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
import { requireSelfOrAdmin } from "../middlewares/requireSelfOrAdmin.js";
import { authenticatedUserLimiter, writeBurstLimiter } from "../middlewares/rateLimiters.js";

const router = Router();
const usuarioAutenticado = [authenticateToken, authenticatedUserLimiter];
const escrituraUsuarios = [authenticateToken, authenticatedUserLimiter, writeBurstLimiter];

// Listar todos los usuarios
router.get("/", usuarioAutenticado, requireAdmin, getUsuarios);
// Lista los municipios asociados al usuario
router.get("/me/municipios", usuarioAutenticado, obtenerMisMunicipios);
// Buscar por ID
router.get("/:id", usuarioAutenticado, requireAdmin, getUsuarioById);
// Municipios asignados a un usuario específico
router.get("/:id/municipios", usuarioAutenticado, requireSelfOrAdmin, getUsuarioMunicipios);
// Roles asignados a un usuario específico
router.get("/:id/roles", usuarioAutenticado, requireAdmin, getUsuarioRoles);
// Actualizar municipios asignados a un usuario
router.put("/:id/municipios", escrituraUsuarios, requireAdmin, updateUsuarioMunicipios);
// Crear usuario
router.post("/", escrituraUsuarios, requireAdmin,createUsuario);
// Actualizar usuario
router.put("/:id", escrituraUsuarios, requireAdmin, updateUsuario);
// Editar roles del usuario
router.put("/:id/roles", escrituraUsuarios, requireAdmin, updateUsuarioRoles);
// Soft delete - Sin uso actualmente
// router.delete("/:id", authenticateToken, softDeleteUsuario);
// Delete permanente
router.delete("/:id", escrituraUsuarios, requireAdmin, deleteUsuario);
// Cambiar estado activo/inactivo
router.patch("/:id/toggle", escrituraUsuarios, requireAdmin, toggleUsuarioActivo);



export default router;
