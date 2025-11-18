import { Router } from "express";
import {
  listarGastos,
  crearGasto,
  reportePorPartida,
  reportePorEconomico,
  actualizarGasto,
  eliminarGasto,
} from "../controllers/gastos.controller.js";

import { authenticateToken } from "../middlewares/auth.js";
import { validarMunicipioAsignado } from "../middlewares/validarMunicipioAsignado.js";
import { validarFechaLimiteDeCarga } from "../middlewares/validarFechaLimiteDeCarga.js";

const router = Router();


// Listar
router.get("/:ejercicio/mes/:mes/municipios/:municipioId", authenticateToken, validarMunicipioAsignado, validarFechaLimiteDeCarga, listarGastos);

// Crear
router.post("/:ejercicio/mes/:mes/municipios/:municipioId", authenticateToken, validarMunicipioAsignado, validarFechaLimiteDeCarga, crearGasto);


// Actualizar
router.put("/:ejercicio/mes/:mes/municipios/:municipioId/partida/:partida", authenticateToken, validarMunicipioAsignado, validarFechaLimiteDeCarga, actualizarGasto);

// Eliminar
// router.delete("/:ejercicio/mes/:mes/municipios/:municipioId/partida/:partida", authenticateToken, validarMunicipioAsignado, validarFechaLimiteDeCarga, eliminarGasto);

// Reporte por partida
router.get(
  "/:ejercicio/mes/:mes/municipios/:municipioId/reporte/partidas",
  authenticateToken,
  validarMunicipioAsignado,
  reportePorPartida
);

// Reporte por clasificación económica
router.get(
  "/:ejercicio/mes/:mes/municipios/:municipioId/reporte/economico",
  authenticateToken,
  validarMunicipioAsignado,
  reportePorEconomico
);

export default router;

