import { Router } from "express";
import {
  getParametros,
  getParametrosEjercicioFiscal,
  getParametroById,
  createParametro,
  updateParametro,
  deleteParametro,
} from "../controllers/parametros.controller.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.get("/", authenticateToken, getParametros);
router.get("/ejercicio-fiscal", authenticateToken, getParametrosEjercicioFiscal);
router.get("/:id", authenticateToken, getParametroById);
router.post("/", authenticateToken, createParametro);
router.put("/:id", authenticateToken, updateParametro);
router.delete("/:id", authenticateToken, deleteParametro);

export default router;
