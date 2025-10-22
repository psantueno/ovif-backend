import cron from "node-cron";
import EjercicioMes from "../models/moduloEjercicios/EjercicioMes.js";
import EjercicioMesMunicipio from "../models/moduloEjercicios/EjercicioMesMunicipio.js";
import EjercicioMesCerrado from "../models/moduloEjercicios/EjercicioMesCerrado.js";
import CronLog from "../models/moduloEjercicios/CronLog.js";

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

      for (const ej of ejercicios) {
        const { ejercicio, mes, fecha_fin } = ej;

        // Si la fecha oficial ya venció
        if (hoy > new Date(fecha_fin).toISOString().split("T")[0]) {
          const municipios = await EjercicioMesMunicipio.findAll({
            where: { ejercicio, mes },
          });

          for (const mun of municipios) {
            const fechaLimite = mun.fecha_fin || fecha_fin;

            // Si también venció la prórroga o fecha final del municipio
            if (hoy > new Date(fechaLimite).toISOString().split("T")[0]) {
              const existente = await EjercicioMesCerrado.findOne({
                where: { ejercicio, mes, municipio_id: mun.municipio_id },
              });

              if (!existente) {
                try {
                  await EjercicioMesCerrado.create({
                    ejercicio,
                    mes,
                    municipio_id: mun.municipio_id,
                    fecha: hoy,
                    informe_recursos: "",
                    informe_gastos: "",
                    informe_personal: "",
                  });

                  await CronLog.create({
                    nombre_tarea: "cierre_automatico",
                    ejercicio,
                    mes,
                    municipio_id: mun.municipio_id,
                    estado: "OK",
                    mensaje: `Cierre automático exitoso para municipio ${mun.municipio_id}`,
                  });

                  cierresRealizados++;
                  console.log(
                    `✅ Municipio ${mun.municipio_id} cerrado automáticamente (${ejercicio}/${mes})`
                  );
                } catch (error) {
                  errores++;
                  console.error(
                    `❌ Error cerrando municipio ${mun.municipio_id}:`,
                    error.message
                  );
                  await CronLog.create({
                    nombre_tarea: "cierre_automatico",
                    ejercicio,
                    mes,
                    municipio_id: mun.municipio_id,
                    estado: "ERROR",
                    mensaje: error.message,
                  });
                }
              }
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
            ? `Cierre automático completado. ${cierresRealizados} municipios cerrados, ${errores} errores.`
            : "Cierre automático ejecutado sin cierres pendientes.",
      });

      console.log(
        cierresRealizados > 0
          ? `🟢 [CRON ${hoy}] Cierre automático completado (${cierresRealizados} cierres, ${errores} errores).`
          : `🟢 [CRON ${hoy}] No había municipios para cerrar.`
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
