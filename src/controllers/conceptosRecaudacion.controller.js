import { ConceptoRecaudacion, PartidaRecurso, Recaudacion, RecaudacionRectificada } from "../models/index.js";
import { Op } from "sequelize";
import { ConceptosRecaudacionSchema } from "../validation/ConceptosRecaudacionSchema.validation.js";
import { zodErrorsToArray } from "../utils/zodErrorMessages.js";


export const getConceptosSelect = async (req, res) => {
    try {
        const conceptos = await ConceptoRecaudacion.findAll({
        attributes: ["cod_concepto", "descripcion"],
        order: [["descripcion", "ASC"]],
        });

        res.json(conceptos);
    } catch (error) {
        console.error("❌ Error consultando conceptos de recaudación:", error);
        res.status(500).json({ error: "Error consultando conceptos de recaudación" });
    }
}

export const listarConceptos = async (req, res) => {
    try {
        let { pagina = 1, limite = 10, search } = req.query;

        const paginaParsed = Number.parseInt(pagina, 10);
        const limiteParsed = Number.parseInt(limite, 10);
        const paginaFinal = Number.isFinite(paginaParsed) && paginaParsed > 0 ? paginaParsed : 1;
        const limiteFinal = Number.isFinite(limiteParsed) && limiteParsed > 0 ? limiteParsed : 10;
        const offset = (paginaFinal - 1) * limiteFinal;

        const where = {};
        const trimmedSearch = typeof search === "string" ? search.trim() : "";
        if (trimmedSearch) {
        where.descripcion = { [Op.like]: `%${trimmedSearch}%` };
        }

        const { rows, count } = await ConceptoRecaudacion.findAndCountAll({
            where,
            order: [
                ["cod_concepto", "ASC"],
            ],
            limit: limiteFinal,
            offset,
        });

        const conceptosPlanas = await Promise.all(
            rows.map(async (c) => {
                const modificable = await esConceptoModificable(c.cod_concepto);

                return {
                cod_concepto: c.cod_concepto,
                descripcion: c.descripcion,
                cod_recurso: c.cod_recurso,
                modificable: modificable
                };
            })
        );

        const totalPaginas = limiteFinal > 0 ? Math.ceil(count / limiteFinal) : 0;

        res.json({
            total: count,
            pagina: paginaFinal,
            limite: limiteFinal,
            totalPaginas,
            data: conceptosPlanas,
        });
    } catch (error) {
        console.error("❌ Error consultando conceptos de recaudación:", error);
        res.status(500).json({ error: "Error consultando conceptos de recaudación" });
    }
}

export const crearConcepto = async (req, res) => {
    const {
        descripcion,
        cod_recurso,
        cod_concepto
    } = req.body;

    try {
        const valid = ConceptosRecaudacionSchema.safeParse({
            descripcion,
            cod_recurso,
            cod_concepto
        })

        if (!valid.success) {
            return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(',') })
        }

        if (cod_concepto) {
            const conceptoDuplicado = await ConceptoRecaudacion.findOne({ where: { cod_concepto: cod_concepto } });

            if (conceptoDuplicado) {
                return res.status(400).json({ error: "Ya existe otro concepto con este código" });
            }
        }

        if (descripcion) {
            const conceptoDuplicado = await ConceptoRecaudacion.findOne({ where: { descripcion: descripcion } });

            if (conceptoDuplicado) {
                return res.status(400).json({ error: "Ya existe otro concepto con esta descripción" });
            }
        }

        if (cod_recurso) {
            const recurso = await PartidaRecurso.findOne({ where: { partidas_recursos_codigo: cod_recurso } })
            if (!recurso) {
                return res.status(400).json({ error: "No existe el recurso seleccionado" });
            }
        }

        const concepto = await ConceptoRecaudacion.create({
            descripcion: descripcion,
            cod_concepto: cod_concepto,
            cod_recurso: cod_recurso ?? null
        })

        res.json({
            message: "Concepto creado correctamente",
            concepto,
        });
    } catch (error) {
        console.error("❌ Error creando concepto:", error);
        res.status(500).json({ error: "Error creando concepto" });
    }
}

export const actualizarConcepto = async (req, res) => {
    const { codigo } = req.params;
    const {
        descripcion,
        cod_recurso,
        cod_concepto
    } = req.body;

    try {
        const concepto = await ConceptoRecaudacion.findByPk(codigo);

        if (!concepto) {
            return res.status(404).json({ error: "Concepto no encontrado" });
        }

        const modificable = await esConceptoModificable(codigo);

        if (!modificable) {
            return res.status(400).json({ error: "El concepto está asociado a otros datos y no puede ser actualizado" });
        }

        const valid = ConceptosRecaudacionSchema.safeParse({
            cod_concepto,
            descripcion,
            cod_recurso,
        })

        if (!valid.success) {
            return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(',') })
        }

        if (cod_recurso) {
            const recurso = await PartidaRecurso.findOne({ where: { partidas_recursos_codigo: cod_recurso } })
            if (!recurso) {
                return res.status(400).json({ error: "No existe el recurso seleccionado" });
            }
        }

        if (descripcion && descripcion !== concepto.descripcion) {
            const conceptoDuplicado = await ConceptoRecaudacion.findOne({ where: { descripcion: descripcion } });

            if (conceptoDuplicado) {
                return res.status(400).json({ error: "Ya existe otro concepto con esta descripción" });
            }

            concepto.descripcion = descripcion;
        }

        if (cod_concepto && cod_concepto !== concepto.cod_concepto) {
            const conceptoDuplicado = await ConceptoRecaudacion.findOne({ where: { cod_concepto: cod_concepto } });

            if (conceptoDuplicado) {
                return res.status(400).json({ error: "Ya existe otro concepto con este código" });
            }

            concepto.cod_concepto = cod_concepto;
        }

        if (cod_recurso != undefined && cod_recurso != null) concepto.cod_recurso = cod_recurso;
        if (cod_recurso === null) concepto.cod_recurso = null;
        await concepto.save();
        concepto.modificable = modificable;

        res.json({
            message: "Concepto actualizado correctamente",
            concepto,
        });
    } catch (error) {
        console.error("❌ Error actualizando concepto:", error);
        res.status(500).json({ error: "Error actualizando concepto" });
    }
};

export const eliminarConcepto = async (req, res) => {
    const { cod_concepto } = req.params;

    try {
        const concepto = await ConceptoRecaudacion.findByPk(cod_concepto);

        if (!concepto) {
            return res.status(404).json({ error: "Concepto no encontrado" });
        }

        const modificable = await esConceptoModificable(cod_concepto);

        if (!modificable) {
            return res.status(400).json({ error: "El concepto está asociado a otros datos y no puede ser eliminado" });
        }

        await concepto.destroy();

        res.json({ message: "Concepto eliminado correctamente" });
    } catch (error) {
        console.error("❌ Error eliminando concepto:", error);
        res.status(500).json({ error: "Error eliminando concepto" });
    }
}

const esConceptoModificable = async (cod_concepto) => {
    const recaudacion = await Recaudacion.findOne({ where: { cod_concepto: cod_concepto } })
    if (recaudacion) return false;

    const recaudacionRectificada = await RecaudacionRectificada.findOne({ where: { cod_concepto: cod_concepto } })
    if (recaudacionRectificada) return false;

    return true;
}