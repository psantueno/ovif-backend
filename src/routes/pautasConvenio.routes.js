import { Router } from "express";
import { getPautaConvenioParametros } from "../controllers/pautasConvenio.controller.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.get("/:pautaId", authenticateToken, getPautaConvenioParametros);

export default router;
