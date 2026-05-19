import rateLimit from "express-rate-limit";
import { logRateLimitEvent } from "../services/observabilityService.js";
import { createRateLimitHandler } from "../utils/rateLimitHandler.js";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const pdfConcurrencyByUser = new Map();

function userIdFromRequest(req) {
  return req.user?.usuario_id || req.user?.sub || "unknown";
}

export function createUserRateLimiter({ limiter, max, message, windowMs = FIFTEEN_MINUTES_MS }) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => {
      const key = `${limiter}:user:${userIdFromRequest(req)}`;
      req.rateLimitKeyContext = key;
      req.rateLimitLimiter = limiter;
      return key;
    },
    handler: createRateLimitHandler(limiter, { error: message }),
  });
}

export const authenticatedUserLimiter = createUserRateLimiter({
  limiter: "authenticated-user",
  max: 1200,
  message: "Demasiadas solicitudes. Intente nuevamente más tarde.",
});

export const writeBurstLimiter = createUserRateLimiter({
  limiter: "write-burst",
  max: 300,
  message: "Demasiadas operaciones de carga. Espere unos minutos e intente nuevamente.",
});

export const reportFiltersLimiter = createUserRateLimiter({
  limiter: "report-filters",
  max: 120,
  message: "Demasiadas consultas de informes. Espere unos minutos e intente nuevamente.",
});

export const reportDownloadLimiter = createUserRateLimiter({
  limiter: "report-download",
  max: 120,
  message: "Demasiadas descargas de informes. Espere unos minutos e intente nuevamente.",
});

export const pdfGenerationLimiter = createUserRateLimiter({
  limiter: "pdf-generation",
  max: 30,
  message: "Demasiadas generaciones de informes. Espere unos minutos e intente nuevamente.",
});

export const adminHeavyLimiter = createUserRateLimiter({
  limiter: "admin-heavy",
  max: 60,
  message: "Demasiadas consultas administrativas. Espere unos minutos e intente nuevamente.",
});

export const deleteBurstLimiter = createUserRateLimiter({
  limiter: "delete-burst",
  max: 10,
  message: "Demasiadas operaciones de borrado. Espere unos minutos e intente nuevamente.",
});

export function pdfGenerationConcurrency(req, res, next) {
  const userId = userIdFromRequest(req);
  const current = pdfConcurrencyByUser.get(userId) || 0;
  if (current >= 2) {
    req.rateLimitLimiter = "pdf-generation-concurrency";
    req.rateLimitKeyContext = `pdf-generation-concurrency:user:${userId}`;
    req.rateLimit = { limit: 2, used: current + 1, remaining: 0 };
    logRateLimitEvent(req, "pdf-generation-concurrency");
    console.warn("PDF_CONCURRENCY_LIMIT", JSON.stringify({
      usuario_id: userId,
      method: req.method,
      originalUrl: req.originalUrl,
      current,
      limit: 2,
    }));
    return res.status(429).json({
      error: "Ya hay dos informes generándose para este usuario. Espere a que finalicen antes de solicitar otro.",
    });
  }

  pdfConcurrencyByUser.set(userId, current + 1);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    const latest = pdfConcurrencyByUser.get(userId) || 0;
    if (latest <= 1) {
      pdfConcurrencyByUser.delete(userId);
    } else {
      pdfConcurrencyByUser.set(userId, latest - 1);
    }
  };

  res.once("finish", release);
  res.once("close", release);
  res.once("error", release);
  return next();
}
