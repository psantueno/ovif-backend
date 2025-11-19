import { Router } from "express";
import {
  listarEjercicios,
  crearEjercicio,
  updateEjercicio,
  prorrogarCierre,
  getFechaLimite,
  cerrarMesMunicipio,
  listarCierres,
  getCierreMunicipio,
  listarEstadoMunicipios,
  deleteEjercicio,
} from "../controllers/ejercicios.controller.js";

import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

// === CRUD de EjerciciosMes ===
router.get("/", listarEjercicios); 
router.post("/", crearEjercicio); 
router.put("/:ejercicio/mes/:mes", updateEjercicio); 
// router.delete("/:ejercicio/mes/:mes", deleteEjercicio); 
router.delete("/:ejercicio/mes/:mes", deleteEjercicio);

// === Prórroga por municipio ===
router.put("/:ejercicio/mes/:mes/municipios/:municipioId/prorroga", prorrogarCierre);

// === Consultar fecha límite efectiva de un municipio ===
router.get("/:ejercicio/mes/:mes/municipios/:municipioId", getFechaLimite);

// === Cierre por módulo para un municipio ===
router.post(
  "/:ejercicio/mes/:mes/convenios/:convenioId/pautas/:pautaId/municipios/:municipioId/modulos/:modulo/cerrar",
  cerrarMesMunicipio
);

// Ruta legacy (se mantiene temporalmente para compatibilidad)
router.post("/:ejercicio/mes/:mes/municipios/:municipioId/cerrar", cerrarMesMunicipio);

// === Lista de municipios que han cerrado un ejercicio/mes ===
router.get("/:ejercicio/mes/:mes/cierres", listarCierres);

// === Detalle de cierre de un municipio ===
router.get("/:ejercicio/mes/:mes/municipios/:municipioId/cierre", getCierreMunicipio);

// === Lista de todos los municipios de un ejercicio/mes con su estado ===
router.get("/:ejercicio/mes/:mes/estado-municipios", listarEstadoMunicipios);

export default router;
