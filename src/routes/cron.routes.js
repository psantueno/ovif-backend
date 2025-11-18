import { Router } from "express";
import { listarCronLogs, getCronLogById, getCronLogsByTask } from "../controllers/cron.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

// Listar logs (con paginación opcional: ?limit=20&offset=0)
router.get("/", listarCronLogs);

// Obtener un log por ID
router.get("/:id", getCronLogById);

// Filtrar logs por nombre de tarea
router.get("/tarea/:tarea", getCronLogsByTask);

export default router;
