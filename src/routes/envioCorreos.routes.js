import { Router } from "express";
import {
  listarEnviosCorreos,
  listarTiposEnvios,
  obtenerEstadisticasEnvios,
} from "../controllers/envioCorreos.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { adminHeavyLimiter, authenticatedUserLimiter } from "../middlewares/rateLimiters.js";

const router = Router();

router.use(authenticateToken, authenticatedUserLimiter, adminHeavyLimiter, requireAdmin);

// Estadísticas de envíos
router.get("/stats", obtenerEstadisticasEnvios);

// Tipos de correo disponibles para filtrar
router.get("/tipos", listarTiposEnvios);

// Listar correos (con filtros: ?estado=ERROR&tipo=CIERRE_MODULOS&limit=20&offset=0)
router.get("/", listarEnviosCorreos);

export default router;
