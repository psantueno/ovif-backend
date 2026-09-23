import { z } from "zod";
import { repararMojibake, detectarMojibake } from "../utils/textoCodificacion.js";

/**
 * Campo de texto para los módulos de carga (gastos, recursos, recaudaciones,
 * determinación tributaria, remuneraciones y sus rectificadas).
 *
 * Antes de validar, intenta reparar texto con doble codificación UTF-8
 * ("mojibake", ver src/utils/textoCodificacion.js) -defensa en profundidad:
 * el frontend ya repara y advierte en la vista previa del Excel, pero la API
 * puede recibir datos por otras vías-. Si el texto queda con marcas de
 * mojibake sin poder repararse, la validación falla y bloquea la fila.
 *
 * @param {string} mensajeRequerido mensaje de error si falta o queda vacío
 * @param {number} maxLength longitud máxima permitida
 * @param {boolean} requerido si es false, permite string vacío (min 0)
 */
export const textoCarga = (mensajeRequerido, maxLength, requerido = true) => {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const { valor } = repararMojibake(value.trim());
      return valor;
    },
    z
      .string({ message: mensajeRequerido })
      .trim()
      .min(requerido ? 1 : 0, { message: mensajeRequerido })
      .max(maxLength, { message: `No puede superar los ${maxLength} caracteres` })
      .refine((valor) => !detectarMojibake(valor), {
        message: "El texto tiene caracteres con codificación inválida y no pudo corregirse automáticamente. Revisá el archivo de origen.",
      })
  );
};
