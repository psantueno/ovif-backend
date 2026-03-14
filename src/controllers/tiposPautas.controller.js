import { TipoPauta } from "../models/index.js";

export const getTiposPautasSelect = async (req, res) => {
    try {
        const tipoPautas = await TipoPauta.findAll({
            attributes: ["tipo_pauta_id", "nombre", "requiere_periodo_rectificar"],
            order: [["nombre", "ASC"]],
        });

        res.json(tipoPautas);
    } catch (error) {
        console.error("❌ Error consultando tipos de pautas:", error);
        res.status(500).json({ error: "Error consultando tipos de pautas" });
    }
}