import { buildRequestLog, enqueueRequestLog } from "../services/observabilityService.js";

export function requestLogger(req, res, next) {
  if (!req.originalUrl.startsWith("/api/")) {
    return next();
  }

  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    try {
      enqueueRequestLog(buildRequestLog(req, res, durationMs));
    } catch (error) {
      console.warn("REQUEST_LOG_BUILD_FAILED", error.message);
    }
  });

  return next();
}
