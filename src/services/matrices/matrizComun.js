/*
Helpers compartidos entre las matrices de homogeneización (recursos y
recaudación), para no duplicar paginación, validaciones y escritura de
historial entre ambos services.
*/

import { Municipio, PartidaRecurso } from "../../models/index.js";

export const LIMITE_PAGINA_DEFAULT = 10;
export const LIMITE_PAGINA_MAX = 100;
export const LIMITE_LOTE_MAX = 500;

export const resolverPaginacion = (query = {}) => {
  const paginaParsed = Number.parseInt(query.pagina, 10);
  const limiteParsed = Number.parseInt(query.limite, 10);

  const pagina = Number.isFinite(paginaParsed) && paginaParsed > 0 ? paginaParsed : 1;
  let limite = Number.isFinite(limiteParsed) && limiteParsed > 0 ? limiteParsed : LIMITE_PAGINA_DEFAULT;
  if (limite > LIMITE_PAGINA_MAX) limite = LIMITE_PAGINA_MAX;

  return { pagina, limite, offset: (pagina - 1) * limite };
};

/** Escapa % y _ para usar de forma segura dentro de un LIKE con Sequelize. */
export const escaparLike = (valor) => String(valor ?? "").replace(/[%_]/g, (c) => `\\${c}`);

export class MatrizError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const validarMunicipioExiste = async (municipioId) => {
  const id = Number(municipioId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new MatrizError(400, "El municipio indicado no es válido");
  }
  const municipio = await Municipio.findByPk(id, { attributes: ["municipio_id", "municipio_nombre"] });
  if (!municipio) {
    throw new MatrizError(404, "El municipio indicado no existe");
  }
  return municipio;
};

/**
 * Valida que la partida exista y sea imputable (partidas_recursos_carga=1):
 * no se puede homologar contra partidas padre/agregadoras.
 */
export const validarPartidaImputable = async (partidaCodigo) => {
  const id = Number(partidaCodigo);
  if (!Number.isInteger(id) || id <= 0) {
    throw new MatrizError(400, "La partida indicada no es válida");
  }
  const partida = await PartidaRecurso.findByPk(id, {
    attributes: ["partidas_recursos_codigo", "partidas_recursos_descripcion", "partidas_recursos_carga"],
  });
  if (!partida) {
    throw new MatrizError(404, "La partida indicada no existe");
  }
  if (!partida.partidas_recursos_carga) {
    throw new MatrizError(400, "La partida indicada no es imputable (es una partida padre/agregadora)");
  }
  return partida;
};

export const registrarHistorial = async (modeloHistorial, datos, transaction) => {
  await modeloHistorial.create(datos, { transaction });
};
