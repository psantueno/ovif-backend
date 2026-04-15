import cron from "node-cron";
import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import {
  RegimenLaboral,
  Gasto,
  Recurso,
  Recaudacion,
  Remuneracion,
  DeterminacionTributaria,
  EjercicioMes,
  ProrrogaMunicipio,
  CronLog,
  CierreModulo,
  Municipio,
  PautaConvenio,
  TipoPauta,
  Convenio, 
  Parametros,
  MunicipioMail
} from "../models/index.js";
import { buildInformeGastos } from "../utils/pdf/municipioGastos.js";
import { buildInformeRecursos } from "../utils/pdf/municipioRecursos.js";
import { buildInformeRecaudaciones } from "../utils/pdf/municipioRecaudaciones.js";
import { buildInformeRemuneraciones } from "../utils/pdf/municipioRemuneraciones.js";
import { buildInformeDeterminacionTributaria } from "../utils/pdf/municipioDeterminacionTributaria.js";
import { enviarMensajeCierreModulos } from "../services/mailer.js";
import crypto from "crypto";
import {
  CIERRE_MODULOS,
  TIPOS_CIERRE_MODULO,
} from "../utils/cierreModulo.js";

const MODULOS_POR_TIPO_PAUTA = {

  gastos_recursos: ["GASTOS", "RECURSOS"],
  recaudaciones_remuneraciones: ["RECAUDACIONES", "REMUNERACIONES"],
  determinacion_tributaria: ["DETERMINACION_TRIBUTARIA"],
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

const obtenerNombreConvenioSeguro = (convenio, convenioId) =>
  convenio?.nombre ?? `Convenio ${convenioId}`;

const existeCierreModulo = async ({
  ejercicio,
  mes,
  municipioId,
  convenioId,
  pautaId,
  modulo,
  tipoCierre,
}) =>
  CierreModulo.findOne({
    where: {
      ejercicio,
      mes,
      municipio_id: municipioId,
      convenio_id: convenioId,
      pauta_id: pautaId,
      modulo,
      tipo_cierre: tipoCierre,
    },
  });

const obtenerDatosPorModulo = async (modulo, municipioId, ejercicio, mes) => {

  if (modulo === "GASTOS") {
    return obtenerDatosGastos(municipioId, ejercicio, mes);
  }

  if (modulo === "RECURSOS") {
    return obtenerDatosRecursos(municipioId, ejercicio, mes);
  }

  if (modulo === "RECAUDACIONES") {
    return obtenerDatosRecaudaciones(municipioId, ejercicio, mes);
  }

  if (modulo === "REMUNERACIONES") {

    return obtenerDatosRemuneraciones(municipioId, ejercicio, mes);
  }

  if (modulo === "DETERMINACION_TRIBUTARIA") {
    return obtenerDatosDeterminacionTributaria(municipioId, ejercicio, mes);
  }

  throw new Error(`Módulo no soportado para cierre automático: ${modulo}`);
};

const obtenerGastosCron = async (municipioId, ejercicio, mes) => {
  const gastos = await Gasto.findAll({
    where: {
      gastos_ejercicio: ejercicio,
      gastos_mes: mes,
      municipio_id: municipioId,
    },
    order: [["codigo_partida", "ASC"]],
  });

  return gastos.map((g) => g.toJSON());
};

const obtenerDatosGastos = async (municipioId, ejercicio, mes) => {
  const gastos = await obtenerGastosCron(municipioId, ejercicio, mes);

  const totales = gastos.reduce((acc, g) => {
    acc.formulado += Number(g.formulado) || 0;
    acc.modificado += Number(g.modificado) || 0;
    acc.vigente += Number(g.vigente) || 0;
    acc.devengado += Number(g.devengado) || 0;
    return acc;
  }, { formulado: 0, modificado: 0, vigente: 0, devengado: 0 });

  return { gastos, totales };
}

const obtenerDatosRecursos = async (municipioId, ejercicio, mes) => {
  const recursosRaw = await Recurso.findAll({
    where: {
      recursos_ejercicio: ejercicio,
      recursos_mes: mes,
      municipio_id: municipioId,
    },
    order: [["codigo_recurso", "ASC"]],
  });

  const recursos = recursosRaw.map((r) => r.toJSON());

  const totales = recursos.reduce((acc, r) => {
    acc.vigente += Number(r.vigente) || 0;
    acc.percibido += Number(r.percibido) || 0;
    return acc;
  }, { vigente: 0, percibido: 0 });

  return { recursos, totales };
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
  const MAX_INTENTOS = 10;
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const unico = generarNumero();
    const repetido = await CierreModulo.findOne({ where: { id_documento: unico } });
    if (!repetido) {
      return unico;
    }
  }
  throw new Error("No se pudo generar un id_documento único tras 10 intentos");
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
  if (modulo === 'GASTOS') {
    buffer = await buildInformeGastos({
      municipioNombre,
      ejercicio,
      mes,
      gastos: datos.gastos,
      totales: datos.totales,
      usuarioNombre: 'Sistema Automático',
      convenioNombre,
      cierreId: numero
    });
  } else if (modulo === 'RECURSOS') {
    buffer = await buildInformeRecursos({
      municipioNombre,
      ejercicio,
      mes,
      recursos: datos.recursos,
      totales: datos.totales,
      usuarioNombre: 'Sistema Automático',
      convenioNombre,
      cierreId: numero
    });
  } else if (modulo === 'RECAUDACIONES') {
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
  } else if (modulo === 'REMUNERACIONES') {
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

// 🕑 Ejecutar todos los días a las 2 AM (hora Argentina)
cron.schedule(
  "0 2 * * *",
  //"*/600 * * * * *",
  async () => {
    console.log(`🟡 [CRON ${new Date()}] Iniciando proceso de cierre automático...`);
    const hoy = new Date();

    let cierresRealizados = 0;
    let errores = 0;

    const hoyArg = new Date().toLocaleDateString("sv-SE", {
      timeZone: "America/Argentina/Buenos_Aires"
    })

    // Crear copia para no mutar la fecha original. Ventana de búsqueda: 6 meses atrás
    const fechaMenosSeisMeses = new Date(hoyArg);
    fechaMenosSeisMeses.setMonth(fechaMenosSeisMeses.getMonth() - 6);
    const fechaMenosSeisMesesStr = fechaMenosSeisMeses
      .toISOString()
      .split("T")[0];

    try {
      // Buscar ejercicios vencidos recientemente por su fecha de cierre real
      const ejerciciosFiltrados = await EjercicioMes.findAll({
        where: {
          fecha_fin: {
            [Op.lt]: hoyArg,
            [Op.gte]: fechaMenosSeisMesesStr,
          },
        },
      });

      // Buscar municipios
      const municipios = await Municipio.findAll({ attributes: ["municipio_id", "municipio_nombre"] });

      // Buscar prorrogas vencidas dentro de la misma ventana de 6 meses
      const prorrogas = await ProrrogaMunicipio.findAll({
        where: {
          fecha_fin_nueva: {
            [Op.lt]: hoyArg,
            [Op.gte]: fechaMenosSeisMesesStr,
          }
        }
      });

      // Mails
      const mailsParaEnviar = [];

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
        const convenioNombre = obtenerNombreConvenioSeguro(convenio, convenio_id);

        for (const municipio of municipios) {
          for (const modulo of modulos) {
            let informePath = null;
            try {
              const cierreExistente = await existeCierreModulo({
                ejercicio,
                mes,
                municipioId: municipio.municipio_id,
                convenioId: convenio_id,
                pautaId: pauta_id,
                modulo,
                tipoCierre: TIPOS_CIERRE_MODULO.REGULAR,
              });

              if (cierreExistente) {
                continue;
              }

              const numero = await generarNumeroUnico();
              const datos = await obtenerDatosPorModulo(
                modulo,
                municipio.municipio_id,
                ejercicio,
                mes
              );

              informePath = await generarPDF(
                modulo,
                datos,
                municipio.municipio_nombre,
                ejercicio,
                mes,
                convenioNombre,
                numero
              );

              await CierreModulo.create({
                ejercicio,
                mes,
                municipio_id: municipio.municipio_id,
                convenio_id,
                pauta_id,
                modulo,
                tipo_cierre: TIPOS_CIERRE_MODULO.REGULAR,
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

          /*
            const municipioMails = await MunicipioMail.findAll({
              where: { 
                municipio_id: municipio.municipio_id
              }
            })

            municipioMails.forEach((mm) => {
              mailsParaEnviar.push({
                to: mm.email,
                nombre: mm.nombre,
                ejercicio,
                mes,
                modulos,
                esProrroga: false
              })
            })
          }*/
        }
      }

      // Procesar prorrogas
      for (const prorroga of prorrogas) {
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
        const convenioNombre = obtenerNombreConvenioSeguro(convenio, convenio_id);

        for (const municipio of municipios) {
          if (municipio.municipio_id !== prorroga.municipio_id) continue;
          for (const modulo of modulos) {
            let informePath = null;
            try {
              const cierreExistente = await existeCierreModulo({
                ejercicio,
                mes,
                municipioId: municipio.municipio_id,
                convenioId: convenio_id,
                pautaId: pauta_id,
                modulo,
                tipoCierre: TIPOS_CIERRE_MODULO.PRORROGA,
              });

              if (cierreExistente) {
                continue;
              }

              const numero = await generarNumeroUnico();
              const datos = await obtenerDatosPorModulo(
                modulo,
                municipio.municipio_id,
                ejercicio,
                mes
              );

              informePath = await generarPDF(
                modulo,
                datos,
                municipio.municipio_nombre,
                ejercicio,
                mes,
                convenioNombre,
                numero
              );

              await CierreModulo.create({
                ejercicio,
                mes,
                municipio_id: municipio.municipio_id,
                convenio_id,
                pauta_id,
                modulo,
                tipo_cierre: TIPOS_CIERRE_MODULO.PRORROGA,
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
              if(informePath){
                await fs.promises.unlink(informePath);
              }
              await CronLog.create({
                nombre_tarea: "Resumen Municipio",
                ejercicio,
                mes,
                municipio_id: municipio.municipio_id,
                estado: "ERROR",
                mensaje: `Error cerrando módulo (${modulo} / ${ejercicio}-${mes} (Prorroga)) para el municipio ${municipio.municipio_nombre}: ${error.message}`,
              });
            }
          }

          /*
            const municipioMails = await MunicipioMail.findAll({
              where: { 
                municipio_id: municipio.municipio_id
              }
            })

            municipioMails.forEach((mm) => {
              mailsParaEnviar.push({
                to: mm.email,
                nombre: mm.nombre,
                ejercicio,
                mes,
                modulos,
                esProrroga: true
              })
            })
          }*/
        }
      }

      // Registrar log general
      await CronLog.create({
        nombre_tarea: "Resumen general",
        estado: errores > 0 ? "WARNING" : "OK",
        mensaje: `Cierre automático completado. ${cierresRealizados} módulos cerrados, ${errores} errores.`
      });

      console.log(
        `🟢 [CRON ${hoy}] Cierre automático completado (${cierresRealizados} cierres, ${errores} errores).`
      );

      /*// Enviar mails
      mailsParaEnviar.forEach(async (m) => {
        await enviarMensajeCierreModulos(m.to, m.nombre, m.ejercicio, m.mes, m.modulos, m.esProrroga)
      })*/
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
