/*
Matriz de homogeneización de Recaudación: relaciona, por municipio, el par
(codigo_tributo, descripcion_tributo normalizada) informado por el municipio
con la partida provincial de recursos (mtz_recaudacion_partida).

Se usa esta clave -y no solo municipio+codigo- porque en municipios reales
(ver informes de producción de Centenario, marzo a agosto 2026) el
codigo_tributo puede ser un correlativo que cambia de tributo entre
períodos, mientras que la descripción es estable. Ver docs/sql/2026-09-
matrices-homogeneizacion.sql y el informe final de este trabajo.

// TODO(funcional): la política "advertir vs. impedir" ante cambios o
// inconsistencias del código de tributo sigue sin definición funcional
// cerrada (minuta 03/08/2026, sección "Validaciones", pendiente). Por ahora
// el código de tributo solo forma parte de la clave de homologación; no se
// valida su estabilidad entre períodos.
*/

import { Op, Sequelize } from "sequelize";
import sequelize from "../../config/db.js";
import {
  MtzRecaudacionPartida,
  MtzRecaudacionPartidaHistorial,
  Municipio,
  PartidaRecurso,
  Usuario,
} from "../../models/index.js";
import {
  MatrizError,
  escaparLike,
  registrarHistorial,
  resolverPaginacion,
  validarMunicipioExiste,
  validarPartidaImputable,
} from "./matrizComun.js";

const EN_USO_LITERAL = Sequelize.literal(`EXISTS (
  SELECT 1 FROM ovif_recaudaciones r
   WHERE r.municipio_id = \`MtzRecaudacionPartida\`.\`municipio_id\`
     AND r.codigo_tributo = \`MtzRecaudacionPartida\`.\`codigo_tributo\`
     AND r.descripcion_normalizada = \`MtzRecaudacionPartida\`.\`descripcion_normalizada\`
  UNION ALL
  SELECT 1 FROM ovif_recaudaciones_rectificadas rr
   WHERE rr.municipio_id = \`MtzRecaudacionPartida\`.\`municipio_id\`
     AND rr.codigo_tributo = \`MtzRecaudacionPartida\`.\`codigo_tributo\`
     AND rr.descripcion_normalizada = \`MtzRecaudacionPartida\`.\`descripcion_normalizada\`
)`);

const attributesConEnUso = { include: [[EN_USO_LITERAL, "en_uso"]] };

const includeComun = [
  { model: Municipio, attributes: ["municipio_id", "municipio_nombre"] },
  { model: PartidaRecurso, attributes: ["partidas_recursos_codigo", "partidas_recursos_descripcion"] },
];

export const listarMatrizRecaudacion = async (query) => {
  const { pagina, limite, offset } = resolverPaginacion(query);
  const where = {};

  if (query.municipio_id) {
    const municipioId = Number(query.municipio_id);
    if (Number.isInteger(municipioId) && municipioId > 0) where.municipio_id = municipioId;
  }
  if (query.partida) {
    const partidaId = Number(query.partida);
    if (Number.isInteger(partidaId) && partidaId > 0) where.partida_recursos_codigo = partidaId;
  }
  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    const searchNum = Number(search);
    const condiciones = [{ descripcion_tributo: { [Op.like]: `%${escaparLike(search)}%` } }];
    if (Number.isInteger(searchNum)) condiciones.push({ codigo_tributo: searchNum });
    where[Op.or] = condiciones;
  }

  const { rows, count } = await MtzRecaudacionPartida.findAndCountAll({
    where,
    include: includeComun,
    attributes: attributesConEnUso,
    order: [["municipio_id", "ASC"], ["codigo_tributo", "ASC"]],
    limit: limite,
    offset,
  });

  return {
    total: count,
    pagina,
    limite,
    totalPaginas: limite > 0 ? Math.ceil(count / limite) : 0,
    data: rows,
  };
};

/**
 * Pares (codigo_tributo, descripcion) informados por el municipio en
 * ovif_recaudaciones y/o ovif_recaudaciones_rectificadas que todavía no
 * tienen correspondencia en la matriz, con una sugerencia de partida.
 */
export const listarPendientesRecaudacion = async (query) => {
  await validarMunicipioExiste(query.municipio_id);
  const municipioId = Number(query.municipio_id);
  const { pagina, limite, offset } = resolverPaginacion(query);

  const [informados] = await sequelize.query(
    `SELECT codigo_tributo, MIN(descripcion) AS descripcion_tributo, descripcion_normalizada
       FROM (
         SELECT codigo_tributo, descripcion, descripcion_normalizada
           FROM ovif_recaudaciones WHERE municipio_id = :municipioId
         UNION
         SELECT codigo_tributo, descripcion, descripcion_normalizada
           FROM ovif_recaudaciones_rectificadas WHERE municipio_id = :municipioId
       ) datos_informados
      GROUP BY codigo_tributo, descripcion_normalizada
      ORDER BY codigo_tributo, descripcion_normalizada`,
    { replacements: { municipioId } }
  );

  const matrizExistente = await MtzRecaudacionPartida.findAll({
    where: { municipio_id: municipioId },
    attributes: ["codigo_tributo", "descripcion_normalizada", "partida_recursos_codigo"],
    raw: true,
  });

  const clavesHomologadas = new Set(matrizExistente.map((m) => `${m.codigo_tributo}||${m.descripcion_normalizada}`));
  const partidaPorDescripcion = new Map();
  const partidaPorCodigo = new Map();
  for (const m of matrizExistente) {
    if (!partidaPorDescripcion.has(m.descripcion_normalizada)) partidaPorDescripcion.set(m.descripcion_normalizada, m.partida_recursos_codigo);
    if (!partidaPorCodigo.has(m.codigo_tributo)) partidaPorCodigo.set(m.codigo_tributo, m.partida_recursos_codigo);
  }

  const pendientes = informados.filter((fila) => !clavesHomologadas.has(`${fila.codigo_tributo}||${fila.descripcion_normalizada}`));
  const total = pendientes.length;
  const paginaSlice = pendientes.slice(offset, offset + limite);

  const codigosPartidaSugeridos = new Set(
    paginaSlice
      .map((f) => partidaPorDescripcion.get(f.descripcion_normalizada) ?? partidaPorCodigo.get(f.codigo_tributo))
      .filter(Boolean)
  );
  const partidas = codigosPartidaSugeridos.size
    ? await PartidaRecurso.findAll({
        where: { partidas_recursos_codigo: { [Op.in]: [...codigosPartidaSugeridos] } },
        attributes: ["partidas_recursos_codigo", "partidas_recursos_descripcion"],
        raw: true,
      })
    : [];
  const partidasPorCodigo = new Map(partidas.map((p) => [p.partidas_recursos_codigo, p]));

  const data = paginaSlice.map((fila) => {
    let partidaCodigo = null;
    let motivo = null;
    if (partidaPorDescripcion.has(fila.descripcion_normalizada)) {
      partidaCodigo = partidaPorDescripcion.get(fila.descripcion_normalizada);
      motivo = "La misma descripción ya está homologada con otro código en este municipio";
    } else if (partidaPorCodigo.has(fila.codigo_tributo)) {
      partidaCodigo = partidaPorCodigo.get(fila.codigo_tributo);
      motivo = "Revisar: el código ya está homologado pero con otra descripción";
    }

    return {
      municipio_id: municipioId,
      codigo_tributo: fila.codigo_tributo,
      descripcion_tributo: fila.descripcion_tributo,
      partida_sugerida: partidaCodigo ? partidasPorCodigo.get(partidaCodigo) ?? { partidas_recursos_codigo: partidaCodigo } : null,
      motivo_sugerencia: motivo,
    };
  });

  return {
    total,
    pagina,
    limite,
    totalPaginas: limite > 0 ? Math.ceil(total / limite) : 0,
    data,
  };
};

// Misma expresión de normalización que la columna generada de la base (ver
// docs/sql/2026-09-matrices-homogeneizacion.sql), aplicada acá sobre el
// texto candidato para poder chequear duplicados antes de insertar.
const buscarPorClaveNormalizada = async (municipioId, codigoTributo, descripcionTributo, transaction) => {
  const [rows] = await sequelize.query(
    `SELECT id FROM mtz_recaudacion_partida
      WHERE municipio_id = :municipioId
        AND codigo_tributo = :codigoTributo
        AND descripcion_normalizada = UPPER(TRIM(TRAILING '.' FROM TRIM(REGEXP_REPLACE(REPLACE(:descripcionTributo, '°', 'º'), '[[:space:]]+', ' '))))
      LIMIT 1`,
    { replacements: { municipioId, codigoTributo, descripcionTributo }, transaction }
  );
  return rows[0] ?? null;
};

export const crearMatrizRecaudacion = async (datos, usuarioId) => {
  const { municipio_id, codigo_tributo, descripcion_tributo, partida_recursos_codigo, observaciones } = datos;

  return sequelize.transaction(async (transaction) => {
    await validarMunicipioExiste(municipio_id);
    await validarPartidaImputable(partida_recursos_codigo);

    const existente = await buscarPorClaveNormalizada(municipio_id, codigo_tributo, descripcion_tributo, transaction);
    if (existente) {
      throw new MatrizError(409, "Ya existe una correspondencia para ese municipio, código y descripción de tributo");
    }

    let registro;
    try {
      registro = await MtzRecaudacionPartida.create(
        { municipio_id, codigo_tributo, descripcion_tributo, partida_recursos_codigo, observaciones: observaciones ?? null, usuario_alta_id: usuarioId },
        { transaction }
      );
    } catch (error) {
      if (error?.name === "SequelizeUniqueConstraintError") {
        throw new MatrizError(409, "Ya existe una correspondencia para ese municipio, código y descripción de tributo");
      }
      throw error;
    }
    await registro.reload({ transaction });

    await registrarHistorial(
      MtzRecaudacionPartidaHistorial,
      {
        matriz_id: registro.id,
        municipio_id,
        codigo_tributo,
        descripcion_tributo: registro.descripcion_tributo,
        accion: "ALTA",
        partida_anterior: null,
        partida_nueva: partida_recursos_codigo,
        observaciones: observaciones ?? null,
        usuario_id: usuarioId,
      },
      transaction
    );

    return registro;
  });
};

export const crearLoteMatrizRecaudacion = async (filas, usuarioId) => {
  return sequelize.transaction(async (transaction) => {
    const creados = [];
    const municipiosValidados = new Set();
    const partidasValidadas = new Set();

    for (const fila of filas) {
      const { municipio_id, codigo_tributo, descripcion_tributo, partida_recursos_codigo, observaciones } = fila;

      if (!municipiosValidados.has(municipio_id)) {
        await validarMunicipioExiste(municipio_id);
        municipiosValidados.add(municipio_id);
      }
      if (!partidasValidadas.has(partida_recursos_codigo)) {
        await validarPartidaImputable(partida_recursos_codigo);
        partidasValidadas.add(partida_recursos_codigo);
      }

      const existente = await buscarPorClaveNormalizada(municipio_id, codigo_tributo, descripcion_tributo, transaction);
      if (existente) {
        throw new MatrizError(409, `Ya existe una correspondencia para el municipio ${municipio_id}, código ${codigo_tributo} y esa descripción`);
      }

      const registro = await MtzRecaudacionPartida.create(
        { municipio_id, codigo_tributo, descripcion_tributo, partida_recursos_codigo, observaciones: observaciones ?? null, usuario_alta_id: usuarioId },
        { transaction }
      );
      await registro.reload({ transaction });

      await registrarHistorial(
        MtzRecaudacionPartidaHistorial,
        {
          matriz_id: registro.id,
          municipio_id,
          codigo_tributo,
          descripcion_tributo: registro.descripcion_tributo,
          accion: "ALTA",
          partida_anterior: null,
          partida_nueva: partida_recursos_codigo,
          observaciones: observaciones ?? null,
          usuario_id: usuarioId,
        },
        transaction
      );

      creados.push(registro);
    }

    return creados;
  });
};

export const actualizarMatrizRecaudacion = async (id, datos, usuarioId) => {
  const { partida_recursos_codigo, observaciones } = datos;

  return sequelize.transaction(async (transaction) => {
    const registro = await MtzRecaudacionPartida.findByPk(id, { transaction });
    if (!registro) {
      throw new MatrizError(404, "La correspondencia indicada no existe");
    }

    await validarPartidaImputable(partida_recursos_codigo);

    const partidaAnterior = registro.partida_recursos_codigo;
    registro.partida_recursos_codigo = partida_recursos_codigo;
    registro.observaciones = observaciones ?? null;
    registro.usuario_modificacion_id = usuarioId;
    await registro.save({ transaction });

    await registrarHistorial(
      MtzRecaudacionPartidaHistorial,
      {
        matriz_id: registro.id,
        municipio_id: registro.municipio_id,
        codigo_tributo: registro.codigo_tributo,
        descripcion_tributo: registro.descripcion_tributo,
        accion: "MODIFICACION",
        partida_anterior: partidaAnterior,
        partida_nueva: partida_recursos_codigo,
        observaciones: observaciones ?? null,
        usuario_id: usuarioId,
      },
      transaction
    );

    return registro;
  });
};

export const eliminarMatrizRecaudacion = async (id, usuarioId) => {
  return sequelize.transaction(async (transaction) => {
    const registro = await MtzRecaudacionPartida.findByPk(id, { transaction });
    if (!registro) {
      throw new MatrizError(404, "La correspondencia indicada no existe");
    }

    await registrarHistorial(
      MtzRecaudacionPartidaHistorial,
      {
        matriz_id: registro.id,
        municipio_id: registro.municipio_id,
        codigo_tributo: registro.codigo_tributo,
        descripcion_tributo: registro.descripcion_tributo,
        accion: "BAJA",
        partida_anterior: registro.partida_recursos_codigo,
        partida_nueva: null,
        observaciones: registro.observaciones,
        usuario_id: usuarioId,
      },
      transaction
    );

    await registro.destroy({ transaction });
  });
};

export const historialMatrizRecaudacion = async (id, query) => {
  const registro = await MtzRecaudacionPartida.findByPk(id, { attributes: ["id"] });
  if (!registro) {
    throw new MatrizError(404, "La correspondencia indicada no existe");
  }

  const { pagina, limite, offset } = resolverPaginacion(query);
  const { rows, count } = await MtzRecaudacionPartidaHistorial.findAndCountAll({
    where: { matriz_id: id },
    include: [{ model: Usuario, attributes: ["usuario_id", "nombre", "apellido"] }],
    order: [["fecha", "DESC"]],
    limit: limite,
    offset,
  });

  return {
    total: count,
    pagina,
    limite,
    totalPaginas: limite > 0 ? Math.ceil(count / limite) : 0,
    data: rows,
  };
};
