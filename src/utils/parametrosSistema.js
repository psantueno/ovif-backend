/*
 * parametrosSistema.js — Parámetros de ovif_parametros que el backend busca por nombre.
 *
 * Estos parámetros no pueden renombrarse (romperían la búsqueda) y, cuando
 * corresponde, su valor se valida con un formato fijo antes de guardarse.
 */
import { z } from "zod";
import { Parametros } from "../models/index.js";

export const PARAMETROS_SISTEMA = {
  DIRECTORIO_BASE: "Directorio Base",
  DIRECTORIO_INFORMES: "Directorio de Informes",
  RECORDATORIO_DIAS_PREVIOS: "Recordatorio de cierre - Días previos",
  RECORDATORIO_HORARIO: "Recordatorio de cierre - Horario",
};

export const RECORDATORIO_DIAS_MIN = 1;
export const RECORDATORIO_DIAS_MAX = 30;

const DiasPreviosSchema = z
  .string()
  .trim()
  .regex(/^\d{1,2}$/, {
    message: `Los días previos deben ser un número entero entre ${RECORDATORIO_DIAS_MIN} y ${RECORDATORIO_DIAS_MAX}`,
  })
  .transform(Number)
  .pipe(
    z
      .number()
      .int()
      .min(RECORDATORIO_DIAS_MIN, {
        message: `Los días previos deben ser un número entero entre ${RECORDATORIO_DIAS_MIN} y ${RECORDATORIO_DIAS_MAX}`,
      })
      .max(RECORDATORIO_DIAS_MAX, {
        message: `Los días previos deben ser un número entero entre ${RECORDATORIO_DIAS_MIN} y ${RECORDATORIO_DIAS_MAX}`,
      })
  );

const HorarioSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "El horario debe tener formato 24 hs HH:mm (por ejemplo 09:00 o 18:30)",
  });

// null = parámetro de sistema sin validación de formato (sólo se protege el nombre)
const VALIDADORES = {
  [PARAMETROS_SISTEMA.DIRECTORIO_BASE]: null,
  [PARAMETROS_SISTEMA.DIRECTORIO_INFORMES]: null,
  [PARAMETROS_SISTEMA.RECORDATORIO_DIAS_PREVIOS]: DiasPreviosSchema,
  [PARAMETROS_SISTEMA.RECORDATORIO_HORARIO]: HorarioSchema,
};

export const esParametroSistema = (nombre) =>
  Object.prototype.hasOwnProperty.call(VALIDADORES, String(nombre ?? "").trim());

/**
 * Valida el valor de un parámetro de sistema.
 * Para parámetros que no son de sistema (o sin validador) devuelve ok sin cambios.
 * @returns {{ ok: boolean, valor?: string, error?: string }}
 */
export const validarValorParametroSistema = (nombre, valor) => {
  const schema = VALIDADORES[String(nombre ?? "").trim()];
  const valorTexto = String(valor ?? "").trim();

  if (!schema) {
    return { ok: true, valor: valorTexto };
  }

  const resultado = schema.safeParse(valorTexto);
  if (!resultado.success) {
    return { ok: false, error: resultado.error.issues[0]?.message ?? "Valor inválido" };
  }

  return { ok: true, valor: String(resultado.data) };
};

/**
 * Lee y valida la configuración del recordatorio de cierre.
 * Sólo queda habilitado si ambos parámetros existen, están activos y son válidos.
 * @returns {Promise<{ habilitado: boolean, diasPrevios: number|null, horario: string|null, motivo: string|null, invalido: boolean }>}
 */
export const obtenerConfigRecordatorioCierre = async () => {
  const nombres = [
    PARAMETROS_SISTEMA.RECORDATORIO_DIAS_PREVIOS,
    PARAMETROS_SISTEMA.RECORDATORIO_HORARIO,
  ];

  const parametros = await Parametros.findAll({ where: { nombre: nombres } });
  const porNombre = new Map(parametros.map((p) => [p.nombre, p]));

  // Valores válidos (aunque el parámetro esté inactivo: los usa la simulación)
  const evaluar = (nombre) => {
    const parametro = porNombre.get(nombre);
    if (!parametro) return { parametro: null, validacion: null };
    return { parametro, validacion: validarValorParametroSistema(nombre, parametro.valor) };
  };
  const dias = evaluar(PARAMETROS_SISTEMA.RECORDATORIO_DIAS_PREVIOS);
  const horario = evaluar(PARAMETROS_SISTEMA.RECORDATORIO_HORARIO);

  const diasPrevios = dias.validacion?.ok ? Number(dias.validacion.valor) : null;
  const horarioValido = horario.validacion?.ok ? horario.validacion.valor : null;

  const resultado = (habilitado, motivo = null, invalido = false) => ({
    habilitado,
    diasPrevios,
    horario: horarioValido,
    motivo,
    invalido,
  });

  // Orden de motivos: faltante → inactivo (silencioso) → valor inválido (se reporta)
  for (const [nombre, { parametro }] of [
    [PARAMETROS_SISTEMA.RECORDATORIO_DIAS_PREVIOS, dias],
    [PARAMETROS_SISTEMA.RECORDATORIO_HORARIO, horario],
  ]) {
    if (!parametro) return resultado(false, `Falta el parámetro "${nombre}"`);
  }
  for (const [nombre, { parametro }] of [
    [PARAMETROS_SISTEMA.RECORDATORIO_DIAS_PREVIOS, dias],
    [PARAMETROS_SISTEMA.RECORDATORIO_HORARIO, horario],
  ]) {
    if (!parametro.estado) return resultado(false, `El parámetro "${nombre}" está inactivo`);
  }
  for (const [nombre, { validacion }] of [
    [PARAMETROS_SISTEMA.RECORDATORIO_DIAS_PREVIOS, dias],
    [PARAMETROS_SISTEMA.RECORDATORIO_HORARIO, horario],
  ]) {
    if (!validacion.ok) return resultado(false, `Valor inválido en "${nombre}": ${validacion.error}`, true);
  }

  return resultado(true);
};
