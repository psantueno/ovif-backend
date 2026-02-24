import { z } from 'zod';

export const ConceptosRecaudacionSchema = z.object({
    cod_concepto: z.number({ message: "El código de concepto debe ser un número" }).int({ message: "El código de concepto debe ser un número entero" }).positive({ message: "El código de concepto debe ser un número positivo" }),
    descripcion: z.string({ message: "La descripción debe ser una cadena de caracteres" }).trim().max(255, { message: "La descripción no puede tener más de 255 caracteres" }),
    cod_recurso: z.number({ message: "El código de recurso debe ser un número" }).int({ message: "El código de recurso debe ser un número entero" }).positive({ message: "El código de recurso debe ser un número positivo" }).optional().nullable(),
});