import { z } from 'zod';
import { textoCarga } from './textoCargaSchema.js';

const MYSQL_INT_MAX = 2147483647;

export const RecaudacionSchema = z.object({
    codigo_tributo: z.number({ message: "El código de tributo debe ser un número entero" })
        .int({ message: "El código de tributo debe ser un número entero" })
        .nonnegative({ message: "El código de tributo debe ser un número entero mayor o igual a 0" })
        .max(MYSQL_INT_MAX, { message: `El código de tributo no puede superar ${MYSQL_INT_MAX}` }),
    descripcion: textoCarga("La descripción es obligatoria", 255),
    importe_recaudacion: z.number({ message: "El importe de recaudacion debe ser un número" })
        .nonnegative({ message: "El importe de recaudacion debe ser mayor o igual a 0" })
        .refine((value) =>
        {
            const str = value.toString();
            return /^\d{1,36}(\.\d{1,2})?$/.test(str);
        },
        {
            message: "El número debe tener hasta 36 dígitos enteros y hasta 2 decimales",
        }
    ),
    ente_recaudador: textoCarga("El ente recaudador es obligatorio", 255)
});
