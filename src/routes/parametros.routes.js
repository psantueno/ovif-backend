import { Router } from "express";
import {
  listarParametros,
  getParametroById,
  crearParametro,
  actualizarParametro,
  actualizarEstadoParametro,
} from "../controllers/parametros.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get("/list", listarParametros);
router.get("/:parametroId", getParametroById);
router.post("/", crearParametro);
router.put("/:parametroId", actualizarParametro);
router.put("/:parametroId/estado", actualizarEstadoParametro);

export default router;
