import { z } from "zod";

const MODULOS_VALIDOS = [
  "GASTOS",
  "RECURSOS",
  "RECAUDACIONES",
  "REMUNERACIONES",
  "DETERMINACION_TRIBUTARIA",
];

export const SimularCierreModulosSchema = z.object({
  ejercicio: z
    .number({ message: "ejercicio debe ser un número entero" })
    .int({ message: "ejercicio debe ser un número entero" })
    .min(2000, { message: "ejercicio debe ser un año válido (mínimo 2000)" }),
  mes: z
    .number({ message: "mes debe ser un número entero entre 1 y 12" })
    .int({ message: "mes debe ser un número entero entre 1 y 12" })
    .min(1, { message: "mes debe estar entre 1 y 12" })
    .max(12, { message: "mes debe estar entre 1 y 12" }),
  municipio_id: z
    .number({ message: "municipio_id debe ser un número entero positivo" })
    .int({ message: "municipio_id debe ser un número entero positivo" })
    .positive({ message: "municipio_id debe ser un número entero positivo" }),
  modulos: z
    .array(
      z.enum(MODULOS_VALIDOS, {
        message: `Módulo inválido. Valores permitidos: ${MODULOS_VALIDOS.join(", ")}`,
      })
    )
    .min(1, { message: "Debe enviar al menos un módulo" }),
  enviar_mail: z.boolean({ message: "enviar_mail debe ser un booleano" }).optional().default(false),
});
