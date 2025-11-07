import { Op } from "sequelize";
import { Convenio, PautaConvenio } from "../models/index.js";

export const listarConveniosActivos = async (req, res) => {
  try {
    const convenios = await Convenio.findAll({
      where: {
        fecha_fin: {
          [Op.gte]: new Date().toISOString().slice(0, 10),
        },
      },
      order: [["nombre", "ASC"]],
    });

    return res.json(convenios);
  } catch (error) {
    console.error("❌ Error listando convenios:", error);
    return res.status(500).json({ error: "Error listando convenios" });
  }
};

export const listarPautasPorConvenio = async (req, res) => {
  const { convenioId } = req.params;

  if (!convenioId || !/^[0-9]+$/.test(convenioId)) {
    return res.status(400).json({ error: "El convenioId es obligatorio y debe ser numérico" });
  }

  try {
    const pautas = await PautaConvenio.findAll({
      where: { convenio_id: Number.parseInt(convenioId, 10) },
      order: [["pauta_id", "ASC"]],
    });

    return res.json(pautas);
  } catch (error) {
    console.error("❌ Error listando pautas por convenio:", error);
    return res.status(500).json({ error: "Error listando pautas del convenio" });
  }
};
