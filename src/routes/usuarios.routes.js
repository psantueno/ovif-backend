import { Router } from "express";
import {
    getUsuarios,
    getUsuarioById,
    createUsuario,
    setPassword,
    updateUsuario,
    updateUsuarioRoles
} from "../controllers/usuarios.controller.js";

const router = Router();

// Listar todos los usuarios
router.get("/", getUsuarios);

// Buscar por ID
router.get("/:id", getUsuarioById);

// Crear usuario (con roles)
router.post("/", createUsuario);

// Cambiar contraseña de usuario existente
router.post("/set-password", setPassword);

// Actualizar usuario
router.put("/:id", updateUsuario);

// Editar datos del usuario
router.put("/:id", updateUsuario);

// Editar roles del usuario
router.put("/:id/roles", updateUsuarioRoles);

// Soft delete
router.delete("/:id", softDeleteUsuario);   


export default router;
