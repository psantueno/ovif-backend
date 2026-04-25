import { z } from 'zod';

export const CreateUsuarioSchema = z.object({
  usuario: z.string({ required_error: "El nombre de usuario es obligatorio" }).trim().min(1, "El nombre de usuario es obligatorio"),
  email: z.string({ required_error: "El email es obligatorio" }).email("El email no tiene un formato válido"),
  password: z.string({ required_error: "La contraseña es obligatoria" }).min(8, "La contraseña debe tener al menos 8 caracteres"),
  nombre: z.string().optional().refine(
    v => v === undefined || v.trim().length > 0,
    "El nombre no puede contener solo espacios"
  ),
  apellido: z.string().optional().refine(
    v => v === undefined || v.trim().length > 0,
    "El apellido no puede contener solo espacios"
  ),
  roles: z.array(z.number()).optional(),
});
