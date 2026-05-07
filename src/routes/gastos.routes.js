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
import { validarFechaLimiteDeCargaPorTipo } from "../middlewares/validarFechaLimiteDeCarga.js";
import { authenticatedUserLimiter, writeBurstLimiter } from "../middlewares/rateLimiters.js";

const router = Router();
const validarFechaLimiteGastosRecursos = validarFechaLimiteDeCargaPorTipo("gastos_recursos");


// Listar
router.get("/:ejercicio/mes/:mes/municipios/:municipioId", authenticateToken, authenticatedUserLimiter, validarMunicipioAsignado, validarFechaLimiteGastosRecursos, listarGastos);

// Crear
router.post("/:ejercicio/mes/:mes/municipios/:municipioId", authenticateToken, authenticatedUserLimiter, writeBurstLimiter, validarMunicipioAsignado, validarFechaLimiteGastosRecursos, crearGasto);


// Actualizar
router.put("/:ejercicio/mes/:mes/municipios/:municipioId/partida/:partida", authenticateToken, authenticatedUserLimiter, writeBurstLimiter, validarMunicipioAsignado, validarFechaLimiteGastosRecursos, actualizarGasto);

// Eliminar
// router.delete("/:ejercicio/mes/:mes/municipios/:municipioId/partida/:partida", authenticateToken, validarMunicipioAsignado, validarFechaLimiteDeCarga, eliminarGasto); // Sin uso actualmente

// Reporte por partida
router.get(
  "/:ejercicio/mes/:mes/municipios/:municipioId/reporte/partidas",
  authenticateToken,
  authenticatedUserLimiter,
  validarMunicipioAsignado,
  reportePorPartida
);

// Reporte por clasificación económica
router.get(
  "/:ejercicio/mes/:mes/municipios/:municipioId/reporte/economico",
  authenticateToken,
  authenticatedUserLimiter,
  validarMunicipioAsignado,
  reportePorEconomico
);

export default router;
