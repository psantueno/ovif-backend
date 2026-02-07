import { z } from 'zod';

export const PautasSchema = z.object({
    descripcion: z.string({ message: "La descripción debe ser una cadena de caractéres" }).trim().max(255, { message: "La descripción no puede tener más de 255 caractéres" }),
    convenio_id: z.number({ message: "El ID del convenio debe ser un número" }).int({ message: "El ID del convenio debe ser un número entero" }).positive({ message: "El ID del convenio debe ser un número positivo" }),
    dia_vto: z.number({ message: "El día de vencimiento debe ser un número" }).int({ message: "El día de vencimiento debe ser un número entero" }).positive({ message: "El día de vencimiento debe ser un número positivo" }).min(1, { message: "El día de vencimiento debe ser mayor a 1" }).max(31, { message: "El día de vencimiento debe ser menor a 31" }),
    plazo_vto: z.number({ message: "El plazo de vencimiento debe ser un número" }).int({ message: "El plazo de vencimiento debe ser un número entero" }).positive({ message: "El plazo de vencimiento debe ser un número positivo" }).min(0, { message: "El plazo de vencimiento debe ser mayor a 0" }),
    cant_dias_rectifica: z.number({ message: "La cantidad de días para rectificar debe ser un número" }).int({ message: "La cantidad de días para rectificar debe ser un número entero" }).min(0, { message: "La cantidad de días para rectificar debe ser mayor a 0" }).optional().nullable(),
    plazo_mes_rectifica: z.number({ message: "El plazo de meses para rectificar debe ser un número" }).int({ message: "El plazo de meses para rectificar debe ser un número entero" }).min(0, { message: "El plazo de meses para rectificar debe ser mayor a 0" }).optional().nullable(),
    tipo_pauta: z.enum(['gastos_recursos', 'recaudaciones_remuneraciones'], { message: "El tipo de pauta especificado no es válido" }),
});