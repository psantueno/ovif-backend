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

router.use(authenticateToken, requireAdmin);

router.get("/", listarConveniosActivos);
router.get("/list", listarConvenios);
router.get("/select", authenticateToken, requireAdmin, getConveniosSelect)
router.get("/:convenioId/pautas", listarPautasPorConvenio);
router.post("/", authenticateToken, requireAdmin, crearConvenio)
router.put("/:convenioId", authenticateToken, requireAdmin, actualizarConvenio);
router.delete("/:convenioId", authenticateToken, requireAdmin, eliminarConvenio);

export default router;
