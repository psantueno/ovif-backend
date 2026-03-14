import { z } from "zod";

export const TiposPautaSchema = z.object({
  codigo: z
    .string({ message: "El código debe ser una cadena de caracteres" })
    .trim()
    .min(1, { message: "El código es obligatorio" })
    .max(100, { message: "El código no puede tener más de 100 caracteres" })
    .regex(/^[a-z0-9_]+$/, {
      message:
        "El código solo puede contener letras minúsculas, números y guion bajo (_)",
    }),
  nombre: z
    .string({ message: "El nombre debe ser una cadena de caracteres" })
    .trim()
    .min(1, { message: "El nombre es obligatorio" })
    .max(150, { message: "El nombre no puede tener más de 150 caracteres" }),
  descripcion: z
    .string({ message: "La descripción debe ser una cadena de caracteres" })
    .trim()
    .max(1000, {
      message: "La descripción no puede tener más de 1000 caracteres",
    })
    .optional()
    .nullable(),
  requiere_periodo_rectificar: z.boolean({
    message: "El campo requiere_periodo_rectificar debe ser booleano",
  }),
});
