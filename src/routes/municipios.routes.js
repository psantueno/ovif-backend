import { Router } from "express";
import {
  getMunicipios,
  getMunicipioById,
  createMunicipio,
  updateMunicipio,
  getMunicipiosSelect,
  listarEjerciciosDisponiblesPorMunicipio,
} from "../controllers/municipios.controller.js";

import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

// Lista todos los municipios
router.get("/", authenticateToken, getMunicipios);
// Lista municipios (id y nombre unicamente)
router.get("/select", authenticateToken, getMunicipiosSelect); 
// Ejercicios abiertos para el municipio
router.get("/:id/ejercicios/disponibles", authenticateToken, listarEjerciciosDisponiblesPorMunicipio);
// Buscar municipio por ID
router.get("/:id", authenticateToken, getMunicipioById);
// Crear municipio 
router.post("/", authenticateToken, createMunicipio);
// actualizar municipio
router.put("/:id", authenticateToken, updateMunicipio);
// eliminar municipio
// router.delete("/:id", authenticateToken, deleteMunicipio);

export default router;
