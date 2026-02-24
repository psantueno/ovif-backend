import { Router } from "express";
import { getPartidasRecursosSelect } from "../controllers/partidas-recursos.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get('/select', getPartidasRecursosSelect);

export default router;