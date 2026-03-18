/*
Este middleware valida la disponibilidad de un período regular de carga
tomando como fuente de verdad el calendario oficial (EjercicioMes) y la
prórroga del municipio cuando exista. No depende de si el convenio sigue
activo al día de hoy.
*/

import { resolverPeriodoRegular } from "../utils/periodosRegulares.js";
import { obtenerFechaActual } from "../utils/obtenerFechaActual.js";

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
  const fechaActual = obtenerFechaActual();
  const tipoPautaResuelto = resolveTipoPautaCodigo(tipoPautaCodigo, req);

  try {
    if (!tipoPautaResuelto) {
      return res.status(400).json({
        error: "No se pudo determinar el tipo de pauta para validar fecha límite",
      });
    }

    const resultado = await resolverPeriodoRegular({
      municipioId,
      ejercicio,
      mes,
      tipoPautaCodigo: tipoPautaResuelto,
      fechaReferencia: fechaActual,
    });

    if (!resultado.disponible) {
      const payload = {
        error: resultado.error,
        detalle: resultado.detalle,
        motivo: resultado.motivo,
        fecha_inicio: resultado.fecha_inicio ?? null,
        fecha_limite_original: resultado.fecha_limite_original ?? null,
        fecha_limite_prorroga: resultado.fecha_limite_prorroga ?? null,
        puede_solicitar_prorroga: Boolean(resultado.puede_solicitar_prorroga),
        sugerencia: resultado.sugerencia ?? null,
      };

      if (resultado.motivo === "configuracion_ambigua") {
        return res.status(409).json(payload);
      }

      if (resultado.motivo === "sin_calendario") {
        return res.status(404).json(payload);
      }

      return res.status(400).json(payload);
    }

    next();
  } catch (error) {
    console.error("❌ Error en validarFechaLimite:", error);
    return res.status(500).json({ error: "Error validando fecha límite" });
  }
};

export const validarFechaLimiteDeCarga = crearValidadorFechaLimiteDeCarga();
export const validarFechaLimiteDeCargaPorTipo = (tipoPautaCodigo) =>
  crearValidadorFechaLimiteDeCarga(tipoPautaCodigo);
