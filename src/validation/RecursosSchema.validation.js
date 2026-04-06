import { z } from 'zod';

const decimalField = (label) =>
  z.number({ message: `${label} debe ser un número` }).refine((value) => {
    const str = value.toString();
    return /^-?\d{1,34}(\.\d{1,2})?$/.test(str);
  }, {
    message: `${label} debe tener hasta 34 dígitos enteros y hasta 2 decimales`,
  });

export const RecursosSchema = z.object({
  codigo_recurso: z.number({ message: "El código del recurso debe ser un número entero" }).int({ message: "El código del recurso debe ser un número entero" }),
  descripcion: z.string({ message: "La descripción es requerida" }).max(255, { message: "La descripción no puede superar los 255 caracteres" }),
  codigo_fuente_financiera: z.number({ message: "El código de fuente financiera debe ser un número entero" }).int({ message: "El código de fuente financiera debe ser un número entero" }),
  descripcion_fuente: z.string({ message: "La descripción de fuente es requerida" }).max(255, { message: "La descripción de fuente no puede superar los 255 caracteres" }),
  vigente: decimalField("Vigente"),
  percibido: decimalField("Percibido"),
});
