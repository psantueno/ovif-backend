import { z } from 'zod';

export const RecaudacionSchema = z.object({
    cod_concepto: z.number({ message: "El código debe ser un número entero" }).int({ message: "El código debe ser un número entero" }),
    importe_recaudacion: z.number({ message: "El importe de recaudacion debe ser un número" }).refine((value) => 
        {
            const str = value.toString();
            return /^\d{1,10}(\.\d{1,2})?$/.test(str);
        },
        {
            message: "El número debe tener hasta 10 dígitos enteros y hasta 2 decimales",
        }
    )
});