import Router from "express";
const router = Router();

import {
    listarLogs,
} from "../controllers/logs.controller.js";
import {
    exportarInformeRateLimits,
    listarEndpointsRateLimits,
    listarEventosRateLimits,
    listarUsuariosRateLimits,
    obtenerResumenRateLimits,
} from "../controllers/rateLimitLogs.controller.js";
import {
    exportarInformeObservabilidad,
    explorarRequestsObservabilidad,
    obtenerAnomaliasObservabilidad,
    obtenerMetricasObservabilidad,
    obtenerRateLimitsResumenObservabilidad,
    obtenerUserJourneyObservabilidad,
} from "../controllers/observabilidad.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { adminHeavyLimiter, authenticatedUserLimiter } from "../middlewares/rateLimiters.js";

router.get("/rate-limits/resumen", authenticateToken, authenticatedUserLimiter, adminHeavyLimiter, requireAdmin, obtenerResumenRateLimits);
router.get("/rate-limits/usuarios", authenticateToken, authenticatedUserLimiter, adminHeavyLimiter, requireAdmin, listarUsuariosRateLimits);
router.get("/rate-limits/endpoints", authenticateToken, authenticatedUserLimiter, adminHeavyLimiter, requireAdmin, listarEndpointsRateLimits);
router.get("/rate-limits/eventos", authenticateToken, authenticatedUserLimiter, adminHeavyLimiter, requireAdmin, listarEventosRateLimits);
router.get("/rate-limits/informe", authenticateToken, authenticatedUserLimiter, adminHeavyLimiter, requireAdmin, exportarInformeRateLimits);
router.get("/observabilidad/metricas", authenticateToken, authenticatedUserLimiter, adminHeavyLimiter, requireAdmin, obtenerMetricasObservabilidad);
router.get("/observabilidad/rate-limits-resumen", authenticateToken, authenticatedUserLimiter, adminHeavyLimiter, requireAdmin, obtenerRateLimitsResumenObservabilidad);
router.get("/observabilidad/explorer", authenticateToken, authenticatedUserLimiter, adminHeavyLimiter, requireAdmin, explorarRequestsObservabilidad);
router.get("/observabilidad/anomalias", authenticateToken, authenticatedUserLimiter, adminHeavyLimiter, requireAdmin, obtenerAnomaliasObservabilidad);
router.get("/observabilidad/user-journey/:usuario_id", authenticateToken, authenticatedUserLimiter, adminHeavyLimiter, requireAdmin, obtenerUserJourneyObservabilidad);
router.get("/observabilidad/informe", authenticateToken, authenticatedUserLimiter, adminHeavyLimiter, requireAdmin, exportarInformeObservabilidad);
router.get("/", authenticateToken, authenticatedUserLimiter, requireAdmin, listarLogs);

export default router;
