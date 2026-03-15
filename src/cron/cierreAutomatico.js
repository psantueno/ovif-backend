import cron from "node-cron";
import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import { 
  PartidaGasto,
  PartidaRecurso,
  RegimenLaboral,
  Gasto,
  Recurso,
  Recaudacion,
  Remuneracion,
  EjercicioMes,
  ProrrogaMunicipio,
  CronLog,
  CierreModulo,
  Municipio,
  PautaConvenio,
  TipoPauta,
  Convenio, 
  Parametros
} from "../models/index.js";
import { buildInformeGastos } from "../utils/pdf/municipioGastos.js";
import { buildInformeRecursos } from "../utils/pdf/municipioRecursos.js";
import { buildInformeRecaudaciones } from "../utils/pdf/municipioRecaudaciones.js";
import { buildInformeRemuneraciones } from "../utils/pdf/municipioRemuneraciones.js";
import crypto from "crypto";

const MODULOS_POR_TIPO_PAUTA = {
  gastos_recursos: ["Gastos", "Recursos"],
  recaudaciones_remuneraciones: ["Recaudaciones", "Remuneraciones"],
};

const obtenerModulosPorTipoPauta = (codigoTipoPauta) => {
  if (!codigoTipoPauta) {
    return [];
  }

  const modulos = MODULOS_POR_TIPO_PAUTA[codigoTipoPauta];
  return Array.isArray(modulos) ? modulos : [];
};

const toNumberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value, fallback = "Sin especificar") => {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim();
  return normalized.length ? normalized : fallback;
};

const mapRemuneracionParaInforme = (remuneracion, regimenesMap = new Map()) => {
  const regimenId = Number(remuneracion?.regimen_id);
  const regimenPorId = Number.isFinite(regimenId) ? regimenesMap.get(regimenId) : null;

  return {
    regimen_laboral: normalizeText(
      remuneracion?.regimen_laboral ??
        remuneracion?.regimen ??
        regimenPorId
    ),
    categoria: normalizeText(
      remuneracion?.categoria ??
        remuneracion?.cargo_salarial
    ),
    total_remunerativo: toNumberOrZero(remuneracion?.total_remunerativo),
    total_no_remunerativo: toNumberOrZero(remuneracion?.total_no_remunerativo),
    total_descuentos: toNumberOrZero(remuneracion?.total_descuentos),
    neto_a_cobrar: toNumberOrZero(
      remuneracion?.total_remuneracion_neta ??
        remuneracion?.neto_a_cobrar ??
        remuneracion?.remuneracion_neta
    ),
  };
};

// 🕑 Ejecutar todos los días a las 2 AM (hora Argentina)
cron.schedule(
  "0 2 * * *",
  //"*/60 * * * * *",
  async () => {
    const hoy = new Date();

    let cierresRealizados = 0;
    let errores = 0;

    const hoyArg = new Date().toLocaleDateString("sv-SE", {
      timeZone: "America/Argentina/Buenos_Aires"
    })

    // Crear copia para no mutar la fecha original
    const fechaMenosTresMeses = new Date(hoyArg);
    fechaMenosTresMeses.setMonth(fechaMenosTresMeses.getMonth() - 3);
    const fechaMenosTresMesesStr = fechaMenosTresMeses
      .toISOString()
      .split("T")[0];

    try {
      // Buscar ejercicios con fecha_fin < CURRENT_DATE
      const ejercicios = await EjercicioMes.findAll({
        where: {
          fecha_fin: {
            [Op.lt]: hoyArg
          },
          fecha_inicio: {
            [Op.gt]: fechaMenosTresMesesStr
          }
        }
      });

      // Filtrar los que no están cerrados (no tienen CierreModulo para todos los módulos)
      const ejerciciosFiltrados = [];
      for (const ej of ejercicios) {
        const cierres = await CierreModulo.findOne({
          where: { ejercicio: ej.ejercicio, mes: ej.mes, convenio_id: ej.convenio_id, pauta_id: ej.pauta_id, tipo_cierre: "REGULAR" }
        });

        const fechaHoy = new Date(hoyArg);
        const fechaEjercicio = new Date(ej.fecha_fin);
        const correspondeCerrar = fechaHoy > fechaEjercicio
        if (!cierres && correspondeCerrar) {
          ejerciciosFiltrados.push(ej);
        }
      };

      // Buscar municipios
      const municipios = await Municipio.findAll({ attributes: ["municipio_id", "municipio_nombre"] });

      // Buscar prorrogas con fecha_fin_nueva < CURRENT_DATE
      const prorrogas = await ProrrogaMunicipio.findAll({
        where: {
          fecha_fin_nueva: {
            [Op.lt]: hoyArg
          }
        }
      });

      const prorrogasFiltradas = [];
      for (const pr of prorrogas) {
        const cierres = await CierreModulo.findOne({
          where: { ejercicio: pr.ejercicio, mes: pr.mes, convenio_id: pr.convenio_id, pauta_id: pr.pauta_id, tipo_cierre: "PRORROGA" }
        });

        const fechaHoy = new Date(hoyArg);
        const fechaEjercicio = new Date(pr.fecha_fin_nueva);
        const correspondeCerrar = fechaHoy > fechaEjercicio
        if (!cierres && correspondeCerrar) {
          prorrogasFiltradas.push(pr);
        }
      };
      // Procesar ejercicios
      for (const ej of ejerciciosFiltrados) {
        const { ejercicio, mes, convenio_id, pauta_id } = ej;
        const pauta = await PautaConvenio.findByPk(pauta_id, {
          include: [
            {
              model: TipoPauta,
              as: "TipoPauta",
              attributes: ["codigo", "nombre"],
            },
          ],
        });
        const tipoCodigo = pauta?.TipoPauta?.codigo ?? null;
        const tipoNombre = pauta?.TipoPauta?.nombre ?? null;
        const modulos = obtenerModulosPorTipoPauta(tipoCodigo);
        if (!modulos.length) {
          console.warn(
            `⚠️ Cierre automático omitido para pauta ${pauta_id}: tipo de pauta no mapeado (${tipoCodigo ?? "sin-codigo"} - ${tipoNombre ?? "sin-nombre"})`
          );
          continue;
        }
        const convenio = await Convenio.findByPk(convenio_id);

        for (const municipio of municipios) {
          for (const modulo of modulos) {
            let informePath = null;
            try {
              const numero = await generarNumeroUnico();
              let datos;
              if (modulo === 'Gastos') {
                datos = await obtenerDatosGastos(municipio.municipio_id, ejercicio, mes);
              } else if (modulo === 'Recursos') {
                datos = await obtenerDatosRecursos(municipio.municipio_id, ejercicio, mes);
              } else if (modulo === 'Recaudaciones') {
                datos = await obtenerDatosRecaudaciones(municipio.municipio_id, ejercicio, mes);
              } else if (modulo === 'Remuneraciones') {
                datos = await obtenerDatosRemuneraciones(municipio.municipio_id, ejercicio, mes);
              }

              informePath = await generarPDF(modulo, datos, municipio.municipio_nombre, ejercicio, mes, convenio.nombre, numero);

              await CierreModulo.create({
                ejercicio,
                mes,
                municipio_id: municipio.municipio_id,
                convenio_id,
                pauta_id,
                modulo,
                tipo_cierre: "REGULAR",
                informe_path: informePath,
                observacion: `Cierre del módulo para el municipio ${municipio.municipio_nombre} exitoso`,
                id_documento: numero
              });

              await CronLog.create({
                nombre_tarea: "Resumen Municipio",
                ejercicio,
                mes,
                municipio_id: municipio.municipio_id,
                estado: "OK",
                mensaje: `Cierre del módulo (${modulo} / ${ejercicio}-${mes}) para el municipio ${municipio.municipio_nombre} exitoso`,
              });

              cierresRealizados++;
            } catch (error) {
              errores++;
              console.error(`❌ Error cerrando módulo ${modulo} para municipio ${municipio.municipio_id}:`, error.message);
              if(informePath){
                await fs.promises.unlink(informePath);
              }
              await CronLog.create({
                nombre_tarea: "Resumen Municipio",
                ejercicio,
                mes,
                municipio_id: municipio.municipio_id,
                estado: "ERROR",
                mensaje: `Error cerrando módulo (${modulo} / ${ejercicio}-${mes}) para el municipio ${municipio.municipio_nombre}: ${error.message}`,
              });
            }
          }
        }
      }

      // Procesar prorrogas
      for (const prorroga of prorrogasFiltradas) {
        const { ejercicio, mes, convenio_id, pauta_id } = prorroga;
        const pauta = await PautaConvenio.findByPk(pauta_id, {
          include: [
            {
              model: TipoPauta,
              as: "TipoPauta",
              attributes: ["codigo", "nombre"],
            },
          ],
        });
        const tipoCodigo = pauta?.TipoPauta?.codigo ?? null;
        const tipoNombre = pauta?.TipoPauta?.nombre ?? null;
        const modulos = obtenerModulosPorTipoPauta(tipoCodigo);
        if (!modulos.length) {
          console.warn(
            `⚠️ Cierre por prórroga omitido para pauta ${pauta_id}: tipo de pauta no mapeado (${tipoCodigo ?? "sin-codigo"} - ${tipoNombre ?? "sin-nombre"})`
          );
          continue;
        }
        const convenio = await Convenio.findByPk(convenio_id);

        for (const municipio of municipios) {
          if (municipio.municipio_id !== prorroga.municipio_id) continue;
          for (const modulo of modulos) {
            try {
              const numero = await generarNumeroUnico();
              let datos;
              if (modulo === 'Gastos') {
                datos = await obtenerDatosGastos(municipio.municipio_id, ejercicio, mes);
              } else if (modulo === 'Recursos') {
                datos = await obtenerDatosRecursos(municipio.municipio_id, ejercicio, mes);
              } else if (modulo === 'Recaudaciones') {
                datos = await obtenerDatosRecaudaciones(municipio.municipio_id, ejercicio, mes);
              } else if (modulo === 'Remuneraciones') {
                datos = await obtenerDatosRemuneraciones(municipio.municipio_id, ejercicio, mes);
              }

              const informePath = await generarPDF(modulo, datos, municipio.municipio_nombre, ejercicio, mes, convenio.nombre, numero);

              await CierreModulo.create({
                ejercicio,
                mes,
                municipio_id: municipio.municipio_id,
                convenio_id,
                pauta_id,
                modulo,
                tipo_cierre: "PRORROGA",
                informe_path: informePath,
                observacion: `Cierre del módulo ${modulo} para el municipio ${municipio.municipio_nombre} exitoso.`,
                id_documento: numero
              });

              await CronLog.create({
                nombre_tarea: "Resumen Municipio",
                ejercicio,
                mes,
                municipio_id: municipio.municipio_id,
                estado: "OK",
                mensaje: `Cierre del módulo (${modulo} / ${ejercicio}-${mes} (Prorroga)) para el municipio ${municipio.municipio_nombre} exitoso`,
              });

              cierresRealizados++;
            } catch (error) {
              errores++;
              console.error(`❌ Error cerrando módulo ${modulo} para municipio ${municipio.municipio_id} por prorroga:`, error.message);
              await CronLog.create({
                nombre_tarea: "Resumen municipio",
                ejercicio,
                mes,
                municipio_id: municipio.municipio_id,
                estado: "ERROR",
                mensaje: `Error cerrando módulo (${modulo} / ${ejercicio}-${mes} (Prorroga)) para el municipio ${municipio.municipio_nombre}: ${error.message}`,
              });
            }
          }
        }
      }

      // Registrar log general
      await CronLog.create({
        nombre_tarea: "Resumen general",
        estado: "OK",
        mensaje: `Cierre automático completado. ${cierresRealizados} módulos cerrados, ${errores} errores.`
      });

      console.log(
        `🟢 [CRON ${hoy}] Cierre automático completado (${cierresRealizados} cierres, ${errores} errores).`
      );
    } catch (error) {
      console.error("💥 Error general en cierre automático:", error);
      try {
        await CronLog.create({
          nombre_tarea: "Resumen general",
          estado: "ERROR",
          mensaje: `Error general: ${error.message}`,
        });
      } catch (logErr) {
        console.error("⚠️ No se pudo registrar el error en CronLog:", logErr.message);
      }
    }
  },
  {
    timezone: "America/Argentina/Buenos_Aires",
  }
);

console.log(
  "🕑 CRON programado: Cierre automático diario a las 2 AM (America/Argentina/Buenos_Aires)"
);

const construirJerarquiaPartidas = async (municipioId, ejercicio, mes) => {
  const [partidas, gastosGuardados] = await Promise.all([
    PartidaGasto.findAll({
      order: [
        ["partidas_gastos_padre", "ASC"],
        ["partidas_gastos_codigo", "ASC"],
      ],
    }),
    Gasto.findAll({
      where: {
        gastos_ejercicio: ejercicio,
        gastos_mes: mes,
        municipio_id: municipioId,
      },
    }),
  ]);

  const gastosMap = new Map();
  gastosGuardados.forEach((gasto) => {
    const importe = gasto.gastos_importe_devengado;
    gastosMap.set(
      gasto.partidas_gastos_codigo,
      importe === null ? null : importe
    );
  });

  const partidasMap = new Map();
  partidas.forEach((partida) => {
    const codigo = partida.partidas_gastos_codigo;
    partidasMap.set(codigo, {
      ...partida.toJSON(),
      partidas_gastos_padre_descripcion: null,
      puede_cargar: Boolean(partida.partidas_gastos_carga),
      importe_devengado: gastosMap.has(codigo) ? gastosMap.get(codigo) : null,
      children: [],
    });
  });

  const jerarquia = [];

  partidasMap.forEach((partida) => {
    const parentId = partida.partidas_gastos_padre;
    const esRaiz =
      parentId === null ||
      parentId === undefined ||
      parentId === 0 ||
      parentId === partida.partidas_gastos_codigo ||
      !partidasMap.has(parentId);

    if (esRaiz) {
      jerarquia.push(partida);
      return;
    }

    const padre = partidasMap.get(parentId);
    if (padre) {
      partida.partidas_gastos_padre_descripcion = padre.partidas_gastos_descripcion;
      padre.children.push(partida);
    } else {
      jerarquia.push(partida);
    }
  });

  return { jerarquia, gastosGuardados };
};

const aplanarJerarquiaPartidas = (nodos, nivel = 0) => {
  const resultado = [];

  nodos.forEach((nodo) => {
    resultado.push({
      codigo: nodo.partidas_gastos_codigo,
      descripcion: nodo.partidas_gastos_descripcion,
      nivel,
      puedeCargar: nodo.puede_cargar,
      importe: nodo.importe_devengado,
    });

    if (Array.isArray(nodo.children) && nodo.children.length > 0) {
      resultado.push(...aplanarJerarquiaPartidas(nodo.children, nivel + 1));
    }
  });

  return resultado;
};

const construirJerarquiaPartidasRecursos = async (municipioId, ejercicio, mes) => {
  const [partidas, recursosGuardados] = await Promise.all([
    PartidaRecurso.findAll({
      order: [
        ["partidas_recursos_padre", "ASC"],
        ["partidas_recursos_codigo", "ASC"],
      ],
    }),
    Recurso.findAll({
      where: {
        recursos_ejercicio: ejercicio,
        recursos_mes: mes,
        municipio_id: municipioId,
      },
    }),
  ]);

  const recursosMap = new Map();
  recursosGuardados.forEach((recurso) => {
    const importe = recurso.recursos_importe_percibido;
    const contribuyentes = recurso.recursos_cantidad_contribuyentes;
    const pagaron = recurso.recursos_cantidad_pagaron;

    recursosMap.set(recurso.partidas_recursos_codigo, {
      importe: importe === null ? null : importe,
      contribuyentes:
        contribuyentes === null || contribuyentes === undefined
          ? null
          : Number(contribuyentes),
      pagaron:
        pagaron === null || pagaron === undefined ? null : Number(pagaron),
    });
  });

  const partidasMap = new Map();
  partidas.forEach((partida) => {
    const codigo = partida.partidas_recursos_codigo;
    const valoresGuardados = recursosMap.get(codigo);

    partidasMap.set(codigo, {
      ...partida.toJSON(),
      partidas_recursos_padre_descripcion: null,
      puede_cargar: Boolean(partida.partidas_recursos_carga),
      es_sin_liquidacion: Boolean(partida.partidas_recursos_sl),
      recursos_importe_percibido: valoresGuardados?.importe ?? null,
      recursos_cantidad_contribuyentes: valoresGuardados?.contribuyentes ?? null,
      recursos_cantidad_pagaron: valoresGuardados?.pagaron ?? null,
      children: [],
    });
  });

  const jerarquia = [];

  partidasMap.forEach((partida) => {
    const parentId = partida.partidas_recursos_padre;
    const esRaiz =
      parentId === null ||
      parentId === undefined ||
      parentId === 0 ||
      parentId === partida.partidas_recursos_codigo ||
      !partidasMap.has(parentId);

    if (esRaiz) {
      jerarquia.push(partida);
      return;
    }

    const padre = partidasMap.get(parentId);
    if (padre) {
      partida.partidas_recursos_padre_descripcion = padre.partidas_recursos_descripcion;
      padre.children.push(partida);
    } else {
      jerarquia.push(partida);
    }
  });

  return { jerarquia, recursosGuardados };
};

const aplanarJerarquiaPartidasRecursos = (nodos, nivel = 0) => {
  const resultado = [];

  nodos.forEach((nodo) => {
    resultado.push({
      codigo: nodo.partidas_recursos_codigo,
      descripcion: nodo.partidas_recursos_descripcion,
      nivel,
      puedeCargar: nodo.puede_cargar,
      esSinLiquidacion: nodo.es_sin_liquidacion,
      importePercibido: nodo.recursos_importe_percibido,
      totalContribuyentes: nodo.recursos_cantidad_contribuyentes,
      contribuyentesPagaron: nodo.recursos_cantidad_pagaron,
    });

    if (Array.isArray(nodo.children) && nodo.children.length > 0) {
      resultado.push(...aplanarJerarquiaPartidasRecursos(nodo.children, nivel + 1));
    }
  });

  return resultado;
};

const obtenerDatosGastos = async (municipioId, ejercicio, mes) => {
  const datos = {
    partidas: [],
    totalImporte: 0
  };
  const { jerarquia, gastosGuardados } = await construirJerarquiaPartidas(
    municipioId,
    ejercicio,
    mes
  );

  if (gastosGuardados && gastosGuardados.length > 0) {
    const partidasPlanas = aplanarJerarquiaPartidas(jerarquia);

    const totalImporte = partidasPlanas.reduce((acumulado, partida) => {
      if (!partida.puedeCargar) {
        return acumulado;
      }

      if (partida.importe === null || partida.importe === undefined) {
        return acumulado;
      }

      const importeNumerico = Number(partida.importe);
      if (!Number.isFinite(importeNumerico)) {
        return acumulado;
      }

      return acumulado + importeNumerico;
    }, 0);

    datos.partidas = partidasPlanas;
    datos.totalImporte = totalImporte;
  }

  return datos;
}

const obtenerDatosRecursos = async (municipioId, ejercicio, mes) => {
  const datos = {
    partidas: [],
    totalImporte: 0
  };
  const { jerarquia, recursosGuardados } = await construirJerarquiaPartidasRecursos(
    municipioId,
    ejercicio,
    mes
  );

  if (recursosGuardados && recursosGuardados.length > 0) {
    const partidasPlanas = aplanarJerarquiaPartidasRecursos(jerarquia);

    const totalImporte = partidasPlanas.reduce((acumulado, partida) => {
      if (!partida.puedeCargar) {
        return acumulado;
      }

      if (partida.importePercibido === null || partida.importePercibido === undefined) {
        return acumulado;
      }

      const importeNumerico = Number(partida.importePercibido);
      if (!Number.isFinite(importeNumerico)) {
        return acumulado;
      }

      return acumulado + importeNumerico;
    }, 0);
    datos.partidas = partidasPlanas;
    datos.totalImporte = totalImporte;
  }

  return datos;
}

const obtenerDatosRecaudaciones = async (municipioId, ejercicio, mes) => {
  const obtenerImporteNumerico = (importe) => {
    if (importe === null || importe === undefined) {
      return null;
    }

    const importeNumerico = Number(importe);
    return Number.isFinite(importeNumerico) ? importeNumerico : null;
  };

  const agruparTotalesPorCodigoTributo = (conceptos = []) => {
    const acumulados = new Map();

    conceptos.forEach((concepto) => {
      const codigoTributo = Number(concepto.codigo_tributo);
      if (!Number.isInteger(codigoTributo) || codigoTributo < 0) {
        return;
      }

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
      if (importeNumerico === null) {
        return acumulado;
      }
      return acumulado + importeNumerico;
    }, 0);

  const datos = {
    conceptos: [],
    totalesPorCodigo: [],
    totalImporte: 0
  }

  const recaudaciones = await Recaudacion.findAll({
    where: {
      recaudaciones_ejercicio: ejercicio,
      recaudaciones_mes: mes,
      municipio_id: municipioId,
    },
  });

  if(recaudaciones && recaudaciones.length > 0){
    const mappedConceptos = recaudaciones
      .map((recaudacion) => ({
        codigo_tributo: recaudacion.codigo_tributo,
        descripcion: recaudacion.descripcion,
        ente_recaudador: recaudacion.ente_recaudador,
        importe_recaudacion: recaudacion.importe_recaudacion
      }))
      .sort((a, b) => {
        const codigoA = Number(a.codigo_tributo);
        const codigoB = Number(b.codigo_tributo);
        if (codigoA !== codigoB) {
          return codigoA - codigoB;
        }
        return (a.ente_recaudador ?? "").localeCompare(b.ente_recaudador ?? "");
      });

    const totalesPorCodigo = agruparTotalesPorCodigoTributo(mappedConceptos);
    const totalImporte = calcularTotalImporte(
      totalesPorCodigo.map((item) => ({ importe_recaudacion: item.importe_total_recaudacion }))
    );

    datos.conceptos = mappedConceptos;
    datos.totalesPorCodigo = totalesPorCodigo;
    datos.totalImporte = totalImporte;
  }
  return datos;
}

const obtenerDatosRemuneraciones = async (municipioId, ejercicio, mes) => {
  const datos = {
    remuneraciones: [],
    regimenes: []
  }

  const remuneraciones = await Remuneracion.findAll({
    where: {
      remuneraciones_ejercicio: ejercicio,
      remuneraciones_mes: mes,
      municipio_id: municipioId,
    },
  });

  if (remuneraciones && remuneraciones.length > 0) {
    const regimenes = await RegimenLaboral.findAll({
      attributes: ["regimen_id", "nombre"],
    });

    const regimenesMap = new Map(
      regimenes.map((regimen) => [Number(regimen.regimen_id), regimen.nombre])
    );

    const remuneracionesPlanas = remuneraciones.map((remuneracion) =>
      mapRemuneracionParaInforme(remuneracion, regimenesMap)
    );

    datos.regimenes = Array.from(
      new Set(remuneracionesPlanas.map((item) => item.regimen_laboral))
    )
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
      .map((nombre) => ({ nombre }));
    datos.remuneraciones = remuneracionesPlanas;
  }

  return datos;
}

const generarNumero = (digitos = 12) => {
  const min = 10 ** (digitos - 1);
  const max = (10 ** digitos) - 1;
  return crypto.randomInt(min, max).toString();
}

const generarNumeroUnico = async () => {
  let unico = generarNumero();
  let valido = false;
  while(!valido){
    const repetido = await CierreModulo.findOne({
      where: {
        id_documento: unico
      }
    })

    valido = repetido ? false : true;
  }
  return unico;
}

const sanitizarCadena = (cadena, separador = " ") => {
  const partes = cadena.split(separador);

  return partes.join('_');
}

// Función para generar PDF
const generarPDF = async (modulo, datos, municipioNombre, ejercicio, mes, convenioNombre, numero) => {
  // Buscar directorio base en BD
  const directorioBase = await Parametros.findOne({ where: {
    nombre: "Directorio Base",
    estado: true
  } });

  if (!directorioBase || !directorioBase.valor) {
    throw new Error("Directorio base no configurado");
  }
  
  // Buscar directorio de informes en BD
  const directorioInformes = await Parametros.findOne({ where: {
    nombre: "Directorio de Informes",
    estado: true
  } });

  if (!directorioInformes || !directorioInformes.valor) {
    throw new Error("Directorio de informes no configurado");
  }

  // Ruta base
  const rutaBase = directorioBase.valor

  // Ruta logica
  const rutaInformes = directorioInformes.valor

  // Armar ruta absoluta
  const dirPath = path.resolve(rutaBase, rutaInformes);

  // Crear carpeta si no existe
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (err) {
    throw new Error(`No se pudo crear el directorio: ${dirPath}. ${err.message}`);
  }

  const fileName = `${ejercicio}-${mes}-${sanitizarCadena(municipioNombre)}-${modulo}-${numero}.pdf`

  // Armar el filepath
  const filePath = path.join(
    dirPath,
    fileName
  );

  let buffer;
  if (modulo === 'Gastos') {
    buffer = await buildInformeGastos({
      municipioNombre,
      ejercicio,
      mes,
      partidas: datos.partidas,
      totalImporte: datos.totalImporte,
      usuarioNombre: 'Sistema Automático',
      convenioNombre,
      cierreId: numero
    });
  } else if (modulo === 'Recursos') {
    buffer = await buildInformeRecursos({
      municipioNombre,
      ejercicio,
      mes,
      partidas: datos.partidas,
      totalImporte: datos.totalImporte,
      usuarioNombre: 'Sistema Automático',
      convenioNombre,
      cierreId: numero
    });
  } else if (modulo === 'Recaudaciones') {
    buffer = await buildInformeRecaudaciones({
      municipioNombre,
      ejercicio,
      mes,
      conceptos: datos.conceptos,
      totalesPorCodigo: datos.totalesPorCodigo,
      totalImporte: datos.totalImporte,
      usuarioNombre: 'Sistema Automático',
      convenioNombre,
      cierreId: numero
    });
  } else if (modulo === 'Remuneraciones') {
    buffer = await buildInformeRemuneraciones({
      municipioNombre,
      ejercicio,
      mes,
      remuneraciones: datos.remuneraciones,
      regimenes: datos.regimenes,
      usuarioNombre: 'Sistema Automático',
      convenioNombre,
      cierreId: numero
    });
  }
  fs.writeFileSync(filePath, buffer);
  return path.join(rutaInformes, fileName);
};
