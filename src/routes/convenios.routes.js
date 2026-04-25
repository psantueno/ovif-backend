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
router.get("/select", getConveniosSelect);
router.get("/:convenioId/pautas", listarPautasPorConvenio);
router.post("/", crearConvenio);
router.put("/:convenioId", actualizarConvenio);
router.delete("/:convenioId", eliminarConvenio);

export default router;
