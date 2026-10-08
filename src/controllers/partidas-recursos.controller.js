import { zodErrorsToArray } from "../utils/zodErrorMessages.js";
import { esCodigoPartidaValido } from "../utils/partidasRecursos.js";
import {
    PartidaRecursoError,
    abrirPartida,
    actualizarPartida,
    cambiarEstadoPartida,
    crearPartida,
    historialPartida,
    listarParaSelect,
    listarPartidas,
    obtenerReferencias,
} from "../services/partidasRecursos.service.js";
import {
    PartidaRecursoAltaSchema,
    PartidaRecursoAperturaSchema,
    PartidaRecursoEstadoSchema,
    PartidaRecursoUpdateSchema,
} from "../validation/PartidasRecursosSchema.validation.js";

const codigoDesdeParam = (req, res) => {
    const codigo = Number(req.params.codigo);
    if (!esCodigoPartidaValido(codigo)) {
        res.status(400).json({ error: "El código de partida indicado no es válido" });
        return null;
    }
    return codigo;
};

const validar = (schema, body, res) => {
    const valid = schema.safeParse(body);
    if (!valid.success) {
        res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(", ") });
        return null;
    }
    return valid.data;
};

const manejarError = (res, error, mensajeGenerico) => {
    if (error instanceof PartidaRecursoError) {
        return res.status(error.status).json({ error: error.message, detalle: error.detalle });
    }
    if (error?.name === "SequelizeForeignKeyConstraintError") {
        return res.status(409).json({ error: "La operación dejaría referencias inválidas a partidas de recursos" });
    }
    console.error("❌", mensajeGenerico, error);
    return res.status(500).json({ error: mensajeGenerico });
};

export const getPartidasRecursosSelect = async (req, res) => {
    try {
        // ?imputables=1 filtra solo las partidas con partidas_recursos_carga=1
        // (hoja/imputable), para no permitir homologar contra partidas padre
        // o agregadoras. Lo usan las matrices de homogeneización.
        // ?incluir=<codigo> agrega esa partida aunque esté inactiva, para que
        // un diálogo de edición muestre el valor actual.
        const soloImputables = req.query.imputables === "1" || req.query.imputables === "true";
        const incluir = Number(req.query.incluir);

        const partidas = await listarParaSelect({
            soloImputables,
            incluir: esCodigoPartidaValido(incluir) ? incluir : null,
        });

        res.json(partidas);
    } catch (error) {
        console.error("❌ Error consultando partidas de recursos:", error);
        res.status(500).json({ error: "Error consultando partidas de recursos" });
    }
};

export const listarPartidasRecursos = async (req, res) => {
    try {
        return res.json(await listarPartidas(req.query));
    } catch (error) {
        return manejarError(res, error, "Error consultando el catálogo de partidas de recursos");
    }
};

export const crearPartidaRecurso = async (req, res) => {
    const datos = validar(PartidaRecursoAltaSchema, req.body, res);
    if (!datos) return;
    try {
        const partida = await crearPartida(datos, req.user?.usuario_id ?? null);
        return res.status(201).json({ message: "Partida creada correctamente", data: partida });
    } catch (error) {
        return manejarError(res, error, "Error creando la partida");
    }
};

export const actualizarPartidaRecurso = async (req, res) => {
    const codigo = codigoDesdeParam(req, res);
    if (codigo === null) return;
    const datos = validar(PartidaRecursoUpdateSchema, req.body, res);
    if (!datos) return;
    try {
        const { partida, cambios } = await actualizarPartida(codigo, datos, req.user?.usuario_id ?? null);
        const message = cambios.length ? "Partida actualizada correctamente" : "No había cambios para guardar";
        return res.json({ message, data: partida, cambios });
    } catch (error) {
        return manejarError(res, error, "Error actualizando la partida");
    }
};

export const cambiarEstadoPartidaRecurso = async (req, res) => {
    const codigo = codigoDesdeParam(req, res);
    if (codigo === null) return;
    const datos = validar(PartidaRecursoEstadoSchema, req.body, res);
    if (!datos) return;
    try {
        const partida = await cambiarEstadoPartida(codigo, datos, req.user?.usuario_id ?? null);
        const message = datos.activo ? "Partida reactivada correctamente" : "Partida dada de baja correctamente";
        return res.json({ message, data: partida });
    } catch (error) {
        return manejarError(res, error, "Error cambiando el estado de la partida");
    }
};

export const referenciasPartidaRecurso = async (req, res) => {
    const codigo = codigoDesdeParam(req, res);
    if (codigo === null) return;
    try {
        return res.json(await obtenerReferencias(codigo));
    } catch (error) {
        return manejarError(res, error, "Error consultando las referencias de la partida");
    }
};

export const abrirPartidaRecurso = async (req, res) => {
    const codigo = codigoDesdeParam(req, res);
    if (codigo === null) return;
    const datos = validar(PartidaRecursoAperturaSchema, req.body, res);
    if (!datos) return;
    try {
        const resultado = await abrirPartida(codigo, datos, req.user?.usuario_id ?? null);
        return res.json({ message: "Partida abierta correctamente", data: resultado });
    } catch (error) {
        return manejarError(res, error, "Error abriendo la partida");
    }
};

export const historialPartidaRecurso = async (req, res) => {
    const codigo = codigoDesdeParam(req, res);
    if (codigo === null) return;
    try {
        return res.json(await historialPartida(codigo, req.query));
    } catch (error) {
        return manejarError(res, error, "Error consultando el historial de la partida");
    }
};
