import { CronLog } from "../models/index.js";

// Listar todos los logs (paginados opcionalmente)
export const listarCronLogs = async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;

  try {
    const logs = await CronLog.findAll({
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["fecha", "DESC"]],
    });

    return res.json(logs);
  } catch (error) {
    console.error("❌ Error listando cron logs:", error);
    return res.status(500).json({ error: "Error listando cron logs" });
  }
};

// Buscar un log por ID
export const getCronLogById = async (req, res) => {
  const { id } = req.params;

  try {
    const log = await CronLog.findByPk(id);
    if (!log) {
      return res.status(404).json({ error: "Log no encontrado" });
    }

    return res.json(log);
  } catch (error) {
    console.error("❌ Error obteniendo cron log:", error);
    return res.status(500).json({ error: "Error obteniendo cron log" });
  }
};

// Filtrar logs por tarea (ej: cierre_automatico)
export const getCronLogsByTask = async (req, res) => {
  const { tarea } = req.params;

  try {
    const logs = await CronLog.findAll({
      where: { nombre_tarea: tarea },
      order: [["fecha", "DESC"]],
    });

    return res.json(logs);
  } catch (error) {
    console.error("❌ Error filtrando logs por tarea:", error);
    return res.status(500).json({ error: "Error filtrando logs" });
  }
};
