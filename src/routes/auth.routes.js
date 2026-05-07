import { Router } from "express";
import rateLimit from "express-rate-limit";
import { createHash } from "crypto";

// === Controllers ===
import { changePassword, login, logout, refresh, profile, forgotPassword, resetPassword } from "../controllers/auth.controller.js";

// === Middlewares ===
import { authenticateToken } from "../middlewares/auth.js";
import { createRateLimitHandler } from "../utils/rateLimitHandler.js";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function normalizeIdentifier(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function shortHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function hashedKey(prefix, value) {
  const normalized = normalizeIdentifier(value);
  if (!normalized) return `${prefix}:unknown`;
  return `${prefix}:${shortHash(normalized)}`;
}

function setKeyContext(req, key, limiter) {
  req.rateLimitKeyContext = key;
  req.rateLimitLimiter = limiter;
  return key;
}

// === Rate limiters especificos para auth ===
const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: 12,
  skipSuccessfulRequests: true,
  // IP omitida: topologia same-origin, toda request llega desde el frontend/proxy.
  keyGenerator: (req) => setKeyContext(req, hashedKey("login", req.body?.usuario), "login"),
  handler: createRateLimitHandler(
    "login",
    { error: "Demasiados intentos de login. Intente nuevamente más tarde." }
  ),
});

const refreshLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: 500,
  handler: createRateLimitHandler(
    "refresh",
    { error: "Demasiados intentos. Intente nuevamente más tarde." }
  ),
});

const forgotPasswordLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: 5,
  // IP omitida: topologia same-origin, toda request llega desde el frontend/proxy.
  keyGenerator: (req) => setKeyContext(req, hashedKey("forgot", req.body?.usuario), "forgot-password"),
  handler: createRateLimitHandler(
    "forgot-password",
    { error: "Demasiadas solicitudes de restablecimiento. Intente nuevamente más tarde." }
  ),
});

const resetPasswordLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: 8,
  // IP omitida: topologia same-origin, toda request llega desde el frontend/proxy.
  keyGenerator: (req) => setKeyContext(req, hashedKey("reset", req.body?.token), "reset-password"),
  handler: createRateLimitHandler(
    "reset-password",
    { error: "Demasiados intentos de restablecimiento. Intente nuevamente más tarde." }
  ),
});

const changeLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: 8,
  keyGenerator: (req) => {
    const userId = req.user?.usuario_id || "unknown";
    return setKeyContext(req, `change:${userId}`, "change-password");
  },
  handler: createRateLimitHandler(
    "change-password",
    { error: "Demasiados intentos de cambio de contraseña. Intente nuevamente más tarde." }
  ),
});

const router = Router();

// Login con usuario y password
router.post("/login", authLimiter, login);

// Refrescar access token usando refresh cookie
router.post("/refresh", refreshLimiter, refresh);

// Perfil del usuario autenticado (rehidratado desde BD)
router.get("/profile", authenticateToken, profile);

// Actualizar contraseña (usuario autenticado)
router.post("/change-password", authenticateToken, changeLimiter, changePassword);

// Logout idempotente: limpia cookies aunque la sesión ya esté expirada
router.post("/logout", logout);

// Solicitar restablecimiento de contraseña
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);

// Restablecer contraseña con token
router.post("/reset-password", resetPasswordLimiter, resetPassword);

export default router;
