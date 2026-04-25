import { Router } from "express";
import { getMunicipiosMailsSelect, listarMunicipiosMails, listarMunicipiosSinMail, crearMunicipioMail, actualizarMunicipioMail, eliminarMunicipioMail } from "../controllers/municipios-mails.controller.js";
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get("/select", getMunicipiosMailsSelect);
router.get("/list", listarMunicipiosMails);
router.get("/sin-mail", listarMunicipiosSinMail);
router.post("/", crearMunicipioMail);
router.put("/:municipio_id/:email", actualizarMunicipioMail);
router.delete("/:municipio_id/:email", eliminarMunicipioMail);

export default router;