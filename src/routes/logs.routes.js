import Router from "express";
const router = Router();

import {
    listarLogs,
} from "../controllers/logs.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

router.get("/", authenticateToken, requireAdmin, listarLogs);

export default router;