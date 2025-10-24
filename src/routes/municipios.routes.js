import { Router } from "express";
import {
  getMunicipios,
  getMunicipioById,
  createMunicipio,
  updateMunicipio,
  getMunicipiosSelect,
  listarEjerciciosDisponiblesPorMunicipio,
  obtenerPartidasGastosMunicipio,
  upsertGastosMunicipio,
  generarInformeGastosMunicipio,
} from "../controllers/municipios.controller.js";

import { authenticateToken } from "../middlewares/auth.js";
import { validarMunicipioAsignado } from "../middlewares/validarMunicipioAsignado.js";
import { validarFechaLimiteDeCarga } from "../middlewares/validarFechaLimiteDeCarga.js";

const router = Router();

// Lista todos los municipios
router.get("/", authenticateToken, getMunicipios);

// Lista municipios (id y nombre unicamente)
router.get("/select", authenticateToken, getMunicipiosSelect);

// Ejercicios abiertos para el municipio
router.get("/:id/ejercicios/disponibles", authenticateToken, listarEjerciciosDisponiblesPorMunicipio);

// Partidas de gastos del municipio
router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/gastos/partidas",
  authenticateToken,
  validarMunicipioAsignado,
  obtenerPartidasGastosMunicipio
);

router.get(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/gastos/informe",
  authenticateToken,
  validarMunicipioAsignado,
  generarInformeGastosMunicipio
);

// Upsert de gastos del municipio
router.put(
  "/:municipioId/ejercicios/:ejercicio/mes/:mes/gastos",
  authenticateToken,
  validarMunicipioAsignado,
  validarFechaLimiteDeCarga,
  upsertGastosMunicipio
);

// Buscar municipio por ID
router.get("/:id", authenticateToken, getMunicipioById);

// Crear municipio 
router.post("/", authenticateToken, createMunicipio);

// actualizar municipio
router.put("/:id", authenticateToken, updateMunicipio);

// eliminar municipio
// router.delete("/:id", authenticateToken, deleteMunicipio);

export default router;
