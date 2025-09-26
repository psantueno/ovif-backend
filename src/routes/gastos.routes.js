import { Router } from "express";
import {
  listarGastos,
  crearGasto,
  updateGasto,
  deleteGasto,
  reportePorPartida,
  reportePorEconomico,
} from "../controllers/gastos.controller.js";

import { authenticateToken } from "../middlewares/auth.js";
import { validarFechaLimiteDeCarga } from "../middlewares/validarFechaLimiteDeCarga.js";

const router = Router();

// Listar gastos de un municipio
router.get("/:ejercicio/mes/:mes/municipios/:municipioId", authenticateToken, listarGastos);

// Crear gasto
router.post(
  "/:ejercicio/mes/:mes/municipios/:municipioId",
  authenticateToken,
  validarFechaLimiteDeCarga,
  crearGasto
);

// Actualizar gasto
router.put("/:id", authenticateToken, validarFechaLimiteDeCarga, updateGasto);

// Eliminar gasto
router.delete("/:id", authenticateToken, validarFechaLimiteDeCarga, deleteGasto);

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
