import { Router } from "express";
import {
    getUsuarios,
    getUsuarioById,
    createUsuario,
    updateUsuario,
    updateUsuarioRoles,
    getUsuarioRoles,
    getUsuarioMunicipios,
    updateUsuarioMunicipios,
    softDeleteUsuario,
    deleteUsuario,
    obtenerMisMunicipios,
    toggleUsuarioActivo,
} from "../controllers/usuarios.controller.js";

// Middleware de autenticación
import { authenticateToken } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

// Listar todos los usuarios
router.get("/", authenticateToken, requireAdmin, getUsuarios);
// Lista los municipios asociados al usuario
router.get("/me/municipios", authenticateToken, obtenerMisMunicipios);
// Buscar por ID
router.get("/:id", authenticateToken, requireAdmin, getUsuarioById);
// Municipios asignados a un usuario específico
router.get("/:id/municipios", authenticateToken, getUsuarioMunicipios);
// Roles asignados a un usuario específico
router.get("/:id/roles", authenticateToken, requireAdmin, getUsuarioRoles);
// Actualizar municipios asignados a un usuario
router.put("/:id/municipios", authenticateToken, requireAdmin, updateUsuarioMunicipios);
// Crear usuario
router.post("/", authenticateToken, requireAdmin,createUsuario);
// Actualizar usuario
router.put("/:id", authenticateToken, requireAdmin, updateUsuario);
// Editar roles del usuario
router.put("/:id/roles", authenticateToken, requireAdmin, updateUsuarioRoles);
// Soft delete
// router.delete("/:id", authenticateToken, softDeleteUsuario);   
// Delete permanente
router.delete("/:id", authenticateToken, requireAdmin, deleteUsuario);
// Cambiar estado activo/inactivo
router.patch("/:id/toggle", authenticateToken, requireAdmin, toggleUsuarioActivo);



export default router;
