import { logRateLimitEvent } from "../services/observabilityService.js";

export function createRateLimitHandler(limiter, message) {
  return (req, res) => {
    req.rateLimitLimiter = limiter;
    const info = req.rateLimit || {};
    const resetTime = info.resetTime instanceof Date
      ? info.resetTime.toISOString()
      : info.resetTime;

    logRateLimitEvent(req, limiter);

    console.warn("RATE_LIMIT_429", JSON.stringify({
      limiter,
      method: req.method,
      originalUrl: req.originalUrl,
      endpoint: req.path,
      keyContext: req.rateLimitKeyContext || info.key || "unknown",
      limit: info.limit,
      used: info.used ?? info.current,
      resetTime,
      ip: req.ip,
    }));

    return res.status(429).json(message);
  };
}
