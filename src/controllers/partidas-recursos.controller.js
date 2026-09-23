import { PartidaRecurso } from "../models/index.js";

export const getPartidasRecursosSelect = async (req, res) => {
    try {
        // ?imputables=1 filtra solo las partidas con partidas_recursos_carga=1
        // (hoja/imputable), para no permitir homologar contra partidas padre
        // o agregadoras. Lo usan las matrices de homogeneización.
        const soloImputables = req.query.imputables === "1" || req.query.imputables === "true";
        const where = soloImputables ? { partidas_recursos_carga: true } : undefined;

        const partidas = await PartidaRecurso.findAll({
            where,
            attributes: ["partidas_recursos_codigo", "partidas_recursos_descripcion"],
            order: [["partidas_recursos_codigo", "ASC"]],
        });

        res.json(partidas);
    } catch (error) {
        console.error("❌ Error consultando partidas de recursos:", error);
        res.status(500).json({ error: "Error consultando partidas de recursos" });
    }
}