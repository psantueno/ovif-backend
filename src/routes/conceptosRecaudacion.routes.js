import { Router } from "express";
import { getConceptosSelect, listarConceptos, crearConcepto, actualizarConcepto, eliminarConcepto } from "../controllers/conceptosRecaudacion.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get("/select", getConceptosSelect);
router.get("/list", listarConceptos);
router.post("/", crearConcepto);
router.put("/:codigo", actualizarConcepto);
router.delete("/:cod_concepto", eliminarConcepto);

export default router;