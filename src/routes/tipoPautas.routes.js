import { Router } from "express";
import { getTiposPautasSelect } from "../controllers/tiposPautas.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get("/select", authenticateToken, requireAdmin, getTiposPautasSelect)

export default router;