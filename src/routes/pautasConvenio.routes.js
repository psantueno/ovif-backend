import { Router } from "express";
import { getPautaConvenioParametros, getPautasSelect, listarPautas, crearPauta, actualizarPauta, eliminarPauta } from "../controllers/pautasConvenio.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get("/select", authenticateToken, requireAdmin, getPautasSelect)
router.get("/list", listarPautas);
router.post("/", authenticateToken, requireAdmin, crearPauta);
router.get("/:pautaId", getPautaConvenioParametros);
router.put("/:pautaId", authenticateToken, requireAdmin, actualizarPauta);
router.delete("/:pautaId", authenticateToken, requireAdmin, eliminarPauta);

export default router;
