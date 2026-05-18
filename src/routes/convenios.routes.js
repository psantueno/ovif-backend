import { Router } from "express";
import { 
    listarConveniosActivos, 
    listarPautasPorConvenio, 
    getConveniosSelect, 
    listarConvenios,
    crearConvenio,
    actualizarConvenio,
    eliminarConvenio
} from "../controllers/convenios.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

router.use(authenticateToken);

router.get("/", requireAdmin, listarConveniosActivos);
router.get("/list", requireAdmin, listarConvenios);
router.get("/select", getConveniosSelect);
router.get("/:convenioId/pautas", requireAdmin, listarPautasPorConvenio);
router.post("/", requireAdmin, crearConvenio);
router.put("/:convenioId", requireAdmin, actualizarConvenio);
router.delete("/:convenioId", requireAdmin, eliminarConvenio);

export default router;
