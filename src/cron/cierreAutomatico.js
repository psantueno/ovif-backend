import cron from "node-cron";
import fs from "fs";
import path from "path";
import { Op, fn, col, where } from "sequelize";
import {
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
import {
  encolarEnvioCierreModulos,
  procesarMailsPendientes,
} from "../services/emailService.js";
import { TIPOS_CIERRE_MODULO } from "../utils/cierreModulo.js";
import {
  MODULOS_POR_TIPO_PAUTA,
  obtenerModulosPorTipoPauta,
  obtenerDatosPorModulo,
  obtenerNombreConvenioSeguro,
  generarNumero,
} from "../services/cierreService.js";

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
  } else if (modulo === 'DETERMINACION_TRIBUTARIA') {
    buffer = await buildInformeDeterminacionTributaria({
      municipioNombre,
      ejercicio,
      mes,
      determinaciones: datos.determinaciones,
      resumen: datos.resumen,
      usuarioNombre: 'Sistema Automático',
      convenioNombre,
      cierreId: numero
    });
  }
  fs.writeFileSync(filePath, buffer);
  return path.join(rutaInformes, fileName);
};

const agregarMailsParaCierre = async (mailsParaEnviar, municipioId, ejercicio, mes, modulos, esProrroga) => {
  // Evitar duplicados: si ya existe un mail para el mismo municipio, ejercicio, mes, modulos y tipo de cierre, no agregar otro
  if(mailsParaEnviar.some(m => 
    m.municipio_id === municipioId && 
    m.ejercicio === ejercicio && 
    m.mes === mes && 
    m.modulos.every(mod => modulos.includes(mod)) && 
    m.esProrroga === esProrroga
  )){
    return;
  }
  
  const municipioMails = await MunicipioMail.findAll({
    where: { 
      municipio_id: municipioId
    }
  })

  municipioMails.forEach((mm) => {
    mailsParaEnviar.push({
      municipio_id: municipioId,
      to: mm.email,
      nombre: mm.nombre,
      ejercicio,
      mes,
      modulos,
      esProrroga
    })
  }
  )
}

// 🕑 Ejecutar todos los días a las 2 AM (hora Argentina)
cron.schedule(
  "34 19 * * *",
  //"/60 * * * * *",
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
      // Buscar ejercicios vencidos recientemente por su fecha de cierre real.
      // IMPORTANTE: fecha_fin es DATETIME y hoyArg es la fecha calendario en
      // hora Argentina. Comparamos a nivel de DÍA (DATE()) para evitar que
      // un valor almacenado con horario (ej: 2026-04-24 21:00:00 UTC, que en
      // AR es 25/04 00:00) sea considerado "menor" al string '2026-04-25' y
      // cierre el módulo el mismo día 25/04, cuando el 25/04 todavía es un
      // día válido de carga (el cierre debe ocurrir el 26/04 a las 2 AM).
      const ejerciciosFiltrados = await EjercicioMes.findAll({
        where: {
          [Op.and]: [
            where(fn("DATE", col("fecha_fin")), { [Op.lt]: hoyArg }),
            where(fn("DATE", col("fecha_fin")), { [Op.gte]: fechaMenosSeisMesesStr }),
          ],
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

              await agregarMailsParaCierre(mailsParaEnviar, municipio.municipio_id, ejercicio, mes, modulos, false);

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

              await agregarMailsParaCierre(mailsParaEnviar, municipio.municipio_id, ejercicio, mes, modulos, true);

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
        }
      }

      // Registrar log general
      await CronLog.create({
        nombre_tarea: "Resumen general",
        estado: errores > 0 ? "ERROR" : "OK",
        mensaje: `Cierre automático completado. ${cierresRealizados} módulos cerrados, ${errores} errores.`
      });

      console.log(
        `🟢 [CRON ${hoy}] Cierre automático completado (${cierresRealizados} cierres, ${errores} errores).`
      );

      // Mostrar detalle de mails agrupados por ejercicio, mes, modulo y esProrroga
      const resumenMails = {};
      mailsParaEnviar.forEach(({ ejercicio, mes, modulos, esProrroga }) => {
        const modulosStr = modulos.join(", ");
          const key = `${ejercicio}-${mes}-${modulosStr}-${esProrroga ? "PRORROGA" : "REGULAR"}`;
          resumenMails[key] = (resumenMails[key] || 0) + 1;
      });
      console.log("Detalle de mails para enviar:");
      Object.entries(resumenMails).forEach(([key, cantidad]) => {
        const [ejercicio, mes, modulo, tipo] = key.split("-");
        console.log(`  Ejercicio: ${ejercicio}, Mes: ${mes}, Módulo: ${modulo}, Tipo: ${tipo}, Cantidad: ${cantidad}`);
      });
      console.log("Total de mails para enviar:", mailsParaEnviar.length);

      // Encolar mails en outbox y procesarlos en esta misma corrida
      let mailsEncolados = 0;
      let mailsDuplicados = 0;
      let erroresEncolando = 0;
      const idsParaProcesar = [];
      for (const m of mailsParaEnviar) {
        try {
          const { correo, created } = await encolarEnvioCierreModulos({
            destinatario: m.to,
            nombre: m.nombre,
            ejercicio: m.ejercicio,
            mes: m.mes,
            modulos: m.modulos,
            esProrroga: m.esProrroga,
          });
          if (created) mailsEncolados++;
          else mailsDuplicados++;

          const correoRetriable =
            correo &&
            ["PENDIENTE", "ERROR"].includes(correo.estado) &&
            Number(correo.intentos) < Number(correo.max_intentos);

          if (correoRetriable) {
            idsParaProcesar.push(Number(correo.id));
          }
        } catch (err) {
          erroresEncolando++;
          console.error(`⚠️ Error encolando mail para ${m.to}:`, err.message);
        }
      }
      console.log(
        `📬 [CRON] ${mailsEncolados} mails encolados, ${mailsDuplicados} ya existentes, ${erroresEncolando} errores al encolar, ${mailsParaEnviar.length} evaluados`
      );

      const resumenEnvio = await procesarMailsPendientes({
        ids: idsParaProcesar,
        maxAttemptsPerRun: 3,
      });

      console.log(
        `📨 [CRON] Correos procesados: ${resumenEnvio.total}, enviados: ${resumenEnvio.sent}, fallidos: ${resumenEnvio.failed}, omitidos: ${resumenEnvio.skipped}`
      );

      await CronLog.create({
        nombre_tarea: "Resumen Correos",
        estado: resumenEnvio.failed > 0 || erroresEncolando > 0 ? "ERROR" : "OK",
        mensaje: `Encolado: evaluados=${mailsParaEnviar.length}, nuevos=${mailsEncolados}, duplicados=${mailsDuplicados}, errores=${erroresEncolando}. Envío: procesados=${resumenEnvio.total}, enviados=${resumenEnvio.sent}, fallidos=${resumenEnvio.failed}, omitidos=${resumenEnvio.skipped}.`,
      });

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
