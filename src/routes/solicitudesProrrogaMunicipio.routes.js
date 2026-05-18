import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { setIsAdmin } from "../middlewares/setIsAdmin.js";
import {
    crearSolicitudes,
    listarSolicitudes,
    obtenerSolicitudPorId,
    editarSolicitud,
    cancelarSolicitud,
    aprobarSolicitud,
    rechazarSolicitud,
    aprobarLote,
    rechazarLote,
} from "../controllers/solicitudesProrrogaMunicipio.controller.js";

const router = Router();

// Rutas de lote ANTES de /:id para evitar que Express interprete "aprobar-lote" como parámetro id
router.put("/aprobar-lote", authenticateToken, requireAdmin, aprobarLote);
router.put("/rechazar-lote", authenticateToken, requireAdmin, rechazarLote);

router.post("/", authenticateToken, crearSolicitudes);
router.get("/", authenticateToken, setIsAdmin, listarSolicitudes);
router.get("/:id", authenticateToken, setIsAdmin, obtenerSolicitudPorId);
router.put("/:id", authenticateToken, setIsAdmin, editarSolicitud);
router.put("/:id/cancelar", authenticateToken, setIsAdmin, cancelarSolicitud);
router.put("/:id/aprobar", authenticateToken, requireAdmin, aprobarSolicitud);
router.put("/:id/rechazar", authenticateToken, requireAdmin, rechazarSolicitud);

export default router;
