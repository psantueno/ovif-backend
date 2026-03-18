import {
  obtenerDisponibilidadRectificacion,
  obtenerProrrogaRectificacionSugerida,
} from "../utils/rectificaciones.js";

export const validarRectificacionDisponible = async (req, res, next) => {
  const municipioNum = Number(req.params.municipioId ?? req.params.id ?? req.params.municipio);
  const ejercicioNum = Number(req.params.ejercicio);
  const mesNum = Number(req.params.mes);

  if (
    !Number.isInteger(municipioNum) ||
    !Number.isInteger(ejercicioNum) ||
    !Number.isInteger(mesNum)
  ) {
    return res.status(400).json({
      error: "Parámetros de municipio/ejercicio/mes inválidos para validar la rectificación.",
    });
  }

  try {
    const resultado = await obtenerDisponibilidadRectificacion(
      municipioNum,
      ejercicioNum,
      mesNum
    );

    if (!resultado.disponible) {
      const prorroga = obtenerProrrogaRectificacionSugerida(resultado.periodo);

      return res.status(400).json({
        error: "El período indicado no está habilitado para rectificación.",
        detalle:
          resultado.detalle ??
          "La ventana de rectificación no se encuentra disponible para el período solicitado.",
        motivo: resultado.motivo ?? null,
        fecha_inicio_rectificacion:
          resultado.periodo?.fecha_inicio_rectificacion ?? null,
        fecha_cierre: resultado.periodo?.fecha_cierre ?? null,
        fecha_limite_original: prorroga?.fecha_limite_original ?? null,
        puede_solicitar_prorroga:
          prorroga?.puede_solicitar_prorroga ?? false,
        sugerencia: prorroga?.sugerencia ?? null,
        periodo_rectificable_anterior:
          resultado.periodoRectificableAnterior ?? null,
      });
    }

    req.rectificacionDisponible = resultado.periodo ?? null;
    next();
  } catch (error) {
    console.error("❌ Error en validarRectificacionDisponible:", error);
    return res.status(500).json({
      error: "Error validando la disponibilidad de rectificación.",
    });
  }
};
