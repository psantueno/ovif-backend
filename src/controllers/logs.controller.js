import { CronLog } from "../models/index.js";
import { Op } from "sequelize";

export const listarLogs = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page, 10) || 1;
        const limit = Number.parseInt(req.query.limit, 10) || 12;
        const offset = (page - 1) * limit;

        const ejercicioFilter = req.query.ejercicio ? Number.parseInt(req.query.ejercicio, 10) : null;
        const mesFilter = req.query.mes ? Number.parseInt(req.query.mes, 10) : null;
        const municipioIdFilter = req.query.municipio_id ? Number.parseInt(req.query.municipio_id, 10) : null;
        const estadoFilter = req.query.estado || null;
        const fechaDesdeFilter = req.query.desde ? new Date(req.query.desde) : null;
        const fechaHastaFilter = req.query.hasta ? new Date(req.query.hasta) : null;

        const whereClause = {};
        if (ejercicioFilter) whereClause.ejercicio = ejercicioFilter;
        if (mesFilter) whereClause.mes = mesFilter;
        if (municipioIdFilter) whereClause.municipio_id = municipioIdFilter;
        if (estadoFilter) whereClause.estado = estadoFilter;
        if (fechaDesdeFilter && fechaHastaFilter) {
            whereClause.fecha = { [Op.between]: [fechaDesdeFilter, fechaHastaFilter] };
        } else if (fechaDesdeFilter) {
            whereClause.fecha = { [Op.gte]: fechaDesdeFilter };
        } else if (fechaHastaFilter) {
            whereClause.fecha = { [Op.lte]: fechaHastaFilter };
        }

        const { rows, count } = await CronLog.findAndCountAll({
            where: whereClause,
            order: [["id_log", "DESC"]],
            limit: limit,
            offset: offset
        });
        res.json({
            data: rows,
            total: count,
            page: page,
            limit: limit,
        });
    } catch (error) {
        console.error("Error al listar logs:", error);
        res.status(500).json({ error: "Error al listar logs" });
    }
}