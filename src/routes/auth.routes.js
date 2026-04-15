import { Router } from "express";
import rateLimit from "express-rate-limit";

// === Controllers ===
import { changePassword, login, logout, forgotPassword, resetPassword  } from "../controllers/auth.controller.js";

// === Middlewares ===
import { authenticateToken } from "../middlewares/auth.js";

// === Rate limiters especificos para auth ===
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15,                   // 15 intentos por ventana
  message: { error: "Demasiados intentos. Intente nuevamente más tarde." },
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Demasiados intentos. Intente nuevamente más tarde." },
});

const changeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Demasiados intentos. Intente nuevamente más tarde." },
});

const router = Router();

// Login con usuario y password
router.post("/login", authLimiter, login);

// Actualizar contraseña (usuario autenticado)
router.post("/change-password", changeLimiter, authenticateToken, changePassword);

// Logout (invalida el token)
router.post("/logout", authenticateToken, logout);

// Ruta protegida de ejemplo
router.get("/profile", authenticateToken, (req, res) => {
  res.json({ message: "Perfil de usuario", user: req.user });
});

// Solicitar restablecimiento de contraseña
router.post("/forgot-password", resetLimiter, forgotPassword);

// Restablecer contraseña con token
router.post("/reset-password", resetLimiter, resetPassword);


export default router;
