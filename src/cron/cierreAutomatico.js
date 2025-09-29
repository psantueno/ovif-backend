import cron from "node-cron";
import EjercicioMes from "../models/moduloEjercicios/EjercicioMes.js";
import EjercicioMesMunicipio from "../models/moduloEjercicios/EjercicioMesMunicipio.js";
import EjercicioMesCerrado from "../models/moduloEjercicios/EjercicioMesCerrado.js";
import CronLog from "../models/moduloEjercicios/CronLog.js";

// Ejecutar todos los días a las 2 AM
cron.schedule("0 2 * * *", async () => {
  const hoy = new Date().toISOString().split("T")[0];
  console.log(`[CRON ${hoy}] Iniciando cierre automático...`);

  try {
    const ejercicios = await EjercicioMes.findAll();

    for (const ej of ejercicios) {
      const { ejercicio, mes, fecha_fin } = ej;

      if (hoy > new Date(fecha_fin).toISOString().split("T")[0]) {
        const municipios = await EjercicioMesMunicipio.findAll({
          where: { ejercicio, mes },
        });

        for (const mun of municipios) {
          const fechaLimite = mun.fecha_fin || fecha_fin;

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
              } catch (error) {
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

    console.log(`[CRON ${hoy}] Cierre automático completado.`);
  } catch (error) {
    console.error("❌ Error general en cierre automático:", error);

    await CronLog.create({
      nombre_tarea: "cierre_automatico",
      estado: "ERROR",
      mensaje: `Error general: ${error.message}`,
    });
  }
});
