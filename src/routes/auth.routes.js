import { Router } from "express";

// === Controllers ===
import { changePassword, login, logout, forgotPassword, resetPassword  } from "../controllers/auth.controller.js";

// === Middlewares ===
import { authenticateToken } from "../middlewares/auth.js";


const router = Router();

// Login con usuario y password
router.post("/login", login);

// Actualizar contraseña (usuario autenticado)
router.post("/change-password", authenticateToken, changePassword);

// Logout (invalida el token)
router.post("/logout", authenticateToken, logout);

// Ruta protegida de ejemplo
router.get("/profile", authenticateToken, (req, res) => {
  res.json({ message: "Perfil de usuario", user: req.user });
});

// Solicitar restablecimiento de contraseña
router.post("/forgot-password", forgotPassword);

// Restablecer contraseña con token
router.post("/reset-password", resetPassword);


export default router;
