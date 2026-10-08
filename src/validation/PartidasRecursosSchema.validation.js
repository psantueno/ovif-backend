import { z } from "zod";
import { textoCarga } from "./textoCargaSchema.js";
import { esCodigoPartidaValido, esRepresentableEnLatin1 } from "../utils/partidasRecursos.js";

const MYSQL_INT_MAX = 2147483647;
const LIMITE_REASIGNACIONES = 5000;
const LIMITE_HIJAS = 50;

const codigoPartida = z
  .number({ message: "El código de partida es obligatorio" })
  .int({ message: "El código de partida debe ser un número entero" })
  .refine(esCodigoPartidaValido, {
    message: "El código de partida debe tener 8 dígitos y terminar en 00 (tipo, clase, concepto, subconcepto y 00)",
  });

const descripcionPartida = textoCarga("La descripción es obligatoria", 255).refine(esRepresentableEnLatin1, {
  message: "La descripción tiene caracteres que no se pueden guardar (por ejemplo emojis o símbolos especiales)",
});

const booleano = (mensaje) => z.boolean({ message: mensaje });

const idPositivo = (mensaje) =>
  z.number({ message: mensaje }).int({ message: mensaje }).positive({ message: mensaje }).max(MYSQL_INT_MAX, { message: mensaje });

const reglaSinLiquidacion = (datos) => !datos.partidas_recursos_sl || datos.partidas_recursos_carga;
const mensajeSinLiquidacion = {
  message: "\"Sin liquidación\" solo aplica a partidas imputables",
  path: ["partidas_recursos_sl"],
};

const camposEditables = {
  partidas_recursos_codigo: codigoPartida,
  partidas_recursos_descripcion: descripcionPartida,
  partidas_recursos_sl: booleano("Indicá si la partida es sin liquidación"),
  partidas_recursos_carga: booleano("Indicá si la partida es imputable"),
};

// Valores de la fila tal como el cliente la leyó: si no coinciden con los
// actuales, otro usuario la modificó en el medio (control de concurrencia).
const valoresOriginales = z
  .object({
    partidas_recursos_descripcion: z.string({ message: "Faltan los valores originales de la partida" }),
    partidas_recursos_sl: booleano("Faltan los valores originales de la partida"),
    partidas_recursos_carga: booleano("Faltan los valores originales de la partida"),
    activo: booleano("Faltan los valores originales de la partida"),
  }, { message: "Faltan los valores originales de la partida" })
  .strict();

export const PartidaRecursoAltaSchema = z.object(camposEditables).strict().refine(reglaSinLiquidacion, mensajeSinLiquidacion);

export const PartidaRecursoUpdateSchema = z
  .object({ ...camposEditables, original: valoresOriginales })
  .strict()
  .refine(reglaSinLiquidacion, mensajeSinLiquidacion);

export const PartidaRecursoEstadoSchema = z
  .object({
    activo: booleano("Indicá si la partida queda activa"),
    original: valoresOriginales,
  })
  .strict();

const hijaApertura = z
  .object({
    partidas_recursos_codigo: codigoPartida,
    partidas_recursos_descripcion: descripcionPartida,
    partidas_recursos_sl: booleano("Indicá si la partida es sin liquidación"),
  })
  .strict();

const reasignacion = z
  .object({
    id: idPositivo("La correspondencia indicada no es válida"),
    partida_recursos_codigo: codigoPartida,
  })
  .strict();

const listaUnica = (schema, clave, mensaje) =>
  z
    .array(schema)
    .max(LIMITE_REASIGNACIONES, { message: `No se pueden reasignar más de ${LIMITE_REASIGNACIONES} elementos por tipo` })
    .refine((filas) => new Set(filas.map((f) => f[clave])).size === filas.length, { message: mensaje });

export const PartidaRecursoAperturaSchema = z
  .object({
    original: valoresOriginales,
    hijas: z
      .array(hijaApertura)
      .min(1, { message: "Indicá al menos una partida hija" })
      .max(LIMITE_HIJAS, { message: `No se pueden crear más de ${LIMITE_HIJAS} hijas en una apertura` })
      .refine((hijas) => new Set(hijas.map((h) => h.partidas_recursos_codigo)).size === hijas.length, {
        message: "Hay códigos de hija repetidos",
      }),
    reasignaciones: z
      .object({
        recursos: listaUnica(reasignacion, "id", "Hay correspondencias de recursos repetidas"),
        recaudacion: listaUnica(reasignacion, "id", "Hay correspondencias de recaudación repetidas"),
        // ovif_conceptos_recaudacion no tiene clave primaria: los conceptos de
        // la partida se reasignan todos juntos a un único destino.
        conceptos_destino: codigoPartida.nullable(),
      })
      .strict(),
    observaciones: z.string().trim().max(400, { message: "Las observaciones no pueden superar los 400 caracteres" }).optional().nullable(),
  })
  .strict();
