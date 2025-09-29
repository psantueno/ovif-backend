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
import { validarFechaLimiteDeCarga } from "../middlewares/validarFechaLimiteDeCarga.js";

const router = Router();

// Listar
router.get("/:ejercicio/mes/:mes/municipios/:municipioId", authenticateToken, listarGastos);

// Crear
router.post("/:ejercicio/mes/:mes/municipios/:municipioId", authenticateToken, validarFechaLimiteDeCarga, crearGasto);

// Actualizar
router.put("/:ejercicio/mes/:mes/municipios/:municipioId/partida/:partida", authenticateToken, validarFechaLimiteDeCarga, actualizarGasto);

// Eliminar
router.delete("/:ejercicio/mes/:mes/municipios/:municipioId/partida/:partida", authenticateToken, validarFechaLimiteDeCarga, eliminarGasto);

// Reporte por partida
router.get(
  "/:ejercicio/mes/:mes/municipios/:municipioId/reporte/partidas",
  authenticateToken,
  reportePorPartida
);

// Reporte por clasificación económica
router.get(
  "/:ejercicio/mes/:mes/municipios/:municipioId/reporte/economico",
  authenticateToken,
  reportePorEconomico
);

export default router;
