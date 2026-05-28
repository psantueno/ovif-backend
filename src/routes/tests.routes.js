import { Router } from "express";
import { simularCierreModulos } from "../controllers/tests.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { authenticatedUserLimiter, adminHeavyLimiter } from "../middlewares/rateLimiters.js";

const router = Router();

router.use(authenticateToken, authenticatedUserLimiter, adminHeavyLimiter, requireAdmin);

router.post("/cierre-modulos", simularCierreModulos);

export default router;
