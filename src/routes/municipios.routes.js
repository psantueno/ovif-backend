import { Router } from "express";
import {
  getMunicipios,
  getMunicipioById,
  createMunicipio,
  updateMunicipio,
  getMunicipiosSelect,
  listarEjerciciosDisponiblesPorMunicipio,
  listarEjerciciosRectificacionesDisponiblesPorMunicipio,
  listarEjerciciosCerradosPorMunicipio,
  obtenerPartidasGastosMunicipio,
  obtenerPartidasRecursosMunicipio,
  obtenerConceptosRecaudacionMunicipio,
  obtenerDeterminacionesTributariasMunicipio,
  upsertGastosMunicipio,
  upsertRecursosMunicipio,
  upsertRecaudacionesMunicipio,
  upsertRemuneracionesMunicipio,
  upsertDeterminacionesTributariasMunicipio,
  generarInformeGastosMunicipio,
  generarInformeRecursosMunicipio,
  generarInformeRecaudacionesMunicipio,
  generarInformeRemuneracionesMunicipio,
  generarInformeDeterminacionTributariaMunicipio,
  upsertRecaudacionesRectificadasMunicipio,
  generarInformeRecaudacionesRectificadasMunicipio,
  upsertRemuneracionesRectificadasMunicipio,
  generarInformeRemuneracionesRectificadasMunicipio,
  crearProrrogaMunicipio,
  deleteMunicipio,
} from "../controllers/municipios.controller.js";

import { authenticateToken } from "../middlewares/auth.js";
import { validarMunicipioAsignado } from "../middlewares/validarMunicipioAsignado.js";
import { validarFechaLimiteDeCargaPorTipo } from "../middlewares/validarFechaLimiteDeCarga.js";
import { validarRectificacionDisponible } from "../middlewares/validarRectificacionDisponible.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { requireSelfOrAdmin } from "../middlewares/requireSelfOrAdmin.js";
import {
  authenticatedUserLimiter,
  pdfGenerationConcurrency,
  pdfGenerationLimiter,
  writeBurstLimiter,
} from "../middlewares/rateLimiters.js";

const router = Router();
const validarFechaLimiteGastosRecursos = validarFechaLimiteDeCargaPorTipo("gastos_recursos");
const validarFechaLimiteRecaudacionesRemuneraciones = validarFechaLimiteDeCargaPorTipo("recaudaciones_remuneraciones");
const validarFechaLimiteDeterminacionTributaria = validarFechaLimiteDeCargaPorTipo("determinacion_tributaria");
const usuarioAutenticado = [authenticateToken, authenticatedUserLimiter];
const escrituraMensual = [authenticateToken, authenticatedUserLimiter, writeBurstLimiter];
const generacionPdf = [authenticateToken, authenticatedUserLimiter, pdfGenerationLimiter, pdfGenerationConcurrency];

// Lista todos los municipios
router.get("/", usuarioAutenticado, requireAdmin,  getMunicipios);

// Lista municipios (id y nombre unicamente)
router.get("/select", usuarioAutenticado, requireAdmin, getMunicipiosSelect);

// Ejercicios abiertos para el municipio
router.get("/:municipioId/ejercicios/disponibles", usuarioAutenticado, validarMunicipioAsignado, listarEjerciciosDisponiblesPorMunicipio);

// Ejercicios rectificables abiertos para el municipio
router.get("/:municipioId/ejercicios/rectificaciones/disponibles", usuarioAutenticado, validarMunicipioAsignado, listarEjerciciosRectificacionesDisponiblesPorMunicipio);

router.get(
  "/:municipioId/ejercicios/cerrados",
  usuarioAutenticado,
  requireSelfOrAdmin,
  listarEjerciciosCerradosPorMunicipio
);

// Partidas de gastos del municipio
router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/gastos/partidas",
  usuarioAutenticado,
  validarMunicipioAsignado,
  obtenerPartidasGastosMunicipio
);

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/gastos/informe",
  generacionPdf,
  validarMunicipioAsignado,
  generarInformeGastosMunicipio
);

// Partidas de recursos

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recursos/partidas",
  usuarioAutenticado,
  validarMunicipioAsignado,
  obtenerPartidasRecursosMunicipio
);

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recursos/informe",
  generacionPdf,
  validarMunicipioAsignado,
  generarInformeRecursosMunicipio
);

// Partidas de recaudaciones

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recaudaciones/conceptos",
  usuarioAutenticado,
  validarMunicipioAsignado,
  obtenerConceptosRecaudacionMunicipio
);

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recaudaciones/informe",
  generacionPdf,
  validarMunicipioAsignado,
  generarInformeRecaudacionesMunicipio
);

// Partidas de remuneraciones

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/remuneraciones/informe",
  generacionPdf,
  validarMunicipioAsignado,
  generarInformeRemuneracionesMunicipio
);

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/determinacion-tributaria",
  usuarioAutenticado,
  validarMunicipioAsignado,
  obtenerDeterminacionesTributariasMunicipio
);

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/determinacion-tributaria/informe",
  generacionPdf,
  validarMunicipioAsignado,
  generarInformeDeterminacionTributariaMunicipio
);

// Upserts
router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/gastos",
  escrituraMensual,
  validarMunicipioAsignado,
  validarFechaLimiteGastosRecursos,
  upsertGastosMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recursos",
  escrituraMensual,
  validarMunicipioAsignado,
  validarFechaLimiteGastosRecursos,
  upsertRecursosMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recaudaciones",
  escrituraMensual,
  validarMunicipioAsignado,
  validarFechaLimiteRecaudacionesRemuneraciones,
  upsertRecaudacionesMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/remuneraciones",
  escrituraMensual,
  validarMunicipioAsignado,
  validarFechaLimiteRecaudacionesRemuneraciones,
  upsertRemuneracionesMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/determinacion-tributaria",
  escrituraMensual,
  validarMunicipioAsignado,
  validarFechaLimiteDeterminacionTributaria,
  upsertDeterminacionesTributariasMunicipio
);

// Rectificaciones
router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recaudaciones-rectificadas",
  escrituraMensual,
  validarMunicipioAsignado,
  validarRectificacionDisponible,
  upsertRecaudacionesRectificadasMunicipio
);

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recaudaciones-rectificadas/informe",
  generacionPdf,
  validarMunicipioAsignado,
  validarRectificacionDisponible,
  generarInformeRecaudacionesRectificadasMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/remuneraciones-rectificadas",
  escrituraMensual,
  validarMunicipioAsignado,
  validarRectificacionDisponible,
  upsertRemuneracionesRectificadasMunicipio
);

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/remuneraciones-rectificadas/informe",
  generacionPdf,
  validarMunicipioAsignado,
  validarRectificacionDisponible,
  generarInformeRemuneracionesRectificadasMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/prorroga",
  escrituraMensual,
  requireAdmin,
  crearProrrogaMunicipio
);

// Buscar municipio por ID
router.get("/:id", usuarioAutenticado, requireAdmin, getMunicipioById);

// Crear municipio 
router.post("/", escrituraMensual, requireAdmin, createMunicipio);

// actualizar municipio
router.put("/:id", escrituraMensual, requireAdmin, updateMunicipio);

// eliminar municipio
router.delete("/:id", escrituraMensual, requireAdmin, deleteMunicipio);

export default router;
