import { Router } from "express";
import {
  listarEnviosCorreos,
  obtenerEstadisticasEnvios,
} from "../controllers/envioCorreos.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

// Estadísticas de envíos
router.get("/stats", obtenerEstadisticasEnvios);

// Listar correos (con filtros: ?estado=ERROR&tipo=CIERRE_MODULOS&limit=20&offset=0)
router.get("/", listarEnviosCorreos);

export default router;
