/*
ABM del catálogo de partidas de recursos (ovif_partidas_recursos).

Reglas de negocio (ver scripts/sql/2026-10-partidas-recursos-abm.sql y
.github/instructions/partidas-recursos.instructions.md):
- Baja lógica (activo); nunca se borran partidas.
- El padre se deduce del código y no se edita.
- Nunca se deja una correspondencia de matriz o un concepto apuntando a una
  partida que ya no se puede asignar: baja y "quitar imputable" se bloquean
  mientras haya referencias; las aperturas se hacen con abrirPartida, que
  reasigna todo en la misma transacción.
- El código solo cambia si la partida nunca fue usada en ningún lado.
- Todo cambio se audita en ovif_partidas_recursos_auditoria (solo inserción)
  dentro de la misma transacción.
- Concurrencia: cada escritura bloquea la fila (FOR UPDATE) y compara los
  valores que el cliente leyó con los actuales.
*/

import { Op, QueryTypes, Sequelize } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import sequelize from "../config/db.js";
import {
  MtzRecaudacionPartida,
  MtzRecaudacionPartidaHistorial,
  MtzRecursosPartida,
  MtzRecursosPartidaHistorial,
  PartidaRecurso,
  PartidaRecursoAuditoria,
  Usuario,
} from "../models/index.js";
import { escaparLike, registrarHistorial, resolverPaginacion } from "./matrices/matrizComun.js";
import {
  admiteHijas,
  calcularCambios,
  derivarPadre,
  nivelPartida,
  reconstruirHistorialPartida,
  snapshotPartida,
} from "../utils/partidasRecursos.js";

export class PartidaRecursoError extends Error {
  constructor(status, message, detalle = null) {
    super(message);
    this.status = status;
    this.detalle = detalle;
  }
}

// ---------------------------------------------------------------------------
// Usos de una partida
// ---------------------------------------------------------------------------

const DESCRIPCION_USOS = {
  matriz_recursos: "correspondencias de la matriz de recursos",
  matriz_recaudacion: "correspondencias de la matriz de recaudación",
  conceptos: "conceptos de recaudación",
  hijas: "partidas de su desagregación",
  historial_matriz_recursos: "el historial de la matriz de recursos",
  historial_matriz_recaudacion: "el historial de la matriz de recaudación",
  carga_historica: "la carga histórica de recursos",
  clasificacion_economica: "la clasificación económica",
};

const SQL_USOS = `
  SELECT
    (SELECT COUNT(*) FROM mtz_recursos_partida WHERE partida_recursos_codigo = :codigo) AS matriz_recursos,
    (SELECT COUNT(*) FROM mtz_recaudacion_partida WHERE partida_recursos_codigo = :codigo) AS matriz_recaudacion,
    (SELECT COUNT(*) FROM ovif_conceptos_recaudacion WHERE cod_recurso = :codigo) AS conceptos,
    (SELECT COUNT(*) FROM ovif_partidas_recursos WHERE partidas_recursos_padre = :codigo) AS hijas,
    (SELECT COUNT(*) FROM ovif_partidas_recursos WHERE partidas_recursos_padre = :codigo AND activo = 1) AS hijas_activas,
    EXISTS (SELECT 1 FROM mtz_recursos_partida_historial WHERE partida_anterior = :codigo OR partida_nueva = :codigo) AS historial_matriz_recursos,
    EXISTS (SELECT 1 FROM mtz_recaudacion_partida_historial WHERE partida_anterior = :codigo OR partida_nueva = :codigo) AS historial_matriz_recaudacion,
    EXISTS (SELECT 1 FROM ovif_recursos_legacy WHERE partidas_recursos_codigo = :codigo) AS carga_historica,
    EXISTS (SELECT 1 FROM ovif_recursos_economico WHERE cod_recurso = :codigo) AS clasificacion_economica`;

const obtenerUsos = async (codigo, transaction) => {
  const [fila] = await sequelize.query(SQL_USOS, {
    replacements: { codigo },
    type: QueryTypes.SELECT,
    transaction,
  });
  const usos = Object.fromEntries(Object.entries(fila).map(([clave, valor]) => [clave, Number(valor)]));
  return {
    ...usos,
    referencias_activas: usos.matriz_recursos + usos.matriz_recaudacion + usos.conceptos,
  };
};

/** Lista legible de los usos que tienen valor, para los mensajes de error. */
const describirUsos = (usos, claves) =>
  claves
    .filter((clave) => usos[clave] > 0)
    .map((clave) => (usos[clave] > 1 ? `${usos[clave]} ${DESCRIPCION_USOS[clave]}` : DESCRIPCION_USOS[clave]));

const CLAVES_REFERENCIAS_ACTIVAS = ["matriz_recursos", "matriz_recaudacion", "conceptos"];
const CLAVES_CUALQUIER_USO = [
  ...CLAVES_REFERENCIAS_ACTIVAS,
  "hijas",
  "historial_matriz_recursos",
  "historial_matriz_recaudacion",
  "carga_historica",
  "clasificacion_economica",
];

// ---------------------------------------------------------------------------
// Helpers de escritura
// ---------------------------------------------------------------------------

const bloquearPartida = async (codigo, transaction) =>
  PartidaRecurso.findByPk(codigo, { transaction, lock: transaction.LOCK.UPDATE });

const obtenerPartidaBloqueada = async (codigo, transaction) => {
  const fila = await bloquearPartida(codigo, transaction);
  if (!fila) {
    throw new PartidaRecursoError(404, `La partida ${codigo} no existe`);
  }
  return fila;
};

/** Control de concurrencia: la fila tiene que seguir como el cliente la leyó. */
const verificarOriginal = (fila, original) => {
  const coincide =
    fila.partidas_recursos_descripcion === original.partidas_recursos_descripcion &&
    Boolean(fila.partidas_recursos_sl) === original.partidas_recursos_sl &&
    Boolean(fila.partidas_recursos_carga) === original.partidas_recursos_carga &&
    Boolean(fila.activo) === original.activo;
  if (!coincide) {
    throw new PartidaRecursoError(
      409,
      `Otro usuario modificó la partida ${fila.partidas_recursos_codigo} mientras la editabas. Recargá la fila y volvé a aplicar el cambio.`,
      { motivo: "concurrencia", actual: snapshotPartida(fila) }
    );
  }
};

/** Valida que `padre` pueda recibir una partida hija nueva o reactivada. */
const validarPadreParaHija = async (padre, transaction) => {
  if (padre === 0) return null;
  const filaPadre = await bloquearPartida(padre, transaction);
  if (!filaPadre) {
    throw new PartidaRecursoError(400, `La partida padre ${padre} no existe. Creala primero.`);
  }
  if (!filaPadre.activo) {
    throw new PartidaRecursoError(409, `La partida padre ${padre} está dada de baja. Reactivala primero.`);
  }
  if (filaPadre.partidas_recursos_carga) {
    throw new PartidaRecursoError(
      409,
      `La partida padre ${padre} es imputable. Para desagregarla usá "Abrir partida", que reasigna sus correspondencias.`
    );
  }
  return filaPadre;
};

const descripcionUsuario = async (usuarioId, transaction) => {
  if (!usuarioId) return null;
  const usuario = await Usuario.findByPk(usuarioId, { attributes: ["nombre", "apellido", "email"], transaction });
  if (!usuario) return null;
  const nombre = [usuario.nombre, usuario.apellido].filter(Boolean).join(" ").trim();
  return (nombre || usuario.email || null)?.slice(0, 255) ?? null;
};

const registrarAuditoria = async (datos, autor, transaction) =>
  PartidaRecursoAuditoria.create(
    {
      partida_codigo: datos.partida_codigo,
      partida_codigo_anterior: datos.partida_codigo_anterior ?? null,
      accion: datos.accion,
      operacion_id: datos.operacion_id ?? null,
      datos_anteriores: datos.datos_anteriores ?? null,
      datos_nuevos: datos.datos_nuevos ?? null,
      observaciones: datos.observaciones ?? null,
      usuario_id: autor.usuarioId ?? null,
      usuario_descripcion: autor.descripcion,
    },
    { transaction }
  );

const conTransaccion = (fn) =>
  sequelize.transaction(async (transaction) => {
    try {
      return await fn(transaction);
    } catch (error) {
      if (error?.name === "SequelizeUniqueConstraintError") {
        throw new PartidaRecursoError(409, "Ya existe una partida con ese código");
      }
      throw error;
    }
  });

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

const COLUMNA_CODIGO = "`PartidaRecurso`.`partidas_recursos_codigo`";
const LIMITE_CATALOGO_COMPLETO = 2000;

const ATRIBUTOS_LISTADO = {
  include: [
    [
      Sequelize.literal(
        `(SELECT COUNT(*) FROM ovif_partidas_recursos h WHERE h.partidas_recursos_padre = ${COLUMNA_CODIGO} AND h.activo = 1)`
      ),
      "hijas_activas",
    ],
    [Sequelize.literal(`(SELECT COUNT(*) FROM mtz_recursos_partida m WHERE m.partida_recursos_codigo = ${COLUMNA_CODIGO})`), "matriz_recursos"],
    [Sequelize.literal(`(SELECT COUNT(*) FROM mtz_recaudacion_partida m WHERE m.partida_recursos_codigo = ${COLUMNA_CODIGO})`), "matriz_recaudacion"],
    [Sequelize.literal(`(SELECT COUNT(*) FROM ovif_conceptos_recaudacion c WHERE c.cod_recurso = ${COLUMNA_CODIGO})`), "conceptos"],
    [
      Sequelize.literal(`(
        EXISTS (SELECT 1 FROM ovif_partidas_recursos h WHERE h.partidas_recursos_padre = ${COLUMNA_CODIGO})
        OR EXISTS (SELECT 1 FROM mtz_recursos_partida m WHERE m.partida_recursos_codigo = ${COLUMNA_CODIGO})
        OR EXISTS (SELECT 1 FROM mtz_recaudacion_partida m WHERE m.partida_recursos_codigo = ${COLUMNA_CODIGO})
        OR EXISTS (SELECT 1 FROM ovif_conceptos_recaudacion c WHERE c.cod_recurso = ${COLUMNA_CODIGO})
        OR EXISTS (SELECT 1 FROM mtz_recursos_partida_historial mh WHERE mh.partida_anterior = ${COLUMNA_CODIGO} OR mh.partida_nueva = ${COLUMNA_CODIGO})
        OR EXISTS (SELECT 1 FROM mtz_recaudacion_partida_historial mh WHERE mh.partida_anterior = ${COLUMNA_CODIGO} OR mh.partida_nueva = ${COLUMNA_CODIGO})
        OR EXISTS (SELECT 1 FROM ovif_recursos_legacy l WHERE l.partidas_recursos_codigo = ${COLUMNA_CODIGO})
        OR EXISTS (SELECT 1 FROM ovif_recursos_economico e WHERE e.cod_recurso = ${COLUMNA_CODIGO})
      )`),
      "con_usos",
    ],
  ],
};

const presentarFila = (fila) => {
  const datos = fila.get({ plain: true });
  const codigo = Number(datos.partidas_recursos_codigo);
  const hijasActivas = Number(datos.hijas_activas ?? 0);
  const matrizRecursos = Number(datos.matriz_recursos ?? 0);
  const matrizRecaudacion = Number(datos.matriz_recaudacion ?? 0);
  const conceptos = Number(datos.conceptos ?? 0);
  return {
    partidas_recursos_codigo: codigo,
    partidas_recursos_descripcion: datos.partidas_recursos_descripcion,
    partidas_recursos_padre: Number(datos.partidas_recursos_padre),
    partidas_recursos_sl: Boolean(datos.partidas_recursos_sl),
    partidas_recursos_carga: Boolean(datos.partidas_recursos_carga),
    activo: Boolean(datos.activo),
    nivel: nivelPartida(codigo),
    admite_hijas: admiteHijas(codigo),
    hijas_activas: hijasActivas,
    referencias: { matriz_recursos: matrizRecursos, matriz_recaudacion: matrizRecaudacion, conceptos },
    en_uso: matrizRecursos + matrizRecaudacion + conceptos > 0,
    codigo_editable: !Number(datos.con_usos ?? 0),
    imputable_con_hijas: Boolean(datos.partidas_recursos_carga) && hijasActivas > 0,
  };
};

export const listarPartidas = async (query = {}) => {
  const { pagina, limite, offset } = resolverPaginacion(query);
  const where = {};

  const estado = typeof query.estado === "string" ? query.estado : "todas";
  if (estado === "activas") where.activo = true;
  if (estado === "inactivas") where.activo = false;

  if (query.imputable === "1" || query.imputable === "true") where.partidas_recursos_carga = true;
  if (query.imputable === "0" || query.imputable === "false") where.partidas_recursos_carga = false;

  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    const patron = `%${escaparLike(search)}%`;
    const condiciones = [{ partidas_recursos_descripcion: { [Op.like]: patron } }];
    if (/^\d+$/.test(search)) {
      condiciones.push(
        Sequelize.where(Sequelize.cast(Sequelize.col("partidas_recursos_codigo"), "CHAR"), { [Op.like]: `${search}%` })
      );
    }
    where[Op.or] = condiciones;
  }

  // ?todas=1 devuelve el catálogo completo (129 filas a 2026-10): la pantalla
  // lo muestra como árbol y filtra en el cliente, y la paginación cortaría la
  // jerarquía. El tope evita respuestas desmedidas si el catálogo creciera.
  const todas = query.todas === "1" || query.todas === "true";
  const { rows, count } = await PartidaRecurso.findAndCountAll({
    where,
    attributes: ATRIBUTOS_LISTADO,
    order: [["partidas_recursos_codigo", "ASC"]],
    limit: todas ? LIMITE_CATALOGO_COMPLETO : limite,
    offset: todas ? 0 : offset,
  });

  return {
    total: count,
    pagina: todas ? 1 : pagina,
    limite: todas ? LIMITE_CATALOGO_COMPLETO : limite,
    totalPaginas: todas ? 1 : limite > 0 ? Math.ceil(count / limite) : 0,
    data: rows.map(presentarFila),
  };
};

const obtenerPartidaPresentada = async (codigo, transaction) => {
  const fila = await PartidaRecurso.findByPk(codigo, { attributes: ATRIBUTOS_LISTADO, transaction });
  return fila ? presentarFila(fila) : null;
};

/**
 * Catálogo para selects: solo activas (y opcionalmente imputables). `incluir`
 * agrega un código aunque esté inactivo, para que un diálogo de edición
 * pueda mostrar el valor actual de una correspondencia o concepto.
 */
export const listarParaSelect = async ({ soloImputables = false, incluir = null } = {}) => {
  const condicionVigentes = { activo: true };
  if (soloImputables) condicionVigentes.partidas_recursos_carga = true;
  const where = incluir ? { [Op.or]: [condicionVigentes, { partidas_recursos_codigo: incluir }] } : condicionVigentes;

  return PartidaRecurso.findAll({
    where,
    attributes: ["partidas_recursos_codigo", "partidas_recursos_descripcion", "partidas_recursos_carga", "activo"],
    order: [["partidas_recursos_codigo", "ASC"]],
  });
};

/** Referencias que hoy apuntan a la partida, para armar el asistente de apertura. */
export const obtenerReferencias = async (codigo) => {
  const partida = await PartidaRecurso.findByPk(codigo, { attributes: ["partidas_recursos_codigo"] });
  if (!partida) throw new PartidaRecursoError(404, `La partida ${codigo} no existe`);

  const [recursos, recaudacion, conceptos] = await Promise.all([
    MtzRecursosPartida.findAll({
      where: { partida_recursos_codigo: codigo },
      attributes: ["id", "municipio_id", "codigo_recurso"],
      include: [{ association: "Municipio", attributes: ["municipio_nombre"] }],
      order: [["municipio_id", "ASC"], ["codigo_recurso", "ASC"]],
    }),
    MtzRecaudacionPartida.findAll({
      where: { partida_recursos_codigo: codigo },
      attributes: ["id", "municipio_id", "codigo_tributo", "descripcion_tributo"],
      include: [{ association: "Municipio", attributes: ["municipio_nombre"] }],
      order: [["municipio_id", "ASC"], ["codigo_tributo", "ASC"]],
    }),
    // Consulta directa: el modelo ConceptoRecaudacion declara una clave
    // (cod_concepto) que la tabla real no tiene.
    sequelize.query(
      `SELECT municipio_id, codigo_tributo, descripcion
         FROM ovif_conceptos_recaudacion
        WHERE cod_recurso = :codigo
        ORDER BY municipio_id, codigo_tributo`,
      { replacements: { codigo }, type: QueryTypes.SELECT }
    ),
  ]);

  return { recursos, recaudacion, conceptos };
};

export const historialPartida = async (codigo, query = {}) => {
  const partida = await PartidaRecurso.findByPk(codigo, { attributes: ["partidas_recursos_codigo"] });
  if (!partida) throw new PartidaRecursoError(404, `La partida ${codigo} no existe`);

  const cargarFilas = async (codigoTramo) =>
    (await PartidaRecursoAuditoria.findAll({ where: { partida_codigo: codigoTramo } })).map((fila) => fila.toJSON());

  const filas = await reconstruirHistorialPartida(codigo, cargarFilas);
  const { pagina, limite, offset } = resolverPaginacion(query);

  return {
    total: filas.length,
    pagina,
    limite,
    totalPaginas: limite > 0 ? Math.ceil(filas.length / limite) : 0,
    data: filas.slice(offset, offset + limite).map((fila) => ({
      ...fila,
      cambios: calcularCambios(fila.datos_anteriores, fila.datos_nuevos),
    })),
  };
};

// ---------------------------------------------------------------------------
// Alta, modificación, baja/reactivación
// ---------------------------------------------------------------------------

export const crearPartida = async (datos, usuarioId) =>
  conTransaccion(async (transaction) => {
    const codigo = datos.partidas_recursos_codigo;

    if (await bloquearPartida(codigo, transaction)) {
      throw new PartidaRecursoError(409, `Ya existe la partida ${codigo}`);
    }

    const padre = derivarPadre(codigo);
    await validarPadreParaHija(padre, transaction);

    const fila = await PartidaRecurso.create(
      {
        partidas_recursos_codigo: codigo,
        partidas_recursos_descripcion: datos.partidas_recursos_descripcion,
        partidas_recursos_padre: padre,
        partidas_recursos_sl: datos.partidas_recursos_sl,
        partidas_recursos_carga: datos.partidas_recursos_carga,
        activo: true,
      },
      { transaction }
    );

    const autor = { usuarioId, descripcion: await descripcionUsuario(usuarioId, transaction) };
    await registrarAuditoria({ partida_codigo: codigo, accion: "ALTA", datos_nuevos: snapshotPartida(fila) }, autor, transaction);

    return obtenerPartidaPresentada(codigo, transaction);
  });

export const actualizarPartida = async (codigo, datos, usuarioId) =>
  conTransaccion(async (transaction) => {
    const fila = await obtenerPartidaBloqueada(codigo, transaction);
    verificarOriginal(fila, datos.original);

    const antes = snapshotPartida(fila);
    const nuevoCodigo = datos.partidas_recursos_codigo;
    const cambiaCodigo = nuevoCodigo !== codigo;
    const usos = await obtenerUsos(codigo, transaction);

    let padre = antes.padre;
    if (cambiaCodigo) {
      const impedimentos = describirUsos(usos, CLAVES_CUALQUIER_USO);
      if (impedimentos.length) {
        throw new PartidaRecursoError(
          409,
          `El código no se puede cambiar porque la partida está en uso en: ${impedimentos.join(", ")}.`,
          { motivo: "en_uso", usos }
        );
      }
      if (await bloquearPartida(nuevoCodigo, transaction)) {
        throw new PartidaRecursoError(409, `Ya existe la partida ${nuevoCodigo}`);
      }
      padre = derivarPadre(nuevoCodigo);
      // Ej.: 13200000 → 13210000. El padre derivado sería la propia fila, que
      // tras el UPDATE deja de existir: la partida quedaría huérfana.
      if (padre === codigo) {
        throw new PartidaRecursoError(
          409,
          `El código ${nuevoCodigo} corresponde a una desagregación de la propia partida ${codigo}. Para desagregarla creá una partida nueva del nivel inferior.`
        );
      }
      if (padre !== antes.padre) {
        await validarPadreParaHija(padre, transaction);
      }
    }

    if (antes.carga && !datos.partidas_recursos_carga && usos.referencias_activas > 0) {
      throw new PartidaRecursoError(
        409,
        `No se puede quitar "Imputable": la partida está asignada en ${describirUsos(usos, CLAVES_REFERENCIAS_ACTIVAS).join(", ")}. Reasignalas antes.`,
        { motivo: "en_uso", usos }
      );
    }
    if (!antes.carga && datos.partidas_recursos_carga && usos.hijas_activas > 0) {
      throw new PartidaRecursoError(
        409,
        `No se puede marcar como imputable: la partida posee desagregación activa (${usos.hijas_activas} partida(s) del nivel inferior).`,
        { motivo: "tiene_hijas", usos }
      );
    }

    const valores = {
      partidas_recursos_codigo: nuevoCodigo,
      partidas_recursos_descripcion: datos.partidas_recursos_descripcion,
      partidas_recursos_padre: padre,
      partidas_recursos_sl: datos.partidas_recursos_sl,
      partidas_recursos_carga: datos.partidas_recursos_carga,
    };
    const despues = snapshotPartida({ ...valores, activo: antes.activo });
    const cambios = calcularCambios(antes, despues);
    if (!cambios.length) {
      return { partida: await obtenerPartidaPresentada(codigo, transaction), cambios };
    }

    await PartidaRecurso.update(valores, { where: { partidas_recursos_codigo: codigo }, transaction });

    const autor = { usuarioId, descripcion: await descripcionUsuario(usuarioId, transaction) };
    await registrarAuditoria(
      {
        partida_codigo: nuevoCodigo,
        partida_codigo_anterior: cambiaCodigo ? codigo : null,
        accion: "MODIFICACION",
        datos_anteriores: antes,
        datos_nuevos: despues,
      },
      autor,
      transaction
    );

    return { partida: await obtenerPartidaPresentada(nuevoCodigo, transaction), cambios };
  });

export const cambiarEstadoPartida = async (codigo, datos, usuarioId) =>
  conTransaccion(async (transaction) => {
    const fila = await obtenerPartidaBloqueada(codigo, transaction);
    verificarOriginal(fila, datos.original);

    const antes = snapshotPartida(fila);
    if (antes.activo === datos.activo) {
      throw new PartidaRecursoError(409, `La partida ${codigo} ya está ${datos.activo ? "activa" : "dada de baja"}.`);
    }

    if (!datos.activo) {
      const usos = await obtenerUsos(codigo, transaction);
      if (usos.referencias_activas > 0) {
        throw new PartidaRecursoError(
          409,
          `No se puede dar de baja: la partida está asignada en ${describirUsos(usos, CLAVES_REFERENCIAS_ACTIVAS).join(", ")}. Reasignalas antes.`,
          { motivo: "en_uso", usos }
        );
      }
      if (usos.hijas_activas > 0) {
        throw new PartidaRecursoError(
          409,
          `No se puede dar de baja: la partida posee desagregación activa (${usos.hijas_activas} partida(s) del nivel inferior). Dalas de baja primero.`,
          { motivo: "tiene_hijas", usos }
        );
      }
    } else {
      await validarPadreParaHija(antes.padre, transaction);
    }

    await PartidaRecurso.update({ activo: datos.activo }, { where: { partidas_recursos_codigo: codigo }, transaction });

    const autor = { usuarioId, descripcion: await descripcionUsuario(usuarioId, transaction) };
    await registrarAuditoria(
      {
        partida_codigo: codigo,
        accion: datos.activo ? "REACTIVACION" : "BAJA",
        datos_anteriores: antes,
        datos_nuevos: { ...antes, activo: datos.activo },
      },
      autor,
      transaction
    );

    return obtenerPartidaPresentada(codigo, transaction);
  });

// ---------------------------------------------------------------------------
// Abrir partida (desagregar un nivel)
// ---------------------------------------------------------------------------

const idsIguales = (actuales, pedidos) => {
  if (actuales.length !== pedidos.length) return false;
  const conjunto = new Set(actuales);
  return pedidos.every((id) => conjunto.has(id));
};

const agruparPorDestino = (filas, clave) => {
  const grupos = new Map();
  for (const fila of filas) {
    const destino = fila.partida_recursos_codigo;
    if (!grupos.has(destino)) grupos.set(destino, []);
    grupos.get(destino).push(fila[clave]);
  }
  return grupos;
};

/**
 * Desagrega una partida imputable: crea sus hijas, reasigna todas sus
 * correspondencias y conceptos, y la deja como agrupadora, en una sola
 * transacción. Si alguna referencia queda sin reasignar, no se aplica nada.
 *
 * Las matrices no tienen vigencia: la reasignación vale para todos los
 * períodos. La carga histórica (ovif_recursos_legacy) no se toca y conserva
 * los importes en el código del padre.
 */
export const abrirPartida = async (codigo, datos, usuarioId) =>
  conTransaccion(async (transaction) => {
    const padre = await obtenerPartidaBloqueada(codigo, transaction);
    verificarOriginal(padre, datos.original);

    if (!padre.activo) {
      throw new PartidaRecursoError(409, `La partida ${codigo} está dada de baja.`);
    }
    if (!padre.partidas_recursos_carga) {
      throw new PartidaRecursoError(
        409,
        `La partida ${codigo} no es imputable. Su desagregación se crea con el alta común ("Agregar desagregación").`
      );
    }
    if (!admiteHijas(codigo)) {
      throw new PartidaRecursoError(400, `La partida ${codigo} es un subconcepto: el último nivel no admite aperturas.`);
    }

    // Hijas: derivan de este padre y no existen.
    const codigosHijas = datos.hijas.map((hija) => hija.partidas_recursos_codigo);
    const fueraDeLaPartida = codigosHijas.filter((hijaCodigo) => derivarPadre(hijaCodigo) !== codigo);
    if (fueraDeLaPartida.length) {
      throw new PartidaRecursoError(400, `Estos códigos no corresponden al nivel inferior de ${codigo}: ${fueraDeLaPartida.join(", ")}.`);
    }
    const existentes = await PartidaRecurso.findAll({
      where: { partidas_recursos_codigo: codigosHijas },
      attributes: ["partidas_recursos_codigo"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existentes.length) {
      throw new PartidaRecursoError(
        409,
        `Ya existen las partidas: ${existentes.map((fila) => fila.partidas_recursos_codigo).join(", ")}.`
      );
    }

    // Referencias actuales del padre, bloqueadas: el pedido tiene que cubrirlas todas.
    const [recursos, recaudacion, conceptos] = await Promise.all([
      MtzRecursosPartida.findAll({ where: { partida_recursos_codigo: codigo }, transaction, lock: transaction.LOCK.UPDATE }),
      MtzRecaudacionPartida.findAll({ where: { partida_recursos_codigo: codigo }, transaction, lock: transaction.LOCK.UPDATE }),
      sequelize.query("SELECT cod_recurso FROM ovif_conceptos_recaudacion WHERE cod_recurso = :codigo FOR UPDATE", {
        replacements: { codigo },
        type: QueryTypes.SELECT,
        transaction,
      }),
    ]);
    const { reasignaciones } = datos;
    const conceptosDestino = conceptos.length ? reasignaciones.conceptos_destino : null;
    const coberturaCompleta =
      idsIguales(recursos.map((fila) => fila.id), reasignaciones.recursos.map((fila) => fila.id)) &&
      idsIguales(recaudacion.map((fila) => fila.id), reasignaciones.recaudacion.map((fila) => fila.id)) &&
      (conceptos.length === 0 || conceptosDestino !== null);
    if (!coberturaCompleta) {
      throw new PartidaRecursoError(
        409,
        "Las correspondencias o conceptos de la partida cambiaron desde que abriste el asistente, o falta reasignar alguno. Recargá y volvé a intentar.",
        { motivo: "cobertura" }
      );
    }

    // Destinos: una hija nueva o una partida existente imputable y activa.
    const nuevas = new Set(codigosHijas);
    const destinos = new Set([
      ...reasignaciones.recursos.map((fila) => fila.partida_recursos_codigo),
      ...reasignaciones.recaudacion.map((fila) => fila.partida_recursos_codigo),
      ...(conceptosDestino !== null ? [conceptosDestino] : []),
    ]);
    if (destinos.has(codigo)) {
      throw new PartidaRecursoError(400, `No se puede reasignar a la misma partida ${codigo}: deja de ser imputable.`);
    }
    const destinosExistentes = [...destinos].filter((destino) => !nuevas.has(destino));
    if (destinosExistentes.length) {
      const filasDestino = await PartidaRecurso.findAll({
        where: { partidas_recursos_codigo: destinosExistentes },
        transaction,
        lock: transaction.LOCK.SHARE,
      });
      const validos = new Set(
        filasDestino.filter((fila) => fila.activo && fila.partidas_recursos_carga).map((fila) => fila.partidas_recursos_codigo)
      );
      const invalidos = destinosExistentes.filter((destino) => !validos.has(destino));
      if (invalidos.length) {
        throw new PartidaRecursoError(400, `Estas partidas destino no existen, no son imputables o están inactivas: ${invalidos.join(", ")}.`);
      }
    }

    const operacionId = uuidv4();
    const observacion = `Apertura de partida ${codigo}`;
    const autor = { usuarioId, descripcion: await descripcionUsuario(usuarioId, transaction) };

    // 1. Hijas
    const hijasCreadas = await PartidaRecurso.bulkCreate(
      datos.hijas.map((hija) => ({
        partidas_recursos_codigo: hija.partidas_recursos_codigo,
        partidas_recursos_descripcion: hija.partidas_recursos_descripcion,
        partidas_recursos_padre: codigo,
        partidas_recursos_sl: hija.partidas_recursos_sl,
        partidas_recursos_carga: true,
        activo: true,
      })),
      { transaction }
    );

    // 2. Matrices, agrupadas por destino, con su historial
    const recursosPorId = new Map(recursos.map((fila) => [fila.id, fila]));
    for (const [destino, ids] of agruparPorDestino(reasignaciones.recursos, "id")) {
      await MtzRecursosPartida.update(
        { partida_recursos_codigo: destino, usuario_modificacion_id: usuarioId },
        { where: { id: ids }, transaction }
      );
      for (const id of ids) {
        const fila = recursosPorId.get(id);
        await registrarHistorial(
          MtzRecursosPartidaHistorial,
          {
            matriz_id: id,
            municipio_id: fila.municipio_id,
            codigo_recurso: fila.codigo_recurso,
            accion: "MODIFICACION",
            partida_anterior: codigo,
            partida_nueva: destino,
            observaciones: observacion,
            usuario_id: usuarioId,
          },
          transaction
        );
      }
    }

    const recaudacionPorId = new Map(recaudacion.map((fila) => [fila.id, fila]));
    for (const [destino, ids] of agruparPorDestino(reasignaciones.recaudacion, "id")) {
      await MtzRecaudacionPartida.update(
        { partida_recursos_codigo: destino, usuario_modificacion_id: usuarioId },
        { where: { id: ids }, transaction }
      );
      for (const id of ids) {
        const fila = recaudacionPorId.get(id);
        await registrarHistorial(
          MtzRecaudacionPartidaHistorial,
          {
            matriz_id: id,
            municipio_id: fila.municipio_id,
            codigo_tributo: fila.codigo_tributo,
            descripcion_tributo: fila.descripcion_tributo,
            accion: "MODIFICACION",
            partida_anterior: codigo,
            partida_nueva: destino,
            observaciones: observacion,
            usuario_id: usuarioId,
          },
          transaction
        );
      }
    }

    // 3. Conceptos (todos al mismo destino; la tabla no tiene clave primaria)
    if (conceptosDestino !== null) {
      await sequelize.query("UPDATE ovif_conceptos_recaudacion SET cod_recurso = :destino WHERE cod_recurso = :codigo", {
        replacements: { destino: conceptosDestino, codigo },
        transaction,
      });
    }

    // 4. El padre pasa a agrupador
    const antesPadre = snapshotPartida(padre);
    await PartidaRecurso.update(
      { partidas_recursos_carga: false, partidas_recursos_sl: false },
      { where: { partidas_recursos_codigo: codigo }, transaction }
    );

    // 5. Auditoría como un único evento
    const resumen =
      `${observacion}: ${hijasCreadas.length} partida(s) de desagregación, ` +
      `${reasignaciones.recursos.length} correspondencia(s) de recursos, ` +
      `${reasignaciones.recaudacion.length} de recaudación y ${conceptos.length} concepto(s) reasignados.` +
      (datos.observaciones ? ` ${datos.observaciones}` : "");

    for (const hija of hijasCreadas) {
      await registrarAuditoria(
        {
          partida_codigo: hija.partidas_recursos_codigo,
          accion: "ALTA",
          operacion_id: operacionId,
          datos_nuevos: snapshotPartida(hija),
          observaciones: observacion,
        },
        autor,
        transaction
      );
    }
    await registrarAuditoria(
      {
        partida_codigo: codigo,
        accion: "MODIFICACION",
        operacion_id: operacionId,
        datos_anteriores: antesPadre,
        datos_nuevos: { ...antesPadre, carga: false, sl: false },
        observaciones: resumen.slice(0, 500),
      },
      autor,
      transaction
    );

    return {
      operacion_id: operacionId,
      partida: await obtenerPartidaPresentada(codigo, transaction),
      hijas: codigosHijas,
      reasignadas: {
        recursos: reasignaciones.recursos.length,
        recaudacion: reasignaciones.recaudacion.length,
        conceptos: conceptos.length,
      },
    };
  });
