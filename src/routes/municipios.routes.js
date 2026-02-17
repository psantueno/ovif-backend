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
  upsertGastosMunicipio,
  upsertRecursosMunicipio,
  upsertRecaudacionesMunicipio,
  upsertRemuneracionesMunicipio,
  generarInformeGastosMunicipio,
  generarInformeRecursosMunicipio,
  generarInformeRecaudacionesMunicipio,
  generarInformeRemuneracionesMunicipio,
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
import { validarFechaLimiteDeCarga } from "../middlewares/validarFechaLimiteDeCarga.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

// Lista todos los municipios
router.get("/", authenticateToken, requireAdmin,  getMunicipios);

// Lista municipios (id y nombre unicamente)
router.get("/select", authenticateToken, requireAdmin, getMunicipiosSelect);

// Ejercicios abiertos para el municipio
router.get("/:id/ejercicios/disponibles", authenticateToken, listarEjerciciosDisponiblesPorMunicipio);

// Ejercicios reftificables abiertos para el municipio
router.get("/:id/ejercicios/rectificaciones/disponibles", authenticateToken, listarEjerciciosRectificacionesDisponiblesPorMunicipio);

router.get(
  "/:municipioId/ejercicios/cerrados",
  authenticateToken,
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

// Upserts
router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/gastos",
  authenticateToken,
  validarMunicipioAsignado,
  validarFechaLimiteDeCarga,
  upsertGastosMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recursos",
  authenticateToken,
  validarMunicipioAsignado,
  validarFechaLimiteDeCarga,
  upsertRecursosMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recaudaciones",
  authenticateToken,
  validarMunicipioAsignado,
  validarFechaLimiteDeCarga,
  upsertRecaudacionesMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/remuneraciones",
  authenticateToken,
  validarMunicipioAsignado,
  validarFechaLimiteDeCarga,
  upsertRemuneracionesMunicipio
);

// Rectificaciones

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recaudaciones-rectificadas/conceptos",
  authenticateToken,
  validarMunicipioAsignado,
  obtenerConceptosRecaudacionRectificadaMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recaudaciones-rectificadas",
  authenticateToken,
  validarMunicipioAsignado,
  validarFechaLimiteDeCarga,
  upsertRecaudacionesRectificadasMunicipio
);

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/recaudaciones-rectificadas/informe",
  authenticateToken,
  validarMunicipioAsignado,
  generarInformeRecaudacionesRectificadasMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/remuneraciones-rectificadas",
  authenticateToken,
  validarMunicipioAsignado,
  validarFechaLimiteDeCarga,
  upsertRemuneracionesRectificadasMunicipio
);

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/remuneraciones-rectificadas/informe",
  authenticateToken,
  validarMunicipioAsignado,
  generarInformeRemuneracionesRectificadasMunicipio
);

router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/prorroga",
  authenticateToken,
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
