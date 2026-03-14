import { Router } from "express";
import {
  actualizarTipoPauta,
  crearTipoPauta,
  eliminarTipoPauta,
  getTiposPautaSelect,
  listarTiposPauta,
} from "../controllers/tiposPauta.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get("/list", listarTiposPauta);
router.get("/select", getTiposPautaSelect);
router.post("/", crearTipoPauta);
router.put("/:tipoPautaId", actualizarTipoPauta);
router.delete("/:tipoPautaId", eliminarTipoPauta);

export default router;
