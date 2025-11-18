import { Router } from "express";
import { getPautaConvenioParametros } from "../controllers/pautasConvenio.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get("/:pautaId", getPautaConvenioParametros);

export default router;
