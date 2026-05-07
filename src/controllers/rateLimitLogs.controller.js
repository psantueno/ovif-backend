import { Op, fn, col, literal } from "sequelize";
import { ApiRequestLog, RateLimitEvent } from "../models/index.js";

function parseDateRange(query) {
  const hastaBase = query.hasta || new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
  const desdeBase = query.desde || hastaBase;
  return {
    desde: new Date(`${desdeBase}T00:00:00-03:00`),
    hasta: new Date(`${hastaBase}T23:59:59-03:00`),
  };
}

function buildWhere(query) {
  const { desde, hasta } = parseDateRange(query);
  const where = { fecha: { [Op.between]: [desde, hasta] } };
  if (query.usuario_id) where.usuario_id = Number.parseInt(query.usuario_id, 10);
  if (query.endpoint) where.route_pattern = query.endpoint;
  if (query.status_code) where.status_code = Number.parseInt(query.status_code, 10);
  if (query.limiter) where.limiter = query.limiter;
  return where;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentile(values, percentileValue) {
  if (!values.length) return 0;
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function addP95(rows, where, groupField) {
  return Promise.all(rows.map(async (row) => {
    const value = row[groupField];
    const durations = await ApiRequestLog.findAll({
      where: { ...where, [groupField]: value },
      attributes: ["duration_ms"],
      raw: true,
      limit: 5000,
      order: [["duration_ms", "ASC"]],
    });
    return {
      ...row,
      p95_duration_ms: percentile(durations.map((item) => item.duration_ms), 95),
    };
  }));
}

function csvEscape(value) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  });
  return lines.join("\n");
}

export const obtenerResumenRateLimits = async (req, res) => {
  try {
    const where = buildWhere(req.query);
    const [totalRequests, total429, total4xx, total5xx, usuariosActivos, limiterRows, endpointRows, userRows, slowRows, profile401, refreshRequests] = await Promise.all([
      ApiRequestLog.count({ where }),
      ApiRequestLog.count({ where: { ...where, status_code: 429 } }),
      ApiRequestLog.count({ where: { ...where, status_code: { [Op.between]: [400, 499] } } }),
      ApiRequestLog.count({ where: { ...where, status_code: { [Op.gte]: 500 } } }),
      ApiRequestLog.count({ where, distinct: true, col: "usuario_id" }),
      RateLimitEvent.findAll({
        where: { fecha: where.fecha },
        attributes: ["limiter", [fn("COUNT", col("rate_limit_event_id")), "total"]],
        group: ["limiter"],
        order: [[literal("total"), "DESC"]],
        raw: true,
      }),
      ApiRequestLog.findAll({
        where,
        attributes: [
          "route_pattern",
          "method",
          [fn("COUNT", col("request_log_id")), "total"],
          [fn("SUM", literal("status_code = 429")), "total_429"],
          [fn("AVG", col("duration_ms")), "avg_duration_ms"],
          [fn("MAX", col("duration_ms")), "max_duration_ms"],
        ],
        group: ["route_pattern", "method"],
        order: [[literal("total"), "DESC"]],
        limit: 10,
        raw: true,
      }),
      ApiRequestLog.findAll({
        where: { ...where, usuario_id: { [Op.ne]: null } },
        attributes: [
          "usuario_id",
          [fn("COUNT", col("request_log_id")), "total"],
          [fn("SUM", literal("status_code = 429")), "total_429"],
          [fn("AVG", col("duration_ms")), "avg_duration_ms"],
        ],
        group: ["usuario_id"],
        order: [[literal("total"), "DESC"]],
        limit: 10,
        raw: true,
      }),
      ApiRequestLog.findAll({
        where,
        attributes: [
          "route_pattern",
          "method",
          [fn("COUNT", col("request_log_id")), "total"],
          [fn("AVG", col("duration_ms")), "avg_duration_ms"],
          [fn("MAX", col("duration_ms")), "max_duration_ms"],
        ],
        group: ["route_pattern", "method"],
        order: [[literal("avg_duration_ms"), "DESC"]],
        limit: 10,
        raw: true,
      }),
      ApiRequestLog.count({ where: { ...where, route_pattern: "/api/auth/profile", status_code: 401 } }),
      ApiRequestLog.count({ where: { ...where, route_pattern: "/api/auth/refresh" } }),
    ]);

    const endpoints = await addP95(endpointRows, where, "route_pattern");
    const slowEndpoints = await addP95(slowRows, where, "route_pattern");

    return res.json({
      totalRequests,
      total429,
      total4xx,
      total5xx,
      usuariosActivos,
      bloqueosPorLimiter: limiterRows.map((row) => ({ ...row, total: toNumber(row.total) })),
      topEndpoints: endpoints,
      topUsuarios: userRows,
      endpointsLentos: slowEndpoints,
      patrones: {
        profile401,
        refreshRequests,
        posibleLoopProfileRefresh: profile401 > 0 && refreshRequests > 0,
      },
    });
  } catch (error) {
    console.error("Error generando resumen de rate limits:", error);
    return res.status(500).json({ error: "Error generando resumen de rate limits" });
  }
};

export const listarUsuariosRateLimits = async (req, res) => {
  try {
    const where = buildWhere(req.query);
    const rows = await ApiRequestLog.findAll({
      where: { ...where, usuario_id: { [Op.ne]: null } },
      attributes: [
        "usuario_id",
        [fn("COUNT", col("request_log_id")), "total_requests"],
        [fn("SUM", literal("status_code = 429")), "total_429"],
        [fn("AVG", col("duration_ms")), "avg_duration_ms"],
        [fn("MAX", col("duration_ms")), "max_duration_ms"],
        [fn("MAX", col("fecha")), "ultimo_request"],
      ],
      group: ["usuario_id"],
      order: [[literal("total_requests"), "DESC"]],
      limit: Number.parseInt(req.query.limit, 10) || 50,
      raw: true,
    });
    return res.json({ data: rows });
  } catch (error) {
    console.error("Error listando usuarios de rate limits:", error);
    return res.status(500).json({ error: "Error listando usuarios de rate limits" });
  }
};

export const listarEndpointsRateLimits = async (req, res) => {
  try {
    const where = buildWhere(req.query);
    const rows = await ApiRequestLog.findAll({
      where,
      attributes: [
        "route_pattern",
        "method",
        [fn("COUNT", col("request_log_id")), "total_requests"],
        [fn("SUM", literal("status_code = 429")), "total_429"],
        [fn("SUM", literal("status_code BETWEEN 400 AND 499")), "total_4xx"],
        [fn("SUM", literal("status_code >= 500")), "total_5xx"],
        [fn("AVG", col("duration_ms")), "avg_duration_ms"],
        [fn("MAX", col("duration_ms")), "max_duration_ms"],
      ],
      group: ["route_pattern", "method"],
      order: [[literal("total_requests"), "DESC"]],
      limit: Number.parseInt(req.query.limit, 10) || 100,
      raw: true,
    });
    const data = await addP95(rows, where, "route_pattern");
    return res.json({ data });
  } catch (error) {
    console.error("Error listando endpoints de rate limits:", error);
    return res.status(500).json({ error: "Error listando endpoints de rate limits" });
  }
};

export const listarEventosRateLimits = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const where = buildWhere(req.query);
    const { rows, count } = await RateLimitEvent.findAndCountAll({
      where,
      order: [["fecha", "DESC"]],
      limit,
      offset,
      raw: true,
    });
    return res.json({ data: rows, total: count, page, limit });
  } catch (error) {
    console.error("Error listando eventos de rate limits:", error);
    return res.status(500).json({ error: "Error listando eventos de rate limits" });
  }
};

export const exportarInformeRateLimits = async (req, res) => {
  try {
    const where = buildWhere(req.query);
    const format = req.query.format === "csv" ? "csv" : "json";
    const endpoints = await ApiRequestLog.findAll({
      where,
      attributes: [
        "route_pattern",
        "method",
        [fn("COUNT", col("request_log_id")), "total_requests"],
        [fn("SUM", literal("status_code = 429")), "total_429"],
        [fn("AVG", col("duration_ms")), "avg_duration_ms"],
        [fn("MAX", col("duration_ms")), "max_duration_ms"],
      ],
      group: ["route_pattern", "method"],
      order: [[literal("total_requests"), "DESC"]],
      raw: true,
    });

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=rate-limits.csv");
      return res.send(toCsv(endpoints));
    }

    return res.json({ generatedAt: new Date().toISOString(), endpoints });
  } catch (error) {
    console.error("Error exportando informe de rate limits:", error);
    return res.status(500).json({ error: "Error exportando informe de rate limits" });
  }
};
