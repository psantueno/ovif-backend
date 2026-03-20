import { MunicipioMail, Municipio } from "../models/index.js";
import { Op, Sequelize } from "sequelize";
import { MunicipiosMailsSchema } from "../validation/MunicipiosMailsSchema.validation.js";
import { zodErrorsToArray } from "../utils/zodErrorMessages.js";

const obtenerMunicipio = async (municipioId) => {
    const municipio = await Municipio.findByPk(municipioId, {
        raw: true
    });

    if(municipio) return municipio.municipio_nombre

    return ''
}

export const getMunicipiosMailsSelect = async (req, res) => {
    try {
        const mails = await MunicipioMail.findAll({
            attributes: [
                [Sequelize.fn('DISTINCT', Sequelize.col('email')), 'email'],
            ],
            order: [
                ["email", "ASC"]
            ],
            raw: true
        });

        res.json(mails);
    } catch (error) {
        console.error("❌ Error consultando mails de municipios:", error);
        res.status(500).json({ error: "Error consultando mails de municipios" });
    }
}

export const listarMunicipiosMails = async (req, res) => {
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
            where.email = { [Op.like]: `%${trimmedSearch}%` };
        }

        const { rows, count } = await MunicipioMail.findAndCountAll({
            where,
            order: [
                ["municipio_id", "ASC"],
            ],
            limit: limiteFinal,
            offset,
        });

        const municipiosMailsPlanos = await Promise.all(
            rows.map(async (c) => {
                return {
                    municipio_id: c.municipio_id,
                    email: c.email,
                    nombre: c.nombre,
                    municipio_nombre: await obtenerMunicipio(c.municipio_id)
                };
            })
        );

        const totalPaginas = limiteFinal > 0 ? Math.ceil(count / limiteFinal) : 0;

        res.json({
            total: count,
            pagina: paginaFinal,
            limite: limiteFinal,
            totalPaginas,
            data: municipiosMailsPlanos,
        });
    } catch (error) {
        console.error("❌ Error consultando mails de muncipios:", error);
        res.status(500).json({ error: "Error consultando mails de muncipios" });
    }
}

export const listarMunicipiosSinMail = async (req, res) => {
    try {
        const municipiosConMail = await MunicipioMail.findAll({
            attributes: ['municipio_id'],
            group: ['municipio_id'],
            raw: true
        });

        const ids = municipiosConMail.map(m => m.municipio_id);

        const municipiosSinMail = await Municipio.findAll({
            where: {
                municipio_id: {
                    [Op.notIn]: ids
                }
            },
            attributes: ['municipio_nombre', 'municipio_id'],
            order: [
                ['municipio_nombre', 'ASC']
            ],
            raw: true
        });

        const nombres = municipiosSinMail.map(m => m.municipio_nombre)

        res.json(nombres)
    } catch (error) {
        console.error("❌ Error obteniendo municipios sin mail:", error);
        res.status(500).json({ error: "Error obteniendo municipios sin mail" });
    }
}

export const crearMunicipioMail = async (req, res) => {
    const {
        municipio_id,
        nombre,
        email
    } = req.body;

    try {
        const valid = MunicipiosMailsSchema.safeParse({
            municipio_id,
            nombre,
            email
        })

        if (!valid.success) {
            return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(',') })
        }

        const municipio = await Municipio.findByPk(municipio_id, { raw: true });

        if(!municipio) return res.status(500).json({ error: "El municipio indicado no existe" });

        const existente = await MunicipioMail.findOne({
            where: {
                municipio_id,
                email
            },
        });

        if (existente) return res.status(500).json({ error: "El mail del municipio ya existe" });

        await MunicipioMail.create({
            municipio_id,
            nombre,
            email
        })

        const municipioMailPlano = {
            municipio_id,
            nombre,
            email,
            municipio_nombre: municipio.municipio_nombre
        }

        res.json({
            message: "Mail del municipio creado correctamente",
            mail: municipioMailPlano,
        });
    } catch (error) {
        console.error("❌ Error creando el mail del municipio:", error);
        res.status(500).json({ error: "Error creando el mail del municipio" });
    }
}

export const actualizarMunicipioMail = async (req, res) => {
    const { municipio_id, email } = req.params;
    const {
        nombre
    } = req.body;

    const municipioId = Number(municipio_id)

    try {
        const municipioMail = await MunicipioMail.findOne({
            where: {
                municipio_id: municipioId,
                email
            },
        });

        if (!municipioMail) {
            return res.status(404).json({ error: "Mail del municipio no encontrado" });
        }

        const valid = MunicipiosMailsSchema.safeParse({
            municipio_id: municipioId, 
            email,
            nombre
        })

        if (!valid.success) {
            return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(',') })
        }

        if(nombre !== municipioMail.nombre) municipioMail.nombre = nombre

        await municipioMail.save();

        const municipioMailPlano = {
            municipio_id,
            nombre,
            email,
            municipio_nombre: await obtenerMunicipio(municipioId)
        }

        res.json({
            message: "Mail del municipio actualizado correctamente",
            mail: municipioMailPlano,
        });
    } catch (error) {
        console.error("❌ Error actualizando el mail del municipio:", error);
        res.status(500).json({ error: "Error actualizando el mail del municipio" });
    }
};

export const eliminarMunicipioMail = async (req, res) => {
    const { municipio_id, email } = req.params;

    try {
        const municipioMail = await MunicipioMail.findOne({
            where: {
                municipio_id,
                email
            },
        });

        if (!municipioMail) {
            return res.status(404).json({ error: "Mail del municipio no encontrado" });
        }

        await municipioMail.destroy();

        res.json({ message: "Mail del municipio eliminado correctamente" });
    } catch (error) {
        console.error("❌ Error eliminando mail del municipio:", error);
        res.status(500).json({ error: "Error eliminando mail del municipio" });
    }
}
