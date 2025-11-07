import { PautaConvenio } from "../models/index.js";

export const getPautaConvenioParametros = async (req, res) => {
  const pautaParam = req.params?.pautaId ?? req.query?.pautaId ?? req.query?.id;

  if (!pautaParam || !/^[0-9]+$/.test(String(pautaParam))) {
    return res.status(400).json({ error: "El identificador de pauta es obligatorio y debe ser numérico." });
  }

  const pautaId = Number.parseInt(pautaParam, 10);

  try {
    const pauta = await PautaConvenio.findOne({
      where: { pauta_id: pautaId },
    });

    if (!pauta) {
      return res.status(404).json({ error: "Pauta del convenio no encontrada." });
    }

    const dia_vto = Number.parseInt(pauta.dia_vto, 10);
    const plazo_vto = Number.parseInt(pauta.plazo_vto, 10);

    return res.json({
      dia_vto: Number.isNaN(dia_vto) ? null : dia_vto,
      plazo_vto: Number.isNaN(plazo_vto) ? null : plazo_vto,
    });
  } catch (error) {
    console.error("❌ Error obteniendo parámetros de la pauta del convenio:", error);
    return res.status(500).json({ error: "Error obteniendo parámetros de la pauta del convenio" });
  }
};
