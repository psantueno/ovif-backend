// Modelo

import { Municipio, EjercicioMes, ProrrogaMunicipio, AuditoriaProrrogaMunicipio, Gasto, Recurso, Convenio, PautaConvenio, Recaudacion, RegimenLaboral, SituacionRevista, TipoGasto, Remuneracion, Usuario, Archivo, CierreModulo, EjercicioMesCerrado, Poblacion, UsuarioMunicipio, RecaudacionRectificada, RemuneracionRectificada, TipoPauta, DeterminacionTributaria } from "../models/index.js";
import { buildInformeGastos } from "../utils/pdf/municipioGastos.js";
import { buildInformeRecursos } from "../utils/pdf/municipioRecursos.js";
import { buildInformeRecaudaciones } from "../utils/pdf/municipioRecaudaciones.js";
import { buildInformeRemuneraciones } from "../utils/pdf/municipioRemuneraciones.js";
import { buildInformeDeterminacionTributaria } from "../utils/pdf/municipioDeterminacionTributaria.js";
import { Op, fn, col, where as sequelizeWhere } from "sequelize";
import { GastosSchema } from "../validation/GastosSchema.validation.js";
import { RecursosSchema } from "../validation/RecursosSchema.validation.js";
import { RecaudacionSchema } from "../validation/RecaudacionSchema.validation.js";
import { RemuneracionSchema } from "../validation/RemuneracionSchema.validation.js";
import { DeterminacionTributariaSchema } from "../validation/DeterminacionTributariaSchema.validation.js";
import { EjerciciosSchema } from "../validation/EjerciciosSchema.validation.js";
import { zodErrorsToArray } from "../utils/zodErrorMessages.js";
import { MunicipiosSchema } from "../validation/MunicipiosSchema.validation.js";
import { obtenerFechaActual } from "../utils/obtenerFechaActual.js";
import {
  obtenerPeriodoRectificableAnterior,
  evaluarPeriodosRectificacion,
  verificarRectificacionDisponible,
} from "../utils/rectificaciones.js";
import {
  obtenerPeriodosRegularesDisponiblesPorMunicipio,
  resolverPeriodoRegular,
} from "../utils/periodosRegulares.js";
import sequelize from "../config/db.js";
import { ejecutarBorrado } from "../services/borrado.service.js";
import { BorradoParamsSchema } from "../validation/BorradoParamsSchema.validation.js";

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

const toNumberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value, fallback = "Sin especificar") => {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim();
  return normalized.length ? normalized : fallback;
};

const mapRemuneracionParaInforme = (remuneracion, regimenesMap = new Map()) => {
  const regimenId = Number(remuneracion?.regimen_id);
  const regimenPorId = Number.isFinite(regimenId) ? regimenesMap.get(regimenId) : null;

  return {
    regimen_laboral: normalizeText(
      remuneracion?.regimen_laboral ??
        remuneracion?.regimen ??
        regimenPorId
    ),
    categoria: normalizeText(
      remuneracion?.categoria ??
        remuneracion?.cargo_salarial
    ),
    total_remunerativo: toNumberOrZero(remuneracion?.total_remunerativo),
    total_no_remunerativo: toNumberOrZero(remuneracion?.total_no_remunerativo),
    total_descuentos: toNumberOrZero(remuneracion?.total_descuentos),
    neto_a_cobrar: toNumberOrZero(
      remuneracion?.total_remuneracion_neta ??
        remuneracion?.neto_a_cobrar ??
        remuneracion?.remuneracion_neta
    ),
  };
};

const whereDateOnly = (field, operator, value) =>
  sequelizeWhere(fn("DATE", col(field)), operator, value);

const buildCalendarioKey = (ejercicio, mes, convenioId, pautaId) =>
  `${ejercicio}-${mes}-${convenioId ?? "null"}-${pautaId ?? "null"}`;

const obtenerGastosMunicipio = async (municipioId, ejercicio, mes) => {
  const gastos = await Gasto.findAll({
    where: {
      gastos_ejercicio: ejercicio,
      gastos_mes: mes,
      municipio_id: municipioId,
    },
    order: [["codigo_partida", "ASC"], ["codigo_fuente_financiera", "ASC"]],
  });

  return gastos.map((g) => g.toJSON());
};

const obtenerRecursosMunicipio = async (municipioId, ejercicio, mes) => {
  const recursos = await Recurso.findAll({
    where: {
      recursos_ejercicio: ejercicio,
      recursos_mes: mes,
      municipio_id: municipioId,
    },
    order: [["codigo_recurso", "ASC"], ["codigo_fuente_financiera", "ASC"]],
  });

  return recursos.map((r) => r.toJSON());
};

const obtenerImporteNumerico = (importe) => {
  if (importe === null || importe === undefined) {
    return null;
  }

  const importeNumerico = Number(importe);
  return Number.isFinite(importeNumerico) ? importeNumerico : null;
};

const mapearDetalleRecaudacion = (recaudacion) => ({
  codigo_tributo: Number(recaudacion.codigo_tributo),
  descripcion: recaudacion.descripcion,
  ente_recaudador: recaudacion.ente_recaudador,
  importe_recaudacion: recaudacion.importe_recaudacion,
});

const agruparTotalesRecaudacionesPorCodigo = (conceptos = []) => {
  const totalesPorCodigo = new Map();

  conceptos.forEach((concepto) => {
    const codigoTributo = Number(concepto.codigo_tributo);
    if (!Number.isInteger(codigoTributo) || codigoTributo < 0) {
      return;
    }

    const importeNumerico = obtenerImporteNumerico(concepto.importe_recaudacion) ?? 0;
    const acumulado = totalesPorCodigo.get(codigoTributo) ?? {
      codigo_tributo: codigoTributo,
      descripcion: concepto.descripcion ?? "",
      importe_total_recaudacion: 0,
    };

    if (!acumulado.descripcion && concepto.descripcion) {
      acumulado.descripcion = concepto.descripcion;
    }

    acumulado.importe_total_recaudacion += importeNumerico;
    totalesPorCodigo.set(codigoTributo, acumulado);
  });

  return Array.from(totalesPorCodigo.values()).sort((a, b) => a.codigo_tributo - b.codigo_tributo);
};

const calcularTotalImporteRecaudacion = (conceptos = []) =>
  conceptos.reduce((acumulado, concepto) => {
    const importeNumerico = obtenerImporteNumerico(concepto.importe_recaudacion);
    if (importeNumerico === null) {
      return acumulado;
    }
    return acumulado + importeNumerico;
  }, 0);

const mapearDetalleDeterminacionTributaria = (determinacion) => ({
  cod_impuesto: Number(determinacion.cod_impuesto),
  descripcion: determinacion.descripcion,
  anio: Number(determinacion.anio),
  cuota: Number(determinacion.cuota),
  liquidadas: Number(determinacion.liquidadas),
  importe_liquidadas: determinacion.importe_liquidadas,
  impagas: Number(determinacion.impagas),
  importe_impagas: determinacion.importe_impagas,
  pagadas: Number(determinacion.pagadas),
  importe_pagadas: determinacion.importe_pagadas,
  altas_periodo: Number(determinacion.altas_periodo),
  bajas_periodo: Number(determinacion.bajas_periodo),
});

const calcularResumenDeterminacionTributaria = (determinaciones = []) =>
  determinaciones.reduce(
    (acumulado, item) => ({
      totalRegistros: acumulado.totalRegistros + 1,
      totalLiquidadas: acumulado.totalLiquidadas + (Number(item.liquidadas) || 0),
      totalImporteLiquidadas:
        acumulado.totalImporteLiquidadas +
        (obtenerImporteNumerico(item.importe_liquidadas) ?? 0),
      totalImpagas: acumulado.totalImpagas + (Number(item.impagas) || 0),
      totalImporteImpagas:
        acumulado.totalImporteImpagas +
        (obtenerImporteNumerico(item.importe_impagas) ?? 0),
      totalPagadas: acumulado.totalPagadas + (Number(item.pagadas) || 0),
      totalImportePagadas:
        acumulado.totalImportePagadas +
        (obtenerImporteNumerico(item.importe_pagadas) ?? 0),
      totalAltasPeriodo:
        acumulado.totalAltasPeriodo + (Number(item.altas_periodo) || 0),
      totalBajasPeriodo:
        acumulado.totalBajasPeriodo + (Number(item.bajas_periodo) || 0),
    }),
    {
      totalRegistros: 0,
      totalLiquidadas: 0,
      totalImporteLiquidadas: 0,
      totalImpagas: 0,
      totalImporteImpagas: 0,
      totalPagadas: 0,
      totalImportePagadas: 0,
      totalAltasPeriodo: 0,
      totalBajasPeriodo: 0,
    }
  );

const responderInformeSinDatos = (res) =>
  res.status(200).json({
    generado: false,
    message:
      "Todavía no hay datos cargados para este período. Cuando los cargues, vas a poder generar el informe.",
  });

// Obtener todos los municipios
export const getMunicipios = async (req, res) => {
  try {
    let { pagina = 1, limite = 10, search } = req.query;

    const paginaParsed = Number.parseInt(pagina, 10);
    const limiteParsed = Number.parseInt(limite, 10);
    const paginaFinal = Number.isFinite(paginaParsed) && paginaParsed > 0 ? paginaParsed : 1;
    const limiteFinal = Number.isFinite(limiteParsed) && limiteParsed > 0 ? limiteParsed : 10;
    const offset = (paginaFinal - 1) * limiteFinal;

    const where = {};
    const trimmedSearch = typeof search === "string" ? search.trim() : "";
    if (trimmedSearch) {
      where.municipio_nombre = { [Op.like]: `%${trimmedSearch}%` };
    }

    const { rows, count } = await Municipio.findAndCountAll({
      where,
      order: [
        ["municipio_nombre", "ASC"],
        ["municipio_id", "ASC"],
      ],
      limit: limiteFinal,
      offset,
    });

    const municipiosPlanos = await Promise.all(
      rows.map(async (m) => {
        let modificable = false;
        try {
          modificable = await esMunicipioModificable(m.municipio_id);
        } catch (error) {
          console.error(`❌ Error verificando si el municipio es modificable para municipio_id ${m.municipio_id}`, error);
        }

        return {
          municipio_id: m.municipio_id,
          municipio_nombre: m.municipio_nombre,
          municipio_usuario: m.municipio_usuario,
          municipio_spar: m.municipio_spar,
          municipio_ubge: m.municipio_ubge,
          municipio_subir_archivos: m.municipio_subir_archivos,
          municipio_poblacion: m.municipio_poblacion,
          modificable: modificable
        };
      })
    );

    const totalPaginas = limiteFinal > 0 ? Math.ceil(count / limiteFinal) : 0;

    return res.json({
      total: count,
      pagina: paginaFinal,
      limite: limiteFinal,
      totalPaginas,
      data: municipiosPlanos,
    });
  } catch (error) {
    console.error("❌ Error consultando municipios:", error);
    return res.status(500).json({ error: "Error consultando municipios" });
  }
};

export const listarEjerciciosDisponiblesPorMunicipio = async (req, res) => {
  const municipioId = Number(req.params.id || req.params.municipioId);
  if (Number.isNaN(municipioId)) {
    return res.status(400).json({ error: "municipioId inválido" });
  }

  try {
    const municipio = await Municipio.findByPk(municipioId, {
      attributes: ["municipio_id", "municipio_nombre"],
    });
    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const disponibles = await obtenerPeriodosRegularesDisponiblesPorMunicipio({
      municipioId,
      fechaReferencia: obtenerFechaActual(),
    });

    return res.json({
      municipio: municipio.get(),
      ejercicios: disponibles,
    });
  } catch (error) {
    console.error("❌ Error listando ejercicios disponibles:", error);
    return res.status(500).json({ error: "Error listando ejercicios disponibles" });
  }
};

export const listarEjerciciosRectificacionesDisponiblesPorMunicipio = async (req, res) => {
  const municipioId = Number(req.params.id || req.params.municipioId);
  if (Number.isNaN(municipioId)) {
    return res.status(400).json({ error: "ID de municipio inválido" });
  }

  try {
    const municipio = await Municipio.findByPk(municipioId, {
      attributes: ["municipio_id", "municipio_nombre"],
    });
    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const fechaActual = obtenerFechaActual();
    const periodoRectificableAnterior =
      obtenerPeriodoRectificableAnterior(fechaActual);
    const {
      ejercicioMesPeriodo,
      pautasRectificablesIds,
      periodosEvaluados,
    } = await evaluarPeriodosRectificacion(
      municipioId,
      periodoRectificableAnterior,
      fechaActual
    );

    /*console.log(
      "🧭 DEBUG rectificaciones: periodos base backend",
      JSON.stringify(
        {
          municipio_id: municipioId,
          fecha_hoy_argentina: fechaActual,
          periodo_rectificable_anterior: periodoRectificableAnterior,
          pautas_rectificables_ids: pautasRectificablesIds,
          periodos_base: ejercicioMesPeriodo.map((em) => ({
            ejercicio: em.ejercicio,
            mes: em.mes,
            convenio_id: em.convenio_id,
            pauta_id: em.pauta_id,
            fecha_inicio: toISODate(em.fecha_inicio),
            fecha_fin: toISODate(em.fecha_fin),
          })),
        },
        null,
        2
      )
    );*/

    if (ejercicioMesPeriodo.length === 0) {
      return res.json({
        municipio: municipio.get(),
        ejercicios: [],
      });
    }

    const disponibles = periodosEvaluados.map((item) => ({
      ...item,
      vencido: !item.disponible,
      cerrado: false,
    }));

    /*console.log(
      "🧮 DEBUG rectificaciones: calculo por periodo",
      JSON.stringify(
        {
          municipio_id: municipioId,
          fecha_hoy_argentina: fechaActual,
          calculos: disponibles.map((item) => ({
            ejercicio: item.ejercicio,
            mes: item.mes,
            convenio_id: item.convenio_id,
            convenio_nombre: item.convenio_nombre,
            pauta_id: item.pauta_id,
            pauta_descripcion: item.pauta_descripcion,
            fecha_inicio: item.fecha_inicio,
            fecha_fin: item.fecha_fin,
            fecha_cierre_regular_base: item.fecha_cierre_regular_base,
            fecha_cierre_regular_efectiva: item.fecha_cierre_regular_efectiva,
            tiene_prorroga: item.tiene_prorroga,
            fecha_fin_prorroga: item.fecha_fin_prorroga,
            cant_dias_rectifica: item.cant_dias_rectifica,
            plazo_mes_rectifica: item.plazo_mes_rectifica,
            fecha_inicio_rectificacion_teorica:
              item.fecha_inicio_rectificacion_teorica,
            fecha_inicio_rectificacion: item.fecha_inicio_rectificacion,
            fecha_cierre: item.fecha_cierre,
            disponible: item.disponible,
            vencido: item.vencido,
          })),
        },
        null,
        2
      )
    );*/

    const periodosDisponibles = disponibles.filter((item) => item.disponible);

    /*console.log(
      "📦 DEBUG rectificaciones: payload final helper",
      JSON.stringify(
        {
          municipio_id: municipioId,
          fecha_hoy_argentina: fechaActual,
          periodo_rectificable_anterior: periodoRectificableAnterior,
          ejercicios: periodosDisponibles,
        },
        null,
        2
      )
    );*/

    return res.json({
      municipio: municipio.get(),
      ejercicios: periodosDisponibles,
    });
  } catch (error) {
    console.error("❌ Error listando ejercicios disponibles:", error);
    return res.status(500).json({ error: "Error listando ejercicios disponibles" });
  }
};

export const listarEjerciciosCerradosPorMunicipio = async (req, res) => {
  const municipioId = Number(req.params.municipioId || req.params.id);
  if (Number.isNaN(municipioId)) {
    return res.status(400).json({ error: "municipioId inválido" });
  }

  try {
    // 1️⃣ Validar que el municipio existe
    const municipio = await Municipio.findByPk(municipioId, {
      attributes: ["municipio_id", "municipio_nombre"],
    });
    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    // 2️⃣ Obtener la fecha actual en zona AR (YYYY-MM-DD)
    const hoy = obtenerFechaActual();

    // 3️⃣ Buscar TODOS los ejercicios/mes donde DATE(fecha_fin) < hoy (VENCIDOS)
    // Se usa DATE() para comparar a nivel de día calendario y evitar
    // discrepancias por componente horario en el DATETIME almacenado.
    const oficiales = await EjercicioMes.findAll({
      where: sequelizeWhere(fn("DATE", col("fecha_fin")), { [Op.lt]: hoy }),
      order: [
        ["ejercicio", "DESC"],
        ["mes", "DESC"],
        ["convenio_id", "ASC"],
        ["pauta_id", "ASC"],
      ],
    });

    if (oficiales.length === 0) {
      return res.json({
        municipio: municipio.get(),
        cierres: [],
        fecha_consulta: hoy,
        total_vencidos: 0,
      });
    }

    // 4️⃣ Buscar prórrogas para este municipio
    const prorrogas = await ProrrogaMunicipio.findAll({
      where: {
        municipio_id: municipioId,
      },
    });

    // 5️⃣ Recopilar IDs de convenios y pautas
    const convenioIds = new Set();
    const pautaIds = new Set();

    oficiales.forEach((oficial) => {
      if (oficial.convenio_id !== null && oficial.convenio_id !== undefined) {
        convenioIds.add(oficial.convenio_id);
      }
      if (oficial.pauta_id !== null && oficial.pauta_id !== undefined) {
        pautaIds.add(oficial.pauta_id);
      }
    });

    prorrogas.forEach((prorroga) => {
      if (prorroga.convenio_id !== null && prorroga.convenio_id !== undefined) {
        convenioIds.add(prorroga.convenio_id);
      }
      if (prorroga.pauta_id !== null && prorroga.pauta_id !== undefined) {
        pautaIds.add(prorroga.pauta_id);
      }
    });

    // 6️⃣ Buscar datos de convenios y pautas
    const [convenios, pautas] = await Promise.all([
      convenioIds.size
        ? Convenio.findAll({
            attributes: ["convenio_id", "nombre"],
            where: { convenio_id: { [Op.in]: [...convenioIds] } },
          })
        : Promise.resolve([]),
      pautaIds.size
        ? PautaConvenio.findAll({
            attributes: ["pauta_id", "descripcion", "convenio_id"],
            where: { pauta_id: { [Op.in]: [...pautaIds] } },
          })
        : Promise.resolve([]),
    ]);

    // 7️⃣ Crear mapas para acceso rápido
    const convenioMap = new Map(convenios.map((item) => [item.convenio_id, item]));
    const pautaMap = new Map(pautas.map((item) => [item.pauta_id, item]));

    const prorrogaMap = new Map(
      prorrogas.map((item) => [
        buildCalendarioKey(item.ejercicio, item.mes, item.convenio_id, item.pauta_id),
        item,
      ])
    );

    // 8️⃣ Construir respuesta
    const respuesta = oficiales.map((oficial) => {
      const key = buildCalendarioKey(
        oficial.ejercicio,
        oficial.mes,
        oficial.convenio_id,
        oficial.pauta_id
      );
      const prorroga = prorrogaMap.get(key);
      const fechaCierreOficial = toISODate(oficial.fecha_fin);
      const fechaProrrogaVigente = prorroga ? toISODate(prorroga.fecha_fin_nueva) : null;
      const fechaCierre = fechaProrrogaVigente ?? fechaCierreOficial;
      const convenio = convenioMap.get(oficial.convenio_id);
      const pauta = pautaMap.get(oficial.pauta_id);

      return {
        ejercicio: oficial.ejercicio,
        mes: oficial.mes,
        convenio_id: oficial.convenio_id,
        convenio_nombre: convenio?.nombre ?? null,
        pauta_id: oficial.pauta_id,
        pauta_descripcion: pauta?.descripcion ?? null,
        fechas: {
          cierre_oficial: fechaCierreOficial,
          prorroga_vigente: fechaProrrogaVigente,
        },
        fecha_cierre: fechaCierre,
        tiene_prorroga: Boolean(prorroga),
      };
    });

    return res.json({
      municipio: municipio.get(),
      cierres: respuesta,
      fecha_consulta: hoy,
      total_vencidos: respuesta.length,
    });
  } catch (error) {
    console.error("❌ Error listando ejercicios cerrados:", error);
    return res.status(500).json({ error: "Error listando ejercicios cerrados" });
  }
};


// 📌 Endpoint liviano para selects
// GET /api/municipios/select
export const getMunicipiosSelect = async (req, res) => {
  try {
    const municipios = await Municipio.findAll({
      attributes: ["municipio_id", "municipio_nombre"],
      order: [["municipio_nombre", "ASC"]],
    });
    res.json(municipios);
  } catch (error) {
    console.error("❌ Error consultando municipios:", error);
    res.status(500).json({ error: "Error consultando municipios" });
  }
};

// Obtener un municipio por ID
export const getMunicipioById = async (req, res) => {
  const { id } = req.params;

  try {
    const municipio = await Municipio.findByPk(id);

    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    res.json(municipio);
  } catch (error) {
    console.error("❌ Error consultando municipio:", error);
    res.status(500).json({ error: "Error consultando municipio" });
  }
};

// Crear un nuevo municipio
export const createMunicipio = async (req, res) => {
  const {
    municipio_nombre,
    municipio_spar,
    municipio_ubge,
    municipio_subir_archivos,
    municipio_poblacion,
  } = req.body;

  try {
    const valid = MunicipiosSchema.safeParse({ 
      municipio_nombre,
      municipio_spar,
      municipio_ubge,
      municipio_subir_archivos,
      municipio_poblacion, 
    });

    if (!valid.success) {
      return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(',') })
    }

    const municipioExistente = await Municipio.findOne({
      where: { municipio_nombre },
    });

    if (municipioExistente) {
      return res.status(400).json({ error: "Ya existe un municipio con este nombre" });
    }

    const nuevoMunicipio = await Municipio.create({
      municipio_nombre,
      municipio_spar,
      municipio_ubge,
      municipio_subir_archivos,
      municipio_poblacion,
    });

    res.status(201).json({
      message: "Municipio creado correctamente",
      municipio: nuevoMunicipio,
    });
  } catch (error) {
    console.error("❌ Error creando municipio:", error);
    res.status(500).json({ error: "Error creando municipio" });
  }
};

// Actualizar un municipio existente
export const updateMunicipio = async (req, res) => {
  const { id } = req.params;
  const {
    municipio_nombre,
    municipio_spar,
    municipio_ubge,
    municipio_subir_archivos,
    municipio_poblacion,
  } = req.body;

  try {
    const municipio = await Municipio.findByPk(id);

    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const valid = MunicipiosSchema.safeParse({ 
      municipio_nombre,
      municipio_spar,
      municipio_ubge,
      municipio_subir_archivos,
      municipio_poblacion, 
    });

    if (!valid.success) {
      return res.status(400).json({ error: zodErrorsToArray(valid.error.issues).join(',') })
    }

    if (municipio_nombre && municipio_nombre !== municipio.municipio_nombre) {
      const municipioDuplicado = await Municipio.findOne({ where: { municipio_nombre } });

      if (municipioDuplicado && municipioDuplicado.municipio_id !== municipio.municipio_id) {
        return res.status(400).json({ error: "Ya existe otro municipio con ese nombre" });
      }

      municipio.municipio_nombre = municipio_nombre;
    }

    const modificable = esMunicipioModificable(municipio.municipio_id);
    if(!modificable){
      return res.status(400).json({ error: "El municipio está asociado a otros datos y no puede ser actualizado" });
    }

    municipio.modificable = modificable;

    if (municipio_spar !== undefined) municipio.municipio_spar = municipio_spar;
    if (municipio_ubge !== undefined) municipio.municipio_ubge = municipio_ubge;
    if (municipio_subir_archivos !== undefined)
      municipio.municipio_subir_archivos = municipio_subir_archivos;
    if (municipio_poblacion !== undefined) municipio.municipio_poblacion = municipio_poblacion;

    await municipio.save();

    res.json({
      message: "Municipio actualizado correctamente",
      municipio,
    });
  } catch (error) {
    console.error("❌ Error actualizando municipio:", error);
    res.status(500).json({ error: "Error actualizando municipio" });
  }
};

// Eliminar un municipio
export const deleteMunicipio = async (req, res) => {
  const { id } = req.params;

  try {
    const municipio = await Municipio.findByPk(id);

    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const modificable = esMunicipioModificable(municipio.municipio_id);
    if(!modificable){
      return res.status(400).json({ error: "El municipio está asociado a otros datos y no puede ser actualizado" });
    }

    await municipio.destroy();

    res.json({ message: "Municipio eliminado correctamente" });
  } catch (error) {
    console.error("❌ Error eliminando municipio:", error);
    res.status(500).json({ error: "Error eliminando municipio" });
  }
};

// === Partidas de gastos del municipio (con importes cargados) ===
export const obtenerPartidasGastosMunicipio = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;

  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);
  const municipioNum = Number(municipioId);

  if ([ejercicioNum, mesNum, municipioNum].some((value) => Number.isNaN(value))) {
    return res.status(400).json({ error: "Ejercicio, mes y municipio deben ser numéricos" });
  }

  try {
    const municipio = await Municipio.findByPk(municipioNum, { attributes: ["municipio_id"] });
    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const gastos = await obtenerGastosMunicipio(municipioNum, ejercicioNum, mesNum);

    return res.json(gastos);
  } catch (error) {
    console.error("❌ Error obteniendo partidas de gastos del municipio:", error);
    return res.status(500).json({ error: "Error obteniendo partidas de gastos" });
  }
};

export const obtenerPartidasRecursosMunicipio = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;

  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);
  const municipioNum = Number(municipioId);

  if ([ejercicioNum, mesNum, municipioNum].some((value) => Number.isNaN(value))) {
    return res
      .status(400)
      .json({ error: "Ejercicio, mes y municipio deben ser numéricos" });
  }

  try {
    const municipio = await Municipio.findByPk(municipioNum, {
      attributes: ["municipio_id"],
    });
    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const recursos = await obtenerRecursosMunicipio(municipioNum, ejercicioNum, mesNum);

    return res.json(recursos);
  } catch (error) {
    console.error("❌ Error obteniendo partidas de recursos del municipio:", error);
    return res.status(500).json({ error: "Error obteniendo partidas de recursos" });
  }
};


export const crearProrrogaMunicipio = async (req, res) => {
  const municipioId = Number(req.params.municipioId || req.params.id);
  const ejercicio = Number(req.params.ejercicio);
  const mes = Number(req.params.mes);
  const { fecha_fin, comentario, convenio_id, pauta_id, motivo, observaciones, tipo } = req.body ?? {};
  const usuarioId = req.user?.usuario_id;

  if ([municipioId, ejercicio, mes].some((value) => Number.isNaN(value))) {
    return res
      .status(400)
      .json({ error: "municipioId, ejercicio y mes deben ser numéricos" });
  }

  if (!fecha_fin) {
    return res.status(400).json({ error: "Debe enviar fecha_fin" });
  }

  if (!tipo || (tipo !== "RECTIFICATIVA" && tipo !== "PRORROGA")) {
    return res.status(400).json({ error: "Debe enviar fecha_fin" });
  }

  const fechaFinNormalizada = toISODate(fecha_fin);
  if (!fechaFinNormalizada) {
    return res.status(400).json({ error: "fecha_fin inválida" });
  }

  const hoy = obtenerFechaActual();
  if (fechaFinNormalizada < hoy) {
    return res
      .status(400)
      .json({ error: "La nueva fecha de prórroga no puede ser anterior al día actual" });
  }

  if (!usuarioId) {
    return res.status(401).json({ error: "Usuario no autenticado" });
  }

  try {
    const municipio = await Municipio.findByPk(municipioId, {
      attributes: ["municipio_id"],
    });
    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const oficial = await EjercicioMes.findOne({
      where: { ejercicio, mes, pauta_id, convenio_id },
    });
    if (!oficial) {
      return res
        .status(404)
        .json({ error: "Ejercicio/Mes no encontrado en calendario oficial" });
    }

    let prorroga = await ProrrogaMunicipio.findOne({
      where: { ejercicio, mes, municipio_id: municipioId, convenio_id, pauta_id },
    });

    const fechaAnterior = prorroga ? prorroga.fecha_fin_nueva : oficial.fecha_fin;

    if (!prorroga) {
      if (convenio_id === undefined || pauta_id === undefined) {
        return res.status(400).json({
          error: "Debe enviar convenio_id y pauta_id para crear una prórroga.",
        });
      }

      prorroga = await ProrrogaMunicipio.create({
        ejercicio,
        mes,
        municipio_id: municipioId,
        convenio_id,
        pauta_id,
        fecha_fin_nueva: fecha_fin,
      });
    } else {
      const nuevoConvenio = convenio_id ?? prorroga.convenio_id;
      const nuevaPauta = pauta_id ?? prorroga.pauta_id;

      if (nuevoConvenio === undefined || nuevaPauta === undefined) {
        return res.status(400).json({
          error: "Debe especificar convenio_id y pauta_id válidos para la prórroga.",
        });
      }

      prorroga.convenio_id = nuevoConvenio;
      prorroga.pauta_id = nuevaPauta;
      prorroga.fecha_fin_nueva = fecha_fin;
      await prorroga.save();
    }

    await AuditoriaProrrogaMunicipio.create({
      prorroga_id: prorroga.prorroga_id,
      ejercicio,
      mes,
      municipio_id: municipioId,
      convenio_id: prorroga.convenio_id,
      pauta_id: prorroga.pauta_id,
      fecha_fin_anterior: fechaAnterior,
      fecha_fin_prorrogada: fecha_fin,
      tipo: tipo,
      motivo: motivo,
      gestionado_por: usuarioId,
      observaciones: observaciones,
    });

    return res.json({
      message: "✅ Prórroga aplicada",
      ejercicio,
      mes,
      municipio_id: municipioId,
      fecha_fin_anterior: toISODate(fechaAnterior),
      fecha_fin_prorrogada: fechaFinNormalizada,
      convenio_id: prorroga.convenio_id,
      pauta_id: prorroga.pauta_id,
    });
  } catch (error) {
    console.error("❌ Error creando prórroga para municipio:", error);
    return res.status(500).json({ error: "Error creando prórroga" });
  }
};


export const upsertGastosMunicipio = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;
  const { partidas } = req.body ?? {};

  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);
  const municipioNum = Number(municipioId);

  const valid = EjerciciosSchema.safeParse({ ejercicio: ejercicioNum, mes: mesNum, municipio_id: municipioNum });

  if (!valid.success) {
    return res.status(400).json({ message: "Error en los datos de entrada", errors: zodErrorsToArray(valid.error.issues) });
  }

  const transaction = await sequelize.transaction();

  try {
    const disponible = await verificarGastosRecursosDisponibles(
      municipioNum,
      ejercicioNum,
      mesNum
    );
    if (!disponible) {
      await transaction.rollback();
      return res.status(400).json({ error: "El período no está disponible para modificar gastos" });
    }

    const municipio = await Municipio.findByPk(municipioNum, { attributes: ["municipio_id"] });
    if (!municipio) {
      await transaction.rollback();
      return res.status(404).json({ error: "Municipio no encontrado" });
    }
    let creados = 0;
    let actualizados = 0;
    let sinCambios = 0;

    const errores = [];
    const partidasPorClave = new Map();

    for (const item of partidas) {
      const codigo = Number(item?.codigo_partida);
      const fuente = Number(item?.codigo_fuente_financiera);
      if (!Number.isFinite(codigo) || !Number.isFinite(fuente)) {
        continue;
      }
      const clave = `${codigo}__${fuente}`;
      partidasPorClave.set(clave, (partidasPorClave.get(clave) ?? 0) + 1);
    }

    const partidasDuplicadas = new Set(
      Array.from(partidasPorClave.entries())
        .filter(([, cantidad]) => cantidad > 1)
        .map(([clave]) => clave)
    );

    for (const item of partidas) {
      try{
        const codigo = Number(item?.codigo_partida);
        const fuente = Number(item?.codigo_fuente_financiera);
        const clave = `${codigo}__${fuente}`;

        if (partidasDuplicadas.has(clave)) {
          errores.push(`Error procesando la partida con código ${item?.codigo_partida}: La combinación codigo_partida ${codigo} y codigo_fuente_financiera ${fuente} está duplicada en el archivo.`);
          continue;
        }

        const datosGasto = {
          codigo_partida: codigo,
          descripcion: item?.descripcion ?? "",
          codigo_fuente_financiera: fuente,
          descripcion_fuente: item?.descripcion_fuente ?? "",
          formulado: Number(item?.formulado ?? 0),
          modificado: Number(item?.modificado ?? 0),
          vigente: Number(item?.vigente ?? 0),
          devengado: Number(item?.devengado ?? 0),
        };

        const validGasto = GastosSchema.safeParse(datosGasto);

        if (!validGasto.success) {
          errores.push(`Error procesando la partida con código ${item?.codigo_partida}: ${zodErrorsToArray(validGasto.error.issues).join(", ")}`);
          continue;
        }

        const where = {
          gastos_ejercicio: ejercicioNum,
          gastos_mes: mesNum,
          municipio_id: municipioNum,
          codigo_partida: codigo,
          codigo_fuente_financiera: datosGasto.codigo_fuente_financiera,
        };

        const existente = await Gasto.findOne({ where, transaction });

        if (!existente) {
          await Gasto.create(
            {
              ...where,
              ...datosGasto,
            },
            { transaction }
          );
          creados += 1;
          continue;
        }

        const cambiado =
          existente.descripcion !== datosGasto.descripcion ||
          Number(existente.codigo_fuente_financiera) !== datosGasto.codigo_fuente_financiera ||
          existente.descripcion_fuente !== datosGasto.descripcion_fuente ||
          Number(existente.formulado) !== datosGasto.formulado ||
          Number(existente.modificado) !== datosGasto.modificado ||
          Number(existente.vigente) !== datosGasto.vigente ||
          Number(existente.devengado) !== datosGasto.devengado;

        if (!cambiado) {
          sinCambios += 1;
          continue;
        }

        await existente.update(datosGasto, { transaction });

        actualizados += 1;
      } catch (error) {
        errores.push(`Error procesando partida ${item?.codigo_partida}: ${error.message}`);
      }
    }

    await transaction.commit();

    const message = errores.length > 0
      ? `Gastos procesados con errores: ${errores.length}`
      : "Gastos procesados correctamente";

    return res.json({
      message,
      resumen: {
        creados,
        actualizados,
        sinCambios,
        errores
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("❌ Error realizando upsert de gastos del municipio:", error);
    return res.status(500).json({ error: "Error guardando los gastos" });
  }
};

export const upsertRecursosMunicipio = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;
  const { partidas } = req.body ?? {};

  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);
  const municipioNum = Number(municipioId);

  const valid = EjerciciosSchema.safeParse({ ejercicio: ejercicioNum, mes: mesNum, municipio_id: municipioNum });

  if (!valid.success) {
    return res.status(400).json({ message: "Error en los datos de entrada", errors: zodErrorsToArray(valid.error.issues) });
  }

  const transaction = await sequelize.transaction();

  try {
    const disponible = await verificarGastosRecursosDisponibles(
      municipioNum,
      ejercicioNum,
      mesNum
    );
    if (!disponible) {
      await transaction.rollback();
      return res.status(400).json({ error: "El período no está disponible para modificar recursos" });
    }

    const municipio = await Municipio.findByPk(municipioNum, { attributes: ["municipio_id"] });
    if (!municipio) {
      await transaction.rollback();
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    let creados = 0;
    let actualizados = 0;
    let sinCambios = 0;
    let errores = [];
    const recursosPorClave = new Map();

    for (const item of partidas) {
      const codigo = Number(item?.codigo_recurso);
      const fuente = Number(item?.codigo_fuente_financiera);
      if (!Number.isFinite(codigo) || !Number.isFinite(fuente)) {
        continue;
      }
      const clave = `${codigo}__${fuente}`;
      recursosPorClave.set(clave, (recursosPorClave.get(clave) ?? 0) + 1);
    }

    const recursosDuplicados = new Set(
      Array.from(recursosPorClave.entries())
        .filter(([, cantidad]) => cantidad > 1)
        .map(([clave]) => clave)
    );

    for (const item of partidas) {
      try {
        const codigo = Number(item?.codigo_recurso);
        const fuente = Number(item?.codigo_fuente_financiera);
        const clave = `${codigo}__${fuente}`;

        if (recursosDuplicados.has(clave)) {
          errores.push(`Error procesando el recurso con código ${item?.codigo_recurso}: La combinación cod_recurso ${codigo} y codigo_fuente_financiera ${fuente} está duplicada en el archivo.`);
          continue;
        }

        const datosRecurso = {
          codigo_recurso: codigo,
          descripcion: item?.descripcion ?? "",
          codigo_fuente_financiera: fuente,
          descripcion_fuente: item?.descripcion_fuente ?? "",
          vigente: Number(item?.vigente ?? 0),
          percibido: Number(item?.percibido ?? 0),
        };

        const validRecurso = RecursosSchema.safeParse(datosRecurso);

        if (!validRecurso.success) {
          errores.push(`Error procesando el recurso con código ${item?.codigo_recurso}: ${zodErrorsToArray(validRecurso.error.issues).join(", ")}`);
          continue;
        }

        const where = {
          recursos_ejercicio: ejercicioNum,
          recursos_mes: mesNum,
          municipio_id: municipioNum,
          codigo_recurso: codigo,
          codigo_fuente_financiera: datosRecurso.codigo_fuente_financiera,
        };

        const existente = await Recurso.findOne({ where, transaction });

        if (!existente) {
          await Recurso.create({ ...where, ...datosRecurso }, { transaction });
          creados += 1;
          continue;
        }

        const cambiado =
          existente.descripcion !== datosRecurso.descripcion ||
          Number(existente.codigo_fuente_financiera) !== datosRecurso.codigo_fuente_financiera ||
          existente.descripcion_fuente !== datosRecurso.descripcion_fuente ||
          Number(existente.vigente) !== datosRecurso.vigente ||
          Number(existente.percibido) !== datosRecurso.percibido;

        if (!cambiado) {
          sinCambios += 1;
          continue;
        }

        await existente.update(datosRecurso, { transaction });
        actualizados += 1;
      } catch (error) {
        errores.push(`Error procesando recurso ${item?.codigo_recurso}: ${error.message}`);
      }
    }

    await transaction.commit();

    const message = errores.length > 0
      ? `Recursos procesados con errores: ${errores.length}`
      : "Recursos procesados correctamente";

    return res.json({
      message,
      resumen: {
        creados,
        actualizados,
        sinCambios,
        errores
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("❌ Error realizando upsert de recursos del municipio:", error);
    return res.status(500).json({ error: "Error guardando los recursos" });
  }
};


export const generarInformeGastosMunicipio = async (req, res) => {
  const { municipioId, ejercicio, mes } = req.params;

  const municipioNum = Number(municipioId);
  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);

  if ([municipioNum, ejercicioNum, mesNum].some((value) => Number.isNaN(value))) {
    return res.status(400).json({ error: "Ejercicio, mes y municipio deben ser numéricos" });
  }

  try {
    const disponible = await verificarGastosRecursosDisponibles(
      municipioNum,
      ejercicioNum,
      mesNum
    );
    if (!disponible) {
      return res.status(400).json({ error: "El período no está disponible para generar informes" });
    }

    const municipio = await Municipio.findByPk(municipioNum, {
      attributes: ["municipio_id", "municipio_nombre"],
    });

    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const gastos = await obtenerGastosMunicipio(municipioNum, ejercicioNum, mesNum);

    if (!gastos || gastos.length === 0) {
      return responderInformeSinDatos(res);
    }

    const totales = gastos.reduce((acc, g) => {
      acc.formulado += Number(g.formulado) || 0;
      acc.modificado += Number(g.modificado) || 0;
      acc.vigente += Number(g.vigente) || 0;
      acc.devengado += Number(g.devengado) || 0;
      return acc;
    }, { formulado: 0, modificado: 0, vigente: 0, devengado: 0 });

    const userRequest = req.user ?? null;
    const user = await Usuario.findOne({where: { usuario_id: userRequest.usuario_id }});

    const ejercicioMes = await EjercicioMes.findOne({where: { ejercicio: ejercicio, mes: mes }});

    const convenio = await Convenio.findOne({where: { convenio_id: ejercicioMes.convenio_id }});

    const buffer = await buildInformeGastos({
      municipioNombre: municipio.municipio_nombre,
      ejercicio: ejercicioNum,
      mes: mesNum,
      gastos,
      totales,
      usuarioNombre: `${user.nombre} ${user.apellido}`,
      convenioNombre: convenio.nombre
    });

    const nombreMunicipioSlug = (municipio.municipio_nombre || `Municipio_${municipioNum}`)
      .normalize("NFD")
      .replace(/[^0-9a-zA-Z]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || `municipio_${municipioNum}`;

    const fileName = `InformeGastos_${nombreMunicipioSlug}_${ejercicioNum}_${mesNum}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (error) {
    console.error("❌ Error generando informe de gastos:", error);
    return res.status(500).json({ error: "Error generando el informe de gastos" });
  }
};

export const generarInformeRecursosMunicipio = async (req, res) => {
  const { municipioId, ejercicio, mes } = req.params;

  const municipioNum = Number(municipioId);
  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);

  if ([municipioNum, ejercicioNum, mesNum].some((value) => Number.isNaN(value))) {
    return res
      .status(400)
      .json({ error: "Ejercicio, mes y municipio deben ser numéricos" });
  }

  try {
    const disponible = await verificarGastosRecursosDisponibles(
      municipioNum,
      ejercicioNum,
      mesNum
    );
    if (!disponible) {
      return res.status(400).json({ error: "El período no está disponible para generar informes" });
    }

    const municipio = await Municipio.findByPk(municipioNum, {
      attributes: ["municipio_id", "municipio_nombre"],
    });

    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const recursos = await obtenerRecursosMunicipio(municipioNum, ejercicioNum, mesNum);

    if (!recursos || recursos.length === 0) {
      return responderInformeSinDatos(res);
    }

    const totales = recursos.reduce((acc, r) => {
      acc.vigente += Number(r.vigente) || 0;
      acc.percibido += Number(r.percibido) || 0;
      return acc;
    }, { vigente: 0, percibido: 0 });

    const userRequest = req.user ?? null;
    const user = await Usuario.findOne({where: { usuario_id: userRequest.usuario_id }});

    const ejercicioMes = await EjercicioMes.findOne({where: { ejercicio: ejercicio, mes: mes }});

    const convenio = await Convenio.findOne({where: { convenio_id: ejercicioMes.convenio_id }});

    const buffer = await buildInformeRecursos({
      municipioNombre: municipio.municipio_nombre,
      ejercicio: ejercicioNum,
      mes: mesNum,
      recursos,
      totales,
      usuarioNombre: `${user.nombre} ${user.apellido}`,
      convenioNombre: convenio.nombre
    });

    const nombreMunicipioSlug = (municipio.municipio_nombre || `Municipio_${municipioNum}`)
      .normalize("NFD")
      .replace(/[^0-9a-zA-Z]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || `municipio_${municipioNum}`;

    const fileName = `InformeRecursos_${nombreMunicipioSlug}_${ejercicioNum}_${mesNum}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (error) {
    console.error("❌ Error generando informe de recursos:", error);
    return res.status(500).json({ error: "Error generando el informe de recursos" });
  }
};

export const obtenerConceptosRecaudacionMunicipio = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;

  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);
  const municipioNum = Number(municipioId);

  if ([ejercicioNum, mesNum, municipioNum].some((value) => Number.isNaN(value))) {
    return res.status(400).json({ error: "Ejercicio, mes y municipio deben ser numéricos" });
  }

  try {
    const municipio = await Municipio.findByPk(municipioNum, { attributes: ["municipio_id"] });
    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const conceptosCargados = await Recaudacion.findAll({
      where: {
        recaudaciones_ejercicio: ejercicioNum,
        recaudaciones_mes: mesNum,
        municipio_id: municipioNum,
      },
      order: [["codigo_tributo", "ASC"], ["ente_recaudador", "ASC"]],
    });

    const conceptosCargadosMap = conceptosCargados.map(mapearDetalleRecaudacion);

    return res.json(conceptosCargadosMap);
  } catch (error) {
    console.error("❌ Error obteniendo recaudaciones del municipio:", error);
    return res.status(500).json({ error: "Error obteniendo recaudaciones" });
  }
}

export const upsertRecaudacionesMunicipio = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;
  const { conceptos } = req.body ?? {};

  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);
  const municipioNum = Number(municipioId);

  const valid = EjerciciosSchema.safeParse({ ejercicio: ejercicioNum, mes: mesNum, municipio_id: municipioNum });

  if (!valid.success) {
    return res.status(400).json({ message: "Error en los datos de entrada", errors: zodErrorsToArray(valid.error.issues) });
  }

  if (!Array.isArray(conceptos)) {
    return res.status(400).json({ error: "El campo conceptos debe ser un arreglo" });
  }

  const transaction = await sequelize.transaction();

  try {
    const disponible = await verificarRecaudacionRemuneracionDisponible(
      municipioNum,
      ejercicioNum,
      mesNum
    );
    if (!disponible) {
      await transaction.rollback();
      return res.status(400).json({ error: "El período no está disponible para modificar recaudaciones" });
    }

    const municipio = await Municipio.findByPk(municipioNum, { attributes: ["municipio_id"] });
    if (!municipio) {
      await transaction.rollback();
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    let creados = 0;
    let actualizados = 0;
    let sinCambios = 0;
    const errores = [];

    for (const item of conceptos) {
      const validRecaudacion = RecaudacionSchema.safeParse({
        codigo_tributo: item?.codigo_tributo,
        descripcion: item?.descripcion,
        importe_recaudacion: item?.importe_recaudacion,
        ente_recaudador: item?.ente_recaudador,
      });

      if (!validRecaudacion.success) {
        errores.push(`Error procesando la fila con código ${item?.codigo_tributo ?? "sin código"}: ${zodErrorsToArray(validRecaudacion.error.issues).join(", ")}`);
        continue;
      }

      const payload = validRecaudacion.data;

      const where = {
        recaudaciones_ejercicio: ejercicioNum,
        recaudaciones_mes: mesNum,
        municipio_id: municipioNum,
        codigo_tributo: payload.codigo_tributo,
        ente_recaudador: payload.ente_recaudador,
      };

      const existente = await Recaudacion.findOne({ where, transaction });

      if (!existente) {
        const data = {
          ...where,
          descripcion: payload.descripcion,
          importe_recaudacion: payload.importe_recaudacion,
        };

        await Recaudacion.create({ ...data }, { transaction });
        creados += 1;
        continue;
      }

      let huboCambios = false;

      if (existente.descripcion !== payload.descripcion) {
        existente.descripcion = payload.descripcion;
        huboCambios = true;
      }

      const importeActual = Number(existente.importe_recaudacion);
      const importeNuevo = Number(payload.importe_recaudacion);
      if (!Number.isNaN(importeActual) && !Number.isNaN(importeNuevo) && importeActual !== importeNuevo) {
        existente.importe_recaudacion = payload.importe_recaudacion;
        huboCambios = true;
      }

      if (!huboCambios) {
        sinCambios += 1;
        continue;
      }

      await existente.save({ transaction });
      actualizados += 1;
    }

    await transaction.commit();

    return res.json({
      message: "Recaudaciones procesadas correctamente",
      resumen: {
        creados,
        actualizados,
        sinCambios,
        errores
      },
    });
  } catch (error) {
    await transaction.rollback();
    const esErrorFK =
      error?.name === "SequelizeForeignKeyConstraintError" ||
      error?.parent?.code === "ER_NO_REFERENCED_ROW_2";
    if (esErrorFK) {
      return res.status(400).json({
        error: "No se pudo guardar porque existe una restricción de clave foránea legacy de recaudaciones. Aplicá la migración SQL de hotfix para quitar la FK contra ovif_conceptos_recaudacion.",
      });
    }
    console.error("❌ Error realizando upsert de recaudaciones del municipio:", error);
    return res.status(500).json({ error: "Error guardando los recaudaciones" });
  }
};

export const generarInformeRecaudacionesMunicipio = async (req, res) => {
  const { municipioId, ejercicio, mes } = req.params;

  const municipioNum = Number(municipioId);
  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);

  if ([municipioNum, ejercicioNum, mesNum].some((value) => Number.isNaN(value))) {
    return res
      .status(400)
      .json({ error: "Ejercicio, mes y municipio deben ser numéricos" });
  }

  try {
    const disponible = await verificarRecaudacionRemuneracionDisponible(
      municipioNum,
      ejercicioNum,
      mesNum
    );
    if (!disponible) {
      return res.status(400).json({ error: "El período no está disponible para generar informes" });
    }

    const municipio = await Municipio.findByPk(municipioNum, {
      attributes: ["municipio_id", "municipio_nombre"],
    });

    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const recaudaciones = await Recaudacion.findAll({
      where: {
        recaudaciones_ejercicio: ejercicioNum,
        recaudaciones_mes: mesNum,
        municipio_id: municipioNum,
      },
      order: [["codigo_tributo", "ASC"], ["ente_recaudador", "ASC"]],
    });

    if (!recaudaciones || recaudaciones.length === 0) {
      return responderInformeSinDatos(res);
    }

    const mappedConceptos = recaudaciones
      .map(mapearDetalleRecaudacion)
      .sort((a, b) => {
        if (a.codigo_tributo !== b.codigo_tributo) {
          return a.codigo_tributo - b.codigo_tributo;
        }
        return (a.ente_recaudador ?? "").localeCompare(b.ente_recaudador ?? "");
      });

    const totalesPorCodigo = agruparTotalesRecaudacionesPorCodigo(mappedConceptos);
    const totalImporte = calcularTotalImporteRecaudacion(totalesPorCodigo.map((item) => ({
      importe_recaudacion: item.importe_total_recaudacion,
    })));

    const userRequest = req.user ?? null;
    const user = await Usuario.findOne({where: { usuario_id: userRequest.usuario_id }});

    const ejercicioMes = await EjercicioMes.findOne({where: { ejercicio: ejercicio, mes: mes }});

    const convenio = await Convenio.findOne({where: { convenio_id: ejercicioMes.convenio_id }});

    const buffer = await buildInformeRecaudaciones({
      municipioNombre: municipio.municipio_nombre,
      ejercicio: ejercicioNum,
      mes: mesNum,
      conceptos: mappedConceptos,
      totalesPorCodigo,
      totalImporte,
      usuarioNombre: `${user.nombre} ${user.apellido}`,
      convenioNombre: convenio.nombre
    });

    const nombreMunicipioSlug = (municipio.municipio_nombre || `Municipio_${municipioNum}`)
      .normalize("NFD")
      .replace(/[^0-9a-zA-Z]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || `municipio_${municipioNum}`;

    const fileName = `InformeRecaudaciones_${nombreMunicipioSlug}_${ejercicioNum}_${mesNum}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (error) {
    console.error("❌ Error generando informe de recaudaciones:", error);
    return res.status(500).json({ error: "Error generando el informe de recaudaciones" });
  }
};

export const generarInformeRemuneracionesMunicipio = async (req, res) => {
  const { municipioId, ejercicio, mes } = req.params;

  const municipioNum = Number(municipioId);
  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);

  if ([municipioNum, ejercicioNum, mesNum].some((value) => Number.isNaN(value))) {
    return res
      .status(400)
      .json({ error: "Ejercicio, mes y municipio deben ser numéricos" });
  }

  try {
    const disponible = await verificarRecaudacionRemuneracionDisponible(
      municipioNum,
      ejercicioNum,
      mesNum
    );
    if (!disponible) {
      return res.status(400).json({ error: "El período no está disponible para generar infromes" });
    }

    const municipio = await Municipio.findByPk(municipioNum, {
      attributes: ["municipio_id", "municipio_nombre"],
    });

    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const remuneraciones = await Remuneracion.findAll({
      where: {
        remuneraciones_ejercicio: ejercicioNum,
        remuneraciones_mes: mesNum,
        municipio_id: municipioNum,
      },
    });

    if (!remuneraciones || remuneraciones.length === 0) {
      return responderInformeSinDatos(res);
    }

    const regimenes = await RegimenLaboral.findAll({
      attributes: ["regimen_id", "nombre"],
    });

    const regimenesMap = new Map(
      regimenes.map((regimen) => [Number(regimen.regimen_id), regimen.nombre])
    );

    const remuneracionesPlanas = remuneraciones.map((remuneracion) =>
      mapRemuneracionParaInforme(remuneracion, regimenesMap)
    );

    const regimenesPlanos = Array.from(
      new Set(remuneracionesPlanas.map((item) => item.regimen_laboral))
    )
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
      .map((nombre) => ({ nombre }));

    const userRequest = req.user ?? null;
    const user = await Usuario.findOne({where: { usuario_id: userRequest.usuario_id }});

    const ejercicioMes = await EjercicioMes.findOne({where: { ejercicio: ejercicio, mes: mes }});

    const convenio = await Convenio.findOne({where: { convenio_id: ejercicioMes.convenio_id }});

    const buffer = await buildInformeRemuneraciones({
      municipioNombre: municipio.municipio_nombre,
      ejercicio: ejercicioNum,
      mes: mesNum,
      remuneraciones: remuneracionesPlanas,
      regimenes: regimenesPlanos,
      usuarioNombre: `${user.nombre} ${user.apellido}`,
      convenioNombre: convenio.nombre 
    });

    const nombreMunicipioSlug = (municipio.municipio_nombre || `Municipio_${municipioNum}`)
      .normalize("NFD")
      .replace(/[^0-9a-zA-Z]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || `municipio_${municipioNum}`;

    const fileName = `InformeRemuneraciones_${nombreMunicipioSlug}_${ejercicioNum}_${mesNum}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (error) {
    console.error("❌ Error generando informe de remuneraciones:", error);
    return res.status(500).json({ error: "Error generando el informe de remuneraciones" });
  }
}

const REMUNERACION_CAMPOS_ACTUALIZABLES = [
  ["apellido_nombre", "apellido_nombre", "string"],
  ["categoria", "categoria", "string"],
  ["sector", "sector", "string"],
  ["fecha_ingreso", "fecha_ingreso", "string"],
  ["fecha_inicio_servicio", "fecha_inicio_servicio", "string"],
  ["fecha_fin_servicio", "fecha_fin_servicio", "string"],
  ["basico_cargo_salarial", "basico_cargo_salarial", "number"],
  ["total_remunerativo", "total_remunerativo", "number"],
  ["sac", "sac", "number"],
  ["cant_hs_extra_50", "cant_hs_extra_50", "number"],
  ["importe_hs_extra_50", "importe_hs_extra_50", "number"],
  ["cant_hs_extra_100", "cant_hs_extra_100", "number"],
  ["importe_hs_extra_100", "importe_hs_extra_100", "number"],
  ["total_no_remunerativo", "total_no_remunerativo", "number"],
  ["total_bonos", "total_bonos", "number"],
  ["total_ropa", "total_ropa", "number"],
  ["asignaciones_familiares", "asignaciones_familiares", "number"],
  ["total_descuentos", "total_descuentos", "number"],
  ["total_issn", "total_issn", "number"],
  ["art", "art", "number"],
  ["seguro_vida_obligatorio", "seguro_vida_obligatorio", "number"],
  ["neto_a_cobrar", "total_remuneracion_neta", "number"],
];

const construirRemuneracionParaValidar = (item = {}) => ({
  cuil: item.cuil,
  legajo: item.legajo,
  apellido_nombre: item.apellido_nombre,
  regimen_laboral: item.regimen_laboral,
  categoria: item.categoria,
  sector: item.sector,
  fecha_ingreso: item.fecha_ingreso,
  fecha_inicio_servicio: item.fecha_inicio_servicio,
  fecha_fin_servicio: item.fecha_fin_servicio ?? null,
  basico_cargo_salarial: item.basico_cargo_salarial ?? 0,
  total_remunerativo: item.total_remunerativo ?? 0,
  sac: item.sac ?? 0,
  cant_hs_extra_50: item.cant_hs_extra_50 ?? 0,
  importe_hs_extra_50: item.importe_hs_extra_50 ?? 0,
  cant_hs_extra_100: item.cant_hs_extra_100 ?? 0,
  importe_hs_extra_100: item.importe_hs_extra_100 ?? 0,
  total_no_remunerativo: item.total_no_remunerativo ?? 0,
  total_bonos: item.total_bonos ?? 0,
  total_ropa: item.total_ropa ?? 0,
  asignaciones_familiares: item.asignaciones_familiares ?? 0,
  total_descuentos: item.total_descuentos ?? 0,
  total_issn: item.total_issn ?? 0,
  art: item.art ?? 0,
  seguro_vida_obligatorio: item.seguro_vida_obligatorio ?? 0,
  neto_a_cobrar: item.neto_a_cobrar ?? 0,
});

const validarPayloadRemuneraciones = (remuneraciones) => {
  if (!Array.isArray(remuneraciones)) {
    return {
      rows: [],
      errors: ["El campo remuneraciones debe ser un arreglo"],
    };
  }

  const rows = [];
  const errors = [];
  const clavesPorCuilRegimen = new Set();

  remuneraciones.forEach((item, index) => {
    const validRemuneracion = RemuneracionSchema.safeParse(construirRemuneracionParaValidar(item));

    if (!validRemuneracion.success) {
      errors.push(
        `Error procesando la remuneracion en la fila ${index + 1} con CUIL ${item?.cuil ?? "sin CUIL"}: ${zodErrorsToArray(validRemuneracion.error.issues).join(", ")}`
      );
      return;
    }

    const payload = validRemuneracion.data;
    const clave = `${payload.cuil}::${payload.regimen_laboral.toLocaleLowerCase("es")}`;
    if (clavesPorCuilRegimen.has(clave)) {
      errors.push(`La combinación CUIL ${payload.cuil} y régimen ${payload.regimen_laboral} está duplicada en el archivo`);
      return;
    }

    clavesPorCuilRegimen.add(clave);
    rows.push({ item, payload });
  });

  return { rows, errors };
};

const crearErrorRemuneracion = (statusCode, message, errors = undefined) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.publicErrors = errors;
  return error;
};

const esConflictoRemuneracion = (error) =>
  error?.name === "SequelizeUniqueConstraintError" ||
  error?.parent?.code === "ER_DUP_ENTRY" ||
  error?.parent?.errno === 1062 ||
  error?.parent?.sqlState === "45000" ||
  error?.original?.code === "ER_DUP_ENTRY" ||
  error?.original?.errno === 1062 ||
  error?.original?.sqlState === "45000";

const obtenerMensajeConflictoRemuneracion = (error) =>
  error?.parent?.sqlMessage ||
  error?.original?.sqlMessage ||
  error?.message ||
  "Conflicto guardando remuneraciones";

const procesarUpsertRemuneraciones = async ({
  req,
  res,
  Modelo,
  verificarDisponible,
  mensajePeriodoNoDisponible,
}) => {
  const { ejercicio, mes, municipioId } = req.params;
  const { remuneraciones } = req.body ?? {};

  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);
  const municipioNum = Number(municipioId);

  const valid = EjerciciosSchema.safeParse({ ejercicio: ejercicioNum, mes: mesNum, municipio_id: municipioNum });

  if (!valid.success) {
    return res.status(400).json({ message: "Error en los datos de entrada", errors: zodErrorsToArray(valid.error.issues) });
  }

  const payloadValidado = validarPayloadRemuneraciones(remuneraciones);
  if (payloadValidado.errors.length > 0) {
    return res.status(400).json({ error: "Error en los datos de remuneraciones", errors: payloadValidado.errors });
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();

    const disponible = await verificarDisponible(municipioNum, ejercicioNum, mesNum);
    if (!disponible) {
      await transaction.rollback();
      return res.status(400).json({ error: mensajePeriodoNoDisponible });
    }

    const municipio = await Municipio.findByPk(municipioNum, { attributes: ["municipio_id"] });
    if (!municipio) {
      await transaction.rollback();
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    let creados = 0;
    let actualizados = 0;
    let sinCambios = 0;
    let errores = [];

    for (const { item, payload } of payloadValidado.rows) {
      const where = {
        remuneraciones_ejercicio: ejercicioNum,
        remuneraciones_mes: mesNum,
        municipio_id: municipioNum,
        cuil: payload.cuil,
        regimen_laboral: payload.regimen_laboral,
      };

      const existente = await Modelo.findOne({ where, transaction });

      if (!existente) {
        const data = { 
          ...where,
          legajo: payload.legajo,
          apellido_nombre: payload.apellido_nombre,
          categoria: payload.categoria,
          sector: payload.sector,
          fecha_ingreso: payload.fecha_ingreso,
          fecha_inicio_servicio: payload.fecha_inicio_servicio,
          fecha_fin_servicio: payload.fecha_fin_servicio ?? null,
          basico_cargo_salarial: payload.basico_cargo_salarial,
          total_remunerativo: payload.total_remunerativo,
          sac: payload.sac,
          cant_hs_extra_50: payload.cant_hs_extra_50,
          importe_hs_extra_50: payload.importe_hs_extra_50,
          cant_hs_extra_100: payload.cant_hs_extra_100,
          importe_hs_extra_100: payload.importe_hs_extra_100,
          total_no_remunerativo: payload.total_no_remunerativo,
          total_bonos: payload.total_bonos,
          total_ropa: payload.total_ropa,
          asignaciones_familiares: payload.asignaciones_familiares,
          total_descuentos: payload.total_descuentos,
          total_issn: payload.total_issn,
          art: payload.art,
          seguro_vida_obligatorio: payload.seguro_vida_obligatorio,
          total_remuneracion_neta: payload.neto_a_cobrar,
        };

        await Modelo.create(
          {
            ...data,
          },
          { transaction }
        );
        creados += 1;
        continue;
      }

      if (Number(existente.legajo) !== Number(payload.legajo)) {
        throw crearErrorRemuneracion(
          400,
          `No se permite modificar el legajo para el CUIL ${payload.cuil} y régimen ${payload.regimen_laboral}`
        );
      }

      let huboCambios = false;

      for (const [payloadKey, modelKey, tipo] of REMUNERACION_CAMPOS_ACTUALIZABLES) {
        if (
          Object.prototype.hasOwnProperty.call(item, payloadKey) &&
          !compararValores(existente[modelKey], payload[payloadKey], tipo)
        ) {
          existente[modelKey] = payload[payloadKey];
          huboCambios = true;
        }
      }

      if (!huboCambios) {
        sinCambios += 1;
        continue;
      }

      await existente.save({ transaction });
      actualizados += 1;
    }

    await transaction.commit();

    return res.json({
      message: "Remuneraciones procesadas correctamente",
      resumen: {
        creados,
        actualizados,
        sinCambios,
        errores
      },
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    if (error?.statusCode === 400) {
      return res.status(400).json({
        error: error.message,
        ...(error.publicErrors ? { errors: error.publicErrors } : {}),
      });
    }
    if (esConflictoRemuneracion(error)) {
      return res.status(409).json({ error: obtenerMensajeConflictoRemuneracion(error) });
    }
    console.error("❌ Error realizando upsert de remuneraciones del municipio:", error);
    return res.status(500).json({ error: "Error guardando los remuneraciones" });
  }
};

export const upsertRemuneracionesMunicipio = async (req, res) =>
  procesarUpsertRemuneraciones({
    req,
    res,
    Modelo: Remuneracion,
    verificarDisponible: verificarRecaudacionRemuneracionDisponible,
    mensajePeriodoNoDisponible: "El período no está disponible para modificar remuneraciones",
  });

export const obtenerDeterminacionesTributariasMunicipio = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;

  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);
  const municipioNum = Number(municipioId);

  if ([ejercicioNum, mesNum, municipioNum].some((value) => Number.isNaN(value))) {
    return res.status(400).json({ error: "Ejercicio, mes y municipio deben ser numericos" });
  }

  try {
    const municipio = await Municipio.findByPk(municipioNum, {
      attributes: ["municipio_id"],
    });

    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const determinaciones = await DeterminacionTributaria.findAll({
      where: {
        determinacion_ejercicio: ejercicioNum,
        determinacion_mes: mesNum,
        municipio_id: municipioNum,
      },
      order: [["cod_impuesto", "ASC"]],
    });

    return res.json(determinaciones.map(mapearDetalleDeterminacionTributaria));
  } catch (error) {
    console.error("❌ Error obteniendo determinacion tributaria del municipio:", error);
    return res.status(500).json({ error: "Error obteniendo determinacion tributaria" });
  }
};

export const upsertDeterminacionesTributariasMunicipio = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;
  const { determinaciones } = req.body ?? {};

  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);
  const municipioNum = Number(municipioId);

  const valid = EjerciciosSchema.safeParse({
    ejercicio: ejercicioNum,
    mes: mesNum,
    municipio_id: municipioNum,
  });

  if (!valid.success) {
    return res.status(400).json({
      message: "Error en los datos de entrada",
      errors: zodErrorsToArray(valid.error.issues),
    });
  }

  if (!Array.isArray(determinaciones)) {
    return res.status(400).json({
      error: "El campo determinaciones debe ser un arreglo",
    });
  }

  const transaction = await sequelize.transaction();

  try {
    const disponible = await verificarDeterminacionTributariaDisponible(
      municipioNum,
      ejercicioNum,
      mesNum
    );
    if (!disponible) {
      await transaction.rollback();
      return res.status(400).json({
        error: "El periodo no esta disponible para modificar determinacion tributaria",
      });
    }

    const municipio = await Municipio.findByPk(municipioNum, {
      attributes: ["municipio_id"],
    });
    if (!municipio) {
      await transaction.rollback();
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    let creados = 0;
    let actualizados = 0;
    let sinCambios = 0;
    const errores = [];

    for (const item of determinaciones) {
      const validDeterminacion = DeterminacionTributariaSchema.safeParse({
        cod_impuesto: item?.cod_impuesto,
        descripcion: item?.descripcion,
        anio: item?.anio,
        cuota: item?.cuota,
        liquidadas: item?.liquidadas,
        importe_liquidadas: item?.importe_liquidadas,
        impagas: item?.impagas,
        importe_impagas: item?.importe_impagas,
        pagadas: item?.pagadas,
        importe_pagadas: item?.importe_pagadas,
        altas_periodo: item?.altas_periodo,
        bajas_periodo: item?.bajas_periodo,
      });

      if (!validDeterminacion.success) {
        errores.push(
          `Error procesando la fila con codigo ${item?.cod_impuesto ?? "sin codigo"}: ${zodErrorsToArray(validDeterminacion.error.issues).join(", ")}`
        );
        continue;
      }

      const payload = validDeterminacion.data;
      const where = {
        determinacion_ejercicio: ejercicioNum,
        determinacion_mes: mesNum,
        municipio_id: municipioNum,
        cod_impuesto: payload.cod_impuesto,
      };

      const existente = await DeterminacionTributaria.findOne({
        where,
        transaction,
      });

      if (!existente) {
        await DeterminacionTributaria.create(
          {
            ...where,
            descripcion: payload.descripcion,
            anio: payload.anio,
            cuota: payload.cuota,
            liquidadas: payload.liquidadas,
            importe_liquidadas: payload.importe_liquidadas,
            impagas: payload.impagas,
            importe_impagas: payload.importe_impagas,
            pagadas: payload.pagadas,
            importe_pagadas: payload.importe_pagadas,
            altas_periodo: payload.altas_periodo,
            bajas_periodo: payload.bajas_periodo,
          },
          { transaction }
        );
        creados += 1;
        continue;
      }

      let huboCambios = false;
      const camposString = ["descripcion"];
      const camposNumero = [
        "anio",
        "cuota",
        "liquidadas",
        "importe_liquidadas",
        "impagas",
        "importe_impagas",
        "pagadas",
        "importe_pagadas",
        "altas_periodo",
        "bajas_periodo",
      ];

      for (const campo of camposString) {
        if (!compararValores(existente[campo], payload[campo])) {
          existente[campo] = payload[campo];
          huboCambios = true;
        }
      }

      for (const campo of camposNumero) {
        if (!compararValores(existente[campo], payload[campo], "number")) {
          existente[campo] = payload[campo];
          huboCambios = true;
        }
      }

      if (!huboCambios) {
        sinCambios += 1;
        continue;
      }

      await existente.save({ transaction });
      actualizados += 1;
    }

    await transaction.commit();

    return res.json({
      message: "Determinacion tributaria procesada correctamente",
      resumen: {
        creados,
        actualizados,
        sinCambios,
        errores,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("❌ Error realizando upsert de determinacion tributaria del municipio:", error);
    return res.status(500).json({ error: "Error guardando la determinacion tributaria" });
  }
};

export const generarInformeDeterminacionTributariaMunicipio = async (req, res) => {
  const { municipioId, ejercicio, mes } = req.params;

  const municipioNum = Number(municipioId);
  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);

  if ([municipioNum, ejercicioNum, mesNum].some((value) => Number.isNaN(value))) {
    return res.status(400).json({
      error: "Ejercicio, mes y municipio deben ser numericos",
    });
  }

  try {
    const resultadoPeriodo = await resolverPeriodoRegular({
      municipioId: municipioNum,
      ejercicio: ejercicioNum,
      mes: mesNum,
      tipoPautaCodigo: "determinacion_tributaria",
      fechaReferencia: obtenerFechaActual(),
    });
    if (!resultadoPeriodo.disponible) {
      return res.status(400).json({
        error: "El periodo no esta disponible para generar informes",
      });
    }

    const municipio = await Municipio.findByPk(municipioNum, {
      attributes: ["municipio_id", "municipio_nombre"],
    });

    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const determinaciones = await DeterminacionTributaria.findAll({
      where: {
        determinacion_ejercicio: ejercicioNum,
        determinacion_mes: mesNum,
        municipio_id: municipioNum,
      },
      order: [["cod_impuesto", "ASC"]],
    });

    if (!determinaciones || determinaciones.length === 0) {
      return responderInformeSinDatos(res);
    }

    const detalle = determinaciones.map(mapearDetalleDeterminacionTributaria);
    const resumen = calcularResumenDeterminacionTributaria(detalle);

    const userRequest = req.user ?? null;
    const user = await Usuario.findOne({
      where: { usuario_id: userRequest.usuario_id },
    });

    const convenio = await Convenio.findOne({
      where: { convenio_id: resultadoPeriodo.periodo?.convenio_id },
    });

    const buffer = await buildInformeDeterminacionTributaria({
      municipioNombre: municipio.municipio_nombre,
      ejercicio: ejercicioNum,
      mes: mesNum,
      determinaciones: detalle,
      resumen,
      usuarioNombre: `${user.nombre} ${user.apellido}`,
      convenioNombre: convenio?.nombre ?? "Convenio",
    });

    const nombreMunicipioSlug = (
      municipio.municipio_nombre || `Municipio_${municipioNum}`
    )
      .normalize("NFD")
      .replace(/[^0-9a-zA-Z]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || `municipio_${municipioNum}`;

    const fileName = `InformeDeterminacionTributaria_${nombreMunicipioSlug}_${ejercicioNum}_${mesNum}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (error) {
    console.error("❌ Error generando informe de determinacion tributaria:", error);
    return res.status(500).json({
      error: "Error generando el informe de determinacion tributaria",
    });
  }
};

export const upsertRecaudacionesRectificadasMunicipio = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;
  const { conceptos } = req.body ?? {};

  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);
  const municipioNum = Number(municipioId);

  const valid = EjerciciosSchema.safeParse({ ejercicio: ejercicioNum, mes: mesNum, municipio_id: municipioNum });

  if (!valid.success) {
    return res.status(400).json({ message: "Error en los datos de entrada", errors: zodErrorsToArray(valid.error.issues) });
  }

  if (!Array.isArray(conceptos)) {
    return res.status(400).json({ error: "El campo conceptos debe ser un arreglo" });
  }

  const transaction = await sequelize.transaction();

  try {
    const municipio = await Municipio.findByPk(municipioNum, { attributes: ["municipio_id"] });
    if (!municipio) {
      await transaction.rollback();
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const disponible = await verificarRectificacionDisponible(municipioNum, ejercicioNum, mesNum);
    if (!disponible) {
      await transaction.rollback();
      return res.status(400).json({ error: "La rectificación no está disponible para este ejercicio y mes" });
    }

    let creados = 0;
    let actualizados = 0;
    let sinCambios = 0;
    const errores = [];

    for (const item of conceptos) {
      const validRecaudacion = RecaudacionSchema.safeParse({
        codigo_tributo: item?.codigo_tributo,
        descripcion: item?.descripcion,
        importe_recaudacion: item?.importe_recaudacion,
        ente_recaudador: item?.ente_recaudador,
      });

      if (!validRecaudacion.success) {
        errores.push(`Error procesando la fila con código ${item?.codigo_tributo ?? "sin código"}: ${zodErrorsToArray(validRecaudacion.error.issues).join(", ")}`);
        continue;
      }

      const payload = validRecaudacion.data;

      const where = {
        recaudaciones_ejercicio: ejercicioNum,
        recaudaciones_mes: mesNum,
        municipio_id: municipioNum,
        codigo_tributo: payload.codigo_tributo,
        ente_recaudador: payload.ente_recaudador,
      };

      const existente = await RecaudacionRectificada.findOne({ where, transaction });

      if (!existente) {
        const data = {
          ...where,
          descripcion: payload.descripcion,
          importe_recaudacion: payload.importe_recaudacion,
        };

        await RecaudacionRectificada.create({ ...data }, { transaction });
        creados += 1;
        continue;
      }

      let huboCambios = false;

      if (existente.descripcion !== payload.descripcion) {
        existente.descripcion = payload.descripcion;
        huboCambios = true;
      }

      const importeActual = Number(existente.importe_recaudacion);
      const importeNuevo = Number(payload.importe_recaudacion);
      if (!Number.isNaN(importeActual) && !Number.isNaN(importeNuevo) && importeActual !== importeNuevo) {
        existente.importe_recaudacion = payload.importe_recaudacion;
        huboCambios = true;
      }

      if (!huboCambios) {
        sinCambios += 1;
        continue;
      }

      await existente.save({ transaction });
      actualizados += 1;
    }

    await transaction.commit();

    return res.json({
      message: "Recaudaciones procesadas correctamente",
      resumen: {
        creados,
        actualizados,
        sinCambios,
        errores
      },
    });
  } catch (error) {
    await transaction.rollback();
    const esErrorFK =
      error?.name === "SequelizeForeignKeyConstraintError" ||
      error?.parent?.code === "ER_NO_REFERENCED_ROW_2";
    if (esErrorFK) {
      return res.status(400).json({
        error: "No se pudo guardar porque existe una restricción de clave foránea legacy de recaudaciones rectificadas. Aplicá la migración SQL de hotfix para quitar la FK contra ovif_conceptos_recaudacion.",
      });
    }
    console.error("❌ Error realizando upsert de recaudaciones del municipio:", error);
    return res.status(500).json({ error: "Error guardando los recaudaciones" });
  }
};

export const generarInformeRecaudacionesRectificadasMunicipio = async (req, res) => {
  const { municipioId, ejercicio, mes } = req.params;

  const municipioNum = Number(municipioId);
  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);

  if ([municipioNum, ejercicioNum, mesNum].some((value) => Number.isNaN(value))) {
    return res
      .status(400)
      .json({ error: "Ejercicio, mes y municipio deben ser numéricos" });
  }

  try {
    const disponible = await verificarRectificacionDisponible(municipioNum, ejercicioNum, mesNum);
    if (!disponible) {
      return res.status(400).json({ error: "La rectificación no está disponible para este ejercicio y mes" });
    }

    const municipio = await Municipio.findByPk(municipioNum, {
      attributes: ["municipio_id", "municipio_nombre"],
    });

    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const recaudaciones = await RecaudacionRectificada.findAll({
      where: {
        recaudaciones_ejercicio: ejercicioNum,
        recaudaciones_mes: mesNum,
        municipio_id: municipioNum,
      },
      order: [["codigo_tributo", "ASC"], ["ente_recaudador", "ASC"]],
    });

    if (!recaudaciones || recaudaciones.length === 0) {
      return responderInformeSinDatos(res);
    }

    const mappedConceptos = recaudaciones
      .map(mapearDetalleRecaudacion)
      .sort((a, b) => {
        if (a.codigo_tributo !== b.codigo_tributo) {
          return a.codigo_tributo - b.codigo_tributo;
        }
        return (a.ente_recaudador ?? "").localeCompare(b.ente_recaudador ?? "");
      });

    const totalesPorCodigo = agruparTotalesRecaudacionesPorCodigo(mappedConceptos);
    const totalImporte = calcularTotalImporteRecaudacion(totalesPorCodigo.map((item) => ({
      importe_recaudacion: item.importe_total_recaudacion,
    })));

    const userRequest = req.user ?? null;
    const user = await Usuario.findOne({where: { usuario_id: userRequest.usuario_id }});

    const ejercicioMes = await EjercicioMes.findOne({where: { ejercicio: ejercicio, mes: mes }});

    const convenio = await Convenio.findOne({where: { convenio_id: ejercicioMes.convenio_id }});

    const buffer = await buildInformeRecaudaciones({
      municipioNombre: municipio.municipio_nombre,
      ejercicio: ejercicioNum,
      mes: mesNum,
      conceptos: mappedConceptos,
      totalesPorCodigo,
      totalImporte,
      usuarioNombre: `${user.nombre} ${user.apellido}`,
      convenioNombre: convenio.nombre,
      esRectificacion: true
    });

    const nombreMunicipioSlug = (municipio.municipio_nombre || `Municipio_${municipioNum}`)
      .normalize("NFD")
      .replace(/[^0-9a-zA-Z]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || `municipio_${municipioNum}`;

    const fileName = `InformeRectificacionRecaudaciones_${nombreMunicipioSlug}_${ejercicioNum}_${mesNum}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (error) {
    console.error("❌ Error generando informe de recaudaciones:", error);
    return res.status(500).json({ error: "Error generando el informe de recaudaciones" });
  }
};

export const generarInformeRemuneracionesRectificadasMunicipio = async (req, res) => {
  const { municipioId, ejercicio, mes } = req.params;

  const municipioNum = Number(municipioId);
  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);

  if ([municipioNum, ejercicioNum, mesNum].some((value) => Number.isNaN(value))) {
    return res
      .status(400)
      .json({ error: "Ejercicio, mes y municipio deben ser numéricos" });
  }

  try {
    const disponible = await verificarRectificacionDisponible(municipioNum, ejercicioNum, mesNum);

    if (!disponible) {
      return res.status(400).json({ error: "El período no está disponible para generar infromes" });
    }

    const municipio = await Municipio.findByPk(municipioNum, {
      attributes: ["municipio_id", "municipio_nombre"],
    });

    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const remuneraciones = await RemuneracionRectificada.findAll({
      where: {
        remuneraciones_ejercicio: ejercicioNum,
        remuneraciones_mes: mesNum,
        municipio_id: municipioNum,
      },
    });

    if (!remuneraciones || remuneraciones.length === 0) {
      return responderInformeSinDatos(res);
    }

    const regimenes = await RegimenLaboral.findAll({
      attributes: ["regimen_id", "nombre"],
    });

    const regimenesMap = new Map(
      regimenes.map((regimen) => [Number(regimen.regimen_id), regimen.nombre])
    );

    const remuneracionesPlanas = remuneraciones.map((remuneracion) =>
      mapRemuneracionParaInforme(remuneracion, regimenesMap)
    );

    const regimenesPlanos = Array.from(
      new Set(remuneracionesPlanas.map((item) => item.regimen_laboral))
    )
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
      .map((nombre) => ({ nombre }));

    const userRequest = req.user ?? null;
    const user = await Usuario.findOne({where: { usuario_id: userRequest.usuario_id }});

    const ejercicioMes = await EjercicioMes.findOne({where: { ejercicio: ejercicio, mes: mes }});

    const convenio = await Convenio.findOne({where: { convenio_id: ejercicioMes.convenio_id }});

    const buffer = await buildInformeRemuneraciones({
      municipioNombre: municipio.municipio_nombre,
      ejercicio: ejercicioNum,
      mes: mesNum,
      remuneraciones: remuneracionesPlanas,
      regimenes: regimenesPlanos,
      usuarioNombre: `${user.nombre} ${user.apellido}`,
      convenioNombre: convenio.nombre ,
      esRectificacion: true
    });

    const nombreMunicipioSlug = (municipio.municipio_nombre || `Municipio_${municipioNum}`)
      .normalize("NFD")
      .replace(/[^0-9a-zA-Z]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || `municipio_${municipioNum}`;

    const fileName = `InformeRemuneraciones_${nombreMunicipioSlug}_${ejercicioNum}_${mesNum}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (error) {
    console.error("❌ Error generando informe de remuneraciones:", error);
    return res.status(500).json({ error: "Error generando el informe de remuneraciones" });
  }
}

export const upsertRemuneracionesRectificadasMunicipio = async (req, res) =>
  procesarUpsertRemuneraciones({
    req,
    res,
    Modelo: RemuneracionRectificada,
    verificarDisponible: verificarRectificacionDisponible,
    mensajePeriodoNoDisponible: "El período no está disponible para modificar remuneraciones",
  });

const compararValores = (existente, nuevo, tipo = 'string') => {
  if(tipo === 'string'){
    return existente === nuevo;
  }

  if(tipo === 'number'){
    const numberParsedExistente = Number(existente);
    const numberParsedNuevo = Number(nuevo);

    return !isNaN(numberParsedExistente) && !isNaN(numberParsedNuevo) && numberParsedExistente === numberParsedNuevo;
  }
}

const obtenerFecha = (fechaString) => {
  const [dia, mes, anio] = fechaString.split("/").map(Number);

  const fecha = new Date(anio, mes - 1, dia);

  return fecha
}

const esMunicipioModificable = async (municipioId) => {
  const cierresModulos = await CierreModulo.findOne({ where: { municipio_id: municipioId } });
  if(cierresModulos) return false;

  const ejercicioMesCerrado = await EjercicioMesCerrado.findOne({ where: { municipio_id: municipioId } });
  if(ejercicioMesCerrado) return false;

  const gastos = await Gasto.findOne({ where: { municipio_id: municipioId } });
  if(gastos) return false;

  const recaudaciones = await Recaudacion.findOne({ where: { municipio_id: municipioId } });
  if(recaudaciones) return false;

  const recursos = await Recurso.findOne({ where: { municipio_id: municipioId } });
  if(recursos) return false;

  const remuneraciones = await Remuneracion.findOne({ where: { municipio_id: municipioId } });
  if(remuneraciones) return false;

  const determinacionesTributarias = await DeterminacionTributaria.findOne({
    where: { municipio_id: municipioId },
  });
  if (determinacionesTributarias) return false;

  const usuarioMunicipio = await UsuarioMunicipio.findOne({ where: { municipio_id: municipioId } });
  if(usuarioMunicipio) return false;

  return true;
}

const verificarGastosRecursosDisponibles = async (municipioId, ejercicio, mes) => {
  const resultado = await resolverPeriodoRegular({
    municipioId,
    ejercicio,
    mes,
    tipoPautaCodigo: "gastos_recursos",
    fechaReferencia: obtenerFechaActual(),
  });

  return resultado.disponible;
}

const verificarRecaudacionRemuneracionDisponible = async (
  municipioId,
  ejercicio,
  mes
) => {
  const resultado = await resolverPeriodoRegular({
    municipioId,
    ejercicio,
    mes,
    tipoPautaCodigo: "recaudaciones_remuneraciones",
    fechaReferencia: obtenerFechaActual(),
  });

  return resultado.disponible;
}

const verificarDeterminacionTributariaDisponible = async (
  municipioId,
  ejercicio,
  mes
) => {
  const resultado = await resolverPeriodoRegular({
    municipioId,
    ejercicio,
    mes,
    tipoPautaCodigo: "determinacion_tributaria",
    fechaReferencia: obtenerFechaActual(),
  });

  return resultado.disponible;
}

// ─── Helpers compartidos para controllers de borrado ─────────────────────────

const validarParamsBorrado = (req, res) => {
  const parsed = BorradoParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({
      error: "Parámetros inválidos",
      detalles: parsed.error.issues.map((e) => e.message),
    });
    return null;
  }
  return parsed.data;
};

const manejarResultadoBorrado = (res, result) => {
  if (result.code === "MODULE_CLOSED") {
    return res.status(409).json({ code: result.code, message: result.message });
  }
  return res.status(200).json(result);
};

// ─── Borrado de gastos ────────────────────────────────────────────────────────

export const borrarGastos = async (req, res) => {
  const params = validarParamsBorrado(req, res);
  if (!params) return;

  try {
    const result = await ejecutarBorrado({
      modulo: "GASTOS",
      tipoCarga: "REGULAR",
      tipoPautaCodigo: "gastos_recursos",
      ejercicio: params.ejercicio,
      mes: params.mes,
      municipioId: params.municipioId,
      usuarioId: req.user.usuario_id,
      ip: req.ip,
    });
    return manejarResultadoBorrado(res, result);
  } catch (error) {
    console.error("❌ borrarGastos:", error);
    return res.status(500).json({ error: "Error al borrar gastos" });
  }
};

// ─── Borrado de recursos ──────────────────────────────────────────────────────

export const borrarRecursos = async (req, res) => {
  const params = validarParamsBorrado(req, res);
  if (!params) return;

  try {
    const result = await ejecutarBorrado({
      modulo: "RECURSOS",
      tipoCarga: "REGULAR",
      tipoPautaCodigo: "gastos_recursos",
      ejercicio: params.ejercicio,
      mes: params.mes,
      municipioId: params.municipioId,
      usuarioId: req.user.usuario_id,
      ip: req.ip,
    });
    return manejarResultadoBorrado(res, result);
  } catch (error) {
    console.error("❌ borrarRecursos:", error);
    return res.status(500).json({ error: "Error al borrar recursos" });
  }
};

// ─── Borrado de recaudaciones ─────────────────────────────────────────────────

export const borrarRecaudaciones = async (req, res) => {
  const params = validarParamsBorrado(req, res);
  if (!params) return;

  try {
    const result = await ejecutarBorrado({
      modulo: "RECAUDACIONES",
      tipoCarga: "REGULAR",
      tipoPautaCodigo: "recaudaciones_remuneraciones",
      ejercicio: params.ejercicio,
      mes: params.mes,
      municipioId: params.municipioId,
      usuarioId: req.user.usuario_id,
      ip: req.ip,
    });
    return manejarResultadoBorrado(res, result);
  } catch (error) {
    console.error("❌ borrarRecaudaciones:", error);
    return res.status(500).json({ error: "Error al borrar recaudaciones" });
  }
};

export const borrarRecaudacionesRectificadas = async (req, res) => {
  const params = validarParamsBorrado(req, res);
  if (!params) return;

  try {
    const result = await ejecutarBorrado({
      modulo: "RECAUDACIONES",
      tipoCarga: "RECTIFICACION",
      tipoPautaCodigo: "recaudaciones_remuneraciones",
      ejercicio: params.ejercicio,
      mes: params.mes,
      municipioId: params.municipioId,
      usuarioId: req.user.usuario_id,
      ip: req.ip,
    });
    return manejarResultadoBorrado(res, result);
  } catch (error) {
    console.error("❌ borrarRecaudacionesRectificadas:", error);
    return res.status(500).json({ error: "Error al borrar recaudaciones rectificadas" });
  }
};

// ─── Borrado de remuneraciones ────────────────────────────────────────────────

export const borrarRemuneraciones = async (req, res) => {
  const params = validarParamsBorrado(req, res);
  if (!params) return;

  try {
    const result = await ejecutarBorrado({
      modulo: "REMUNERACIONES",
      tipoCarga: "REGULAR",
      tipoPautaCodigo: "recaudaciones_remuneraciones",
      ejercicio: params.ejercicio,
      mes: params.mes,
      municipioId: params.municipioId,
      usuarioId: req.user.usuario_id,
      ip: req.ip,
    });
    return manejarResultadoBorrado(res, result);
  } catch (error) {
    console.error("❌ borrarRemuneraciones:", error);
    return res.status(500).json({ error: "Error al borrar remuneraciones" });
  }
};

export const borrarRemuneracionesRectificadas = async (req, res) => {
  const params = validarParamsBorrado(req, res);
  if (!params) return;

  try {
    const result = await ejecutarBorrado({
      modulo: "REMUNERACIONES",
      tipoCarga: "RECTIFICACION",
      tipoPautaCodigo: "recaudaciones_remuneraciones",
      ejercicio: params.ejercicio,
      mes: params.mes,
      municipioId: params.municipioId,
      usuarioId: req.user.usuario_id,
      ip: req.ip,
    });
    return manejarResultadoBorrado(res, result);
  } catch (error) {
    console.error("❌ borrarRemuneracionesRectificadas:", error);
    return res.status(500).json({ error: "Error al borrar remuneraciones rectificadas" });
  }
};

// ─── Borrado de determinación tributaria ─────────────────────────────────────

export const borrarDeterminaciones = async (req, res) => {
  const params = validarParamsBorrado(req, res);
  if (!params) return;

  try {
    const result = await ejecutarBorrado({
      modulo: "DETERMINACION_TRIBUTARIA",
      tipoCarga: "REGULAR",
      tipoPautaCodigo: "determinacion_tributaria",
      ejercicio: params.ejercicio,
      mes: params.mes,
      municipioId: params.municipioId,
      usuarioId: req.user.usuario_id,
      ip: req.ip,
    });
    return manejarResultadoBorrado(res, result);
  } catch (error) {
    console.error("❌ borrarDeterminaciones:", error);
    return res.status(500).json({ error: "Error al borrar determinaciones tributarias" });
  }
};
