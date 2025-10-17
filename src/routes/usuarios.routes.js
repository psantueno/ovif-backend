import { Router } from "express";
import {
    getUsuarios,
    getUsuarioById,
    createUsuario,
    updateUsuario,
    updateUsuarioRoles,
    getUsuarioMunicipios,
    updateUsuarioMunicipios,
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
// Lista los municipios asociados al usuario
router.get("/me/municipios", authenticateToken, obtenerMisMunicipios);
// Buscar por ID
router.get("/:id", authenticateToken, getUsuarioById);
// Municipios asignados a un usuario específico
router.get("/:id/municipios", authenticateToken, getUsuarioMunicipios);
// Actualizar municipios asignados a un usuario
router.put("/:id/municipios", authenticateToken, updateUsuarioMunicipios);
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
// Cambiar estado activo/inactivo
router.patch("/:id/toggle", toggleUsuarioActivo);



export default router;
