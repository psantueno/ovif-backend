import {
  RegimenLaboral,
  Gasto,
  Recurso,
  Recaudacion,
  Remuneracion,
  DeterminacionTributaria,
} from "../models/index.js";
import crypto from "crypto";

// ─── Mapeo tipo de pauta → módulos ──────────────────────────────────────────

export const MODULOS_POR_TIPO_PAUTA = {
  gastos_recursos: ["GASTOS", "RECURSOS"],
  recaudaciones_remuneraciones: ["RECAUDACIONES", "REMUNERACIONES"],
  determinacion_tributaria: ["DETERMINACION_TRIBUTARIA"],
};

export const obtenerModulosPorTipoPauta = (codigoTipoPauta) => {
  if (!codigoTipoPauta) return [];
  const modulos = MODULOS_POR_TIPO_PAUTA[codigoTipoPauta];
  return Array.isArray(modulos) ? modulos : [];
};

export const obtenerNombreConvenioSeguro = (convenio, convenioId) =>
  convenio?.nombre ?? `Convenio ${convenioId}`;

// ─── Generador de número de documento simulado ───────────────────────────────

export const generarNumero = (digitos = 12) => {
  const min = 10 ** (digitos - 1);
  const max = 10 ** digitos - 1;
  return crypto.randomInt(min, max).toString();
};

// ─── Helpers internos ────────────────────────────────────────────────────────

const toNumberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value, fallback = "Sin especificar") => {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).trim();
  return normalized.length ? normalized : fallback;
};

const mapRemuneracionParaInforme = (remuneracion, regimenesMap = new Map()) => {
  const regimenId = Number(remuneracion?.regimen_id);
  const regimenPorId = Number.isFinite(regimenId) ? regimenesMap.get(regimenId) : null;

  return {
    regimen_laboral: normalizeText(
      remuneracion?.regimen_laboral ?? remuneracion?.regimen ?? regimenPorId
    ),
    categoria: normalizeText(remuneracion?.categoria ?? remuneracion?.cargo_salarial),
    seguro_vida: toNumberOrZero(remuneracion?.seguro_vida_obligatorio),
    art: toNumberOrZero(remuneracion?.art),
    issn: toNumberOrZero(remuneracion?.total_issn),
    desc_personales: toNumberOrZero(remuneracion?.total_descuentos),
    neto_a_cobrar: toNumberOrZero(
      remuneracion?.total_remuneracion_neta ??
        remuneracion?.neto_a_cobrar ??
        remuneracion?.remuneracion_neta
    ),
  };
};

const obtenerImporteNumerico = (importe) => {
  if (importe === null || importe === undefined) return null;
  const importeNumerico = Number(importe);
  return Number.isFinite(importeNumerico) ? importeNumerico : null;
};

const mapearDetalleDeterminacionTributaria = (determinacion) => ({
  cod_impuesto: Number(determinacion.cod_impuesto),
  descripcion: determinacion.descripcion,
  anio: Number(determinacion.anio),
  cuota: Number(determinacion.cuota),
  liquidadas: Number(determinacion.liquidadas),
  importe_liquidadas: determinacion.importe_liquidadas,
  impagas: Number(determinacion.impagas),
  importe_impagas: determinacion.importe_impagas,
  pagadas: Number(determinacion.pagadas),
  importe_pagadas: determinacion.importe_pagadas,
  altas_periodo: Number(determinacion.altas_periodo),
  bajas_periodo: Number(determinacion.bajas_periodo),
});

const calcularResumenDeterminacionTributaria = (determinaciones = []) =>
  determinaciones.reduce(
    (acumulado, item) => ({
      totalRegistros: acumulado.totalRegistros + 1,
      totalLiquidadas: acumulado.totalLiquidadas + (Number(item.liquidadas) || 0),
      totalImporteLiquidadas:
        acumulado.totalImporteLiquidadas + (obtenerImporteNumerico(item.importe_liquidadas) ?? 0),
      totalImpagas: acumulado.totalImpagas + (Number(item.impagas) || 0),
      totalImporteImpagas:
        acumulado.totalImporteImpagas + (obtenerImporteNumerico(item.importe_impagas) ?? 0),
      totalPagadas: acumulado.totalPagadas + (Number(item.pagadas) || 0),
      totalImportePagadas:
        acumulado.totalImportePagadas + (obtenerImporteNumerico(item.importe_pagadas) ?? 0),
      totalAltasPeriodo: acumulado.totalAltasPeriodo + (Number(item.altas_periodo) || 0),
      totalBajasPeriodo: acumulado.totalBajasPeriodo + (Number(item.bajas_periodo) || 0),
    }),
    {
      totalRegistros: 0,
      totalLiquidadas: 0,
      totalImporteLiquidadas: 0,
      totalImpagas: 0,
      totalImporteImpagas: 0,
      totalPagadas: 0,
      totalImportePagadas: 0,
      totalAltasPeriodo: 0,
      totalBajasPeriodo: 0,
    }
  );

// ─── Fetchers de datos por módulo ────────────────────────────────────────────

const obtenerDatosGastos = async (municipioId, ejercicio, mes) => {
  const gastosRaw = await Gasto.findAll({
    where: { gastos_ejercicio: ejercicio, gastos_mes: mes, municipio_id: municipioId },
    order: [["codigo_partida", "ASC"]],
  });

  const gastos = gastosRaw.map((g) => g.toJSON());
  const totales = gastos.reduce(
    (acc, g) => {
      acc.formulado += Number(g.formulado) || 0;
      acc.modificado += Number(g.modificado) || 0;
      acc.vigente += Number(g.vigente) || 0;
      acc.devengado += Number(g.devengado) || 0;
      return acc;
    },
    { formulado: 0, modificado: 0, vigente: 0, devengado: 0 }
  );

  return { gastos, totales };
};

const obtenerDatosRecursos = async (municipioId, ejercicio, mes) => {
  const recursosRaw = await Recurso.findAll({
    where: { recursos_ejercicio: ejercicio, recursos_mes: mes, municipio_id: municipioId },
    order: [["codigo_recurso", "ASC"]],
  });

  const recursos = recursosRaw.map((r) => r.toJSON());
  const totales = recursos.reduce(
    (acc, r) => {
      acc.vigente += Number(r.vigente) || 0;
      acc.percibido += Number(r.percibido) || 0;
      return acc;
    },
    { vigente: 0, percibido: 0 }
  );

  return { recursos, totales };
};

const obtenerDatosRecaudaciones = async (municipioId, ejercicio, mes) => {
  const agruparTotalesPorCodigoTributo = (conceptos = []) => {
    const acumulados = new Map();
    conceptos.forEach((concepto) => {
      const codigoTributo = Number(concepto.codigo_tributo);
      if (!Number.isInteger(codigoTributo) || codigoTributo < 0) return;

      const importeNumerico = obtenerImporteNumerico(concepto.importe_recaudacion) ?? 0;
      const acumulado = acumulados.get(codigoTributo) ?? {
        codigo_tributo: codigoTributo,
        descripcion: concepto.descripcion ?? "",
        importe_total_recaudacion: 0,
      };
      if (!acumulado.descripcion && concepto.descripcion) {
        acumulado.descripcion = concepto.descripcion;
      }
      acumulado.importe_total_recaudacion += importeNumerico;
      acumulados.set(codigoTributo, acumulado);
    });
    return Array.from(acumulados.values()).sort((a, b) => a.codigo_tributo - b.codigo_tributo);
  };

  const calcularTotalImporte = (conceptos = []) =>
    conceptos.reduce((acumulado, concepto) => {
      const importeNumerico = obtenerImporteNumerico(concepto.importe_recaudacion);
      return importeNumerico === null ? acumulado : acumulado + importeNumerico;
    }, 0);

  const datos = { conceptos: [], totalesPorCodigo: [], totalImporte: 0 };

  const recaudaciones = await Recaudacion.findAll({
    where: { recaudaciones_ejercicio: ejercicio, recaudaciones_mes: mes, municipio_id: municipioId },
  });

  if (recaudaciones && recaudaciones.length > 0) {
    const mappedConceptos = recaudaciones
      .map((r) => ({
        codigo_tributo: r.codigo_tributo,
        descripcion: r.descripcion,
        ente_recaudador: r.ente_recaudador,
        importe_recaudacion: r.importe_recaudacion,
      }))
      .sort((a, b) => {
        const codigoA = Number(a.codigo_tributo);
        const codigoB = Number(b.codigo_tributo);
        if (codigoA !== codigoB) return codigoA - codigoB;
        return (a.ente_recaudador ?? "").localeCompare(b.ente_recaudador ?? "");
      });

    const totalesPorCodigo = agruparTotalesPorCodigoTributo(mappedConceptos);
    datos.conceptos = mappedConceptos;
    datos.totalesPorCodigo = totalesPorCodigo;
    datos.totalImporte = calcularTotalImporte(
      totalesPorCodigo.map((item) => ({ importe_recaudacion: item.importe_total_recaudacion }))
    );
  }

  return datos;
};

const obtenerDatosRemuneraciones = async (municipioId, ejercicio, mes) => {
  const datos = { remuneraciones: [], regimenes: [] };

  const remuneraciones = await Remuneracion.findAll({
    where: { remuneraciones_ejercicio: ejercicio, remuneraciones_mes: mes, municipio_id: municipioId },
  });

  if (remuneraciones && remuneraciones.length > 0) {
    const regimenes = await RegimenLaboral.findAll({ attributes: ["regimen_id", "nombre"] });
    const regimenesMap = new Map(
      regimenes.map((reg) => [Number(reg.regimen_id), reg.nombre])
    );

    const remuneracionesPlanas = remuneraciones.map((r) => mapRemuneracionParaInforme(r, regimenesMap));

    datos.regimenes = Array.from(new Set(remuneracionesPlanas.map((item) => item.regimen_laboral)))
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
      .map((nombre) => ({ nombre }));
    datos.remuneraciones = remuneracionesPlanas;
  }

  return datos;
};

const obtenerDatosDeterminacionTributaria = async (municipioId, ejercicio, mes) => {
  const determinaciones = await DeterminacionTributaria.findAll({
    where: { determinacion_ejercicio: ejercicio, determinacion_mes: mes, municipio_id: municipioId },
  });

  const detalle = determinaciones.map(mapearDetalleDeterminacionTributaria);
  const resumen = calcularResumenDeterminacionTributaria(detalle);

  return { determinaciones: detalle, resumen };
};

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export const obtenerDatosPorModulo = async (modulo, municipioId, ejercicio, mes) => {
  if (modulo === "GASTOS") return obtenerDatosGastos(municipioId, ejercicio, mes);
  if (modulo === "RECURSOS") return obtenerDatosRecursos(municipioId, ejercicio, mes);
  if (modulo === "RECAUDACIONES") return obtenerDatosRecaudaciones(municipioId, ejercicio, mes);
  if (modulo === "REMUNERACIONES") return obtenerDatosRemuneraciones(municipioId, ejercicio, mes);
  if (modulo === "DETERMINACION_TRIBUTARIA")
    return obtenerDatosDeterminacionTributaria(municipioId, ejercicio, mes);
  throw new Error(`Módulo no soportado: ${modulo}`);
};
