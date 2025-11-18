import { Router } from "express";
import { listarConveniosActivos, listarPautasPorConvenio } from "../controllers/convenios.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get("/", listarConveniosActivos);
router.get("/:convenioId/pautas", listarPautasPorConvenio);

export default router;
