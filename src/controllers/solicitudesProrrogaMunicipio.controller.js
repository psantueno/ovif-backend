import { v4 as uuidv4 } from "uuid";
import { Op } from "sequelize";
import sequelize from "../config/db.js";
import {
    SolicitudProrroga,
    SolicitudProrrogaEstados,
    ProrrogaMunicipio,
    EjercicioMes,
    Municipio,
    Convenio,
    PautaConvenio,
    UsuarioMunicipio,
    Usuario,
    Rol,
} from "../models/index.js";
import { obtenerFechaActual } from "../utils/obtenerFechaActual.js";
import { zodErrorsToArray } from "../utils/zodErrorMessages.js";
import {
    CrearSolicitudesSchema,
    EditarSolicitudSchema,
    CancelarSolicitudSchema,
    AprobarSolicitudSchema,
    RechazarSolicitudSchema,
    AprobarLoteSchema,
    RechazarLoteSchema,
} from "../validation/SolicitudesProrrogaSchema.validation.js";
import {
    encolarNotificacionSolicitudProrroga,
    procesarMailsPendientes,
} from "../services/emailService.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

const toISODate = (value) => {
    if (!value) return null;
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
};

// DD-MM-YYYY → YYYY-MM-DD
const parseDDMMYYYY = (str) => {
    if (!str) return null;
    const match = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return null;
    return `${match[3]}-${match[2]}-${match[1]}`;
};

const parseDate = (str) => {
    if (!str) return null;
    const match = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return null;
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    return new Date(year, month, day);
};

const includesBase = [
    { model: Municipio, attributes: ["municipio_id", "municipio_nombre"] },
    { model: Convenio, attributes: ["convenio_id", "nombre"] },
    { model: PautaConvenio, attributes: ["pauta_id", "descripcion"] },
    { model: Usuario, as: "Solicitante", attributes: ["usuario_id", "nombre", "apellido"] },
    { model: Usuario, as: "Resolutor", attributes: ["usuario_id", "nombre", "apellido"] },
];

async function esMunicipioAsignado(usuarioId, municipioId) {
    const acceso = await UsuarioMunicipio.findOne({
        where: { usuario_id: usuarioId, municipio_id: municipioId },
    });
    return !!acceso;
}

async function getMunicipiosDeUsuario(usuarioId) {
    const asignaciones = await UsuarioMunicipio.findAll({
        where: { usuario_id: usuarioId },
        attributes: ["municipio_id"],
    });
    return asignaciones.map((a) => a.municipio_id);
}

async function registrarAuditoria({ solicitud_id, accion, estado_anterior, estado_nuevo, payload_anterior, payload_nuevo, usuario_id, comentario, transaction }) {
    await SolicitudProrrogaEstados.create(
        { solicitud_id, accion, estado_anterior, estado_nuevo, payload_anterior, payload_nuevo, usuario_id, comentario },
        { transaction }
    );
}

async function obtenerEmailsAdmins() {
    const adminRoleNames = (process.env.ADMIN_ROLE_NAMES || process.env.ADMIN_ROLE_NAME || "Administrador")
        .split(",")
        .map((n) => n.trim().toLowerCase());

    const usuarios = await Usuario.findAll({
        attributes: ["usuario_id", "nombre", "apellido", "email"],
        include: [{
            model: Rol,
            as: "Roles",
            attributes: ["nombre"],
            through: { attributes: [] },
        }],
    });

    return usuarios.filter(
        (u) =>
            u.email &&
            (u.Roles || []).some((rol) => adminRoleNames.includes((rol.nombre || "").toLowerCase()))
    );
}

// Lógica de aprobación reutilizada por aprobar individual y lote
async function ejecutarAprobacion({ solicitud, fecha_cierre_aprobada_raw, comentario_resolucion, usuarioId }) {
    const hoy = obtenerFechaActual();

    let fechaAprobada = fecha_cierre_aprobada_raw
        ? parseDDMMYYYY(fecha_cierre_aprobada_raw)
        : toISODate(solicitud.fecha_cierre_solicitada);

    if (!fechaAprobada) {
        throw { status: 400, message: "Formato de fecha_cierre_aprobada inválido" };
    }

    if (fechaAprobada < hoy) {
        if (fecha_cierre_aprobada_raw) {
            throw { status: 400, message: "fecha_cierre_aprobada no puede ser anterior a hoy" };
        }
        throw {
            status: 400,
            message: "La fecha_cierre_solicitada ya venció. Debe proveer fecha_cierre_aprobada con una fecha válida (mayor o igual a hoy)",
        };
    }

    return sequelize.transaction(async (t) => {
        const sol = await SolicitudProrroga.findByPk(solicitud.solicitud_id, { transaction: t, lock: true });
        if (!sol || sol.estado !== "PENDIENTE") {
            throw { status: 400, message: "La solicitud ya no está en estado PENDIENTE" };
        }

        const oficial = await EjercicioMes.findOne({
            where: {
                ejercicio: sol.ejercicio,
                mes: sol.mes,
                convenio_id: sol.convenio_id,
                pauta_id: sol.pauta_id,
            },
            transaction: t,
        });
        if (!oficial) {
            throw { status: 404, message: "No se encontró el calendario oficial para este período" };
        }

        let prorroga = await ProrrogaMunicipio.findOne({
            where: {
                ejercicio: sol.ejercicio,
                mes: sol.mes,
                municipio_id: sol.municipio_id,
                convenio_id: sol.convenio_id,
                pauta_id: sol.pauta_id,
            },
            transaction: t,
        });

        const fechaAnterior = prorroga ? toISODate(prorroga.fecha_fin_nueva) : toISODate(oficial.fecha_fin);
        const tipoAuditoria = prorroga ? "AMPLIACION" : "PRORROGA";

        if (!prorroga) {
            prorroga = await ProrrogaMunicipio.create(
                {
                    ejercicio: sol.ejercicio,
                    mes: sol.mes,
                    municipio_id: sol.municipio_id,
                    convenio_id: sol.convenio_id,
                    pauta_id: sol.pauta_id,
                    fecha_fin_nueva: fechaAprobada,
                },
                { transaction: t }
            );
        } else {
            prorroga.fecha_fin_nueva = fechaAprobada;
            await prorroga.save({ transaction: t });
        }

        const payloadAnterior = {
            estado: sol.estado,
            fecha_cierre_solicitada: toISODate(sol.fecha_cierre_solicitada),
        };

        sol.estado = "APROBADA";
        sol.prorroga_id = prorroga.prorroga_id;
        sol.fecha_cierre_anterior = fechaAnterior;
        sol.fecha_cierre_aprobada = fechaAprobada;
        sol.resuelto_por = usuarioId;
        sol.fecha_resolucion = new Date();
        sol.comentario_resolucion = comentario_resolucion || null;
        await sol.save({ transaction: t });

        await registrarAuditoria({
            solicitud_id: sol.solicitud_id,
            accion: "APROBADA",
            estado_anterior: "PENDIENTE",
            estado_nuevo: "APROBADA",
            payload_anterior: payloadAnterior,
            payload_nuevo: {
                estado: "APROBADA",
                fecha_cierre_anterior: fechaAnterior,
                fecha_cierre_aprobada: fechaAprobada,
                prorroga_id: prorroga.prorroga_id,
            },
            usuario_id: usuarioId,
            comentario: comentario_resolucion || null,
            transaction: t,
        });

        return sol;
    });
}

// ─── Controladores ───────────────────────────────────────────────────────────

export const crearSolicitudes = async (req, res) => {
    try {
        const usuarioId = req.user?.usuario_id;
        if (!usuarioId) return res.status(401).json({ error: "Usuario no autenticado" });

        const valid = CrearSolicitudesSchema.safeParse(req.body);
        if (!valid.success) {
            return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(", ") });
        }

        const items = valid.data;
        const hoy = obtenerFechaActual();
        const errores = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const idx = i + 1;

            const asignado = await esMunicipioAsignado(usuarioId, item.municipio_id);
            if (!asignado) {
                const municipio = await Municipio.findByPk(item.municipio_id);
                errores.push({ indice: idx, error: `${municipio?.municipio_nombre ?? `ID ${item.municipio_id}`}: no tiene acceso a este municipio` });
                continue;
            }

            const oficial = await EjercicioMes.findOne({
                where: {
                    ejercicio: item.ejercicio,
                    mes: item.mes,
                    convenio_id: item.convenio_id,
                    pauta_id: item.pauta_id,
                },
            });
            if (!oficial) {
                errores.push({ indice: idx, error: `No existe el período ${item.ejercicio}/${item.mes} para el convenio/pauta indicado` });
                continue;
            }

            const fechaFinOficial = toISODate(oficial.fecha_fin);
            if (!fechaFinOficial || fechaFinOficial >= hoy) {
                errores.push({ indice: idx, error: `El período ${item.ejercicio}/${item.mes} no está cerrado aún` });
                continue;
            }

            const fechaCierre = parseDDMMYYYY(item.fecha_cierre_solicitada);
            if (!fechaCierre || fechaCierre < hoy) {
                errores.push({ indice: idx, error: "La fecha de cierre solicitada debe ser mayor o igual a hoy" });
                continue;
            }

            const duplicado = await SolicitudProrroga.findOne({
                where: {
                    municipio_id: item.municipio_id,
                    ejercicio: item.ejercicio,
                    mes: item.mes,
                    convenio_id: item.convenio_id,
                    pauta_id: item.pauta_id,
                    estado: "PENDIENTE",
                },
            });
            if (duplicado) {
                const [municipio, pauta] = await Promise.all([
                    Municipio.findByPk(item.municipio_id),
                    PautaConvenio.findByPk(item.pauta_id),
                ]);
                errores.push({ indice: idx, error: `Ya existe una solicitud pendiente para el municipio ${municipio?.municipio_nombre ?? item.municipio_id}, período ${item.ejercicio}/${item.mes}, pauta ${pauta?.descripcion ?? item.pauta_id}` });
            }
        }

        if (errores.length > 0) {
            return res.status(400).json({ error: "Errores de validación en las solicitudes", errores });
        }

        const grupoId = uuidv4();

        const solicitudesCreadas = await sequelize.transaction(async (t) => {
            const creadas = await SolicitudProrroga.bulkCreate(
                items.map((item) => ({
                    grupo_solicitud_id: grupoId,
                    municipio_id: item.municipio_id,
                    ejercicio: item.ejercicio,
                    mes: item.mes,
                    convenio_id: item.convenio_id,
                    pauta_id: item.pauta_id,
                    fecha_cierre_solicitada: parseDDMMYYYY(item.fecha_cierre_solicitada),
                    motivo: item.motivo,
                    estado: "PENDIENTE",
                    solicitado_por: usuarioId,
                    fecha_solicitud: new Date(),
                })),
                { transaction: t }
            );

            await Promise.all(
                creadas.map((sol) =>
                    registrarAuditoria({
                        solicitud_id: sol.solicitud_id,
                        accion: "CREADA",
                        estado_anterior: null,
                        estado_nuevo: "PENDIENTE",
                        payload_nuevo: {
                            municipio_id: sol.municipio_id,
                            ejercicio: sol.ejercicio,
                            mes: sol.mes,
                            convenio_id: sol.convenio_id,
                            pauta_id: sol.pauta_id,
                            fecha_cierre_solicitada: toISODate(sol.fecha_cierre_solicitada),
                            motivo: sol.motivo,
                        },
                        usuario_id: usuarioId,
                        transaction: t,
                    })
                )
            );

            return creadas;
        });

        // Fire-and-forget: email a admins (un email por lote)
        try {
            const [solicitante, admins, municipios, pautas] = await Promise.all([
                Usuario.findByPk(usuarioId, { attributes: ["nombre", "apellido"] }),
                obtenerEmailsAdmins(),
                Municipio.findAll({ where: { municipio_id: { [Op.in]: [...new Set(items.map((i) => i.municipio_id))] } }, attributes: ["municipio_id", "municipio_nombre"] }),
                PautaConvenio.findAll({ where: { pauta_id: { [Op.in]: [...new Set(items.map((i) => i.pauta_id))] } }, attributes: ["pauta_id", "descripcion"] }),
            ]);

            const municipioMap = Object.fromEntries(municipios.map((m) => [m.municipio_id, m.municipio_nombre]));
            const pautaMap = Object.fromEntries(pautas.map((p) => [p.pauta_id, p.descripcion]));
            const solicitanteNombre = `${solicitante?.nombre ?? ""} ${solicitante?.apellido ?? ""}`.trim();

            const itemsEmail = items.map((item) => ({
                municipio: municipioMap[item.municipio_id] ?? `ID ${item.municipio_id}`,
                ejercicio: item.ejercicio,
                mes: item.mes,
                pauta: pautaMap[item.pauta_id] ?? `ID ${item.pauta_id}`,
                fechaSolicitada: parseDDMMYYYY(item.fecha_cierre_solicitada),
                motivo: item.motivo,
            }));

            if (admins.length > 0) {
                const correos = await Promise.all(
                    admins.map((admin) =>
                        encolarNotificacionSolicitudProrroga({
                            tipo: "SOLICITUD_PRORROGA_CREADA",
                            destinatario: admin.email,
                            nombre: `${admin.nombre} ${admin.apellido}`.trim(),
                            asunto: `[OVIF - APP] Nueva solicitud de prórroga - ${solicitanteNombre}`,
                            payload: { nombre: `${admin.nombre} ${admin.apellido}`.trim(), solicitante: solicitanteNombre, municipios: itemsEmail },
                            idRef: grupoId,
                        })
                    )
                );
                await procesarMailsPendientes({ ids: correos.map((c) => c.correo.id) });
            }
        } catch (emailErr) {
            console.error("❌ Error encolando email de solicitud creada:", emailErr);
        }

        return res.status(201).json({
            message: "Solicitudes creadas correctamente",
            grupo_solicitud_id: grupoId,
            solicitudes: solicitudesCreadas,
        });
    } catch (error) {
        console.error("❌ Error al crear las solicitudes:", error);
        return res.status(500).json({ error: "Ocurrió un error al crear las solicitudes" });
    }
};

export const listarSolicitudes = async (req, res) => {
    try {
        const usuarioId = req.user?.usuario_id;
        if (!usuarioId) return res.status(401).json({ error: "Usuario no autenticado" });

        const {
            estado,
            municipio_id,
            ejercicio,
            mes,
            convenio_id,
            pauta_id,
            fecha_solicitud_desde,
            fecha_solicitud_hasta,
            fecha_resolucion_desde,
            fecha_resolucion_hasta,
            page = 1,
            limit = 20,
        } = req.query;

        const where = {};

        if (estado) where.estado = estado;
        if (municipio_id) where.municipio_id = Number(municipio_id);
        if (ejercicio) where.ejercicio = Number(ejercicio);
        if (mes) where.mes = Number(mes);
        if (convenio_id) where.convenio_id = Number(convenio_id);
        if (pauta_id) where.pauta_id = Number(pauta_id);
        if (fecha_solicitud_desde || fecha_solicitud_hasta) {
            where.fecha_solicitud = {};
            if (fecha_solicitud_desde) {
                const desdeDatetime = parseDate(fecha_solicitud_desde);
                desdeDatetime.setHours(0, 0, 0, 0);
                where.fecha_solicitud[Op.gte] = desdeDatetime;
            }
            if (fecha_solicitud_hasta) {
                const hastaDatetime = parseDate(fecha_solicitud_hasta);
                hastaDatetime.setHours(23, 59, 59, 999);
                where.fecha_solicitud[Op.lte] = hastaDatetime;
            }
        }
        if (fecha_resolucion_desde || fecha_resolucion_hasta) {
            where.fecha_resolucion = {};
            if (fecha_resolucion_desde) {
                const desdeDatetime = parseDate(fecha_resolucion_desde);
                desdeDatetime.setHours(0, 0, 0, 0);
                where.fecha_resolucion[Op.gte] = desdeDatetime;
            }
            if (fecha_resolucion_hasta) {
                const hastaDatetime = parseDate(fecha_resolucion_hasta);
                hastaDatetime.setHours(23, 59, 59, 999);
                where.fecha_resolucion[Op.lte] = hastaDatetime;
            }
        }

        const { isAdmin } = req;
        if (!isAdmin) {
            const municipios = await getMunicipiosDeUsuario(usuarioId);
            if (municipios.length === 0) return res.json({ total: 0, page: Number(page), limit: Number(limit), data: [] });
            if (!municipio_id) where.municipio_id = { [Op.in]: municipios };
        }

        const offset = (Number(page) - 1) * Number(limit);
        const { count, rows } = await SolicitudProrroga.findAndCountAll({
            where,
            include: includesBase,
            order: [["fecha_solicitud", "DESC"], ["ejercicio", "DESC"], ["mes", "DESC"]],
            limit: Number(limit),
            offset,
        });

        return res.json({ total: count, page: Number(page), limit: Number(limit), data: rows });
    } catch (error) {
        console.error("❌ Error al listar las solicitudes:", error);
        return res.status(500).json({ error: "Ocurrió un error al listar las solicitudes" });
    }
};

export const obtenerSolicitudPorId = async (req, res) => {
    try {
        const usuarioId = req.user?.usuario_id;
        const solicitudId = Number(req.params.id);
        if (Number.isNaN(solicitudId)) return res.status(400).json({ error: "ID inválido" });

        const solicitud = await SolicitudProrroga.findByPk(solicitudId, {
            include: [
                ...includesBase,
                {
                    model: SolicitudProrrogaEstados,
                    include: [{ model: Usuario, attributes: ["usuario_id", "nombre", "apellido"] }],
                    order: [["fecha_evento", "ASC"]],
                },
            ],
        });
        if (!solicitud) return res.status(404).json({ error: "Solicitud no encontrada" });

        const { isAdmin } = req;
        if (!isAdmin) {
            const asignado = await esMunicipioAsignado(usuarioId, solicitud.municipio_id);
            if (!asignado) return res.status(403).json({ error: "No posee autorización para ver esta solicitud" });
        }

        return res.json(solicitud);
    } catch (error) {
        console.error("❌ Error al obtener la solicitud:", error);
        return res.status(500).json({ error: "Ocurrió un error al obtener la solicitud" });
    }
};

export const editarSolicitud = async (req, res) => {
    try {
        const usuarioId = req.user?.usuario_id;
        const solicitudId = Number(req.params.id);
        if (Number.isNaN(solicitudId)) return res.status(400).json({ error: "ID inválido" });

        const valid = EditarSolicitudSchema.safeParse(req.body);
        if (!valid.success) {
            return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(", ") });
        }

        const solicitud = await SolicitudProrroga.findByPk(solicitudId);
        if (!solicitud) return res.status(404).json({ error: "Solicitud no encontrada" });
        if (solicitud.estado !== "PENDIENTE") {
            return res.status(400).json({ error: "Solo se pueden editar solicitudes en estado PENDIENTE" });
        }

        const { isAdmin } = req;
        if (!isAdmin) {
            const asignado = await esMunicipioAsignado(usuarioId, solicitud.municipio_id);
            if (!asignado) return res.status(403).json({ error: "No posee autorización para editar esta solicitud" });
        }

        const hoy = obtenerFechaActual();
        const { fecha_cierre_solicitada, motivo } = valid.data;

        if (fecha_cierre_solicitada) {
            const fechaISO = parseDDMMYYYY(fecha_cierre_solicitada);
            if (!fechaISO || fechaISO < hoy) {
                return res.status(400).json({ error: "fecha_cierre_solicitada debe ser mayor o igual a hoy" });
            }
        }

        const payloadAnterior = {
            fecha_cierre_solicitada: toISODate(solicitud.fecha_cierre_solicitada),
            motivo: solicitud.motivo,
            estado: solicitud.estado,
        };

        await sequelize.transaction(async (t) => {
            if (fecha_cierre_solicitada) solicitud.fecha_cierre_solicitada = parseDDMMYYYY(fecha_cierre_solicitada);
            if (motivo) solicitud.motivo = motivo;
            solicitud.actualizado_por = usuarioId;
            await solicitud.save({ transaction: t });

            await registrarAuditoria({
                solicitud_id: solicitud.solicitud_id,
                accion: "EDITADA",
                estado_anterior: "PENDIENTE",
                estado_nuevo: "PENDIENTE",
                payload_anterior: payloadAnterior,
                payload_nuevo: {
                    fecha_cierre_solicitada: toISODate(solicitud.fecha_cierre_solicitada),
                    motivo: solicitud.motivo,
                    estado: "PENDIENTE",
                },
                usuario_id: usuarioId,
                transaction: t,
            });
        });

        return res.json({ message: "Solicitud actualizada", solicitud });
    } catch (error) {
        console.error("❌ Error al editar la solicitud:", error);
        return res.status(500).json({ error: "Ocurrió un error al editar la solicitud" });
    }
};

export const cancelarSolicitud = async (req, res) => {
    try {
        const usuarioId = req.user?.usuario_id;
        const solicitudId = Number(req.params.id);
        if (Number.isNaN(solicitudId)) return res.status(400).json({ error: "ID inválido" });

        const valid = CancelarSolicitudSchema.safeParse(req.body);
        if (!valid.success) {
            return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(", ") });
        }

        const solicitud = await SolicitudProrroga.findByPk(solicitudId);
        if (!solicitud) return res.status(404).json({ error: "Solicitud no encontrada" });
        if (solicitud.estado !== "PENDIENTE") {
            return res.status(400).json({ error: "Solo se pueden cancelar solicitudes en estado PENDIENTE" });
        }

        const { isAdmin } = req;
        if (!isAdmin) {
            const asignado = await esMunicipioAsignado(usuarioId, solicitud.municipio_id);
            if (!asignado) return res.status(403).json({ error: "No posee autorización para cancelar esta solicitud" });
        }

        const { motivo_cancelacion } = valid.data;

        await sequelize.transaction(async (t) => {
            solicitud.estado = "CANCELADA";
            solicitud.cancelado_por = usuarioId;
            solicitud.fecha_cancelacion = new Date();
            solicitud.motivo_cancelacion = motivo_cancelacion;
            await solicitud.save({ transaction: t });

            await registrarAuditoria({
                solicitud_id: solicitud.solicitud_id,
                accion: "CANCELADA",
                estado_anterior: "PENDIENTE",
                estado_nuevo: "CANCELADA",
                payload_anterior: { estado: "PENDIENTE" },
                payload_nuevo: { estado: "CANCELADA", motivo_cancelacion },
                usuario_id: usuarioId,
                comentario: motivo_cancelacion,
                transaction: t,
            });
        });

        // Fire-and-forget: email a admins
        try {
            const [municipio, pauta, solicitante, admins] = await Promise.all([
                Municipio.findByPk(solicitud.municipio_id, { attributes: ["municipio_nombre"] }),
                PautaConvenio.findByPk(solicitud.pauta_id, { attributes: ["descripcion"] }),
                Usuario.findByPk(solicitud.solicitado_por, { attributes: ["nombre", "apellido"] }),
                obtenerEmailsAdmins(),
            ]);

            if (admins.length > 0) {
                const correos = await Promise.all(
                    admins.map((admin) =>
                        encolarNotificacionSolicitudProrroga({
                            tipo: "SOLICITUD_PRORROGA_CANCELADA",
                            destinatario: admin.email,
                            nombre: `${admin.nombre} ${admin.apellido}`.trim(),
                            asunto: `[OVIF - APP] Solicitud de prórroga cancelada - ${municipio?.municipio_nombre ?? ""}`,
                            payload: {
                                nombre: `${admin.nombre} ${admin.apellido}`.trim(),
                                solicitante: `${solicitante?.nombre ?? ""} ${solicitante?.apellido ?? ""}`.trim(),
                                municipio: municipio?.municipio_nombre ?? `ID ${solicitud.municipio_id}`,
                                ejercicio: solicitud.ejercicio,
                                mes: solicitud.mes,
                                pauta: pauta?.descripcion ?? `ID ${solicitud.pauta_id}`,
                                motivoCancelacion: motivo_cancelacion,
                            },
                            idRef: solicitud.solicitud_id,
                        })
                    )
                );
                await procesarMailsPendientes({ ids: correos.map((c) => c.correo.id) });
            }
        } catch (emailErr) {
            console.error("❌ Error encolando email de cancelación:", emailErr);
        }

        return res.json({ message: "Solicitud cancelada", solicitud });
    } catch (error) {
        console.error("❌ Error al cancelar la solicitud:", error);
        return res.status(500).json({ error: "Ocurrió un error al cancelar la solicitud" });
    }
};

export const aprobarSolicitud = async (req, res) => {
    try {
        const usuarioId = req.user?.usuario_id;
        const solicitudId = Number(req.params.id);
        if (Number.isNaN(solicitudId)) return res.status(400).json({ error: "ID inválido" });

        const valid = AprobarSolicitudSchema.safeParse(req.body);
        if (!valid.success) {
            return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(", ") });
        }

        const solicitud = await SolicitudProrroga.findByPk(solicitudId);
        if (!solicitud) return res.status(404).json({ error: "Solicitud no encontrada" });
        if (solicitud.estado !== "PENDIENTE") {
            return res.status(400).json({ error: "Solo se pueden aprobar solicitudes en estado PENDIENTE" });
        }

        const sol = await ejecutarAprobacion({
            solicitud,
            fecha_cierre_aprobada_raw: valid.data.fecha_cierre_aprobada,
            comentario_resolucion: valid.data.comentario_resolucion,
            usuarioId,
        });

        // Fire-and-forget: email al solicitante
        try {
            const [solicitante, municipio, pauta] = await Promise.all([
                Usuario.findByPk(sol.solicitado_por, { attributes: ["nombre", "apellido", "email"] }),
                Municipio.findByPk(sol.municipio_id, { attributes: ["municipio_nombre"] }),
                PautaConvenio.findByPk(sol.pauta_id, { attributes: ["descripcion"] }),
            ]);

            if (solicitante?.email) {
                const correo = await encolarNotificacionSolicitudProrroga({
                    tipo: "SOLICITUD_PRORROGA_APROBADA",
                    destinatario: solicitante.email,
                    nombre: `${solicitante.nombre} ${solicitante.apellido}`.trim(),
                    asunto: `[OVIF - APP] Tu solicitud de prórroga fue aprobada - ${municipio?.municipio_nombre ?? ""}`,
                    payload: {
                        nombre: `${solicitante.nombre} ${solicitante.apellido}`.trim(),
                        municipio: municipio?.municipio_nombre ?? `ID ${sol.municipio_id}`,
                        ejercicio: sol.ejercicio,
                        mes: sol.mes,
                        pauta: pauta?.descripcion ?? `ID ${sol.pauta_id}`,
                        fechaAprobada: toISODate(sol.fecha_cierre_aprobada),
                        comentario: sol.comentario_resolucion,
                    },
                    idRef: sol.solicitud_id,
                });
                await procesarMailsPendientes({ ids: [correo.correo.id] });
            }
        } catch (emailErr) {
            console.error("❌ Error encolando email de aprobación:", emailErr);
        }

        return res.json({ message: "Solicitud aprobada", solicitud: sol });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error("❌ Error aprobando solicitud:", err);
        return res.status(500).json({ error: "Ocurrió un error al aprobar la solicitud" });
    }
};

export const rechazarSolicitud = async (req, res) => {
    try {
        const usuarioId = req.user?.usuario_id;
        const solicitudId = Number(req.params.id);
        if (Number.isNaN(solicitudId)) return res.status(400).json({ error: "ID inválido" });

        const valid = RechazarSolicitudSchema.safeParse(req.body);
        if (!valid.success) {
            return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(", ") });
        }

        const solicitud = await SolicitudProrroga.findByPk(solicitudId);
        if (!solicitud) return res.status(404).json({ error: "Solicitud no encontrada" });
        if (solicitud.estado !== "PENDIENTE") {
            return res.status(400).json({ error: "Solo se pueden rechazar solicitudes en estado PENDIENTE" });
        }

        const { comentario_resolucion } = valid.data;

        await sequelize.transaction(async (t) => {
            solicitud.estado = "RECHAZADA";
            solicitud.resuelto_por = usuarioId;
            solicitud.fecha_resolucion = new Date();
            solicitud.comentario_resolucion = comentario_resolucion;
            await solicitud.save({ transaction: t });

            await registrarAuditoria({
                solicitud_id: solicitud.solicitud_id,
                accion: "RECHAZADA",
                estado_anterior: "PENDIENTE",
                estado_nuevo: "RECHAZADA",
                payload_anterior: { estado: "PENDIENTE" },
                payload_nuevo: { estado: "RECHAZADA", comentario_resolucion },
                usuario_id: usuarioId,
                comentario: comentario_resolucion,
                transaction: t,
            });
        });

        // Fire-and-forget: email al solicitante
        try {
            const [solicitante, municipio, pauta] = await Promise.all([
                Usuario.findByPk(solicitud.solicitado_por, { attributes: ["nombre", "apellido", "email"] }),
                Municipio.findByPk(solicitud.municipio_id, { attributes: ["municipio_nombre"] }),
                PautaConvenio.findByPk(solicitud.pauta_id, { attributes: ["descripcion"] }),
            ]);

            if (solicitante?.email) {
                const correo = await encolarNotificacionSolicitudProrroga({
                    tipo: "SOLICITUD_PRORROGA_RECHAZADA",
                    destinatario: solicitante.email,
                    nombre: `${solicitante.nombre} ${solicitante.apellido}`.trim(),
                    asunto: `[OVIF - APP] Tu solicitud de prórroga fue rechazada - ${municipio?.municipio_nombre ?? ""}`,
                    payload: {
                        nombre: `${solicitante.nombre} ${solicitante.apellido}`.trim(),
                        municipio: municipio?.municipio_nombre ?? `ID ${solicitud.municipio_id}`,
                        ejercicio: solicitud.ejercicio,
                        mes: solicitud.mes,
                        pauta: pauta?.descripcion ?? `ID ${solicitud.pauta_id}`,
                        comentario: comentario_resolucion,
                    },
                    idRef: solicitud.solicitud_id,
                });
                await procesarMailsPendientes({ ids: [correo.correo.id] });
            }
        } catch (emailErr) {
            console.error("❌ Error encolando email de rechazo:", emailErr);
        }

        return res.json({ message: "Solicitud rechazada", solicitud });
    } catch (error) {
        console.error("❌ Error al rechazar la solicitud:", error);
        return res.status(500).json({ error: "Ocurrió un error al rechazar la solicitud" });
    }
};

export const aprobarLote = async (req, res) => {
    try {
        const usuarioId = req.user?.usuario_id;

        const valid = AprobarLoteSchema.safeParse(req.body);
        if (!valid.success) {
            return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(", ") });
        }

        const resultados = await Promise.all(
            valid.data.items.map(async (item) => {
                try {
                    const solicitud = await SolicitudProrroga.findByPk(item.solicitud_id);
                    if (!solicitud) return { solicitud_id: item.solicitud_id, success: false, error: "Solicitud no encontrada" };
                    if (solicitud.estado !== "PENDIENTE") return { solicitud_id: item.solicitud_id, success: false, error: "La solicitud no está en estado PENDIENTE" };

                    const sol = await ejecutarAprobacion({
                        solicitud,
                        fecha_cierre_aprobada_raw: item.fecha_cierre_aprobada,
                        comentario_resolucion: item.comentario_resolucion,
                        usuarioId,
                    });

                    // Fire-and-forget email
                    try {
                        const [solicitante, municipio, pauta] = await Promise.all([
                            Usuario.findByPk(sol.solicitado_por, { attributes: ["nombre", "apellido", "email"] }),
                            Municipio.findByPk(sol.municipio_id, { attributes: ["municipio_nombre"] }),
                            PautaConvenio.findByPk(sol.pauta_id, { attributes: ["descripcion"] }),
                        ]);
                        if (solicitante?.email) {
                            const correo = await encolarNotificacionSolicitudProrroga({
                                tipo: "SOLICITUD_PRORROGA_APROBADA",
                                destinatario: solicitante.email,
                                nombre: `${solicitante.nombre} ${solicitante.apellido}`.trim(),
                                asunto: `[OVIF - APP] Tu solicitud de prórroga fue aprobada - ${municipio?.municipio_nombre ?? ""}`,
                                payload: {
                                    nombre: `${solicitante.nombre} ${solicitante.apellido}`.trim(),
                                    municipio: municipio?.municipio_nombre ?? `ID ${sol.municipio_id}`,
                                    ejercicio: sol.ejercicio,
                                    mes: sol.mes,
                                    pauta: pauta?.descripcion ?? `ID ${sol.pauta_id}`,
                                    fechaAprobada: toISODate(sol.fecha_cierre_aprobada),
                                    comentario: sol.comentario_resolucion,
                                },
                                idRef: sol.solicitud_id,
                            });
                            await procesarMailsPendientes({ ids: [correo.correo.id] });
                        }
                    } catch (emailErr) {
                        console.error(`❌ Error encolando email de aprobación para solicitud ${item.solicitud_id}:`, emailErr);
                    }

                    return { solicitud_id: item.solicitud_id, success: true };
                } catch (err) {
                    return { solicitud_id: item.solicitud_id, success: false, error: err.message || "Error al aprobar" };
                }
            })
        );

        return res.json({ resultados });
    } catch (error) {
        console.error("❌ Error al aprobar el lote de solicitudes:", error);
        return res.status(500).json({ error: "Ocurrió un error al aprobar el lote de solicitudes" });
    }
};

export const rechazarLote = async (req, res) => {
    try {
        const usuarioId = req.user?.usuario_id;

        const valid = RechazarLoteSchema.safeParse(req.body);
        if (!valid.success) {
            return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(", ") });
        }

        const resultados = await Promise.all(
            valid.data.items.map(async (item) => {
                try {
                    const solicitud = await SolicitudProrroga.findByPk(item.solicitud_id);
                    if (!solicitud) return { solicitud_id: item.solicitud_id, success: false, error: "Solicitud no encontrada" };
                    if (solicitud.estado !== "PENDIENTE") return { solicitud_id: item.solicitud_id, success: false, error: "La solicitud no está en estado PENDIENTE" };

                    await sequelize.transaction(async (t) => {
                        solicitud.estado = "RECHAZADA";
                        solicitud.resuelto_por = usuarioId;
                        solicitud.fecha_resolucion = new Date();
                        solicitud.comentario_resolucion = item.comentario_resolucion;
                        await solicitud.save({ transaction: t });

                        await registrarAuditoria({
                            solicitud_id: solicitud.solicitud_id,
                            accion: "RECHAZADA",
                            estado_anterior: "PENDIENTE",
                            estado_nuevo: "RECHAZADA",
                            payload_anterior: { estado: "PENDIENTE" },
                            payload_nuevo: { estado: "RECHAZADA", comentario_resolucion: item.comentario_resolucion },
                            usuario_id: usuarioId,
                            comentario: item.comentario_resolucion,
                            transaction: t,
                        });
                    });

                    // Fire-and-forget email
                    try {
                        const [solicitante, municipio, pauta] = await Promise.all([
                            Usuario.findByPk(solicitud.solicitado_por, { attributes: ["nombre", "apellido", "email"] }),
                            Municipio.findByPk(solicitud.municipio_id, { attributes: ["municipio_nombre"] }),
                            PautaConvenio.findByPk(solicitud.pauta_id, { attributes: ["descripcion"] }),
                        ]);
                        if (solicitante?.email) {
                            const correo = await encolarNotificacionSolicitudProrroga({
                                tipo: "SOLICITUD_PRORROGA_RECHAZADA",
                                destinatario: solicitante.email,
                                nombre: `${solicitante.nombre} ${solicitante.apellido}`.trim(),
                                asunto: `[OVIF - APP] Tu solicitud de prórroga fue rechazada - ${municipio?.municipio_nombre ?? ""}`,
                                payload: {
                                    nombre: `${solicitante.nombre} ${solicitante.apellido}`.trim(),
                                    municipio: municipio?.municipio_nombre ?? `ID ${solicitud.municipio_id}`,
                                    ejercicio: solicitud.ejercicio,
                                    mes: solicitud.mes,
                                    pauta: pauta?.descripcion ?? `ID ${solicitud.pauta_id}`,
                                    comentario: item.comentario_resolucion,
                                },
                                idRef: solicitud.solicitud_id,
                            });
                            await procesarMailsPendientes({ ids: [correo.correo.id] });
                        }
                    } catch (emailErr) {
                        console.error(`❌ Error encolando email de rechazo para solicitud ${item.solicitud_id}:`, emailErr);
                    }

                    return { solicitud_id: item.solicitud_id, success: true };
                } catch (err) {
                    return { solicitud_id: item.solicitud_id, success: false, error: err.message || "Error al rechazar" };
                }
            })
        );

        return res.json({ resultados });
    } catch (error) {
        console.error("❌ Error al rechazar lote de solicitudes:", error);
        return res.status(500).json({ error: "Ocurrió un error al rechazar lote de solicitudes" });
    }
};
