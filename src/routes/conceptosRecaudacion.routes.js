import { Router } from "express";
import { getConceptosSelect, listarConceptos, crearConcepto, actualizarConcepto, eliminarConcepto } from "../controllers/conceptosRecaudacion.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get("/select", authenticateToken, requireAdmin, getConceptosSelect)
router.get("/list", listarConceptos);
router.post("/", authenticateToken, requireAdmin, crearConcepto);
router.put("/:codigo", authenticateToken, requireAdmin, actualizarConcepto);
router.delete("/:cod_concepto", authenticateToken, requireAdmin, eliminarConcepto);

export default router;