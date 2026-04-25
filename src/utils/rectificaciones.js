import { Op, fn, col, where as sequelizeWhere } from "sequelize";
import {
  Convenio,
  EjercicioMes,
  PautaConvenio,
  ProrrogaMunicipio,
  TipoPauta,
} from "../models/index.js";
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
  return date.toLocaleDateString("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
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

const buildCalendarioKey = (ejercicio, mes, convenioId, pautaId) =>
  `${ejercicio}-${mes}-${convenioId ?? "null"}-${pautaId ?? "null"}`;

const sumarMesesSeguro = (fecha, cantidadMeses) => {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
    return null;
  }

  const monthsToAdd = Number(cantidadMeses);
  if (!Number.isInteger(monthsToAdd)) {
    return null;
  }

  const year = fecha.getFullYear();
  const month = fecha.getMonth() + monthsToAdd;
  const day = fecha.getDate();
  const ultimoDiaMesDestino = new Date(year, month + 1, 0).getDate();

  return new Date(year, month, Math.min(day, ultimoDiaMesDestino));
};

const obtenerPrimerDiaMesSiguiente = (fecha) => {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
    return null;
  }

  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1);
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
  {
    fechaInicio,
    plazoMesRectifica,
    cantDiasRectifica,
    fechaCierreRegularBase,
    fechaCierreRegularEfectiva,
  },
  fechaReferencia = obtenerFechaActual()
) => {
  const fechaInicioDate = toLocalDateFromISO(fechaInicio);
  const fechaReferenciaDate = toLocalDateFromISO(fechaReferencia);
  const fechaCierreRegularBaseDate = toLocalDateFromISO(fechaCierreRegularBase);
  const fechaCierreRegularEfectivaDate =
    toLocalDateFromISO(fechaCierreRegularEfectiva) ?? fechaCierreRegularBaseDate;
  const plazoMes = Number(plazoMesRectifica);
  const cantDias = Number(cantDiasRectifica);

  if (
    !fechaInicioDate ||
    !fechaReferenciaDate ||
    !fechaCierreRegularBaseDate ||
    !fechaCierreRegularEfectivaDate ||
    !Number.isInteger(plazoMes) ||
    !Number.isInteger(cantDias) ||
    plazoMes < 0 ||
    cantDias <= 0
  ) {
    return {
      fecha_inicio_rectificacion_teorica: null,
      fecha_inicio_rectificacion: null,
      fecha_cierre: null,
      disponible: false,
    };
  }

  const fechaInicioRectificacionTeorica = sumarMesesSeguro(
    fechaInicioDate,
    plazoMes
  );
  const primerDiaMesSiguienteAlCierre =
    obtenerPrimerDiaMesSiguiente(fechaCierreRegularEfectivaDate);

  if (!fechaInicioRectificacionTeorica || !primerDiaMesSiguienteAlCierre) {
    return {
      fecha_inicio_rectificacion_teorica: null,
      fecha_inicio_rectificacion: null,
      fecha_cierre: null,
      disponible: false,
    };
  }

  const fechaInicioRectificacion =
    fechaInicioRectificacionTeorica > primerDiaMesSiguienteAlCierre
      ? fechaInicioRectificacionTeorica
      : primerDiaMesSiguienteAlCierre;
  const fechaCierreRectificacion = new Date(
    fechaInicioRectificacion.getFullYear(),
    fechaInicioRectificacion.getMonth(),
    fechaInicioRectificacion.getDate() + (cantDias - 1)
  );

  return {
    fecha_inicio_rectificacion_teorica: toISODate(fechaInicioRectificacionTeorica),
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
  periodoRectificableAnterior,
  municipioId = null
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
      prorrogaMap: new Map(),
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
      prorrogaMap: new Map(),
    };
  }

  const convenioIds = [
    ...new Set(ejercicioMesPeriodo.map((item) => item.convenio_id).filter(Boolean)),
  ];
  const pautaIds = [
    ...new Set(ejercicioMesPeriodo.map((item) => item.pauta_id).filter(Boolean)),
  ];

  const [convenios, pautasRectificables, prorrogas] = await Promise.all([
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
    municipioId !== null && municipioId !== undefined
      ? ProrrogaMunicipio.findAll({
          where: {
            municipio_id: Number(municipioId),
            ejercicio: periodoRectificableAnterior.ejercicio,
            mes: periodoRectificableAnterior.mes,
            convenio_id: { [Op.in]: convenioIds.length ? convenioIds : [0] },
            pauta_id: { [Op.in]: pautaIds.length ? pautaIds : [0] },
          },
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
    prorrogaMap: new Map(
      prorrogas.map((item) => [
        buildCalendarioKey(item.ejercicio, item.mes, item.convenio_id, item.pauta_id),
        item,
      ])
    ),
  };
};

export const evaluarPeriodosRectificacion = async (
  municipioId,
  periodoRectificableAnterior,
  fechaReferencia = obtenerFechaActual()
) => {
  const {
    ejercicioMesPeriodo,
    conveniosMap,
    pautasRectificablesIds,
    pautasMap,
    prorrogaMap,
  } = await obtenerContextoRectificacionesPorPeriodo(
    periodoRectificableAnterior,
    municipioId
  );

  const periodosEvaluados = ejercicioMesPeriodo
    .map((item) => {
      const pauta = pautasMap.find((p) => p.pauta_id === item.pauta_id);
      if (!pauta) {
        return null;
      }

      const convenio = conveniosMap.find((c) => c.convenio_id === item.convenio_id);
      const prorroga = prorrogaMap.get(
        buildCalendarioKey(item.ejercicio, item.mes, item.convenio_id, item.pauta_id)
      );
      const fechaFinBase = toISODate(item.fecha_fin);
      const fechaFinProrroga = toISODate(prorroga?.fecha_fin_nueva);
      const fechaCierreRegularEfectiva = fechaFinProrroga ?? fechaFinBase;

      const ventana = calcularVentanaRectificacion(
        {
          fechaInicio: item.fecha_inicio,
          plazoMesRectifica: pauta.plazo_mes_rectifica,
          cantDiasRectifica: pauta.cant_dias_rectifica,
          fechaCierreRegularBase: fechaFinBase,
          fechaCierreRegularEfectiva,
        },
        fechaReferencia
      );

      return {
        ejercicio: item.ejercicio,
        mes: item.mes,
        convenio_id: item.convenio_id,
        convenio_nombre: convenio?.nombre ?? null,
        pauta_id: item.pauta_id,
        pauta_descripcion: pauta.descripcion,
        tipo_pauta_id: pauta.tipo_pauta_id,
        tipo_pauta_codigo: pauta.tipo_pauta_codigo,
        tipo_pauta_nombre: pauta.tipo_pauta_nombre,
        tipo_pauta_descripcion: pauta.tipo_pauta_descripcion,
        requiere_periodo_rectificar: Boolean(pauta.requiere_periodo_rectificar),
        cant_dias_rectifica: pauta.cant_dias_rectifica,
        plazo_mes_rectifica: pauta.plazo_mes_rectifica,
        fecha_inicio: toISODate(item.fecha_inicio),
        fecha_fin: fechaFinBase,
        tiene_prorroga: Boolean(prorroga),
        fecha_fin_prorroga: fechaFinProrroga,
        fecha_cierre_regular_base: fechaFinBase,
        fecha_cierre_regular_efectiva: fechaCierreRegularEfectiva,
        fecha_inicio_rectificacion_teorica:
          ventana.fecha_inicio_rectificacion_teorica,
        fecha_inicio_rectificacion: ventana.fecha_inicio_rectificacion,
        fecha_cierre: ventana.fecha_cierre,
        fecha_limite_original: ventana.fecha_cierre,
        disponible: ventana.disponible,
      };
    })
    .filter(Boolean);

  return {
    ejercicioMesPeriodo,
    conveniosMap,
    pautasRectificablesIds,
    pautasMap,
    periodosEvaluados,
  };
};

export const obtenerDisponibilidadRectificacion = async (
  municipioId,
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

  const {
    ejercicioMesPeriodo,
    periodosEvaluados,
  } = await evaluarPeriodosRectificacion(
    municipioId,
    periodoRectificableAnterior,
    fechaReferencia
  );

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
  municipioId,
  ejercicio,
  mes,
  fechaReferencia = obtenerFechaActual()
) => {
  const resultado = await obtenerDisponibilidadRectificacion(
    municipioId,
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
