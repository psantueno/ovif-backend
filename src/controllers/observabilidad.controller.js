import { Op, fn, col, literal } from "sequelize";
import { z } from "zod";
import { ApiRequestLog, ApiRequestMetricHourly, RateLimitEvent } from "../models/index.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const METHOD_VALUES = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
const RAW_RETENTION_DAYS = 90;
const ROLLUP_MAX_DAYS = 366;

const baseQuerySchema = z.object({
  desde: z.string().regex(DATE_RE).optional(),
  hasta: z.string().regex(DATE_RE).optional(),
  usuario_id: z.coerce.number().int().positive().optional(),
  module: z.string().trim().max(80).optional(),
  route_pattern: z.string().trim().max(255).optional(),
  endpoint: z.string().trim().max(255).optional(),
  method: z.enum(METHOD_VALUES).optional(),
  status_code: z.coerce.number().int().min(100).max(599).optional(),
  limiter: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  format: z.enum(["json", "csv"]).default("json"),
}).superRefine((query, ctx) => {
  const range = parseDateRange(query);
  if (range.desde > range.hasta) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "desde debe ser menor o igual a hasta", path: ["desde"] });
  }
});

function argentinaDate() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
}

function parseDateRange(query) {
  const hastaBase = query.hasta || argentinaDate();
  const desdeBase = query.desde || hastaBase;
  return {
    desde: new Date(`${desdeBase}T00:00:00-03:00`),
    hasta: new Date(`${hastaBase}T23:59:59-03:00`),
  };
}

function daysBetween({ desde, hasta }) {
  return Math.ceil((hasta.getTime() - desde.getTime()) / (24 * 60 * 60 * 1000));
}

function validateQuery(req, res) {
  const parsed = baseQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Filtros inválidos",
      details: parsed.error.issues.map((issue) => issue.message),
    });
    return null;
  }
  return parsed.data;
}

function buildRollupWhere(query) {
  const { desde, hasta } = parseDateRange(query);
  const where = { hour_bucket: { [Op.between]: [desde, hasta] } };
  if (query.module) where.module = query.module;
  if (query.route_pattern || query.endpoint) where.route_pattern = query.route_pattern || query.endpoint;
  if (query.method) where.method = query.method;
  if (query.limiter) where.limiter = query.limiter;
  if (query.status_code) where.status_family = `${Math.floor(query.status_code / 100)}xx`;
  return where;
}

function buildRawWhere(query) {
  const { desde, hasta } = parseDateRange(query);
  const where = { fecha: { [Op.between]: [desde, hasta] } };
  if (query.usuario_id) where.usuario_id = query.usuario_id;
  if (query.module) where.module = query.module;
  if (query.route_pattern || query.endpoint) where.route_pattern = query.route_pattern || query.endpoint;
  if (query.method) where.method = query.method;
  if (query.status_code) where.status_code = query.status_code;
  if (query.limiter) where.limiter = query.limiter;
  return where;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function csvEscape(value) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

async function exactActiveUsers(query) {
  const range = parseDateRange(query);
  if (daysBetween(range) > RAW_RETENTION_DAYS) {
    return { exact: false, total: null };
  }
  return {
    exact: true,
    total: await ApiRequestLog.count({ where: buildRawWhere(query), distinct: true, col: "usuario_id" }),
  };
}

export const obtenerMetricasObservabilidad = async (req, res) => {
  try {
    const query = validateQuery(req, res);
    if (!query) return;
    const range = parseDateRange(query);
    if (daysBetween(range) > ROLLUP_MAX_DAYS) {
      return res.status(400).json({ error: "Las métricas agregadas permiten rangos de hasta 12 meses." });
    }
    const where = buildRollupWhere(query);
    const [
      totals,
      requestsPorDia,
      requestsPorHora,
      statusFamilies,
      modules,
      slowEndpoints,
      usuariosActivos,
    ] = await Promise.all([
      ApiRequestMetricHourly.findOne({
        where,
        attributes: [
          [fn("SUM", col("total_requests")), "total_requests"],
          [fn("SUM", col("total_4xx")), "total_4xx"],
          [fn("SUM", col("total_5xx")), "total_5xx"],
          [fn("SUM", col("total_429")), "total_429"],
          [fn("AVG", col("avg_duration_ms")), "avg_duration_ms"],
          [fn("MAX", col("p95_duration_ms")), "p95_duration_ms"],
        ],
        raw: true,
      }),
      ApiRequestMetricHourly.findAll({
        where,
        attributes: [
          [literal("DATE_FORMAT(hour_bucket, '%Y-%m-%d')"), "fecha"],
          [fn("SUM", col("total_requests")), "requests"],
          [fn("AVG", col("avg_duration_ms")), "avg_duration_ms"],
        ],
        group: [literal("DATE_FORMAT(hour_bucket, '%Y-%m-%d')")],
        order: [[literal("fecha"), "ASC"]],
        raw: true,
      }),
      ApiRequestMetricHourly.findAll({
        where,
        attributes: [
          [literal("HOUR(hour_bucket)"), "hora"],
          [fn("SUM", col("total_requests")), "requests"],
        ],
        group: [literal("HOUR(hour_bucket)")],
        order: [[literal("hora"), "ASC"]],
        raw: true,
      }),
      ApiRequestMetricHourly.findAll({
        where,
        attributes: ["status_family", [fn("SUM", col("total_requests")), "total"]],
        group: ["status_family"],
        order: [["status_family", "ASC"]],
        raw: true,
      }),
      ApiRequestMetricHourly.findAll({
        where,
        attributes: [
          "module",
          [fn("SUM", col("total_requests")), "total_requests"],
          [fn("SUM", col("total_4xx")), "total_4xx"],
          [fn("SUM", col("total_5xx")), "total_5xx"],
          [fn("AVG", col("avg_duration_ms")), "avg_duration_ms"],
        ],
        group: ["module"],
        order: [[literal("total_requests"), "DESC"]],
        limit: 10,
        raw: true,
      }),
      ApiRequestMetricHourly.findAll({
        where,
        attributes: [
          "route_pattern",
          "method",
          [fn("SUM", col("total_requests")), "total_requests"],
          [fn("AVG", col("avg_duration_ms")), "avg_duration_ms"],
          [fn("MAX", col("max_duration_ms")), "max_duration_ms"],
          [fn("MAX", col("p95_duration_ms")), "p95_duration_ms"],
        ],
        group: ["route_pattern", "method"],
        having: literal("SUM(total_requests) > 0"),
        order: [[literal("p95_duration_ms"), "DESC"]],
        limit: 5,
        raw: true,
      }),
      exactActiveUsers(query),
    ]);

    return res.json({
      periodo: { desde: range.desde, hasta: range.hasta },
      kpis: {
        totalRequests: number(totals?.total_requests),
        total4xx: number(totals?.total_4xx),
        total5xx: number(totals?.total_5xx),
        total429: number(totals?.total_429),
        avgDurationMs: number(totals?.avg_duration_ms),
        p95DurationMs: number(totals?.p95_duration_ms),
        usuariosActivos: usuariosActivos.total,
        usuariosActivosExacto: usuariosActivos.exact,
      },
      requestsPorDia,
      requestsPorHora,
      statusFamilies,
      modules,
      topEndpointsLentos: slowEndpoints,
    });
  } catch (error) {
    console.error("Error obteniendo métricas de observabilidad:", error);
    return res.status(500).json({ error: "Error obteniendo métricas de observabilidad" });
  }
};

export const obtenerRateLimitsResumenObservabilidad = async (req, res) => {
  try {
    const query = validateQuery(req, res);
    if (!query) return;
    const rawWhere = buildRawWhere(query);
    const eventWhere = { fecha: rawWhere.fecha };
    if (query.limiter) eventWhere.limiter = query.limiter;
    if (query.usuario_id) eventWhere.usuario_id = query.usuario_id;
    if (query.route_pattern || query.endpoint) eventWhere.route_pattern = query.route_pattern || query.endpoint;

    const [bloqueosPorLimiter, usuariosAfectados, eventosRecientes] = await Promise.all([
      RateLimitEvent.findAll({
        where: eventWhere,
        attributes: ["limiter", [fn("COUNT", col("rate_limit_event_id")), "total"]],
        group: ["limiter"],
        order: [[literal("total"), "DESC"]],
        raw: true,
      }),
      RateLimitEvent.findAll({
        where: { ...eventWhere, usuario_id: { [Op.ne]: null } },
        attributes: ["usuario_id", [fn("COUNT", col("rate_limit_event_id")), "total"]],
        group: ["usuario_id"],
        order: [[literal("total"), "DESC"]],
        limit: 10,
        raw: true,
      }),
      RateLimitEvent.findAll({
        where: eventWhere,
        order: [["fecha", "DESC"]],
        limit: 20,
        raw: true,
      }),
    ]);

    return res.json({ bloqueosPorLimiter, usuariosAfectados, eventosRecientes });
  } catch (error) {
    console.error("Error obteniendo rate limits de observabilidad:", error);
    return res.status(500).json({ error: "Error obteniendo rate limits de observabilidad" });
  }
};

export const explorarRequestsObservabilidad = async (req, res) => {
  try {
    const query = validateQuery(req, res);
    if (!query) return;
    const range = parseDateRange(query);
    if (daysBetween(range) > RAW_RETENTION_DAYS) {
      return res.status(400).json({ error: "Los logs crudos solo se retienen 90 días. Reducí el rango." });
    }
    const offset = (query.page - 1) * query.limit;
    const { rows, count } = await ApiRequestLog.findAndCountAll({
      where: buildRawWhere(query),
      attributes: [
        "request_log_id",
        "fecha",
        "usuario_id",
        "method",
        "original_url",
        "route_pattern",
        "module",
        "status_code",
        "duration_ms",
        "response_bytes",
        "ip",
        "user_agent",
        "limiter",
        "rate_limit_used",
        "rate_limit_limit",
        "is_rate_limited",
        "is_slow",
        "is_bot",
        "bot_type",
      ],
      order: [["fecha", "DESC"]],
      limit: query.limit,
      offset,
      raw: true,
    });
    return res.json({ data: rows, total: count, page: query.page, limit: query.limit });
  } catch (error) {
    console.error("Error explorando requests:", error);
    return res.status(500).json({ error: "Error explorando requests" });
  }
};

export const obtenerAnomaliasObservabilidad = async (req, res) => {
  try {
    const query = validateQuery(req, res);
    if (!query) return;
    const rollupWhere = buildRollupWhere(query);
    const rawWhere = buildRawWhere(query);
    const [profile401, refreshRequests, totals, slowEndpoints, pdfPressure, rateLimitSpike] = await Promise.all([
      ApiRequestLog.count({ where: { ...rawWhere, route_pattern: "/api/auth/profile", status_code: 401 } }),
      ApiRequestLog.count({ where: { ...rawWhere, route_pattern: "/api/auth/refresh" } }),
      ApiRequestMetricHourly.findOne({
        where: rollupWhere,
        attributes: [
          [fn("SUM", col("total_requests")), "total_requests"],
          [fn("SUM", col("total_4xx")), "total_4xx"],
          [fn("SUM", col("total_5xx")), "total_5xx"],
          [fn("SUM", col("total_429")), "total_429"],
        ],
        raw: true,
      }),
      ApiRequestMetricHourly.findAll({
        where: { ...rollupWhere, p95_duration_ms: { [Op.gte]: 1000 } },
        attributes: [
          "route_pattern",
          "method",
          [fn("SUM", col("total_requests")), "total_requests"],
          [fn("MAX", col("p95_duration_ms")), "p95_duration_ms"],
        ],
        group: ["route_pattern", "method"],
        order: [[literal("p95_duration_ms"), "DESC"]],
        limit: 10,
        raw: true,
      }),
      ApiRequestMetricHourly.findAll({
        where: { ...rollupWhere, route_pattern: { [Op.like]: "%informe%" } },
        attributes: [
          "route_pattern",
          "method",
          [fn("SUM", col("total_requests")), "total_requests"],
          [fn("SUM", col("total_429")), "total_429"],
          [fn("MAX", col("p95_duration_ms")), "p95_duration_ms"],
        ],
        group: ["route_pattern", "method"],
        order: [[literal("total_requests"), "DESC"]],
        limit: 10,
        raw: true,
      }),
      RateLimitEvent.findAll({
        where: { fecha: rawWhere.fecha },
        attributes: ["limiter", [fn("COUNT", col("rate_limit_event_id")), "total"]],
        group: ["limiter"],
        having: literal("COUNT(rate_limit_event_id) >= 5"),
        order: [[literal("total"), "DESC"]],
        raw: true,
      }),
    ]);

    const totalRequests = number(totals?.total_requests);
    const totalErrors = number(totals?.total_4xx) + number(totals?.total_5xx);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    const anomalias = [
      {
        type: "refresh_loop",
        active: profile401 >= 20 && refreshRequests >= 20,
        severity: profile401 >= 100 ? "high" : "medium",
        metrics: { profile401, refreshRequests },
      },
      {
        type: "error_spike",
        active: totalRequests >= 50 && errorRate >= 10,
        severity: errorRate >= 25 ? "high" : "medium",
        metrics: { totalRequests, totalErrors, errorRate: Math.round(errorRate * 100) / 100 },
      },
      {
        type: "slow_endpoint",
        active: slowEndpoints.length > 0,
        severity: slowEndpoints.some((row) => number(row.p95_duration_ms) >= 3000) ? "high" : "medium",
        metrics: { endpoints: slowEndpoints },
      },
      {
        type: "pdf_pressure",
        active: pdfPressure.some((row) => number(row.total_429) > 0 || number(row.p95_duration_ms) >= 3000),
        severity: pdfPressure.some((row) => number(row.total_429) > 0) ? "high" : "medium",
        metrics: { endpoints: pdfPressure },
      },
      {
        type: "rate_limit_spike",
        active: rateLimitSpike.length > 0,
        severity: rateLimitSpike.some((row) => number(row.total) >= 20) ? "high" : "medium",
        metrics: { limiters: rateLimitSpike },
      },
    ];

    return res.json({ anomalias, thresholds: { refreshLoop: 20, errorRatePercent: 10, slowP95Ms: 1000, pdfP95Ms: 3000, limiterEvents: 5 } });
  } catch (error) {
    console.error("Error obteniendo anomalías:", error);
    return res.status(500).json({ error: "Error obteniendo anomalías" });
  }
};

export const obtenerUserJourneyObservabilidad = async (req, res) => {
  try {
    const query = validateQuery(req, res);
    if (!query) return;
    const usuarioId = Number.parseInt(req.params.usuario_id, 10);
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      return res.status(400).json({ error: "usuario_id inválido" });
    }
    const range = parseDateRange(query);
    if (daysBetween(range) > RAW_RETENTION_DAYS) {
      return res.status(400).json({ error: "Los logs crudos solo se retienen 90 días. Reducí el rango." });
    }
    const offset = (query.page - 1) * query.limit;
    const { rows, count } = await ApiRequestLog.findAndCountAll({
      where: { ...buildRawWhere(query), usuario_id: usuarioId },
      attributes: [
        "request_log_id",
        "fecha",
        "method",
        "route_pattern",
        "status_code",
        "duration_ms",
        "module",
        "limiter",
        "is_rate_limited",
        "is_slow",
      ],
      order: [["fecha", "DESC"]],
      limit: query.limit,
      offset,
      raw: true,
    });
    return res.json({ usuario_id: usuarioId, data: rows, total: count, page: query.page, limit: query.limit });
  } catch (error) {
    console.error("Error obteniendo user journey:", error);
    return res.status(500).json({ error: "Error obteniendo user journey" });
  }
};

export const exportarInformeObservabilidad = async (req, res) => {
  try {
    const query = validateQuery(req, res);
    if (!query) return;
    const where = buildRollupWhere(query);
    const rows = await ApiRequestMetricHourly.findAll({
      where,
      attributes: [
        "hour_bucket",
        "module",
        "route_pattern",
        "method",
        "status_family",
        "limiter",
        "total_requests",
        "total_4xx",
        "total_5xx",
        "total_429",
        "avg_duration_ms",
        "max_duration_ms",
        "p95_duration_ms",
        "total_response_bytes",
        "usuarios_activos",
      ],
      order: [["hour_bucket", "DESC"]],
      limit: 10000,
      raw: true,
    });
    if (query.format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=observabilidad.csv");
      return res.send(toCsv(rows));
    }
    return res.json({ generatedAt: new Date().toISOString(), data: rows });
  } catch (error) {
    console.error("Error exportando observabilidad:", error);
    return res.status(500).json({ error: "Error exportando observabilidad" });
  }
};
