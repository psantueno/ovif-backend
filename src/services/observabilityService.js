import cron from "node-cron";
import { Op } from "sequelize";
import sequelize from "../config/db.js";
import { ApiRequestLog, ApiRequestMetricHourly, RateLimitEvent } from "../models/index.js";

const REQUEST_LOG_RETENTION_DAYS = Number.parseInt(process.env.REQUEST_LOG_RETENTION_DAYS || "90", 10);
const REQUEST_ROLLUP_RETENTION_MONTHS = Number.parseInt(process.env.REQUEST_ROLLUP_RETENTION_MONTHS || "12", 10);
const REQUEST_LOG_BATCH_SIZE = Number.parseInt(process.env.REQUEST_LOG_BATCH_SIZE || "100", 10);
const REQUEST_LOG_FLUSH_MS = Number.parseInt(process.env.REQUEST_LOG_FLUSH_MS || "5000", 10);
const SLOW_REQUEST_MS = Number.parseInt(process.env.OBSERVABILITY_SLOW_REQUEST_MS || "1000", 10);

let requestLogQueue = [];
let flushing = false;

function getRoutePattern(req) {
  const routePath = req.route?.path;
  if (!routePath) return normalizeRoutePattern(req.path);
  const baseUrl = req.baseUrl || "";
  return `${baseUrl}${routePath}`;
}

function normalizeRoutePattern(path) {
  return (path || "unknown")
    .replace(/[0-9a-fA-F]{24}/g, ":id")
    .replace(/\b\d+\b/g, ":id");
}

function sanitizeOriginalUrl(originalUrl) {
  return (originalUrl || "").split("?")[0];
}

function parseResponseBytes(res) {
  const contentLength = res.getHeader("content-length");
  const parsed = Number.parseInt(Array.isArray(contentLength) ? contentLength[0] : contentLength, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildRateLimitData(req) {
  const info = req.rateLimit || {};
  return {
    limiter: req.rateLimitLimiter || null,
    rate_limit_key: req.rateLimitKeyContext || info.key || null,
    rate_limit_used: info.used ?? info.current ?? null,
    rate_limit_limit: info.limit ?? null,
    rate_limit_remaining: info.remaining ?? null,
  };
}

function deriveModule(routePattern) {
  const segments = (routePattern || "").split("/").filter(Boolean);
  const apiIndex = segments.indexOf("api");
  return segments[apiIndex >= 0 ? apiIndex + 1 : 0] || "unknown";
}

function deriveStatusFamily(statusCode) {
  const family = Math.floor(Number(statusCode || 0) / 100);
  return family > 0 ? `${family}xx` : "0xx";
}

function detectBot(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (!ua) return { is_bot: true, bot_type: "missing_user_agent" };
  if (/googlebot|bingbot|crawler|spider|slurp|duckduckbot/.test(ua)) return { is_bot: true, bot_type: "crawler" };
  if (/curl|wget|python-requests|httpie|postman|insomnia|axios/.test(ua)) return { is_bot: true, bot_type: "script" };
  if (/nikto|sqlmap|acunetix|nessus|nmap|masscan|zgrab/.test(ua)) return { is_bot: true, bot_type: "scanner" };
  return { is_bot: false, bot_type: null };
}

export function buildRequestLog(req, res, durationMs) {
  const routePattern = getRoutePattern(req);
  const roundedDuration = Math.round(durationMs);
  const userAgent = (req.headers["user-agent"] || "").slice(0, 512) || null;
  const bot = detectBot(userAgent);
  return {
    fecha: new Date(),
    usuario_id: req.user?.usuario_id || null,
    method: req.method,
    original_url: sanitizeOriginalUrl(req.originalUrl),
    route_pattern: routePattern,
    status_code: res.statusCode,
    duration_ms: roundedDuration,
    response_bytes: parseResponseBytes(res),
    ip: req.ip || null,
    user_agent: userAgent,
    module: deriveModule(routePattern),
    status_family: deriveStatusFamily(res.statusCode),
    is_error: res.statusCode >= 400,
    is_slow: roundedDuration >= SLOW_REQUEST_MS,
    ...bot,
    ...buildRateLimitData(req),
    is_rate_limited: res.statusCode === 429,
  };
}

export function enqueueRequestLog(entry) {
  requestLogQueue.push(entry);
  if (requestLogQueue.length >= REQUEST_LOG_BATCH_SIZE) {
    void flushRequestLogs();
  }
}

export async function flushRequestLogs() {
  if (flushing || requestLogQueue.length === 0) return;
  flushing = true;
  const batch = requestLogQueue.splice(0, REQUEST_LOG_BATCH_SIZE);
  try {
    await ApiRequestLog.bulkCreate(batch, { validate: false });
  } catch (error) {
    console.warn("REQUEST_LOG_WRITE_FAILED", error.message);
  } finally {
    flushing = false;
  }
}

function addMonths(date, months) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function startOfHour(date) {
  const copy = new Date(date);
  copy.setMinutes(0, 0, 0);
  return copy;
}

function previousHour() {
  const now = new Date();
  now.setHours(now.getHours() - 1);
  return startOfHour(now);
}

function percentile(values, percentileValue) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

export async function rollupApiRequestHour(hourBucket = previousHour()) {
  const hourStart = startOfHour(hourBucket);
  const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
  const rows = await ApiRequestLog.findAll({
    where: { fecha: { [Op.gte]: hourStart, [Op.lt]: hourEnd } },
    attributes: [
      "module",
      "route_pattern",
      "method",
      "status_family",
      "limiter",
      "status_code",
      "duration_ms",
      "response_bytes",
      "usuario_id",
    ],
    raw: true,
  });

  const groups = new Map();
  rows.forEach((row) => {
    const moduleName = row.module || deriveModule(row.route_pattern);
    const routePattern = normalizeRoutePattern(row.route_pattern || "unknown");
    const method = row.method || "UNKNOWN";
    const statusFamily = row.status_family || deriveStatusFamily(row.status_code);
    const limiter = row.limiter || "none";
    const key = [moduleName, routePattern, method, statusFamily, limiter].join("\u001f");
    if (!groups.has(key)) {
      groups.set(key, {
        hour_bucket: hourStart,
        module: moduleName,
        route_pattern: routePattern,
        method,
        status_family: statusFamily,
        limiter,
        total_requests: 0,
        total_4xx: 0,
        total_5xx: 0,
        total_429: 0,
        durations: [],
        total_response_bytes: 0,
        usuarios: new Set(),
      });
    }
    const group = groups.get(key);
    const statusCode = Number(row.status_code);
    const duration = Number(row.duration_ms);
    group.total_requests += 1;
    if (statusCode >= 400 && statusCode <= 499) group.total_4xx += 1;
    if (statusCode >= 500) group.total_5xx += 1;
    if (statusCode === 429) group.total_429 += 1;
    if (Number.isFinite(duration)) group.durations.push(duration);
    group.total_response_bytes += Number(row.response_bytes || 0);
    if (row.usuario_id != null) group.usuarios.add(row.usuario_id);
  });

  await sequelize.transaction(async (transaction) => {
    await ApiRequestMetricHourly.destroy({ where: { hour_bucket: hourStart }, transaction });
    const payload = Array.from(groups.values()).map((group) => ({
      hour_bucket: group.hour_bucket,
      module: group.module,
      route_pattern: group.route_pattern,
      method: group.method,
      status_family: group.status_family,
      limiter: group.limiter,
      total_requests: group.total_requests,
      total_4xx: group.total_4xx,
      total_5xx: group.total_5xx,
      total_429: group.total_429,
      avg_duration_ms: group.durations.length
        ? group.durations.reduce((sum, value) => sum + value, 0) / group.durations.length
        : 0,
      max_duration_ms: group.durations.length ? Math.max(...group.durations) : 0,
      p95_duration_ms: percentile(group.durations, 95),
      total_response_bytes: group.total_response_bytes,
      usuarios_activos: group.usuarios.size,
      created_at: new Date(),
      updated_at: new Date(),
    }));
    if (payload.length) {
      await ApiRequestMetricHourly.bulkCreate(payload, { transaction, validate: false });
    }
  });
}

async function backfillRecentRollups() {
  try {
    await rollupApiRequestHour(previousHour());
  } catch (error) {
    console.warn("OBSERVABILITY_ROLLUP_BACKFILL_FAILED", error.message);
  }
}

export function scheduleObservabilityRollups() {
  cron.schedule("5 * * * *", () => {
    rollupApiRequestHour().catch((error) => {
      console.warn("OBSERVABILITY_ROLLUP_FAILED", error.message);
    });
  }, { timezone: "America/Argentina/Buenos_Aires" });
  void backfillRecentRollups();
}

export function logRateLimitEvent(req, limiter) {
  const info = req.rateLimit || {};
  const resetTime = info.resetTime instanceof Date ? info.resetTime : null;
  RateLimitEvent.create({
    fecha: new Date(),
    usuario_id: req.user?.usuario_id || null,
    limiter,
    method: req.method,
    original_url: sanitizeOriginalUrl(req.originalUrl),
    route_pattern: getRoutePattern(req),
    status_code: 429,
    ip: req.ip || null,
    user_agent: (req.headers["user-agent"] || "").slice(0, 512) || null,
    rate_limit_key: req.rateLimitKeyContext || info.key || null,
    rate_limit_used: info.used ?? info.current ?? null,
    rate_limit_limit: info.limit ?? null,
    rate_limit_remaining: info.remaining ?? null,
    reset_time: resetTime,
  }).catch((error) => {
    console.warn("RATE_LIMIT_EVENT_WRITE_FAILED", error.message);
  });
}

export async function initializeObservability() {
  scheduleRequestLogFlush();
  scheduleObservabilityRetention();
  scheduleObservabilityRollups();
}

export function scheduleRequestLogFlush() {
  setInterval(() => {
    void flushRequestLogs();
  }, REQUEST_LOG_FLUSH_MS).unref();
}

export function scheduleObservabilityRetention() {
  setInterval(() => {
    void cleanupOldObservabilityLogs();
  }, 24 * 60 * 60 * 1000).unref();
  void cleanupOldObservabilityLogs();
}

export async function cleanupOldObservabilityLogs() {
  const retentionDays = Number.isInteger(REQUEST_LOG_RETENTION_DAYS) && REQUEST_LOG_RETENTION_DAYS > 0
    ? REQUEST_LOG_RETENTION_DAYS
    : 90;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const rollupRetentionMonths = Number.isInteger(REQUEST_ROLLUP_RETENTION_MONTHS) && REQUEST_ROLLUP_RETENTION_MONTHS > 0
    ? REQUEST_ROLLUP_RETENTION_MONTHS
    : 12;
  const rollupCutoff = addMonths(new Date(), -rollupRetentionMonths);
  try {
    await Promise.all([
      ApiRequestLog.destroy({ where: { fecha: { [Op.lt]: cutoff } } }),
      RateLimitEvent.destroy({ where: { fecha: { [Op.lt]: cutoff } } }),
      ApiRequestMetricHourly.destroy({ where: { hour_bucket: { [Op.lt]: rollupCutoff } } }),
    ]);
  } catch (error) {
    console.warn("OBSERVABILITY_RETENTION_FAILED", error.message);
  }
}
