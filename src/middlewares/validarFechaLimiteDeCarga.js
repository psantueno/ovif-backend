/*
Este middleware verifica si la fecha límite para cargar datos
de un ejercicio/mes para un municipio específico ha pasado.
Si la fecha límite ha pasado, responde con un error 400.
Si está dentro del plazo, llama a next() para continuar.
*/

import { Op, fn, col, where as sequelizeWhere } from "sequelize";
import {
  Convenio,
  EjercicioMes,
  PautaConvenio,
  ProrrogaMunicipio,
  TipoPauta,
} from "../models/index.js";

const whereDateOnly = (field, operator, value) =>
  sequelizeWhere(fn("DATE", col(field)), operator, value);

const obtenerFechaHoyArgentina = () =>
  new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

const toISODate = (value) => {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
};

const resolveTipoPautaCodigo = (tipoPautaCodigo, req) => {
  if (tipoPautaCodigo) return tipoPautaCodigo;

  const routeHint = `${req.baseUrl ?? ""} ${req.originalUrl ?? ""}`.toLowerCase();
  if (routeHint.includes("recaudaciones") || routeHint.includes("remuneraciones")) {
    return "recaudaciones_remuneraciones";
  }
  if (routeHint.includes("gastos") || routeHint.includes("recursos")) {
    return "gastos_recursos";
  }
  return null;
};

const crearValidadorFechaLimiteDeCarga = (tipoPautaCodigo = null) => async (req, res, next) => {
  const { ejercicio, mes } = req.params;
  const municipioId = req.params.municipioId ?? req.params.municipio;
  const fechaHoy = obtenerFechaHoyArgentina();
  const tipoPautaResuelto = resolveTipoPautaCodigo(tipoPautaCodigo, req);

  try {
    if (!tipoPautaResuelto) {
      return res.status(400).json({
        error: "No se pudo determinar el tipo de pauta para validar fecha límite",
      });
    }

    const conveniosActivos = await Convenio.findAll({
      attributes: ["convenio_id"],
      where: whereDateOnly("fecha_fin", Op.gte, fechaHoy),
      raw: true,
    });
    const conveniosActivosIds = conveniosActivos.map((item) => item.convenio_id);

    if (!conveniosActivosIds.length) {
      return res.status(400).json({
        error: "⛔ No hay convenios activos para validar el período de carga",
      });
    }

    const pautas = await PautaConvenio.findAll({
      attributes: ["pauta_id"],
      where: {
        convenio_id: { [Op.in]: conveniosActivosIds },
      },
      include: [
        {
          model: TipoPauta,
          as: "TipoPauta",
          attributes: ["tipo_pauta_id", "codigo"],
          required: true,
          where: { codigo: tipoPautaResuelto },
        },
      ],
      raw: true,
      nest: true,
    });
    const pautasIds = pautas.map((item) => item.pauta_id);

    if (!pautasIds.length) {
      return res.status(400).json({
        error: "No hay pauta activa para el tipo de carga solicitado",
      });
    }

    const oficial = await EjercicioMes.findOne({
      where: {
        ejercicio,
        mes,
        pauta_id: { [Op.in]: pautasIds },
      },
      order: [["fecha_fin", "DESC"]],
    });

    if (!oficial) {
      return res.status(404).json({
        error: "Ejercicio/Mes no encontrado en calendario oficial para el tipo de pauta",
      });
    }

    const fechaInicio = toISODate(oficial.fecha_inicio);
    const fechaFinOficial = toISODate(oficial.fecha_fin);

    if (fechaInicio && fechaHoy < fechaInicio) {
      return res.status(400).json({
        error: "⛔ El período de carga aún no inició",
        fecha_inicio: fechaInicio,
      });
    }

    // 2. Buscar prórroga del municipio (si existe)
    let prorroga = null;
    if (municipioId !== undefined) {
      prorroga = await ProrrogaMunicipio.findOne({
        where: {
          ejercicio,
          mes,
          municipio_id: municipioId,
          convenio_id: oficial.convenio_id,
          pauta_id: oficial.pauta_id,
        },
      });
    }

    const fechaLimite = toISODate(prorroga?.fecha_fin_nueva) ?? fechaFinOficial;

    // 3. Validar contra fecha actual
    if (!fechaLimite || fechaHoy > fechaLimite) {
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

export const validarFechaLimiteDeCarga = crearValidadorFechaLimiteDeCarga();
export const validarFechaLimiteDeCargaPorTipo = (tipoPautaCodigo) =>
  crearValidadorFechaLimiteDeCarga(tipoPautaCodigo);
