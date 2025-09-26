import { Router } from "express";
import {
  getMunicipios,
  getMunicipioById,
  createMunicipio,
  updateMunicipio,
} from "../controllers/municipios.controller.js";

import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

// Kista todos los municipios
router.get("/", authenticateToken, getMunicipios);
// Buscar municipio por ID
router.get("/:id", authenticateToken, getMunicipioById);
// Crear municipio 
router.post("/", authenticateToken, createMunicipio);
// actualizar municipio
router.put("/:id", authenticateToken, updateMunicipio);
// eliminar municipio
// router.delete("/:id", authenticateToken, deleteMunicipio);

export default router;
