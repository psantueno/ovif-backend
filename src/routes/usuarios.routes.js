import { Router } from "express";
import {
    getUsuarios,
    getUsuarioById,
    createUsuario,
    updateUsuario,
    updateUsuarioRoles,
    softDeleteUsuario,
    deleteUsuario,
    obtenerMisMunicipios,
    toggleUsuarioActivo,
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
// router.delete("/:id", authenticateToken, softDeleteUsuario);   
// Delete permanente
router.delete("/:id", authenticateToken, deleteUsuario);
// Lista los municipios asociados al usuario
router.get("/me/municipios", authenticateToken, obtenerMisMunicipios);
// Cambiar estado activo/inactivo
router.patch("/:id/toggle", toggleUsuarioActivo);



export default router;
