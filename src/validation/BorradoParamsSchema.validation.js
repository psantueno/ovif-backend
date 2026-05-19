import { z } from "zod";

const positiveInt = (label) =>
  z
    .string({ message: `${label} es requerido` })
    .regex(/^\d+$/, { message: `${label} debe ser un número entero positivo` })
    .transform(Number)
    .refine((v) => v > 0, { message: `${label} debe ser mayor a 0` });

export const BorradoParamsSchema = z.object({
  municipioId: positiveInt("municipioId"),
  ejercicio: positiveInt("ejercicio"),
  mes: z
    .string({ message: "mes es requerido" })
    .regex(/^\d+$/, { message: "mes debe ser un número entero" })
    .transform(Number)
    .refine((v) => v >= 1 && v <= 12, { message: "mes debe estar entre 1 y 12" }),
});
