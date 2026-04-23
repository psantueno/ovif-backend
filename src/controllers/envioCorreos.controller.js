import { Op } from "sequelize";
import EnvioCorreo from "../models/moduloEjercicios/EnvioCorreo.js";

// Listar envíos de correos con filtros opcionales
export const listarEnviosCorreos = async (req, res) => {
  const { limit = 50, offset = 0, estado, tipo } = req.query;

  try {
    const where = {};
    if (estado) where.estado = estado;
    if (tipo) where.tipo = tipo;

    const { count, rows } = await EnvioCorreo.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    return res.json({ total: count, data: rows });
  } catch (error) {
    console.error("Error listando envíos de correos:", error);
    return res.status(500).json({ error: "Error listando envíos de correos" });
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
