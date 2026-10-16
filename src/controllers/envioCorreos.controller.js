import { Op } from "sequelize";
import EnvioCorreo from "../models/moduloEjercicios/EnvioCorreo.js";

const ESTADOS_VALIDOS = ["PENDIENTE", "ENVIANDO", "ENVIADO", "ERROR"];
const LIMITE_MAXIMO = 100;

const toPositiveInt = (value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.min(parsed, max);
};

// Escapa los comodines de LIKE para que el texto buscado se tome literal
const escaparLike = (texto) => texto.replace(/[\\%_]/g, (c) => `\\${c}`);

const fechaAR = (valor, finDeDia) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor ?? ""))) return null;
  const fecha = new Date(`${valor}T${finDeDia ? "23:59:59" : "00:00:00"}-03:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

// Listar envíos de correos con filtros opcionales.
// Filtros: estado, tipo, destinatario (búsqueda parcial), desde/hasta (YYYY-MM-DD, hora Argentina).
// No devuelve el payload (puede ser grande y no se muestra en el listado).
export const listarEnviosCorreos = async (req, res) => {
  const { estado, tipo, destinatario, desde, hasta } = req.query;
  const limit = toPositiveInt(req.query.limit, 50, { min: 1, max: LIMITE_MAXIMO });
  const offset = toPositiveInt(req.query.offset, 0);

  try {
    const where = {};

    if (estado) {
      if (!ESTADOS_VALIDOS.includes(String(estado))) {
        return res.status(400).json({ error: `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(", ")}` });
      }
      where.estado = estado;
    }

    if (tipo) {
      where.tipo = String(tipo).substring(0, 50);
    }

    const textoDestinatario = typeof destinatario === "string" ? destinatario.trim().substring(0, 255) : "";
    if (textoDestinatario) {
      where[Op.or] = [
        { destinatario: { [Op.like]: `%${escaparLike(textoDestinatario)}%` } },
        { nombre_destinatario: { [Op.like]: `%${escaparLike(textoDestinatario)}%` } },
      ];
    }

    const fechaDesde = desde ? fechaAR(desde, false) : null;
    const fechaHasta = hasta ? fechaAR(hasta, true) : null;
    if ((desde && !fechaDesde) || (hasta && !fechaHasta)) {
      return res.status(400).json({ error: "Las fechas deben tener formato YYYY-MM-DD" });
    }
    if (fechaDesde && fechaHasta) {
      where.created_at = { [Op.between]: [fechaDesde, fechaHasta] };
    } else if (fechaDesde) {
      where.created_at = { [Op.gte]: fechaDesde };
    } else if (fechaHasta) {
      where.created_at = { [Op.lte]: fechaHasta };
    }

    const { count, rows } = await EnvioCorreo.findAndCountAll({
      where,
      attributes: { exclude: ["payload", "idempotency_key"] },
      limit,
      offset,
      order: [["created_at", "DESC"], ["id", "DESC"]],
    });

    return res.json({ total: count, limit, offset, data: rows });
  } catch (error) {
    console.error("Error listando envíos de correos:", error);
    return res.status(500).json({ error: "Error listando envíos de correos" });
  }
};

// Tipos de correo existentes (para el filtro del listado)
export const listarTiposEnvios = async (_req, res) => {
  try {
    const filas = await EnvioCorreo.findAll({
      attributes: [[EnvioCorreo.sequelize.fn("DISTINCT", EnvioCorreo.sequelize.col("tipo")), "tipo"]],
      order: [["tipo", "ASC"]],
      raw: true,
    });
    return res.json(filas.map((f) => f.tipo));
  } catch (error) {
    console.error("Error listando tipos de envíos:", error);
    return res.status(500).json({ error: "Error listando tipos de envíos" });
  }
};

// Estadísticas de envíos
export const obtenerEstadisticasEnvios = async (_req, res) => {
  try {
    const [pendientes, enviando, enviados, errores] = await Promise.all([
      EnvioCorreo.count({ where: { estado: "PENDIENTE" } }),
      EnvioCorreo.count({ where: { estado: "ENVIANDO" } }),
      EnvioCorreo.count({ where: { estado: "ENVIADO" } }),
      EnvioCorreo.count({ where: { estado: "ERROR" } }),
    ]);

    const erroresAgotados = await EnvioCorreo.count({
      where: {
        estado: "ERROR",
        intentos: { [Op.gte]: EnvioCorreo.sequelize.col("max_intentos") },
      },
    });

    return res.json({
      pendientes,
      enviando,
      enviados,
      errores,
      errores_agotados: erroresAgotados,
      total: pendientes + enviando + enviados + errores,
    });
  } catch (error) {
    console.error("Error obteniendo estadísticas de envíos:", error);
    return res.status(500).json({ error: "Error obteniendo estadísticas" });
  }
};
