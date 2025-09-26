import Gasto from "../models/moduloCargaDatos/Gasto.js";
import Municipio from "../models/Municipio.js";
import PartidaGasto from "../models/partidas/PartidaGasto.js";
import PartidaEconomico from "../models/puentes/PartidaEconomico.js";
import EconomicoGasto from "../models/clasificacionEconomica/EconomicoGasto.js";


// === Listar todos los gastos de un municipio en un ejercicio/mes ===
export const listarGastos = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;

  try {
    const gastos = await Gasto.findAll({
      where: { ejercicio, mes, municipio_id: municipioId },
      include: [
        { model: Municipio, attributes: ["municipio_id", "municipio_nombre"] },
        { model: PartidaGasto, attributes: ["cod_partida_gasto", "descripcion"] },
      ],
      order: [["id_gasto", "ASC"]],
    });

    return res.json(gastos);
  } catch (error) {
    console.error("❌ Error listando gastos:", error);
    return res.status(500).json({ error: "Error listando gastos" });
  }
};

// === Crear un gasto ===
export const crearGasto = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;
  const { cod_partida_gasto, monto, descripcion } = req.body;

  try {
    const nuevo = await Gasto.create({
      ejercicio,
      mes,
      municipio_id: municipioId,
      cod_partida_gasto,
      monto,
      descripcion,
    });

    return res.status(201).json(nuevo);
  } catch (error) {
    console.error("❌ Error creando gasto:", error);
    return res.status(500).json({ error: "Error creando gasto" });
  }
};

// === Actualizar un gasto ===
export const updateGasto = async (req, res) => {
  const { id } = req.params;
  const { cod_partida_gasto, monto, descripcion } = req.body;

  try {
    const gasto = await Gasto.findByPk(id);
    if (!gasto) {
      return res.status(404).json({ error: "Gasto no encontrado" });
    }

    gasto.cod_partida_gasto = cod_partida_gasto ?? gasto.cod_partida_gasto;
    gasto.monto = monto ?? gasto.monto;
    gasto.descripcion = descripcion ?? gasto.descripcion;

    await gasto.save();

    return res.json(gasto);
  } catch (error) {
    console.error("❌ Error actualizando gasto:", error);
    return res.status(500).json({ error: "Error actualizando gasto" });
  }
};

// === Eliminar un gasto ===
export const deleteGasto = async (req, res) => {
  const { id } = req.params;

  try {
    const gasto = await Gasto.findByPk(id);
    if (!gasto) {
      return res.status(404).json({ error: "Gasto no encontrado" });
    }

    await gasto.destroy();
    return res.json({ message: "Gasto eliminado correctamente" });
  } catch (error) {
    console.error("❌ Error eliminando gasto:", error);
    return res.status(500).json({ error: "Error eliminando gasto" });
  }
};

// === Reporte: totales por partida ===
export const reportePorPartida = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;

  try {
    const totales = await Gasto.findAll({
      where: { ejercicio, mes, municipio_id: municipioId },
      attributes: [
        "cod_partida_gasto",
        [Gasto.sequelize.fn("SUM", Gasto.sequelize.col("monto")), "total_monto"],
      ],
      include: [{ model: PartidaGasto, attributes: ["descripcion"] }],
      group: ["cod_partida_gasto", "PartidaGasto.cod_partida_gasto"],
    });

    return res.json(totales);
  } catch (error) {
    console.error("❌ Error generando reporte por partida:", error);
    return res.status(500).json({ error: "Error generando reporte por partida" });
  }
};


// === Reporte: totales por clasificación económica ===
export const reportePorEconomico = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;

  try {
    const sequelize = Gasto.sequelize;

    const totales = await Gasto.findAll({
      where: { ejercicio, mes, municipio_id: municipioId },
      attributes: [
        [sequelize.col("EconomicoGasto.cod_economico"), "cod_economico"],
        [sequelize.col("EconomicoGasto.descripcion"), "descripcion"],
        [sequelize.fn("SUM", sequelize.col("monto")), "total_monto"],
      ],
      include: [
        {
          model: PartidaGasto,
          attributes: [],
          include: [
            {
              model: PartidaEconomico,
              attributes: [],
              include: [
                {
                  model: EconomicoGasto,
                  attributes: [],
                },
              ],
            },
          ],
        },
      ],
      group: ["EconomicoGasto.cod_economico", "EconomicoGasto.descripcion"],
      raw: true,
    });

    return res.json(totales);
  } catch (error) {
    console.error("❌ Error generando reporte por económico:", error);
    return res.status(500).json({ error: "Error generando reporte por económico" });
  }
};