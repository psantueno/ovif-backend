/*
Matriz de homogeneización de Recursos: relaciona, por municipio, el
codigo_recurso informado por el municipio con la partida provincial de
recursos (mtz_recursos_partida). Ver docs/sql/2026-09-matrices-homogeneizacion.sql
y minuta 03/08/2026 punto 2.4.
*/

import { Op, Sequelize } from "sequelize";
import sequelize from "../../config/db.js";
import { MtzRecursosPartida, MtzRecursosPartidaHistorial, Municipio, PartidaRecurso, Recurso, Usuario } from "../../models/index.js";
import {
  MatrizError,
  registrarHistorial,
  resolverPaginacion,
  validarMunicipioExiste,
  validarPartidaImputable,
} from "./matrizComun.js";

const EN_USO_LITERAL = Sequelize.literal(
  `EXISTS (SELECT 1 FROM ovif_recursos r WHERE r.municipio_id = \`MtzRecursosPartida\`.\`municipio_id\` AND r.codigo_recurso = \`MtzRecursosPartida\`.\`codigo_recurso\`)`
);

const attributesConEnUso = {
  include: [[EN_USO_LITERAL, "en_uso"]],
};

const includeComun = [
  { model: Municipio, attributes: ["municipio_id", "municipio_nombre"] },
  { model: PartidaRecurso, attributes: ["partidas_recursos_codigo", "partidas_recursos_descripcion"] },
];

export const listarMatrizRecursos = async (query) => {
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
    // Recursos solo se busca por código (sin descripción, ver minuta 2.4).
    // Si la búsqueda no es numérica, no puede haber resultados.
    const searchNum = Number(search);
    where.codigo_recurso = Number.isInteger(searchNum) ? searchNum : -1;
  }

  const { rows, count } = await MtzRecursosPartida.findAndCountAll({
    where,
    include: includeComun,
    attributes: attributesConEnUso,
    order: [["municipio_id", "ASC"], ["codigo_recurso", "ASC"]],
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
 * Códigos de recurso informados por el municipio (ovif_recursos) que todavía
 * no tienen correspondencia en la matriz.
 */
export const listarPendientesRecursos = async (query) => {
  await validarMunicipioExiste(query.municipio_id);
  const municipioId = Number(query.municipio_id);
  const { pagina, limite, offset } = resolverPaginacion(query);

  const codigosInformados = await Recurso.findAll({
    where: { municipio_id: municipioId },
    attributes: ["codigo_recurso"],
    group: ["codigo_recurso"],
    raw: true,
  });

  const codigosHomologados = await MtzRecursosPartida.findAll({
    where: { municipio_id: municipioId },
    attributes: ["codigo_recurso"],
    raw: true,
  });
  const homologadosSet = new Set(codigosHomologados.map((c) => c.codigo_recurso));

  const pendientes = codigosInformados
    .map((c) => c.codigo_recurso)
    .filter((codigo) => !homologadosSet.has(codigo))
    .sort((a, b) => a - b);

  const paginaSlice = pendientes.slice(offset, offset + limite);

  // Sugerencia: el propio código existe en el catálogo provincial imputable.
  const partidasCatalogo = await PartidaRecurso.findAll({
    where: { partidas_recursos_codigo: { [Op.in]: paginaSlice }, partidas_recursos_carga: true },
    attributes: ["partidas_recursos_codigo", "partidas_recursos_descripcion"],
    raw: true,
  });
  const partidasPorCodigo = new Map(partidasCatalogo.map((p) => [p.partidas_recursos_codigo, p]));

  return {
    total: pendientes.length,
    pagina,
    limite,
    totalPaginas: limite > 0 ? Math.ceil(pendientes.length / limite) : 0,
    data: paginaSlice.map((codigo) => ({
      municipio_id: municipioId,
      codigo_recurso: codigo,
      partida_sugerida: partidasPorCodigo.get(codigo) ?? null,
      motivo_sugerencia: partidasPorCodigo.has(codigo) ? "El código coincide con el catálogo provincial" : null,
    })),
  };
};

const buscarExistente = async (municipioId, codigoRecurso, transaction) =>
  MtzRecursosPartida.findOne({ where: { municipio_id: municipioId, codigo_recurso: codigoRecurso }, transaction });

export const crearMatrizRecursos = async (datos, usuarioId) => {
  const { municipio_id, codigo_recurso, partida_recursos_codigo, observaciones } = datos;

  return sequelize.transaction(async (transaction) => {
    await validarMunicipioExiste(municipio_id);
    await validarPartidaImputable(partida_recursos_codigo);

    const existente = await buscarExistente(municipio_id, codigo_recurso, transaction);
    if (existente) {
      throw new MatrizError(409, "Ya existe una correspondencia para ese municipio y código de recurso");
    }

    let registro;
    try {
      registro = await MtzRecursosPartida.create(
        { municipio_id, codigo_recurso, partida_recursos_codigo, observaciones: observaciones ?? null, usuario_alta_id: usuarioId },
        { transaction }
      );
    } catch (error) {
      if (error?.name === "SequelizeUniqueConstraintError") {
        throw new MatrizError(409, "Ya existe una correspondencia para ese municipio y código de recurso");
      }
      throw error;
    }

    await registrarHistorial(
      MtzRecursosPartidaHistorial,
      {
        matriz_id: registro.id,
        municipio_id,
        codigo_recurso,
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

export const crearLoteMatrizRecursos = async (filas, usuarioId) => {
  return sequelize.transaction(async (transaction) => {
    const creados = [];
    const municipiosValidados = new Set();
    const partidasValidadas = new Set();

    for (const fila of filas) {
      const { municipio_id, codigo_recurso, partida_recursos_codigo, observaciones } = fila;

      if (!municipiosValidados.has(municipio_id)) {
        await validarMunicipioExiste(municipio_id);
        municipiosValidados.add(municipio_id);
      }
      if (!partidasValidadas.has(partida_recursos_codigo)) {
        await validarPartidaImputable(partida_recursos_codigo);
        partidasValidadas.add(partida_recursos_codigo);
      }

      const existente = await buscarExistente(municipio_id, codigo_recurso, transaction);
      if (existente) {
        throw new MatrizError(409, `Ya existe una correspondencia para el municipio ${municipio_id} y código de recurso ${codigo_recurso}`);
      }

      const registro = await MtzRecursosPartida.create(
        { municipio_id, codigo_recurso, partida_recursos_codigo, observaciones: observaciones ?? null, usuario_alta_id: usuarioId },
        { transaction }
      );

      await registrarHistorial(
        MtzRecursosPartidaHistorial,
        {
          matriz_id: registro.id,
          municipio_id,
          codigo_recurso,
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

export const actualizarMatrizRecursos = async (id, datos, usuarioId) => {
  const { partida_recursos_codigo, observaciones } = datos;

  return sequelize.transaction(async (transaction) => {
    const registro = await MtzRecursosPartida.findByPk(id, { transaction });
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
      MtzRecursosPartidaHistorial,
      {
        matriz_id: registro.id,
        municipio_id: registro.municipio_id,
        codigo_recurso: registro.codigo_recurso,
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

export const eliminarMatrizRecursos = async (id, usuarioId) => {
  return sequelize.transaction(async (transaction) => {
    const registro = await MtzRecursosPartida.findByPk(id, { transaction });
    if (!registro) {
      throw new MatrizError(404, "La correspondencia indicada no existe");
    }

    await registrarHistorial(
      MtzRecursosPartidaHistorial,
      {
        matriz_id: registro.id,
        municipio_id: registro.municipio_id,
        codigo_recurso: registro.codigo_recurso,
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

export const historialMatrizRecursos = async (id, query) => {
  const registro = await MtzRecursosPartida.findByPk(id, { attributes: ["id"] });
  if (!registro) {
    throw new MatrizError(404, "La correspondencia indicada no existe");
  }

  const { pagina, limite, offset } = resolverPaginacion(query);
  const { rows, count } = await MtzRecursosPartidaHistorial.findAndCountAll({
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
