import { Router } from "express";
import {
  listarEjercicios,
  crearEjercicio,
  updateEjercicio,
  deleteEjercicio,
  prorrogarCierre,
  getFechaLimite,
  cerrarMesMunicipio,
  listarCierres,
  getCierreMunicipio,
  listarEstadoMunicipios,
} from "../controllers/ejercicios.controller.js";

//Middlewares de autenticación
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

// === CRUD de EjerciciosMes ===
router.get("/", authenticateToken, listarEjercicios); // listar todos
router.post("/", authenticateToken, crearEjercicio); // crear un nuevo ejercicio/mes
router.put("/:ejercicio/mes/:mes", authenticateToken, updateEjercicio); // actualizar fechas oficiales
router.delete("/:ejercicio/mes/:mes", authenticateToken, deleteEjercicio); // eliminar ejercicio/mes

// === Prórroga por municipio ===
router.put("/:ejercicio/mes/:mes/municipios/:municipioId/prorroga", authenticateToken, prorrogarCierre);
// Consultar fecha límite efectiva de un municipio
router.get("/:ejercicio/mes/:mes/municipios/:municipioId", getFechaLimite);
// Cerrar mes para un municipio (crear registro en ovif_ejercicios_meses_cerrados)
router.post("/:ejercicio/mes/:mes/municipios/:municipioId/cerrar", cerrarMesMunicipio);
// Lista de municipios que han cerrado un ejercicio/mes
router.get("/:ejercicio/mes/:mes/cierres", listarCierres);
// Detalles del cierre de un municipio (incluye auditoria)
router.get("/:ejercicio/mes/:mes/municipios/:municipioId/cierre", getCierreMunicipio);
// Lista todos los municipios de un ejercicio/mes con su estado (cumplió / fuera de plazo / sin cerrar)
router.get("/:ejercicio/mes/:mes/estado-municipios", listarEstadoMunicipios);

export default router;
