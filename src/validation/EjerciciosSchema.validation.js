import { z } from 'zod';

export const EjerciciosSchema = z.object({
    ejercicio: z.number({ message: "El ejercicio debe ser un número entero" }).int({ message: "El ejercicio debe ser un número entero" }),
    mes: z.number({ message: "El mes debe ser un número entero" }).int({ message: "El mes debe ser un número entero" }),
    municipio_id: z.number({ message: "El municipio_id debe ser un número entero" }).int({ message: "El municipio_id debe ser un número entero" }),
});