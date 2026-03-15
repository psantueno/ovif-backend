// routes/recurso.routes.js
import { Router } from "express";
import {
  crearRecurso,
  obtenerRecursos,
  obtenerRecurso,
  actualizarRecurso,
  eliminarRecurso
} from "../controllers/recursos.controller.js";

import { validarMunicipioAsignado } from "../middlewares/validarMunicipioAsignado.js";
import { validarFechaLimiteDeCargaPorTipo } from "../middlewares/validarFechaLimiteDeCarga.js";

const router = Router();
const validarFechaLimiteGastosRecursos = validarFechaLimiteDeCargaPorTipo("gastos_recursos");

router.post("/", validarMunicipioAsignado, validarFechaLimiteGastosRecursos, crearRecurso);
router.get("/", validarMunicipioAsignado, validarFechaLimiteGastosRecursos, obtenerRecursos);
router.get("/:ejercicio/:mes/:partida/:municipio", validarMunicipioAsignado, validarFechaLimiteGastosRecursos, obtenerRecurso);
router.put("/:ejercicio/:mes/:partida/:municipio", validarMunicipioAsignado, validarFechaLimiteGastosRecursos, actualizarRecurso);
// router.delete("/:ejercicio/:mes/:partida/:municipio", validarMunicipioAsignado, validarFechaLimiteDeCarga, eliminarRecurso);

export default router;
