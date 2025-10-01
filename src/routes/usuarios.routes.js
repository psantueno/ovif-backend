import { Router } from "express";
import {
    getUsuarios,
    getUsuarioById,
    createUsuario,
    updateUsuario,
    updateUsuarioRoles,
    softDeleteUsuario,
    deleteUsuario,
    obtenerMisMunicipios
} from "../controllers/usuarios.controller.js";

// Middleware de autenticación
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();

// Listar todos los usuarios
router.get("/", authenticateToken, getUsuarios);
// Buscar por ID
router.get("/:id", authenticateToken, getUsuarioById);
// Crear usuario (con roles)
router.post("/", authenticateToken, createUsuario);
// Actualizar usuario
router.put("/:id", authenticateToken, updateUsuario);
// Editar roles del usuario
router.put("/:id/roles", authenticateToken, updateUsuarioRoles);
// Soft delete
router.delete("/:id", authenticateToken, softDeleteUsuario);   
// Delete permanente
router.delete("/:id", authenticateToken, deleteUsuario);


export default router;
