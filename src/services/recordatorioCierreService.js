/*
 * recordatorioCierreService.js — Recordatorio de vencimiento de carga a municipios.
 *
 * Envía un mail por pauta (con los módulos que agrupa) a cada contacto de
 * ovif_municipios_mails cuando faltan N días o menos para el cierre efectivo
 * del período (considerando la prórroga del municipio, si existe).
 *
 * Un único recordatorio por destinatario/municipio/pauta/fecha de cierre:
 * la clave idempotente de ovif_envio_correos evita duplicados aunque el proceso
 * corra varias veces el mismo día o en días sucesivos dentro de la ventana.
 */
import { Op } from "sequelize";
import { CronLog, Municipio, MunicipioMail } from "../models/index.js";
import { obtenerPeriodosRegulares } from "../utils/periodosRegulares.js";
import { obtenerFechaActual } from "../utils/obtenerFechaActual.js";
import { obtenerModulosPorTipoPauta } from "./cierreService.js";
import { encolarRecordatorioCierre, procesarMailsPendientes } from "./emailService.js";

export const NOMBRE_TAREA_RECORDATORIO = "Recordatorio cierre";
export const NOMBRE_TAREA_RESUMEN_RECORDATORIO = "Resumen Recordatorio cierre";

const parseFechaISO = (valor) => {
  const match = String(valor ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

/**
 * Días calendario desde hoyISO hasta cierreISO (ambos YYYY-MM-DD).
 * Negativo si el cierre ya pasó; null si alguna fecha es inválida.
 */
export const calcularDiasRestantes = (hoyISO, cierreISO) => {
  const hoy = parseFechaISO(hoyISO);
  const cierre = parseFechaISO(cierreISO);
  if (hoy === null || cierre === null) return null;
  return Math.round((cierre - hoy) / 86400000);
};

/**
 * Indica si un período regular debe recordarse en la fecha de referencia.
 * Requiere período iniciado, no vencido y cierre dentro de [0, diasPrevios] días.
 */
export const periodoEnVentanaRecordatorio = (periodo, fechaReferencia, diasPrevios) => {
  if (!periodo?.iniciado || periodo?.vencido || !periodo?.fecha_cierre) {
    return { enVentana: false, diasRestantes: null };
  }
  const diasRestantes = calcularDiasRestantes(fechaReferencia, periodo.fecha_cierre);
  const enVentana = diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= diasPrevios;
  return { enVentana, diasRestantes };
};

/**
 * Arma la lista de recordatorios a enviar: un ítem por municipio y pauta.
 *
 * @param {object} params
 * @param {string} params.fechaReferencia - YYYY-MM-DD (hora Argentina)
 * @param {number} params.diasPrevios
 * @param {number} [params.municipioId] - limita a un municipio (simulación)
 * @returns {Promise<Array<{ municipio_id, municipio_nombre, destinatarios, periodo, modulos, dias_restantes }>>}
 */
export const obtenerRecordatorios = async ({ fechaReferencia, diasPrevios, municipioId = null }) => {
  const whereMails = municipioId ? { municipio_id: Number(municipioId) } : {};
  const mails = await MunicipioMail.findAll({ where: whereMails });

  // Agrupar contactos por municipio, sin repetir emails (comparación sin mayúsculas)
  const contactosPorMunicipio = new Map();
  for (const mail of mails) {
    const email = String(mail.email ?? "").trim();
    if (!email) continue;

    const contactos = contactosPorMunicipio.get(mail.municipio_id) ?? new Map();
    const clave = email.toLowerCase();
    if (!contactos.has(clave)) {
      contactos.set(clave, { email, nombre: mail.nombre });
    }
    contactosPorMunicipio.set(mail.municipio_id, contactos);
  }

  if (!contactosPorMunicipio.size) {
    return [];
  }

  const municipios = await Municipio.findAll({
    where: { municipio_id: { [Op.in]: [...contactosPorMunicipio.keys()] } },
    attributes: ["municipio_id", "municipio_nombre"],
    order: [["municipio_nombre", "ASC"]],
  });

  const recordatorios = [];

  for (const municipio of municipios) {
    const destinatarios = [...contactosPorMunicipio.get(municipio.municipio_id).values()];
    const periodos = await obtenerPeriodosRegulares({
      municipioId: municipio.municipio_id,
      fechaReferencia,
    });

    for (const periodo of periodos) {
      const { enVentana, diasRestantes } = periodoEnVentanaRecordatorio(periodo, fechaReferencia, diasPrevios);
      if (!enVentana) continue;

      const modulos = obtenerModulosPorTipoPauta(periodo.tipo_pauta_codigo);
      if (!modulos.length) {
        console.warn(
          `⚠️ Recordatorio de cierre omitido para pauta ${periodo.pauta_id}: tipo de pauta no mapeado (${periodo.tipo_pauta_codigo ?? "sin-codigo"})`
        );
        continue;
      }

      recordatorios.push({
        municipio_id: municipio.municipio_id,
        municipio_nombre: municipio.municipio_nombre,
        destinatarios,
        periodo,
        modulos: [...modulos].sort(),
        dias_restantes: diasRestantes,
      });
    }
  }

  return recordatorios;
};

const registrarCronLog = async (datos) => {
  try {
    await CronLog.create(datos);
  } catch (error) {
    console.error("⚠️ No se pudo registrar el CronLog del recordatorio de cierre:", error.message);
  }
};

/**
 * Ejecuta el recordatorio: encola los mails (idempotente) y procesa el envío.
 * Los correos existentes en PENDIENTE/ERROR con intentos disponibles se reintentan.
 *
 * @returns {Promise<{ evaluados, nuevos, existentes, erroresEncolando, envio }>}
 */
export const ejecutarRecordatorioCierre = async ({
  fechaReferencia = obtenerFechaActual(),
  diasPrevios,
} = {}) => {
  const recordatorios = await obtenerRecordatorios({ fechaReferencia, diasPrevios });

  let evaluados = 0;
  let nuevos = 0;
  let existentes = 0;
  let erroresEncolando = 0;
  const idsParaProcesar = [];

  for (const item of recordatorios) {
    for (const destinatario of item.destinatarios) {
      evaluados++;
      try {
        const { correo, created } = await encolarRecordatorioCierre({
          destinatario: destinatario.email,
          nombre: destinatario.nombre,
          municipioId: item.municipio_id,
          municipioNombre: item.municipio_nombre,
          periodo: item.periodo,
          modulos: item.modulos,
        });

        if (created) nuevos++;
        else existentes++;

        const correoRetriable =
          correo &&
          ["PENDIENTE", "ERROR"].includes(correo.estado) &&
          Number(correo.intentos) < Number(correo.max_intentos);

        if (correoRetriable) {
          idsParaProcesar.push(Number(correo.id));
        }
      } catch (error) {
        erroresEncolando++;
        console.error(`⚠️ Error encolando recordatorio de cierre para ${destinatario.email}:`, error.message);
        await registrarCronLog({
          nombre_tarea: NOMBRE_TAREA_RECORDATORIO,
          ejercicio: item.periodo.ejercicio,
          mes: item.periodo.mes,
          municipio_id: item.municipio_id,
          estado: "ERROR",
          mensaje: `Error encolando recordatorio (${item.modulos.join(", ")} / ${item.periodo.ejercicio}-${item.periodo.mes}) para ${destinatario.email} del municipio ${item.municipio_nombre}: ${error.message}`,
        });
      }
    }
  }

  const envio = await procesarMailsPendientes({ ids: idsParaProcesar, maxAttemptsPerRun: 3 });

  await registrarCronLog({
    nombre_tarea: NOMBRE_TAREA_RESUMEN_RECORDATORIO,
    estado: envio.failed > 0 || erroresEncolando > 0 ? "ERROR" : "OK",
    mensaje: `Fecha ${fechaReferencia}, días previos ${diasPrevios}. Recordatorios: pautas=${recordatorios.length}, evaluados=${evaluados}, nuevos=${nuevos}, ya existentes=${existentes}, errores=${erroresEncolando}. Envío: procesados=${envio.total}, enviados=${envio.sent}, fallidos=${envio.failed}, omitidos=${envio.skipped}.`,
  });

  return { evaluados, nuevos, existentes, erroresEncolando, envio };
};
