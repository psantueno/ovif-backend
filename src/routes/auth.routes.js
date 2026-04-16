import { Router } from "express";
import rateLimit from "express-rate-limit";

// === Controllers ===
import { changePassword, login, logout, refresh, profile, forgotPassword, resetPassword } from "../controllers/auth.controller.js";

// === Middlewares ===
import { authenticateToken } from "../middlewares/auth.js";

// === Rate limiters especificos para auth ===
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15,                   // 15 intentos por ventana
  message: { error: "Demasiados intentos. Intente nuevamente más tarde." },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,                   // refresh puede ser más frecuente
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

// Refrescar access token usando refresh cookie
router.post("/refresh", refreshLimiter, refresh);

// Perfil del usuario autenticado (rehidratado desde BD)
router.get("/profile", authenticateToken, profile);

// Actualizar contraseña (usuario autenticado)
router.post("/change-password", changeLimiter, authenticateToken, changePassword);

// Logout (revoca sesión)
router.post("/logout", authenticateToken, logout);

// Solicitar restablecimiento de contraseña
router.post("/forgot-password", resetLimiter, forgotPassword);

// Restablecer contraseña con token
router.post("/reset-password", resetLimiter, resetPassword);

export default router;
