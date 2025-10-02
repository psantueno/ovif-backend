import { Router } from "express";
import {
  getRoles,
  getRolById,
  createRol,
  updateRol,
  deleteRol,
  getRolesSelect,
} from "../controllers/roles.controller.js";

import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

router.get("/", authenticateToken, getRoles);
router.get("/select", authenticateToken, getRolesSelect);
router.get("/:id", authenticateToken, getRolById);
router.post("/", authenticateToken, createRol);
router.put("/:id", authenticateToken, updateRol);
router.delete("/:id", authenticateToken, deleteRol);

export default router;
