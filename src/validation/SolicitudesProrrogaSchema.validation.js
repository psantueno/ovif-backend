import { z } from "zod";

const fechaDDMMYYYY = z
    .string({ message: "La fecha debe ser una cadena de texto" })
    .regex(/^\d{2}-\d{2}-\d{4}$/, { message: "La fecha debe tener formato DD-MM-YYYY" });

const tipoProrroga = z.enum(["AMPLIACION_PLAZO", "CORRECCION_DATOS"], {
    message: "tipo debe ser AMPLIACION_PLAZO o CORRECCION_DATOS",
});

const itemCrearSchema = z.object({
    municipio_id: z
        .number({ message: "municipio_id debe ser un número" })
        .int({ message: "municipio_id debe ser un número entero" }),
    ejercicio: z
        .number({ message: "ejercicio debe ser un número" })
        .int({ message: "ejercicio debe ser un número entero" }),
    mes: z
        .number({ message: "mes debe ser un número" })
        .int({ message: "mes debe ser un número entero" })
        .min(1, { message: "mes debe estar entre 1 y 12" })
        .max(12, { message: "mes debe estar entre 1 y 12" }),
    convenio_id: z
        .number({ message: "convenio_id debe ser un número" })
        .int({ message: "convenio_id debe ser un número entero" }),
    pauta_id: z
        .number({ message: "pauta_id debe ser un número" })
        .int({ message: "pauta_id debe ser un número entero" }),
    fecha_cierre_solicitada: fechaDDMMYYYY,
    motivo: z
        .string({ message: "motivo es requerido" })
        .min(1, { message: "motivo no puede estar vacío" }),
});

export const CrearSolicitudesSchema = z
    .array(itemCrearSchema, { message: "El body debe ser un array de solicitudes" })
    .min(1, { message: "Debe enviar al menos una solicitud" });

export const EditarSolicitudSchema = z
    .object({
        fecha_cierre_solicitada: fechaDDMMYYYY.optional(),
        motivo: z.string().min(1, { message: "motivo no puede estar vacío" }).optional(),
    })
    .refine((data) => data.fecha_cierre_solicitada || data.motivo, {
        message: "Debe enviar al menos un campo a editar: fecha_cierre_solicitada o motivo",
    });

export const CancelarSolicitudSchema = z.object({
    motivo_cancelacion: z
        .string({ message: "motivo_cancelacion es requerido" })
        .min(1, { message: "motivo_cancelacion no puede estar vacío" }),
});

export const AprobarSolicitudSchema = z.object({
    tipo: tipoProrroga,
    fecha_cierre_aprobada: fechaDDMMYYYY.optional(),
    comentario_resolucion: z.string().optional(),
});

export const RechazarSolicitudSchema = z.object({
    comentario_resolucion: z
        .string({ message: "comentario_resolucion es requerido" })
        .min(1, { message: "comentario_resolucion no puede estar vacío" }),
});

const itemAprobarLoteSchema = z.object({
    solicitud_id: z
        .number({ message: "solicitud_id debe ser un número" })
        .int({ message: "solicitud_id debe ser un número entero" }),
    fecha_cierre_aprobada: fechaDDMMYYYY.optional(),
    comentario_resolucion: z.string().optional(),
});

export const AprobarLoteSchema = z.object({
    tipo: tipoProrroga,
    items: z
        .array(itemAprobarLoteSchema, { message: "items debe ser un array" })
        .min(1, { message: "Debe enviar al menos un ítem" }),
});

const itemRechazarLoteSchema = z.object({
    solicitud_id: z
        .number({ message: "solicitud_id debe ser un número" })
        .int({ message: "solicitud_id debe ser un número entero" }),
    comentario_resolucion: z
        .string({ message: "comentario_resolucion es requerido" })
        .min(1, { message: "comentario_resolucion no puede estar vacío" }),
});

export const RechazarLoteSchema = z.object({
    items: z
        .array(itemRechazarLoteSchema, { message: "items debe ser un array" })
        .min(1, { message: "Debe enviar al menos un ítem" }),
});
