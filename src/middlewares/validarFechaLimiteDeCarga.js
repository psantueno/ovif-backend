/*
Este middleware verifica si la fecha límite para cargar datos
de un ejercicio/mes para un municipio específico ha pasado.
Si la fecha límite ha pasado, responde con un error 400.
Si está dentro del plazo, llama a next() para continuar.
*/

import { EjercicioMes, ProrrogaMunicipio } from "../models/index.js";

export const validarFechaLimiteDeCarga = async (req, res, next) => {
  const { ejercicio, mes, municipioId } = req.params;
  const fechaHoy = new Date().toISOString().split("T")[0]; // yyyy-mm-dd

  try {
    // 1. Buscar fechas oficiales
    const oficial = await EjercicioMes.findOne({ where: { ejercicio, mes } });
    if (!oficial) {
      return res.status(404).json({ error: "Ejercicio/Mes no encontrado en calendario oficial" });
    }

    // 2. Buscar prórroga del municipio (si existe)
    const prorroga = await ProrrogaMunicipio.findOne({
      where: { ejercicio, mes, municipio_id: municipioId },
    });

    const fechaLimite = prorroga?.fecha_fin_nueva || oficial.fecha_fin;

    // 3. Validar contra fecha actual
    if (fechaHoy > new Date(fechaLimite).toISOString().split("T")[0]) {
      return res.status(400).json({
        error: "⛔ El plazo de carga ya venció, no puede cargar información",
        fecha_limite: fechaLimite,
      });
    }

    // 4. Si está dentro del plazo → continuar
    next();
  } catch (error) {
    console.error("❌ Error en validarFechaLimite:", error);
    return res.status(500).json({ error: "Error validando fecha límite" });
  }
};
