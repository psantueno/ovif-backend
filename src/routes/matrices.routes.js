import { Router } from "express";
import {
  listarMatriz,
  listarPendientes,
  crearMatriz,
  crearMatrizLote,
  actualizarMatriz,
  eliminarMatriz,
  historialMatriz,
} from "../controllers/matrices.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { authenticatedUserLimiter, writeBurstLimiter, deleteBurstLimiter } from "../middlewares/rateLimiters.js";

const router = Router();

router.use(authenticateToken, requireAdmin, authenticatedUserLimiter);

// :tipo = "recursos" | "recaudacion"
router.get("/:tipo", listarMatriz);
router.get("/:tipo/pendientes", listarPendientes);
router.get("/:tipo/:id/historial", historialMatriz);
router.post("/:tipo", writeBurstLimiter, crearMatriz);
router.post("/:tipo/lote", writeBurstLimiter, crearMatrizLote);
router.put("/:tipo/:id", writeBurstLimiter, actualizarMatriz);
router.delete("/:tipo/:id", deleteBurstLimiter, eliminarMatriz);

export default router;
