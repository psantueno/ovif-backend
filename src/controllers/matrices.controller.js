import { zodErrorsToArray } from "../utils/zodErrorMessages.js";
import { MatrizError } from "../services/matrices/matrizComun.js";
import * as recursosService from "../services/matrices/matrizRecursos.service.js";
import * as recaudacionService from "../services/matrices/matrizRecaudacion.service.js";
import {
  MtzRecursosPartidaSchema,
  MtzRecursosPartidaUpdateSchema,
  MtzRecaudacionPartidaSchema,
  MtzRecaudacionPartidaUpdateSchema,
  LoteRecursosSchema,
  LoteRecaudacionSchema,
} from "../validation/MatricesSchema.validation.js";

const SERVICIOS = {
  recursos: {
    listar: recursosService.listarMatrizRecursos,
    pendientes: recursosService.listarPendientesRecursos,
    crear: recursosService.crearMatrizRecursos,
    crearLote: recursosService.crearLoteMatrizRecursos,
    actualizar: recursosService.actualizarMatrizRecursos,
    eliminar: recursosService.eliminarMatrizRecursos,
    historial: recursosService.historialMatrizRecursos,
    schemaAlta: MtzRecursosPartidaSchema,
    schemaUpdate: MtzRecursosPartidaUpdateSchema,
    schemaLote: LoteRecursosSchema,
  },
  recaudacion: {
    listar: recaudacionService.listarMatrizRecaudacion,
    pendientes: recaudacionService.listarPendientesRecaudacion,
    crear: recaudacionService.crearMatrizRecaudacion,
    crearLote: recaudacionService.crearLoteMatrizRecaudacion,
    actualizar: recaudacionService.actualizarMatrizRecaudacion,
    eliminar: recaudacionService.eliminarMatrizRecaudacion,
    historial: recaudacionService.historialMatrizRecaudacion,
    schemaAlta: MtzRecaudacionPartidaSchema,
    schemaUpdate: MtzRecaudacionPartidaUpdateSchema,
    schemaLote: LoteRecaudacionSchema,
  },
};

/** Valida :tipo y devuelve el set de funciones/schemas correspondiente, o null (+ 404 ya enviado). */
const resolverTipo = (req, res) => {
  const tipo = SERVICIOS[req.params.tipo];
  if (!tipo) {
    res.status(404).json({ error: "Tipo de matriz no reconocido. Use 'recursos' o 'recaudacion'." });
    return null;
  }
  return tipo;
};

const idDesdeParam = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "El id indicado no es válido" });
    return null;
  }
  return id;
};

const manejarError = (res, error, mensajeGenerico) => {
  if (error instanceof MatrizError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error?.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({ error: "Ya existe una correspondencia con esos datos" });
  }
  if (error?.name === "SequelizeForeignKeyConstraintError") {
    return res.status(400).json({ error: "Referencia inválida (municipio o partida)" });
  }
  console.error("❌", mensajeGenerico, error);
  return res.status(500).json({ error: mensajeGenerico });
};

export const listarMatriz = async (req, res) => {
  const svc = resolverTipo(req, res);
  if (!svc) return;
  try {
    const resultado = await svc.listar(req.query);
    return res.json(resultado);
  } catch (error) {
    return manejarError(res, error, "Error consultando la matriz");
  }
};

export const listarPendientes = async (req, res) => {
  const svc = resolverTipo(req, res);
  if (!svc) return;
  if (!req.query.municipio_id) {
    return res.status(400).json({ error: "El municipio es obligatorio para consultar pendientes" });
  }
  try {
    const resultado = await svc.pendientes(req.query);
    return res.json(resultado);
  } catch (error) {
    return manejarError(res, error, "Error consultando las correspondencias pendientes");
  }
};

export const crearMatriz = async (req, res) => {
  const svc = resolverTipo(req, res);
  if (!svc) return;

  const valid = svc.schemaAlta.safeParse(req.body);
  if (!valid.success) {
    return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(", ") });
  }

  try {
    const usuarioId = req.user?.usuario_id ?? null;
    const registro = await svc.crear(valid.data, usuarioId);
    return res.status(201).json({ message: "Correspondencia creada correctamente", data: registro });
  } catch (error) {
    return manejarError(res, error, "Error creando la correspondencia");
  }
};

export const crearMatrizLote = async (req, res) => {
  const svc = resolverTipo(req, res);
  if (!svc) return;

  const valid = svc.schemaLote.safeParse(req.body);
  if (!valid.success) {
    return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(", ") });
  }

  try {
    const usuarioId = req.user?.usuario_id ?? null;
    const registros = await svc.crearLote(valid.data.filas, usuarioId);
    return res.status(201).json({ message: `${registros.length} correspondencias creadas correctamente`, data: registros });
  } catch (error) {
    return manejarError(res, error, "Error creando el lote de correspondencias");
  }
};

export const actualizarMatriz = async (req, res) => {
  const svc = resolverTipo(req, res);
  if (!svc) return;
  const id = idDesdeParam(req, res);
  if (id === null) return;

  const valid = svc.schemaUpdate.safeParse(req.body);
  if (!valid.success) {
    return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(", ") });
  }

  try {
    const usuarioId = req.user?.usuario_id ?? null;
    const registro = await svc.actualizar(id, valid.data, usuarioId);
    return res.json({ message: "Correspondencia actualizada correctamente", data: registro });
  } catch (error) {
    return manejarError(res, error, "Error actualizando la correspondencia");
  }
};

export const eliminarMatriz = async (req, res) => {
  const svc = resolverTipo(req, res);
  if (!svc) return;
  const id = idDesdeParam(req, res);
  if (id === null) return;

  try {
    const usuarioId = req.user?.usuario_id ?? null;
    await svc.eliminar(id, usuarioId);
    return res.json({ message: "Correspondencia eliminada correctamente" });
  } catch (error) {
    return manejarError(res, error, "Error eliminando la correspondencia");
  }
};

export const historialMatriz = async (req, res) => {
  const svc = resolverTipo(req, res);
  if (!svc) return;
  const id = idDesdeParam(req, res);
  if (id === null) return;

  try {
    const resultado = await svc.historial(id, req.query);
    return res.json(resultado);
  } catch (error) {
    return manejarError(res, error, "Error consultando el historial");
  }
};
