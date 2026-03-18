import { Op, fn, col, where as sequelizeWhere } from "sequelize";
import { Convenio, EjercicioMes, PautaConvenio, TipoPauta } from "../models/index.js";
import { obtenerFechaActual } from "./obtenerFechaActual.js";

const whereDateOnly = (field, operator, value) =>
  sequelizeWhere(fn("DATE", col(field)), operator, value);

const toISODate = (value) => {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
};

const toLocalDateFromISO = (value) => {
  const iso = toISODate(value);
  if (!iso) return null;

  const [year, month, day] = iso.split("-").map(Number);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  return new Date(year, month - 1, day);
};

export const obtenerPeriodoRectificableAnterior = (
  fechaReferencia = obtenerFechaActual()
) => {
  const fechaReferenciaDate = toLocalDateFromISO(fechaReferencia);
  if (!fechaReferenciaDate) {
    return {
      fecha_inicio_periodo: null,
      fecha_fin_periodo: null,
      ejercicio: null,
      mes: null,
    };
  }

  const fechaInicioPeriodo = new Date(
    fechaReferenciaDate.getFullYear(),
    fechaReferenciaDate.getMonth() - 1,
    1
  );
  const fechaFinPeriodo = new Date(
    fechaReferenciaDate.getFullYear(),
    fechaReferenciaDate.getMonth(),
    0
  );

  return {
    fecha_inicio_periodo: toISODate(fechaInicioPeriodo),
    fecha_fin_periodo: toISODate(fechaFinPeriodo),
    ejercicio: fechaInicioPeriodo.getFullYear(),
    mes: fechaInicioPeriodo.getMonth() + 1,
  };
};

export const calcularVentanaRectificacion = (
  fechaInicio,
  plazoMesRectifica,
  cantDiasRectifica,
  fechaReferencia = obtenerFechaActual()
) => {
  const fechaInicioDate = toLocalDateFromISO(fechaInicio);
  const fechaReferenciaDate = toLocalDateFromISO(fechaReferencia);
  const plazoMes = Number(plazoMesRectifica);
  const cantDias = Number(cantDiasRectifica);

  if (
    !fechaInicioDate ||
    !fechaReferenciaDate ||
    !Number.isInteger(plazoMes) ||
    !Number.isInteger(cantDias) ||
    plazoMes < 0 ||
    cantDias <= 0
  ) {
    return {
      fecha_inicio_rectificacion: null,
      fecha_cierre: null,
      disponible: false,
    };
  }

  const fechaInicioRectificacion = new Date(
    fechaInicioDate.getFullYear(),
    fechaInicioDate.getMonth() + plazoMes,
    fechaInicioDate.getDate()
  );
  const fechaCierreRectificacion = new Date(
    fechaInicioRectificacion.getFullYear(),
    fechaInicioRectificacion.getMonth(),
    fechaInicioRectificacion.getDate() + (cantDias - 1)
  );

  return {
    fecha_inicio_rectificacion: toISODate(fechaInicioRectificacion),
    fecha_cierre: toISODate(fechaCierreRectificacion),
    disponible:
      fechaReferenciaDate >= fechaInicioRectificacion &&
      fechaReferenciaDate <= fechaCierreRectificacion,
  };
};

const normalizarPautaRectificable = (pauta) => ({
  pauta_id: pauta.pauta_id,
  descripcion: pauta.descripcion,
  cant_dias_rectifica: pauta.cant_dias_rectifica,
  plazo_mes_rectifica: pauta.plazo_mes_rectifica,
  tipo_pauta_id: pauta.tipo_pauta_id,
  tipo_pauta_codigo: pauta.TipoPauta?.codigo ?? null,
  tipo_pauta_nombre: pauta.TipoPauta?.nombre ?? null,
  tipo_pauta_descripcion: pauta.TipoPauta?.descripcion ?? null,
  requiere_periodo_rectificar: Boolean(
    pauta.TipoPauta?.requiere_periodo_rectificar
  ),
});

export const obtenerContextoRectificacionesPorPeriodo = async (
  periodoRectificableAnterior
) => {
  if (
    !periodoRectificableAnterior?.ejercicio ||
    !periodoRectificableAnterior?.mes
  ) {
    return {
      ejercicioMesPeriodo: [],
      conveniosMap: [],
      pautasRectificablesIds: [],
      pautasMap: [],
    };
  }

  const ejercicioMesPeriodo = await EjercicioMes.findAll({
    where: {
      ejercicio: periodoRectificableAnterior.ejercicio,
      mes: periodoRectificableAnterior.mes,
    },
    order: [
      ["ejercicio", "DESC"],
      ["mes", "DESC"],
      ["convenio_id", "ASC"],
      ["pauta_id", "ASC"],
    ],
  });

  if (!ejercicioMesPeriodo.length) {
    return {
      ejercicioMesPeriodo: [],
      conveniosMap: [],
      pautasRectificablesIds: [],
      pautasMap: [],
    };
  }

  const convenioIds = [
    ...new Set(ejercicioMesPeriodo.map((item) => item.convenio_id).filter(Boolean)),
  ];
  const pautaIds = [
    ...new Set(ejercicioMesPeriodo.map((item) => item.pauta_id).filter(Boolean)),
  ];

  const [convenios, pautasRectificables] = await Promise.all([
    convenioIds.length
      ? Convenio.findAll({
          where: { convenio_id: { [Op.in]: convenioIds } },
        })
      : [],
    pautaIds.length
      ? PautaConvenio.findAll({
          where: {
            pauta_id: { [Op.in]: pautaIds },
            [Op.and]: [
              { cant_dias_rectifica: { [Op.not]: null } },
              { cant_dias_rectifica: { [Op.ne]: 0 } },
              { plazo_mes_rectifica: { [Op.not]: null } },
              { plazo_mes_rectifica: { [Op.ne]: 0 } },
            ],
          },
          include: [
            {
              model: TipoPauta,
              as: "TipoPauta",
              attributes: [
                "tipo_pauta_id",
                "codigo",
                "nombre",
                "descripcion",
                "requiere_periodo_rectificar",
              ],
              required: true,
              where: {
                requiere_periodo_rectificar: true,
              },
            },
          ],
        })
      : [],
  ]);

  return {
    ejercicioMesPeriodo,
    conveniosMap: convenios.map((c) => ({
      convenio_id: c.convenio_id,
      nombre: c.nombre,
    })),
    pautasRectificablesIds: pautasRectificables.map((p) => p.pauta_id),
    pautasMap: pautasRectificables.map(normalizarPautaRectificable),
  };
};

export const obtenerDisponibilidadRectificacion = async (
  ejercicio,
  mes,
  fechaReferencia = obtenerFechaActual()
) => {
  const periodoRectificableAnterior =
    obtenerPeriodoRectificableAnterior(fechaReferencia);

  if (
    ejercicio !== periodoRectificableAnterior.ejercicio ||
    mes !== periodoRectificableAnterior.mes
  ) {
    return {
      disponible: false,
      motivo: "periodo_fuera_de_ventana",
      detalle: "Solo es posible rectificar el período inmediatamente anterior habilitado por la pauta.",
      periodo: null,
      periodosEvaluados: [],
      periodoRectificableAnterior,
    };
  }

  const { ejercicioMesPeriodo, conveniosMap, pautasMap } =
    await obtenerContextoRectificacionesPorPeriodo(periodoRectificableAnterior);

  if (!ejercicioMesPeriodo.length) {
    return {
      disponible: false,
      motivo: "sin_calendario_rectificable",
      detalle: "No existe un período cargado en el calendario oficial para rectificar.",
      periodo: null,
      periodosEvaluados: [],
      periodoRectificableAnterior,
    };
  }

  const periodosEvaluados = ejercicioMesPeriodo
    .map((item) => {
      const pauta = pautasMap.find((p) => p.pauta_id === item.pauta_id);
      if (!pauta) {
        return null;
      }

      const convenio = conveniosMap.find((c) => c.convenio_id === item.convenio_id);
      const ventana = calcularVentanaRectificacion(
        item.fecha_inicio,
        pauta.plazo_mes_rectifica,
        pauta.cant_dias_rectifica,
        fechaReferencia
      );

      return {
        ejercicio: item.ejercicio,
        mes: item.mes,
        convenio_id: item.convenio_id,
        convenio_nombre: convenio?.nombre ?? null,
        pauta_id: item.pauta_id,
        pauta_descripcion: pauta.descripcion,
        fecha_inicio: toISODate(item.fecha_inicio),
        fecha_fin: toISODate(item.fecha_fin),
        fecha_inicio_rectificacion: ventana.fecha_inicio_rectificacion,
        fecha_cierre: ventana.fecha_cierre,
        fecha_limite_original: ventana.fecha_cierre,
        disponible: ventana.disponible,
      };
    })
    .filter(Boolean);

  if (!periodosEvaluados.length) {
    return {
      disponible: false,
      motivo: "sin_pauta_rectificable",
      detalle: "El período existe en calendario, pero no tiene una pauta habilitada para rectificación.",
      periodo: null,
      periodosEvaluados: [],
      periodoRectificableAnterior,
    };
  }

  const periodoDisponible = periodosEvaluados.find((item) => item.disponible);
  if (periodoDisponible) {
    return {
      disponible: true,
      motivo: null,
      detalle: null,
      periodo: periodoDisponible,
      periodosEvaluados,
      periodoRectificableAnterior,
    };
  }

  return {
    disponible: false,
    motivo: "ventana_rectificacion_vencida",
    detalle:
      "El período indicado ya no se encuentra habilitado para carga de rectificaciones.",
    periodo: periodosEvaluados[0] ?? null,
    periodosEvaluados,
    periodoRectificableAnterior,
  };
};

export const verificarRectificacionDisponible = async (
  ejercicio,
  mes,
  fechaReferencia = obtenerFechaActual()
) => {
  const resultado = await obtenerDisponibilidadRectificacion(
    ejercicio,
    mes,
    fechaReferencia
  );

  return resultado.disponible;
};

export const obtenerProrrogaRectificacionSugerida = (periodo) => {
  if (!periodo?.fecha_cierre) {
    return null;
  }

  return {
    fecha_limite_original: periodo.fecha_cierre,
    puede_solicitar_prorroga: true,
    sugerencia:
      "Si necesitás cargar fuera de término, podés solicitar una prórroga.",
  };
};
