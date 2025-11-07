import { Router } from "express";
import { listarConveniosActivos, listarPautasPorConvenio } from "../controllers/convenios.controller.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.get("/", authenticateToken, listarConveniosActivos);
router.get("/:convenioId/pautas", authenticateToken, listarPautasPorConvenio);

export default router;
