import cron from "node-cron";
import EjercicioMes from "../models/moduloEjercicios/EjercicioMes.js";
import ProrrogaMunicipio from "../models/ProrrogaMunicipio.js";
import CronLog from "../models/moduloEjercicios/CronLog.js";
import CierreModulo from "../models/moduloEjercicios/CierreModulo.js";
import Municipio from "../models/Municipio.js";

const MODULOS = ["GASTOS", "RECURSOS", "RECAUDACIONES", "PERSONAL"];

const toISODate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
};

// 🕑 Ejecutar todos los días a las 2 AM (hora Argentina)
cron.schedule(
  "0 2 * * *",
  async () => {
    const hoy = new Date().toISOString().split("T")[0];
    console.log(`\n🕒 [CRON ${hoy}] Iniciando cierre automático...`);

    let cierresRealizados = 0;
    let errores = 0;

    try {
      const ejercicios = await EjercicioMes.findAll();
      const municipios = await Municipio.findAll({ attributes: ["municipio_id"] });

      for (const ej of ejercicios) {
        const { ejercicio, mes, fecha_fin, convenio_id, pauta_id } = ej;
        const fechaFinOficial = toISODate(fecha_fin);
        if (!fechaFinOficial || hoy <= fechaFinOficial) {
          continue;
        }

        const prorrogas = await ProrrogaMunicipio.findAll({
          where: { ejercicio, mes, convenio_id, pauta_id },
        });

        const cierresExistentes = await CierreModulo.findAll({
          where: { ejercicio, mes, convenio_id, pauta_id },
          attributes: ["municipio_id", "modulo"],
        });

        const prorrogaMap = new Map(
          prorrogas.map((p) => [p.municipio_id, toISODate(p.fecha_fin_nueva)])
        );
        const cierresSet = new Set(
          cierresExistentes.map(
            (cierre) => `${cierre.municipio_id}|${cierre.modulo}`
          )
        );

        for (const municipio of municipios) {
          const municipioId = municipio.municipio_id;
          const fechaLimiteMunicipio =
            prorrogaMap.get(municipioId) || fechaFinOficial;

          if (!fechaLimiteMunicipio || hoy <= fechaLimiteMunicipio) {
            continue;
          }

          for (const modulo of MODULOS) {
            const cierreKey = `${municipioId}|${modulo}`;
            if (cierresSet.has(cierreKey)) {
              continue;
            }

            try {
              await CierreModulo.create({
                ejercicio,
                mes,
                municipio_id: municipioId,
                convenio_id,
                pauta_id,
                modulo,
                tipo_cierre: "AUTOMATICO",
                informe_path: null,
                observacion:
                  "Cierre automático generado por cron al vencer el plazo.",
              });

              cierresSet.add(cierreKey);

              await CronLog.create({
                nombre_tarea: "cierre_automatico",
                ejercicio,
                mes,
                municipio_id: municipioId,
                estado: "OK",
                mensaje: `Cierre automático (${modulo}) para municipio ${municipioId}`,
              });

              cierresRealizados++;
              console.log(
                `✅ Municipio ${municipioId} - módulo ${modulo} cerrado automáticamente (${ejercicio}/${mes})`
              );
            } catch (error) {
              errores++;
              console.error(
                `❌ Error cerrando módulo ${modulo} para municipio ${municipioId}:`,
                error.message
              );
              await CronLog.create({
                nombre_tarea: "cierre_automatico",
                ejercicio,
                mes,
                municipio_id: municipioId,
                estado: "ERROR",
                mensaje: `Error cerrando módulo ${modulo}: ${error.message}`,
              });
            }
          }
        }
      }

      // 🔹 Registrar log general, aunque no haya cierres
      await CronLog.create({
        nombre_tarea: "cierre_automatico",
        estado: "OK",
        mensaje:
          cierresRealizados > 0
            ? `Cierre automático completado. ${cierresRealizados} módulos cerrados, ${errores} errores.`
            : "Cierre automático ejecutado sin cierres pendientes.",
      });

      console.log(
        cierresRealizados > 0
          ? `🟢 [CRON ${hoy}] Cierre automático completado (${cierresRealizados} cierres, ${errores} errores).`
          : `🟢 [CRON ${hoy}] No había módulos para cerrar.`
      );
    } catch (error) {
      console.error("💥 Error general en cierre automático:", error);

      try {
        await CronLog.create({
          nombre_tarea: "cierre_automatico",
          estado: "ERROR",
          mensaje: `Error general: ${error.message}`,
        });
      } catch (logErr) {
        console.error(
          "⚠️ No se pudo registrar el error en CronLog:",
          logErr.message
        );
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
