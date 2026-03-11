import { Router } from "express";
import {
  listarEjercicios,
  crearEjercicio,
  updateEjercicio,
  prorrogarCierre,
  getFechaLimite,
  listarCierres,
  getCierreMunicipio,
  listarEstadoMunicipios,
  deleteEjercicio,
  obtenerFiltrosInformes,
  descargarInforme,
  listarCatalogoEjercicios
} from "../controllers/ejercicios.controller.js";

import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { validarMunicipioAsignado } from "../middlewares/validarMunicipioAsignado.js";

const router = Router();

// === Informes por módulo (acceso por usuario autenticado con municipio asignado) ===
router.get("/informes/filtros", authenticateToken, validarMunicipioAsignado, obtenerFiltrosInformes);
router.get("/informes/download", authenticateToken, validarMunicipioAsignado, descargarInforme);

// === Resto de endpoints de ejercicios (admin) ===
router.use(authenticateToken, requireAdmin);

// === CRUD de EjerciciosMes ===
router.get("/", listarEjercicios); 
router.get("/select", listarCatalogoEjercicios);
router.post("/", crearEjercicio); 
router.put("/:ejercicio/mes/:mes", updateEjercicio); 
// router.delete("/:ejercicio/mes/:mes", deleteEjercicio); 
router.delete("/:ejercicio/mes/:mes", deleteEjercicio);

// === Prórroga por municipio ===
router.put("/:ejercicio/mes/:mes/municipios/:municipioId/prorroga", prorrogarCierre);

// === Consultar fecha límite efectiva de un municipio ===
router.get("/:ejercicio/mes/:mes/municipios/:municipioId", getFechaLimite);

// === Lista de municipios que han cerrado un ejercicio/mes ===
router.get("/:ejercicio/mes/:mes/cierres", listarCierres);

// === Detalle de cierre de un municipio ===
router.get("/:ejercicio/mes/:mes/municipios/:municipioId/cierre", getCierreMunicipio);

// === Lista de todos los municipios de un ejercicio/mes con su estado ===
router.get("/:ejercicio/mes/:mes/estado-municipios", listarEstadoMunicipios);

export default router;
