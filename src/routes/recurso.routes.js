// routes/recurso.routes.js
import { Router } from "express";
import {
  crearRecurso,
  obtenerRecursos,
  obtenerRecurso,
  actualizarRecurso,
  eliminarRecurso
} from "../controllers/recursos.controller.js";

import { authenticateToken } from "../middlewares/auth.js";
import { validarMunicipioAsignado } from "../middlewares/validarMunicipioAsignado.js";
import { validarFechaLimiteDeCargaPorTipo } from "../middlewares/validarFechaLimiteDeCarga.js";
import { authenticatedUserLimiter, writeBurstLimiter } from "../middlewares/rateLimiters.js";

const router = Router();
const validarFechaLimiteGastosRecursos = validarFechaLimiteDeCargaPorTipo("gastos_recursos");

router.post("/", authenticateToken, authenticatedUserLimiter, writeBurstLimiter, validarMunicipioAsignado, validarFechaLimiteGastosRecursos, crearRecurso);
router.get("/", authenticateToken, authenticatedUserLimiter, validarMunicipioAsignado, validarFechaLimiteGastosRecursos, obtenerRecursos);
router.get("/:ejercicio/:mes/:partida/:municipio", authenticateToken, authenticatedUserLimiter, validarMunicipioAsignado, validarFechaLimiteGastosRecursos, obtenerRecurso);
router.put("/:ejercicio/:mes/:partida/:municipio", authenticateToken, authenticatedUserLimiter, writeBurstLimiter, validarMunicipioAsignado, validarFechaLimiteGastosRecursos, actualizarRecurso);
// router.delete("/:ejercicio/:mes/:partida/:municipio", validarMunicipioAsignado, validarFechaLimiteDeCarga, eliminarRecurso); // Sin uso actualmente

export default router;
