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
  obtenerConceptosRecaudacionRectificadaMunicipio,
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

const router = Router();
const validarFechaLimiteGastosRecursos = validarFechaLimiteDeCargaPorTipo("gastos_recursos");
const validarFechaLimiteRecaudacionesRemuneraciones = validarFechaLimiteDeCargaPorTipo("recaudaciones_remuneraciones");
const validarFechaLimiteDeterminacionTributaria = validarFechaLimiteDeCargaPorTipo("determinacion_tributaria");

// Lista todos los municipios
router.get("/", authenticateToken, requireAdmin,  getMunicipios);

// Lista municipios (id y nombre unicamente)
router.get("/select", authenticateToken, requireAdmin, getMunicipiosSelect);

// Ejercicios abiertos para el municipio
router.get("/:municipioId/ejercicios/disponibles", authenticateToken, validarMunicipioAsignado, listarEjerciciosDisponiblesPorMunicipio);

// Ejercicios rectificables abiertos para el municipio
router.get("/:municipioId/ejercicios/rectificaciones/disponibles", authenticateToken, validarMunicipioAsignado, listarEjerciciosRectificacionesDisponiblesPorMunicipio);

router.get(
  "/:municipioId/ejercicios/cerrados",
  authenticateToken,
  requireSelfOrAdmin,
  listarEjerciciosCerradosPorMunicipio
);

// Partidas de gastos del municipio
router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/gastos/partidas",
  authenticateToken,
  validarMunicipioAsignado,
  obtenerPartidasGastosMunicipio
);

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/gastos/informe",
  authenticateToken,
  validarMunicipioAsignado,
  generarInformeGastosMunicipio
);

// Partidas de recursos

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recursos/partidas",
  authenticateToken,
  validarMunicipioAsignado,
  obtenerPartidasRecursosMunicipio
);

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recursos/informe",
  authenticateToken,
  validarMunicipioAsignado,
  generarInformeRecursosMunicipio
);

// Partidas de recaudaciones

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recaudaciones/conceptos",
  authenticateToken,
  validarMunicipioAsignado,
  obtenerConceptosRecaudacionMunicipio
);

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recaudaciones/informe",
  authenticateToken,
  validarMunicipioAsignado,
  generarInformeRecaudacionesMunicipio
);

// Partidas de remuneraciones

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/remuneraciones/informe",
  authenticateToken,
  validarMunicipioAsignado,
  generarInformeRemuneracionesMunicipio
);

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/determinacion-tributaria",
  authenticateToken,
  validarMunicipioAsignado,
  obtenerDeterminacionesTributariasMunicipio
);

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/determinacion-tributaria/informe",
  authenticateToken,
  validarMunicipioAsignado,
  generarInformeDeterminacionTributariaMunicipio
);

// Upserts
router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/gastos",
  authenticateToken,
  validarMunicipioAsignado,
  validarFechaLimiteGastosRecursos,
  upsertGastosMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recursos",
  authenticateToken,
  validarMunicipioAsignado,
  validarFechaLimiteGastosRecursos,
  upsertRecursosMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recaudaciones",
  authenticateToken,
  validarMunicipioAsignado,
  validarFechaLimiteRecaudacionesRemuneraciones,
  upsertRecaudacionesMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/remuneraciones",
  authenticateToken,
  validarMunicipioAsignado,
  validarFechaLimiteRecaudacionesRemuneraciones,
  upsertRemuneracionesMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/determinacion-tributaria",
  authenticateToken,
  validarMunicipioAsignado,
  validarFechaLimiteDeterminacionTributaria,
  upsertDeterminacionesTributariasMunicipio
);

// Rectificaciones

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recaudaciones-rectificadas/conceptos",
  authenticateToken,
  validarMunicipioAsignado,
  validarRectificacionDisponible,
  obtenerConceptosRecaudacionRectificadaMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recaudaciones-rectificadas",
  authenticateToken,
  validarMunicipioAsignado,
  validarRectificacionDisponible,
  upsertRecaudacionesRectificadasMunicipio
);

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recaudaciones-rectificadas/informe",
  authenticateToken,
  validarMunicipioAsignado,
  validarRectificacionDisponible,
  generarInformeRecaudacionesRectificadasMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/remuneraciones-rectificadas",
  authenticateToken,
  validarMunicipioAsignado,
  validarRectificacionDisponible,
  upsertRemuneracionesRectificadasMunicipio
);

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/remuneraciones-rectificadas/informe",
  authenticateToken,
  validarMunicipioAsignado,
  validarRectificacionDisponible,
  generarInformeRemuneracionesRectificadasMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/prorroga",
  authenticateToken,
  requireAdmin,
  crearProrrogaMunicipio
);

// Buscar municipio por ID
router.get("/:id", authenticateToken, requireAdmin, getMunicipioById);

// Crear municipio 
router.post("/", authenticateToken, requireAdmin, createMunicipio);

// actualizar municipio
router.put("/:id", authenticateToken, requireAdmin, updateMunicipio);

// eliminar municipio
router.delete("/:id", authenticateToken, requireAdmin, deleteMunicipio);

export default router;
