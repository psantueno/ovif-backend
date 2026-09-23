import { z } from "zod";
import { textoCarga } from "./textoCargaSchema.js";

const MYSQL_INT_MAX = 2147483647;

const idPositivo = (mensaje) =>
  z.number({ message: mensaje }).int({ message: mensaje }).positive({ message: mensaje }).max(MYSQL_INT_MAX, { message: mensaje });

export const MtzRecursosPartidaSchema = z.object({
  municipio_id: idPositivo("El municipio es obligatorio"),
  codigo_recurso: idPositivo("El código de recurso es obligatorio"),
  partida_recursos_codigo: idPositivo("La partida es obligatoria"),
  observaciones: z.string().trim().max(500, { message: "Las observaciones no pueden superar los 500 caracteres" }).optional().nullable(),
});

// La partida es la única modificable luego del alta (la clave es inmutable).
export const MtzRecursosPartidaUpdateSchema = z.object({
  partida_recursos_codigo: idPositivo("La partida es obligatoria"),
  observaciones: z.string().trim().max(500, { message: "Las observaciones no pueden superar los 500 caracteres" }).optional().nullable(),
});

export const MtzRecaudacionPartidaSchema = z.object({
  municipio_id: idPositivo("El municipio es obligatorio"),
  codigo_tributo: idPositivo("El código de tributo es obligatorio"),
  descripcion_tributo: textoCarga("La descripción del tributo es obligatoria", 255),
  partida_recursos_codigo: idPositivo("La partida es obligatoria"),
  observaciones: z.string().trim().max(500, { message: "Las observaciones no pueden superar los 500 caracteres" }).optional().nullable(),
});

export const MtzRecaudacionPartidaUpdateSchema = z.object({
  partida_recursos_codigo: idPositivo("La partida es obligatoria"),
  observaciones: z.string().trim().max(500, { message: "Las observaciones no pueden superar los 500 caracteres" }).optional().nullable(),
});

export const LoteRecursosSchema = z.object({
  filas: z.array(MtzRecursosPartidaSchema).min(1, { message: "El lote no puede estar vacío" }).max(500, { message: "El lote no puede tener más de 500 filas" }),
});

export const LoteRecaudacionSchema = z.object({
  filas: z.array(MtzRecaudacionPartidaSchema).min(1, { message: "El lote no puede estar vacío" }).max(500, { message: "El lote no puede tener más de 500 filas" }),
});
