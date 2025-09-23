import { Router } from "express";
import {
    getUsuarios,
    getUsuarioById,
    createUsuario,
    updateUsuario,
    updateUsuarioRoles,
    softDeleteUsuario,
    deleteUsuario
} from "../controllers/usuarios.controller.js";

const router = Router();

// Listar todos los usuarios
router.get("/", getUsuarios);

// Buscar por ID
router.get("/:id", getUsuarioById);

// Crear usuario (con roles)
router.post("/", createUsuario);

// Actualizar usuario
router.put("/:id", updateUsuario);

// Editar datos del usuario
router.put("/:id", updateUsuario);

// Editar roles del usuario
router.put("/:id/roles", updateUsuarioRoles);

// Soft delete
router.delete("/:id", softDeleteUsuario);   

// delete permantente
router.delete("/:id", deleteUsuario);



export default router;
