import {
  Convenio,
  EjercicioMes,
  PautaConvenio,
  ProrrogaMunicipio,
  TipoPauta,
} from "../models/index.js";
import { obtenerFechaActual } from "./obtenerFechaActual.js";

const toISODate = (value) => {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // Convertir a fecha calendario en zona Argentina para que valores DATETIME
  // almacenados en UTC (ej: 2026-04-24T21:00:00Z = 25/04 00:00 AR) se
  // interpreten correctamente como el día que representan en AR.
  return date.toLocaleDateString("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
};

const buildCalendarioKey = (ejercicio, mes, convenioId, pautaId) =>
  `${ejercicio}-${mes}-${convenioId ?? "null"}-${pautaId ?? "null"}`;

const buildDisponibilidadKey = (ejercicio, mes, tipoPautaCodigo) =>
  `${ejercicio}-${mes}-${tipoPautaCodigo ?? "null"}`;

const mapPeriodoRegular = (ejercicioMes, prorroga, convenio, pauta, fechaReferencia) => {
  const fechaInicio = toISODate(ejercicioMes.fecha_inicio);
  const fechaFinOficial = toISODate(ejercicioMes.fecha_fin);
  const fechaFinProrroga = toISODate(prorroga?.fecha_fin_nueva);
  const fechaCierre = fechaFinProrroga ?? fechaFinOficial;
  const iniciado = fechaInicio ? fechaReferencia >= fechaInicio : false;
  const vencido = fechaCierre ? fechaReferencia > fechaCierre : false;

  return {
    ejercicio: ejercicioMes.ejercicio,
    mes: ejercicioMes.mes,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaCierre,
    fecha_fin_oficial: fechaFinOficial,
    tiene_prorroga: Boolean(prorroga),
    fecha_fin_prorroga: fechaFinProrroga,
    convenio_id: ejercicioMes.convenio_id ?? null,
    pauta_id: ejercicioMes.pauta_id ?? null,
    convenio_nombre: convenio?.nombre ?? null,
    pauta_descripcion: pauta?.descripcion ?? null,
    tipo_pauta_id: pauta?.tipo_pauta_id ?? null,
    tipo_pauta_codigo: pauta?.TipoPauta?.codigo ?? null,
    tipo_pauta_nombre: pauta?.TipoPauta?.nombre ?? null,
    tipo_pauta_descripcion: pauta?.TipoPauta?.descripcion ?? null,
    requiere_periodo_rectificar: Boolean(
      pauta?.TipoPauta?.requiere_periodo_rectificar
    ),
    fecha_cierre: fechaCierre,
    iniciado,
    vencido,
    cerrado: false,
    disponible: iniciado && !vencido,
  };
};

export const obtenerPeriodosRegulares = async ({
  municipioId,
  ejercicio = null,
  mes = null,
  fechaReferencia = obtenerFechaActual(),
} = {}) => {
  const whereEjercicioMes = {};
  if (ejercicio !== null && ejercicio !== undefined) {
    whereEjercicioMes.ejercicio = Number(ejercicio);
  }
  if (mes !== null && mes !== undefined) {
    whereEjercicioMes.mes = Number(mes);
  }

  const ejerciciosMeses = await EjercicioMes.findAll({
    where: whereEjercicioMes,
    order: [
      ["ejercicio", "ASC"],
      ["mes", "ASC"],
      ["convenio_id", "ASC"],
      ["pauta_id", "ASC"],
    ],
  });

  if (!ejerciciosMeses.length) {
    return [];
  }

  const convenioIds = [
    ...new Set(ejerciciosMeses.map((item) => item.convenio_id).filter(Boolean)),
  ];
  const pautaIds = [
    ...new Set(ejerciciosMeses.map((item) => item.pauta_id).filter(Boolean)),
  ];

  const [convenios, pautas, prorrogas] = await Promise.all([
    convenioIds.length
      ? Convenio.findAll({ where: { convenio_id: convenioIds } })
      : [],
    pautaIds.length
      ? PautaConvenio.findAll({
          where: { pauta_id: pautaIds },
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
            },
          ],
        })
      : [],
    municipioId !== null && municipioId !== undefined
      ? ProrrogaMunicipio.findAll({
          where: { municipio_id: Number(municipioId) },
        })
      : [],
  ]);

  const convenioMap = new Map(convenios.map((item) => [item.convenio_id, item]));
  const pautaMap = new Map(pautas.map((item) => [item.pauta_id, item]));
  const prorrogaMap = new Map(
    prorrogas.map((item) => [
      buildCalendarioKey(item.ejercicio, item.mes, item.convenio_id, item.pauta_id),
      item,
    ])
  );

  return ejerciciosMeses.map((item) => {
    const prorroga = prorrogaMap.get(
      buildCalendarioKey(item.ejercicio, item.mes, item.convenio_id, item.pauta_id)
    );

    return mapPeriodoRegular(
      item,
      prorroga,
      convenioMap.get(item.convenio_id) ?? null,
      pautaMap.get(item.pauta_id) ?? null,
      fechaReferencia
    );
  });
};

export const obtenerPeriodosRegularesDisponiblesPorMunicipio = async ({
  municipioId,
  fechaReferencia = obtenerFechaActual(),
} = {}) => {
  const periodos = await obtenerPeriodosRegulares({
    municipioId,
    fechaReferencia,
  });

  const agrupados = new Map();
  for (const periodo of periodos) {
    if (!periodo.tipo_pauta_codigo) {
      continue;
    }

    const key = buildDisponibilidadKey(
      periodo.ejercicio,
      periodo.mes,
      periodo.tipo_pauta_codigo
    );
    const bucket = agrupados.get(key) ?? [];
    bucket.push(periodo);
    agrupados.set(key, bucket);
  }

  const disponibles = [];

  for (const [key, candidatos] of agrupados.entries()) {
    if (candidatos.length > 1) {
      console.warn(
        "⚠️ Configuración ambigua de período regular, se omite del menú mensual:",
        {
          key,
          candidatos: candidatos.map((item) => ({
            ejercicio: item.ejercicio,
            mes: item.mes,
            convenio_id: item.convenio_id,
            pauta_id: item.pauta_id,
            tipo_pauta_codigo: item.tipo_pauta_codigo,
          })),
        }
      );
      continue;
    }

    const periodo = candidatos[0];
    if (periodo?.disponible) {
      disponibles.push(periodo);
    }
  }

  return disponibles.sort((a, b) => {
    if (a.ejercicio !== b.ejercicio) return a.ejercicio - b.ejercicio;
    if (a.mes !== b.mes) return a.mes - b.mes;
    return String(a.tipo_pauta_codigo).localeCompare(String(b.tipo_pauta_codigo));
  });
};

export const resolverPeriodoRegular = async ({
  municipioId,
  ejercicio,
  mes,
  tipoPautaCodigo,
  fechaReferencia = obtenerFechaActual(),
} = {}) => {
  const ejercicioNumero = Number(ejercicio);
  const mesNumero = Number(mes);

  if (!tipoPautaCodigo) {
    return {
      disponible: false,
      motivo: "tipo_pauta_indeterminado",
      error: "No se pudo determinar el tipo de pauta para validar el período de carga.",
      detalle: null,
      periodo: null,
    };
  }

  const periodos = await obtenerPeriodosRegulares({
    municipioId,
    ejercicio: ejercicioNumero,
    mes: mesNumero,
    fechaReferencia,
  });

  const candidatos = periodos.filter(
    (item) => item.tipo_pauta_codigo === tipoPautaCodigo
  );

  if (!candidatos.length) {
    return {
      disponible: false,
      motivo: "sin_calendario",
      error:
        "El período indicado no existe en el calendario oficial para el tipo de carga seleccionado.",
      detalle:
        "Verificá el ejercicio y mes elegidos o consultá la configuración vigente del calendario.",
      periodo: null,
      periodosEvaluados: periodos,
    };
  }

  if (candidatos.length > 1) {
    return {
      disponible: false,
      motivo: "configuracion_ambigua",
      error:
        "Existe más de un período configurado para el mismo ejercicio, mes y tipo de pauta.",
      detalle:
        "El sistema no puede determinar automáticamente cuál usar. Revisá la configuración del calendario oficial.",
      periodo: null,
      periodosEvaluados: candidatos,
    };
  }

  const periodo = candidatos[0];

  if (!periodo.iniciado) {
    return {
      disponible: false,
      motivo: "periodo_no_iniciado",
      error: "El período indicado aún no está habilitado para carga.",
      detalle: "La ventana de carga regular todavía no comenzó para el período seleccionado.",
      fecha_inicio: periodo.fecha_inicio,
      fecha_limite_original: periodo.fecha_fin_oficial,
      fecha_limite_prorroga: periodo.fecha_fin_prorroga,
      puede_solicitar_prorroga: false,
      sugerencia: null,
      periodo,
      periodosEvaluados: candidatos,
    };
  }

  if (periodo.vencido) {
    return {
      disponible: false,
      motivo: "periodo_vencido",
      error: "El período indicado ya no está habilitado para carga.",
      detalle:
        "La fecha límite de carga ya venció para el ejercicio y mes seleccionados.",
      fecha_inicio: periodo.fecha_inicio,
      fecha_limite_original: periodo.fecha_fin_oficial,
      fecha_limite_prorroga: periodo.fecha_fin_prorroga,
      puede_solicitar_prorroga: true,
      sugerencia:
        "Si necesitás cargar fuera de término, podés solicitar una prórroga.",
      periodo,
      periodosEvaluados: candidatos,
    };
  }

  return {
    disponible: true,
    motivo: null,
    error: null,
    detalle: null,
    fecha_inicio: periodo.fecha_inicio,
    fecha_limite_original: periodo.fecha_fin_oficial,
    fecha_limite_prorroga: periodo.fecha_fin_prorroga,
    puede_solicitar_prorroga: false,
    sugerencia: null,
    periodo,
    periodosEvaluados: candidatos,
  };
};
