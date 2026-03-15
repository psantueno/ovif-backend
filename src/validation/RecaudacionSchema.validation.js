import { z } from 'zod';

export const RecaudacionSchema = z.object({
    codigo_tributo: z.number({ message: "El código de tributo debe ser un número entero" })
        .int({ message: "El código de tributo debe ser un número entero" })
        .nonnegative({ message: "El código de tributo debe ser un número entero mayor o igual a 0" }),
    descripcion: z.string({ message: "La descripción es obligatoria" })
        .trim()
        .min(1, { message: "La descripción es obligatoria" })
        .max(255, { message: "La descripción no puede superar los 255 caracteres" }),
    importe_recaudacion: z.number({ message: "El importe de recaudacion debe ser un número" })
        .nonnegative({ message: "El importe de recaudacion debe ser mayor o igual a 0" })
        .refine((value) => 
        {
            const str = value.toString();
            return /^\d{1,18}(\.\d{1,2})?$/.test(str);
        },
        {
            message: "El número debe tener hasta 18 dígitos enteros y hasta 2 decimales",
        }
    ),
    ente_recaudador: z.string({ message: "El ente recaudador es obligatorio" })
        .trim()
        .min(1, { message: "El ente recaudador es obligatorio" })
        .max(255, { message: "El ente recaudador no puede superar los 255 caracteres" })
});
