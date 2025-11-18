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
import { validarFechaLimiteDeCarga } from "../middlewares/validarFechaLimiteDeCarga.js";

const router = Router();

router.post("/", validarMunicipioAsignado, validarFechaLimiteDeCarga, crearRecurso);
router.get("/", validarMunicipioAsignado, validarFechaLimiteDeCarga, obtenerRecursos);
router.get("/:ejercicio/:mes/:partida/:municipio", validarMunicipioAsignado, validarFechaLimiteDeCarga, obtenerRecurso);
router.put("/:ejercicio/:mes/:partida/:municipio", validarMunicipioAsignado, validarFechaLimiteDeCarga, actualizarRecurso);
// router.delete("/:ejercicio/:mes/:partida/:municipio", validarMunicipioAsignado, validarFechaLimiteDeCarga, eliminarRecurso);

export default router;
