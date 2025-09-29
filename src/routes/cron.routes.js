import { Router } from "express";
import { listarCronLogs, getCronLogById, getCronLogsByTask } from "../controllers/cron.controller.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

// Listar logs (con paginación opcional: ?limit=20&offset=0)
router.get("/", authenticateToken, listarCronLogs);

// Obtener un log por ID
router.get("/:id", authenticateToken, getCronLogById);

// Filtrar logs por nombre de tarea
router.get("/tarea/:tarea", authenticateToken, getCronLogsByTask);

export default router;
