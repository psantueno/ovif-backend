import { z } from 'zod';

export const RecursosSchema = z.object({
    partidas_recursos_codigo: z.number({ message: "El código debe ser un número entero" }).int({ message: "El código debe ser un número entero" }),
    recursos_importe_percibido: z.number({ message: "El importe percibido debe ser un número" }).refine((value) => 
        {
            const str = value.toString();
            return /^\d{1,10}(\.\d{1,2})?$/.test(str);
        },
        {
            message: "El número debe tener hasta 10 dígitos enteros y hasta 2 decimales",
        }
    )
});
