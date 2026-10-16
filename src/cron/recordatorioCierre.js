import cron from "node-cron";
import { CronLog } from "../models/index.js";
import { obtenerConfigRecordatorioCierre } from "../utils/parametrosSistema.js";
import { obtenerFechaActual } from "../utils/obtenerFechaActual.js";
import {
  ejecutarRecordatorioCierre,
  NOMBRE_TAREA_RESUMEN_RECORDATORIO,
} from "../services/recordatorioCierreService.js";

const TIMEZONE = "America/Argentina/Buenos_Aires";

// Estado en memoria (una sola instancia del backend). Si el proceso se reinicia
// el mismo día después del horario, vuelve a correr: la clave idempotente de
// ovif_envio_correos evita duplicados y aprovecha para reintentar los fallidos.
let ultimaEjecucion = null;
let ultimoAvisoConfigInvalida = null;
let ultimoAvisoErrorPrevio = null;
let enEjecucion = false;

const obtenerHoraActual = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());

const tick = async () => {
  if (enEjecucion) return;

  const hoy = obtenerFechaActual();
  if (ultimaEjecucion === hoy) return;

  enEjecucion = true;
  try {
    const config = await obtenerConfigRecordatorioCierre();

    if (!config.habilitado) {
      // Parámetro con valor inválido: avisar una vez por día (inactivo/faltante es silencioso)
      if (config.invalido && ultimoAvisoConfigInvalida !== hoy) {
        ultimoAvisoConfigInvalida = hoy;
        console.warn(`⚠️ [CRON] Recordatorio de cierre no ejecutado: ${config.motivo}`);
        await CronLog.create({
          nombre_tarea: NOMBRE_TAREA_RESUMEN_RECORDATORIO,
          estado: "ERROR",
          mensaje: `Recordatorio de cierre no ejecutado: ${config.motivo}`,
        });
      }
      return;
    }

    // "HH:mm" en 24 hs: la comparación de strings respeta el orden horario
    if (obtenerHoraActual() < config.horario) return;

    // Se marca antes de ejecutar: un fallo no se reintenta cada minuto, sino al día siguiente
    ultimaEjecucion = hoy;

    console.log(`🟡 [CRON ${new Date()}] Iniciando recordatorio de cierre (días previos: ${config.diasPrevios})...`);
    const resumen = await ejecutarRecordatorioCierre({ fechaReferencia: hoy, diasPrevios: config.diasPrevios });
    console.log(
      `🟢 [CRON] Recordatorio de cierre completado: evaluados=${resumen.evaluados}, nuevos=${resumen.nuevos}, ya existentes=${resumen.existentes}, enviados=${resumen.envio.sent}, fallidos=${resumen.envio.failed}`
    );
  } catch (error) {
    console.error("💥 Error general en recordatorio de cierre:", error);
    // Si falló antes de ejecutar (ej: lectura de parámetros) se reintenta en el
    // próximo tick; el CronLog se registra una sola vez por día para no inundarlo.
    if (ultimaEjecucion !== hoy) {
      if (ultimoAvisoErrorPrevio === hoy) return;
      ultimoAvisoErrorPrevio = hoy;
    }
    try {
      await CronLog.create({
        nombre_tarea: NOMBRE_TAREA_RESUMEN_RECORDATORIO,
        estado: "ERROR",
        mensaje: `Error general: ${error.message}`,
      });
    } catch (logErr) {
      console.error("⚠️ No se pudo registrar el error en CronLog:", logErr.message);
    }
  } finally {
    enEjecucion = false;
  }
};

// Revisa cada minuto si llegó el horario configurado en ovif_parametros
cron.schedule("* * * * *", tick, { timezone: TIMEZONE, noOverlap: true });

console.log(
  "🕑 CRON programado: Recordatorio de cierre (horario según parámetro 'Recordatorio de cierre - Horario', America/Argentina/Buenos_Aires)"
);
