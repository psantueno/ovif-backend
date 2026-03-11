import { PartidaRecurso } from "../models/index.js";

export const getPartidasRecursosSelect = async (req, res) => {
    try {
        const partidas = await PartidaRecurso.findAll({
            attributes: ["partidas_recursos_codigo", "partidas_recursos_descripcion"],
            order: [["partidas_recursos_codigo", "ASC"]],
        });

        res.json(partidas);
    } catch (error) {
        console.error("❌ Error consultando partidas de recursos:", error);
        res.status(500).json({ error: "Error consultando partidas de recursos" });
    }
}