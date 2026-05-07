import { Router } from "express";
import { getPautaConvenioParametros, getPautasSelect, listarPautas, crearPauta, actualizarPauta, eliminarPauta } from "../controllers/pautasConvenio.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

router.use(authenticateToken);

router.get("/select", getPautasSelect);
router.get("/list", requireAdmin, listarPautas);
router.post("/", requireAdmin, crearPauta);
router.get("/:pautaId", requireAdmin, getPautaConvenioParametros);
router.put("/:pautaId", requireAdmin, actualizarPauta);
router.delete("/:pautaId", requireAdmin, eliminarPauta);

export default router;
