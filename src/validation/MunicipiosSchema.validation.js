import { z } from 'zod';

export const MunicipiosSchema = z.object({
    municipio_nombre: z.string({ message: "El nombre del municipio debe ser una cadena de caractéres" }).trim().max(255, { message: "El nombre del municipio no puede tener más de 255 caractéres" }),
    municipio_poblacion: z.number({ message: "La población estimada debe ser un número" }).int({ message: "La población estimada debe ser un número entero" }).positive({ message: "La población estimada debe ser mayor a 0" }),
    municipio_spar: z.number({ message: "El valor SPAR debe ser un número" }).int({ message: "El valor SPAR debe ser un número entero" }).positive({ message: "El valor SPAR debe ser mayor a 0" }),
    municipio_ubge: z.number({ message: "El valor UBGE debe ser un número" }).int({ message: "El valor UBGE debe ser un número entero" }).positive({ message: "El valor UBGE debe ser mayor a 0" }),
    municipio_subir_archivos: z.boolean({ message: "El valor de subir archivos debe ser booleano" }),
});