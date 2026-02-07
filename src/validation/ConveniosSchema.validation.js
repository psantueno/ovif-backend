import { z } from 'zod';

export const ConveniosSchema = z.object({
    nombre: z.string({ message: "El nombre del convenio debe ser una cadena de caractéres" }).trim().max(150, { message: "El nombre del municipio no puede tener más de 150 caractéres" }),
    descripcion: z.string({ message: "La descripción del convenio debe ser una cadena de caractéres" }).trim(),
    fecha_inicio: z.string({ message: "La fecha de inicio debe ser una cadena de caractéres" }).trim().datetime({ message: "La fecha de inicio debe tener un formato de fecha válido" }),
    fecha_fin: z.string({ message: "La fecha de fin debe ser una cadena de caractéres" }).trim().datetime({ message: "La fecha de fin debe tener un formato de fecha válido" }),
});