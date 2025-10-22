import PartidaGasto from "../models/partidas/PartidaGasto.js";

// === Listar partidas de gastos activas con jerarquía ===
export const obtenerPartidasGastos = async (req, res) => {
  try {
    const partidas = await PartidaGasto.findAll({
      order: [
        ["partidas_gastos_padre", "ASC"],
        ["partidas_gastos_codigo", "ASC"],
      ],
    });

    const partidasMap = new Map();
    partidas.forEach((partida) => {
      partidasMap.set(partida.partidas_gastos_codigo, {
        ...partida.toJSON(),
        puede_cargar: Boolean(partida.partidas_gastos_carga),
        children: [],
      });
    });

    const jerarquia = [];

    partidasMap.forEach((partida) => {
      const parentId = partida.partidas_gastos_padre;
      const esRaiz =
        parentId === null ||
        parentId === undefined ||
        parentId === 0 ||
        parentId === partida.partidas_gastos_codigo ||
        !partidasMap.has(parentId);

      if (esRaiz) {
        jerarquia.push(partida);
        return;
      }

      const padre = partidasMap.get(parentId);
      if (padre) {
        padre.children.push(partida);
      } else {
        jerarquia.push(partida);
      }
    });

    return res.json(jerarquia);
  } catch (error) {
    console.error("❌ Error obteniendo partidas de gastos:", error);
    return res.status(500).json({ error: "Error obteniendo partidas de gastos" });
  }
};

