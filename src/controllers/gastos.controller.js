import Gasto from "../models/moduloCargaDatos/Gasto.js";
import Municipio from "../models/Municipio.js";
import PartidaGasto from "../models/partidas/PartidaGasto.js";
import PartidaEconomico from "../models/puentes/PartidaEconomico.js";
import EconomicoGasto from "../models/clasificacionEconomica/EconomicoGasto.js";


// === Listar gastos ===
export const listarGastos = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;

  try {
    const gastos = await Gasto.findAll({
      where: {
        gastos_ejercicio: ejercicio,
        gastos_mes: mes,
        municipio_id: municipioId
      },
      include: [
        { model: Municipio, attributes: ["municipio_id", "municipio_nombre"] },
        { model: PartidaGasto, attributes: ["partidas_gastos_codigo", "partidas_gastos_descripcion"] },
      ]
    });

    return res.json(gastos);
  } catch (error) {
    console.error("❌ Error listando gastos:", error);
    return res.status(500).json({ error: "Error listando gastos" });
  }
};

// === Crear gasto ===
export const crearGasto = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;
  const { partidas_gastos_codigo, gastos_importe_devengado } = req.body;

  try {
    const nuevo = await Gasto.create({
      gastos_ejercicio: ejercicio,
      gastos_mes: mes,
      municipio_id: municipioId,
      partidas_gastos_codigo,
      gastos_importe_devengado
    });

    return res.status(201).json(nuevo);
  } catch (error) {
    console.error("❌ Error creando gasto:", error);
    return res.status(500).json({ error: "Error creando gasto" });
  }
};

// === Actualizar gasto ===
export const actualizarGasto = async (req, res) => {
  const { ejercicio, mes, municipioId, partida } = req.params;
  const { gastos_importe_devengado } = req.body;

  try {
    const gasto = await Gasto.findOne({
      where: {
        gastos_ejercicio: ejercicio,
        gastos_mes: mes,
        municipio_id: municipioId,
        partidas_gastos_codigo: partida
      }
    });

    if (!gasto) return res.status(404).json({ error: "Gasto no encontrado" });

    gasto.gastos_importe_devengado = gastos_importe_devengado ?? gasto.gastos_importe_devengado;
    await gasto.save();

    return res.json(gasto);
  } catch (error) {
    console.error("❌ Error actualizando gasto:", error);
    return res.status(500).json({ error: "Error actualizando gasto" });
  }
};

// === Eliminar gasto ===
export const eliminarGasto = async (req, res) => {
  const { ejercicio, mes, municipioId, partida } = req.params;

  try {
    const deleted = await Gasto.destroy({
      where: {
        gastos_ejercicio: ejercicio,
        gastos_mes: mes,
        municipio_id: municipioId,
        partidas_gastos_codigo: partida
      }
    });

    if (deleted === 0) return res.status(404).json({ error: "Gasto no encontrado" });

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
      where: {
        gastos_ejercicio: ejercicio,
        gastos_mes: mes,
        municipio_id: municipioId
      },
      attributes: [
        "partidas_gastos_codigo",
        [Gasto.sequelize.fn("SUM", Gasto.sequelize.col("gastos_importe_devengado")), "total_monto"],
      ],
      include: [
        {
          model: PartidaGasto,
          attributes: ["partidas_gastos_descripcion"]
        }
      ],
      group: ["partidas_gastos_codigo", "PartidaGasto.partidas_gastos_codigo", "PartidaGasto.partidas_gastos_descripcion"],
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
      where: {
        gastos_ejercicio: ejercicio,
        gastos_mes: mes,
        municipio_id: municipioId
      },
      attributes: [
        [sequelize.col("PartidaGasto->PartidaEconomico->EconomicoGasto.cod_economico"), "cod_economico"],
        [sequelize.col("PartidaGasto->PartidaEconomico->EconomicoGasto.descripcion"), "descripcion"],
        [sequelize.fn("SUM", sequelize.col("gastos_importe_devengado")), "total_monto"],
      ],
      include: [
        {
          model: PartidaGasto,
          attributes: [],
          required: true, // INNER JOIN (cambiá a false si querés conservar partidas sin clasificar)
          include: [
            {
              model: PartidaEconomico,
              attributes: [],
              required: true, // idem
              include: [
                {
                  model: EconomicoGasto,
                  attributes: [],
                  required: true // idem
                },
              ],
            },
          ],
        },
      ],
      group: [
        sequelize.col("PartidaGasto->PartidaEconomico->EconomicoGasto.cod_economico"),
        sequelize.col("PartidaGasto->PartidaEconomico->EconomicoGasto.descripcion"),
      ],
      raw: true,
    });

    return res.json(totales);
  } catch (error) {
    console.error("❌ Error generando reporte por económico:", error);
    return res.status(500).json({ error: "Error generando reporte por económico" });
  }
};
