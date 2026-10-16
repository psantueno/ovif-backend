import { z } from "zod";
import { RECORDATORIO_DIAS_MAX, RECORDATORIO_DIAS_MIN } from "../utils/parametrosSistema.js";

const esFechaCalendarioValida = (valor) => {
  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
};

export const SimularRecordatorioCierreSchema = z.object({
  fecha_referencia: z
    .string({ message: "fecha_referencia debe tener formato YYYY-MM-DD" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "fecha_referencia debe tener formato YYYY-MM-DD" })
    .refine(esFechaCalendarioValida, { message: "fecha_referencia no es una fecha válida" })
    .optional(),
  dias_previos: z
    .number({ message: `dias_previos debe ser un número entero entre ${RECORDATORIO_DIAS_MIN} y ${RECORDATORIO_DIAS_MAX}` })
    .int({ message: `dias_previos debe ser un número entero entre ${RECORDATORIO_DIAS_MIN} y ${RECORDATORIO_DIAS_MAX}` })
    .min(RECORDATORIO_DIAS_MIN, { message: `dias_previos debe estar entre ${RECORDATORIO_DIAS_MIN} y ${RECORDATORIO_DIAS_MAX}` })
    .max(RECORDATORIO_DIAS_MAX, { message: `dias_previos debe estar entre ${RECORDATORIO_DIAS_MIN} y ${RECORDATORIO_DIAS_MAX}` })
    .optional(),
  municipio_id: z
    .number({ message: "municipio_id debe ser un número entero positivo" })
    .int({ message: "municipio_id debe ser un número entero positivo" })
    .positive({ message: "municipio_id debe ser un número entero positivo" })
    .optional(),
  enviar_mail: z.boolean({ message: "enviar_mail debe ser un booleano" }).optional().default(false),
});
