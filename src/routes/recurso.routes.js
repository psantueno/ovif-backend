// routes/recurso.routes.js
import { Router } from "express";
import {
  crearRecurso,
  obtenerRecursos,
  obtenerRecurso,
  actualizarRecurso,
  eliminarRecurso
} from "../controllers/recursos.controller.js";

const router = Router();

router.post("/", crearRecurso);
router.get("/", obtenerRecursos);
router.get("/:ejercicio/:mes/:partida/:municipio", obtenerRecurso);
router.put("/:ejercicio/:mes/:partida/:municipio", actualizarRecurso);
router.delete("/:ejercicio/:mes/:partida/:municipio", eliminarRecurso);

export default router;
