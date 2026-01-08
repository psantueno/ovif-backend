import { z } from 'zod';

export const GastosSchema = z.object({
    partidas_gastos_codigo: z.number({ message: "El código de la partida debe ser un número entero" }).int({ message: "El código de la partida debe ser un número entero" }),
    gastos_importe_devengado: z.number({ message: "El importe devengado debe ser un número" }).refine((value) => 
        {
            const str = value.toString();
            return /^\d{1,10}(\.\d{1,2})?$/.test(str);
        },
        {
            message: "El número debe tener hasta 10 dígitos enteros y hasta 2 decimales",
        }
    ),
});
