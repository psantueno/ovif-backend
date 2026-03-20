import { z } from 'zod';

export const MunicipiosMailsSchema = z.object({
    municipio_id: z.number({ message: "El ID del municipio debe ser un número" }).int({ message: "El ID del municipio debe ser un número entero" }).positive({ message: "El ID del municipio debe ser un número positivo" }),
    nombre: z.string({ message: "El nombre debe ser una cadena de caracteres" }).trim().max(255, { message: "El nombre no puede tener más de 255 caracteres" }),
    email: z.string({ message: "El email debe ser una cadena de caracteres" }).trim().max(255, { message: "El email no puede tener más de 255 caracteres" }),
});