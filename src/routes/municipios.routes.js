import { Router } from "express";
import {
  getMunicipios,
  getMunicipioById,
  createMunicipio,
  updateMunicipio,
  deleteMunicipio,
} from "../controllers/municipios.controller.js";

const router = Router();

router.get("/", getMunicipios);
router.get("/:id", getMunicipioById);
router.post("/", createMunicipio);
router.put("/:id", updateMunicipio);
router.delete("/:id", deleteMunicipio);

export default router;
