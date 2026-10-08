import { Router } from "express";
import {
    abrirPartidaRecurso,
    actualizarPartidaRecurso,
    cambiarEstadoPartidaRecurso,
    crearPartidaRecurso,
    getPartidasRecursosSelect,
    historialPartidaRecurso,
    listarPartidasRecursos,
    referenciasPartidaRecurso,
} from "../controllers/partidas-recursos.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { authenticatedUserLimiter, writeBurstLimiter } from "../middlewares/rateLimiters.js";

const router = Router();

router.use(authenticateToken, requireAdmin, authenticatedUserLimiter);

// /select va antes que /:codigo
router.get('/select', getPartidasRecursosSelect);
router.get('/', listarPartidasRecursos);
router.post('/', writeBurstLimiter, crearPartidaRecurso);
router.get('/:codigo/historial', historialPartidaRecurso);
router.get('/:codigo/referencias', referenciasPartidaRecurso);
router.post('/:codigo/apertura', writeBurstLimiter, abrirPartidaRecurso);
router.put('/:codigo', writeBurstLimiter, actualizarPartidaRecurso);
router.patch('/:codigo/estado', writeBurstLimiter, cambiarEstadoPartidaRecurso);

export default router;
