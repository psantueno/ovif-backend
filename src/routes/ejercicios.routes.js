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
} from "../controllers/ejercicios.controller.js";

import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

// === CRUD de EjerciciosMes ===
router.get("/", authenticateToken, listarEjercicios); 
router.post("/", authenticateToken, crearEjercicio); 
router.put("/:ejercicio/mes/:mes", authenticateToken, updateEjercicio); 
// router.delete("/:ejercicio/mes/:mes", authenticateToken, deleteEjercicio); 

// === Prórroga por municipio ===
router.put("/:ejercicio/mes/:mes/municipios/:municipioId/prorroga", authenticateToken, prorrogarCierre);

// === Consultar fecha límite efectiva de un municipio ===
router.get("/:ejercicio/mes/:mes/municipios/:municipioId", authenticateToken, getFechaLimite);

// === Cerrar mes para un municipio (registro en ovif_ejercicios_meses_cerrados) ===
router.post("/:ejercicio/mes/:mes/municipios/:municipioId/cerrar", authenticateToken, cerrarMesMunicipio);

// === Lista de municipios que han cerrado un ejercicio/mes ===
router.get("/:ejercicio/mes/:mes/cierres", authenticateToken, listarCierres);

// === Detalle de cierre de un municipio ===
router.get("/:ejercicio/mes/:mes/municipios/:municipioId/cierre", authenticateToken, getCierreMunicipio);

// === Lista de todos los municipios de un ejercicio/mes con su estado ===
router.get("/:ejercicio/mes/:mes/estado-municipios", authenticateToken, listarEstadoMunicipios);

export default router;
