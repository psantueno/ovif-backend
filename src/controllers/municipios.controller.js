// Modelo
import { Municipio, EjercicioMes, ProrrogaMunicipio, AuditoriaProrrogaMunicipio, Gasto, PartidaGasto, PartidaRecurso, Recurso, Convenio, PautaConvenio, ConceptoRecaudacion, Recaudacion, RegimenLaboral, SituacionRevista, TipoGasto, Remuneracion, Usuario, Archivo, CierreModulo, EjercicioMesCerrado, Poblacion, UsuarioMunicipio, RecaudacionRectificada, RemuneracionRectificada } from "../models/index.js";
import { buildInformeGastos } from "../utils/pdf/municipioGastos.js";
import { buildInformeRecursos } from "../utils/pdf/municipioRecursos.js";
import { buildInformeRecaudaciones } from "../utils/pdf/municipioRecaudaciones.js";
import { buildInformeRemuneraciones } from "../utils/pdf/municipioRemuneraciones.js";
import { Op } from "sequelize";
import { GastosSchema } from "../validation/GastosSchema.validation.js";
import { RecursosSchema } from "../validation/RecursosSchema.validation.js";
import { RecaudacionSchema } from "../validation/RecaudacionSchema.validation.js";
import { RemuneracionSchema } from "../validation/RemuneracionSchema.validation.js";
import { EjerciciosSchema } from "../validation/EjerciciosSchema.validation.js";
import { zodErrorsToArray } from "../utils/zodErrorMessages.js";
import { MunicipiosSchema } from "../validation/MunicipiosSchema.validation.js";

const toISODate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
};

const buildCalendarioKey = (ejercicio, mes, convenioId, pautaId) =>
  `${ejercicio}-${mes}-${convenioId ?? "null"}-${pautaId ?? "null"}`;

const construirJerarquiaPartidas = async (municipioId, ejercicio, mes) => {
  const [partidas, gastosGuardados] = await Promise.all([
    PartidaGasto.findAll({
      order: [
        ["partidas_gastos_padre", "ASC"],
        ["partidas_gastos_codigo", "ASC"],
      ],
    }),
    Gasto.findAll({
      where: {
        gastos_ejercicio: ejercicio,
        gastos_mes: mes,
        municipio_id: municipioId,
      },
    }),
  ]);

  const gastosMap = new Map();
  gastosGuardados.forEach((gasto) => {
    const importe = gasto.gastos_importe_devengado;
    gastosMap.set(
      gasto.partidas_gastos_codigo,
      importe === null ? null : importe
    );
  });

  const partidasMap = new Map();
  partidas.forEach((partida) => {
    const codigo = partida.partidas_gastos_codigo;
    partidasMap.set(codigo, {
      ...partida.toJSON(),
      partidas_gastos_padre_descripcion: null,
      puede_cargar: Boolean(partida.partidas_gastos_carga),
      importe_devengado: gastosMap.has(codigo) ? gastosMap.get(codigo) : null,
      children: [],
    });
  });

  const jerarquia = [];

  partidasMap.forEach((partida) => {
    const parentId = partida.partidas_gastos_padre;
    const esRaiz =
      parentId === null ||
      parentId === undefined ||
      parentId === 0 ||
      parentId === partida.partidas_gastos_codigo ||
      !partidasMap.has(parentId);

    if (esRaiz) {
      jerarquia.push(partida);
      return;
    }

    const padre = partidasMap.get(parentId);
    if (padre) {
      partida.partidas_gastos_padre_descripcion = padre.partidas_gastos_descripcion;
      padre.children.push(partida);
    } else {
      jerarquia.push(partida);
    }
  });

  return { jerarquia, gastosGuardados };
};

const aplanarJerarquiaPartidas = (nodos, nivel = 0) => {
  const resultado = [];

  nodos.forEach((nodo) => {
    resultado.push({
      codigo: nodo.partidas_gastos_codigo,
      descripcion: nodo.partidas_gastos_descripcion,
      nivel,
      puedeCargar: nodo.puede_cargar,
      importe: nodo.importe_devengado,
    });

    if (Array.isArray(nodo.children) && nodo.children.length > 0) {
      resultado.push(...aplanarJerarquiaPartidas(nodo.children, nivel + 1));
    }
  });

  return resultado;
};

const construirJerarquiaPartidasRecursos = async (municipioId, ejercicio, mes) => {
  const [partidas, recursosGuardados] = await Promise.all([
    PartidaRecurso.findAll({
      order: [
        ["partidas_recursos_padre", "ASC"],
        ["partidas_recursos_codigo", "ASC"],
      ],
    }),
    Recurso.findAll({
      where: {
        recursos_ejercicio: ejercicio,
        recursos_mes: mes,
        municipio_id: municipioId,
      },
    }),
  ]);

  const recursosMap = new Map();
  recursosGuardados.forEach((recurso) => {
    const importe = recurso.recursos_importe_percibido;
    const contribuyentes = recurso.recursos_cantidad_contribuyentes;
    const pagaron = recurso.recursos_cantidad_pagaron;

    recursosMap.set(recurso.partidas_recursos_codigo, {
      importe: importe === null ? null : importe,
      contribuyentes:
        contribuyentes === null || contribuyentes === undefined
          ? null
          : Number(contribuyentes),
      pagaron:
        pagaron === null || pagaron === undefined ? null : Number(pagaron),
    });
  });

  const partidasMap = new Map();
  partidas.forEach((partida) => {
    const codigo = partida.partidas_recursos_codigo;
    const valoresGuardados = recursosMap.get(codigo);

    partidasMap.set(codigo, {
      ...partida.toJSON(),
      partidas_recursos_padre_descripcion: null,
      puede_cargar: Boolean(partida.partidas_recursos_carga),
      es_sin_liquidacion: Boolean(partida.partidas_recursos_sl),
      recursos_importe_percibido: valoresGuardados?.importe ?? null,
      recursos_cantidad_contribuyentes: valoresGuardados?.contribuyentes ?? null,
      recursos_cantidad_pagaron: valoresGuardados?.pagaron ?? null,
      children: [],
    });
  });

  const jerarquia = [];

  partidasMap.forEach((partida) => {
    const parentId = partida.partidas_recursos_padre;
    const esRaiz =
      parentId === null ||
      parentId === undefined ||
      parentId === 0 ||
      parentId === partida.partidas_recursos_codigo ||
      !partidasMap.has(parentId);

    if (esRaiz) {
      jerarquia.push(partida);
      return;
    }

    const padre = partidasMap.get(parentId);
    if (padre) {
      partida.partidas_recursos_padre_descripcion = padre.partidas_recursos_descripcion;
      padre.children.push(partida);
    } else {
      jerarquia.push(partida);
    }
  });

  return { jerarquia, recursosGuardados };
};

const aplanarJerarquiaPartidasRecursos = (nodos, nivel = 0) => {
  const resultado = [];

  nodos.forEach((nodo) => {
    resultado.push({
      codigo: nodo.partidas_recursos_codigo,
      descripcion: nodo.partidas_recursos_descripcion,
      nivel,
      puedeCargar: nodo.puede_cargar,
      esSinLiquidacion: nodo.es_sin_liquidacion,
      importePercibido: nodo.recursos_importe_percibido,
      totalContribuyentes: nodo.recursos_cantidad_contribuyentes,
      contribuyentesPagaron: nodo.recursos_cantidad_pagaron,
    });

    if (Array.isArray(nodo.children) && nodo.children.length > 0) {
      resultado.push(...aplanarJerarquiaPartidasRecursos(nodo.children, nivel + 1));
    }
  });

  return resultado;
};

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
        const modificable = await esMunicipioModificable(m.municipio_id);

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

    res.json({
      total: count,
      pagina: paginaFinal,
      limite: limiteFinal,
      totalPaginas,
      data: municipiosPlanos,
    });
  } catch (error) {
    console.error("❌ Error consultando municipios:", error);
    res.status(500).json({ error: "Error consultando municipios" });
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

    const ejercicios = await EjercicioMes.findAll({
      order: [
        ["ejercicio", "ASC"],
        ["mes", "ASC"],
      ],
    });

    const convenioIds = new Set();
    const pautaIds = new Set();
    ejercicios.forEach((em) => {
      if (em.convenio_id) convenioIds.add(em.convenio_id);
      if (em.pauta_id) pautaIds.add(em.pauta_id);
    });

    if (ejercicios.length === 0) {
      return res.json({
        municipio: municipio.get(),
        ejercicios: [],
      });
    }

    const prorrogas = await ProrrogaMunicipio.findAll({
      where: { municipio_id: municipioId },
    });
    prorrogas.forEach((p) => {
      if (p.convenio_id) convenioIds.add(p.convenio_id);
      if (p.pauta_id) pautaIds.add(p.pauta_id);
    });

    const prorrogaMap = new Map(
      prorrogas.map((p) => [
        buildCalendarioKey(p.ejercicio, p.mes, p.convenio_id, p.pauta_id),
        p,
      ])
    );

    const [convenios, pautas] = await Promise.all([
      convenioIds.size
        ? Convenio.findAll({ where: { convenio_id: [...convenioIds] } })
        : [],
      pautaIds.size
        ? PautaConvenio.findAll({ where: { pauta_id: [...pautaIds] } })
        : [],
    ]);

    const convenioMap = new Map(convenios.map((c) => [c.convenio_id, c]));
    const pautaMap = new Map(pautas.map((p) => [p.pauta_id, p]));

    const hoy = toISODate(new Date());
    const disponibles = ejercicios
      .map((em) => {
        const key = buildCalendarioKey(em.ejercicio, em.mes, em.convenio_id, em.pauta_id);
        const prorroga = prorrogaMap.get(key);
        const resolvedConvenioId = prorroga?.convenio_id ?? em.convenio_id ?? null;
        const resolvedPautaId = prorroga?.pauta_id ?? em.pauta_id ?? null;
        const convenio = resolvedConvenioId ? convenioMap.get(resolvedConvenioId) : null;
        const pauta = resolvedPautaId ? pautaMap.get(resolvedPautaId) : null;

        const fechaInicio = em.fecha_inicio;
        const fechaFin = prorroga?.fecha_fin_nueva || em.fecha_fin;

        const fechaFinStr = toISODate(fechaFin);

        const vencido = fechaFinStr ? hoy > fechaFinStr : false;
        const disponible = !vencido;

        return {
          ejercicio: em.ejercicio,
          mes: em.mes,
          fecha_inicio: toISODate(fechaInicio),
          fecha_fin: fechaFinStr,
          fecha_fin_oficial: toISODate(em.fecha_fin),
          tiene_prorroga: Boolean(prorroga),
          fecha_fin_prorroga: toISODate(prorroga?.fecha_fin_nueva) ?? null,
          convenio_id: resolvedConvenioId,
          pauta_id: resolvedPautaId,
          convenio_nombre: convenio?.nombre ?? null,
          pauta_descripcion: pauta?.descripcion ?? null,
          tipo_pauta: pauta?.tipo_pauta ?? null,
          fecha_cierre: fechaFinStr,
          vencido,
          cerrado: false,
          disponible,
        };
      })
      .filter((item) => item.disponible);

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

    const conveniosActivos = await Convenio.findAll(
      { 
        where: { fecha_fin: { [Op.gt]: new Date() } }
      }
    );
    const conveniosActivosIds = conveniosActivos.map(c => c.convenio_id);
    const conveniosMap = conveniosActivos.map(c => ({
      convenio_id: c.convenio_id,
      nombre: c.nombre
    }));

    const pautasRectificables = await PautaConvenio.findAll({
      where: {
        [Op.and]: [
          {
            cant_dias_rectifica: {
              [Op.ne]: null,
              [Op.ne]: 0
            }
          },
          {
            plazo_mes_rectifica: {
              [Op.ne]: null,
              [Op.ne]: 0
            }
          },
          {
            convenio_id: {
              [Op.in]: conveniosActivosIds
            }
          }
        ]
      },
    });
    const pautasRectificablesIds = pautasRectificables.map(p => p.pauta_id);
    const pautasMap = pautasRectificables.map(p => ({
      pauta_id: p.pauta_id,
      descripcion: p.descripcion,
      cant_dias_rectifica: p.cant_dias_rectifica,
      plazo_mes_rectifica: p.plazo_mes_rectifica,
      tipo_pauta: p.tipo_pauta
    }))

    const ejercicioMesRectificables = await EjercicioMes.findAll({
      where: {
        pauta_id: {
          [Op.in]: pautasRectificablesIds
        },
        fecha_fin: {
          [Op.lt]: new Date()
        },
      }
    });

    if (ejercicioMesRectificables.length === 0) {
      return res.json({
        municipio: municipio.get(),
        ejercicios: [],
      });
    }

    const disponibles = ejercicioMesRectificables.map((em) => {
        const pauta = pautasMap.find(p => p.pauta_id === em.pauta_id);
        const convenio = conveniosMap.find(c => c.convenio_id === em.convenio_id);

        const disponible = verificarPeriodoRectificacionDisponible(em.fecha_fin, pauta.plazo_mes_rectifica, pauta.cant_dias_rectifica);
        const fechaCierreRectificacion = obtenerFechaCierrerectificacion(em.fecha_fin, pauta.plazo_mes_rectifica, pauta.cant_dias_rectifica);
        return {
          ejercicio: em.ejercicio,
          mes: em.mes,
          fecha_inicio: toISODate(em.fecha_inicio),
          fecha_fin: toISODate(em.fecha_fin),
          convenio_id: em.convenio_id,
          pauta_id: em.pauta_id,
          convenio_nombre: convenio?.nombre ?? null,
          pauta_descripcion: pauta?.descripcion ?? null,
          tipo_pauta: pauta?.tipo_pauta ?? null,
          fecha_cierre: toISODate(fechaCierreRectificacion),
          vencido: !disponible,
          cerrado: false,
          disponible,
        };
    }).filter(item => item.disponible);

    return res.json({
      municipio: municipio.get(),
      ejercicios: disponibles,
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

    // 2️⃣ Obtener la fecha actual automáticamente
    const hoy = toISODate(new Date());

    // 3️⃣ Buscar TODOS los ejercicios/mes donde fecha_fin < hoy (VENCIDOS)
    const oficiales = await EjercicioMes.findAll({
      where: {
        fecha_fin: { [Op.lt]: new Date(hoy) }, // fecha_fin menor a hoy
      },
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

    const { jerarquia } = await construirJerarquiaPartidas(municipioNum, ejercicioNum, mesNum);

    return res.json(jerarquia);
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

    const { jerarquia } = await construirJerarquiaPartidasRecursos(
      municipioNum,
      ejercicioNum,
      mesNum
    );

    return res.json(jerarquia);
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

  const hoy = toISODate(new Date());
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
      where: { ejercicio, mes },
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

  const sequelize = Gasto.sequelize;
  const transaction = await sequelize.transaction();

  try {
    const disponible = await verificarGastosRecursosDisponibles(ejercicioNum, mesNum);
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

    for (const item of partidas) {
      try{
        const codigo = Number(item?.partidas_gastos_codigo);

        const partidaGasto = await PartidaGasto.findOne({ where: { partidas_gastos_codigo: codigo } });

        if (!partidaGasto) {
          errores.push(`La partida con código ${item?.partidas_gastos_codigo} no existe en el catálogo de partidas de gastos.`);
          continue;
        }

        if(partidaGasto && !partidaGasto.partidas_gastos_carga){
          errores.push(`La partida con código ${item?.partidas_gastos_codigo} no permite carga de gastos.`);
          continue;
        }

        const tieneImporte = Object.prototype.hasOwnProperty.call(item, "gastos_importe_devengado");
        const importeValor = item?.gastos_importe_devengado;
        let importeParsed;

        if (tieneImporte) {
          const normalizado = importeValor === null || importeValor === "" ? 0 : importeValor;
          importeParsed = Number(normalizado);
        }
        const validGasto = GastosSchema.safeParse({
          partidas_gastos_codigo: codigo,
          gastos_importe_devengado: importeParsed,
        });

        if (!validGasto.success) {
          errores.push(`Error procesando la partida con código ${item?.partidas_gastos_codigo}: ${zodErrorsToArray(validGasto.error.issues).join(", ")}`);
          continue;
        }

        const where = {
          gastos_ejercicio: ejercicioNum,
          gastos_mes: mesNum,
          municipio_id: municipioNum,
          partidas_gastos_codigo: codigo,
        };

        const existente = await Gasto.findOne({ where, transaction });

        if (!existente) {
          await Gasto.create(
            {
              ...where,
              gastos_importe_devengado: importeParsed,
            },
            { transaction }
          );
          creados += 1;
          continue;
        }

        if (!tieneImporte) {
          sinCambios += 1;
          continue;
        }

        const importeActual = Number(existente.gastos_importe_devengado);
        if (!Number.isNaN(importeActual) && importeActual === importeParsed) {
          sinCambios += 1;
          continue;
        }

        await existente.update(
          {
            gastos_importe_devengado: importeParsed,
          },
          { transaction }
        );

        actualizados += 1;
      } catch (error) {
        errores.push(`Error procesando partida ${item?.partidas_gastos_codigo}: ${error.message}`);
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

  const sequelize = Recurso.sequelize;
  const transaction = await sequelize.transaction();

  try {
    const disponible = await verificarGastosRecursosDisponibles(ejercicioNum, mesNum);
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

    for (const item of partidas) {
      const tieneImporte = Object.prototype.hasOwnProperty.call(item, "recursos_importe_percibido");
      const tieneContribuyentes = item?.recursos_cantidad_contribuyentes !== undefined;
      const tienePagaron = item?.recursos_cantidad_pagaron !== undefined;

      const validRecurso = RecursosSchema.safeParse({
        partidas_recursos_codigo: item?.partidas_recursos_codigo,
        recursos_importe_percibido: item?.recursos_importe_percibido,
        recursos_cantidad_contribuyentes: item?.recursos_cantidad_contribuyentes,
        recursos_cantidad_pagaron: item?.recursos_cantidad_pagaron,
      });

      if (!validRecurso.success) {
        errores.push(`Error procesando la partida con código ${item?.partidas_recursos_codigo}: ${zodErrorsToArray(validRecurso.error.issues).join(", ")}`);
        continue;
      }

      const codigo = Number(item?.partidas_recursos_codigo);

      const partidaRecurso = await PartidaRecurso.findOne({ where: { partidas_recursos_codigo: codigo } });
      if (!partidaRecurso) {
        errores.push(`La partida con código ${item?.partidas_recursos_codigo} no existe en el catálogo de partidas de recursos.`);
        continue;
      }

      if(partidaRecurso && !partidaRecurso.partidas_recursos_carga){
        errores.push(`La partida con código ${item?.partidas_recursos_codigo} no permite carga de recursos.`);
        continue;
      }

      const cargaContribuyentes = !partidaRecurso.partidas_recursos_sl;

      const where = {
        recursos_ejercicio: ejercicioNum,
        recursos_mes: mesNum,
        municipio_id: municipioNum,
        partidas_recursos_codigo: codigo,
      };

      const existente = await Recurso.findOne({ where, transaction });

      if (!existente) {
        const data = { ...where, recursos_importe_percibido: item.recursos_importe_percibido, recursos_cantidad_contribuyentes: 0, recursos_cantidad_pagaron: 0 };

        if(cargaContribuyentes){
          data.recursos_cantidad_contribuyentes = item.recursos_cantidad_contribuyentes ?? 0;
          data.recursos_cantidad_pagaron = item.recursos_cantidad_pagaron ?? 0;
        }

        await Recurso.create(
          {
            ...data,
          },
          { transaction }
        );
        creados += 1;
        continue;
      }

      let huboCambios = false;

      if (tieneImporte) {
        const importeActual = Number(existente.recursos_importe_percibido);
        if (!Number.isNaN(importeActual) && importeActual !== item.recursos_importe_percibido) {
          existente.recursos_importe_percibido = item.recursos_importe_percibido;
          huboCambios = true;
        }
      }

      if (tieneContribuyentes && cargaContribuyentes) {
        const contribuyentesActual = Number(existente.recursos_cantidad_contribuyentes);
        if (!Number.isNaN(contribuyentesActual) && contribuyentesActual !== item.recursos_cantidad_contribuyentes) {
          existente.recursos_cantidad_contribuyentes = item.recursos_cantidad_contribuyentes ?? 0;
          huboCambios = true;
        }
      }

      if (tienePagaron && cargaContribuyentes) {
        const pagaronActual = Number(existente.recursos_cantidad_pagaron);
        if (!Number.isNaN(pagaronActual) && pagaronActual !== item.recursos_cantidad_pagaron) {
          existente.recursos_cantidad_pagaron = item.recursos_cantidad_pagaron ?? 0;
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
      message: "Recursos procesados correctamente",
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
    const disponible = await verificarGastosRecursosDisponibles(ejercicioNum, mesNum);
    if (!disponible) {
      return res.status(400).json({ error: "El período no está disponible para generar informes" });
    }

    const municipio = await Municipio.findByPk(municipioNum, {
      attributes: ["municipio_id", "municipio_nombre"],
    });

    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const { jerarquia, gastosGuardados } = await construirJerarquiaPartidas(
      municipioNum,
      ejercicioNum,
      mesNum
    );

    if (!gastosGuardados || gastosGuardados.length === 0) {
      return res.status(404).json({ error: "No hay datos guardados para generar el informe" });
    }

    const partidasPlanas = aplanarJerarquiaPartidas(jerarquia);

    const totalImporte = partidasPlanas.reduce((acumulado, partida) => {
      if (!partida.puedeCargar) {
        return acumulado;
      }

      if (partida.importe === null || partida.importe === undefined) {
        return acumulado;
      }

      const importeNumerico = Number(partida.importe);
      if (!Number.isFinite(importeNumerico)) {
        return acumulado;
      }

      return acumulado + importeNumerico;
    }, 0);

    const userRequest = req.user ?? null;
    const user = await Usuario.findOne({where: { usuario_id: userRequest.usuario_id }});

    const ejercicioMes = await EjercicioMes.findOne({where: { ejercicio: ejercicio, mes: mes }});

    const convenio = await Convenio.findOne({where: { convenio_id: ejercicioMes.convenio_id }});

    const buffer = await buildInformeGastos({
      municipioNombre: municipio.municipio_nombre,
      ejercicio: ejercicioNum,
      mes: mesNum,
      partidas: partidasPlanas,
      totalImporte,
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
    const disponible = await verificarGastosRecursosDisponibles(ejercicioNum, mesNum);
    if (!disponible) {
      return res.status(400).json({ error: "El período no está disponible para generar informes" });
    }

    const municipio = await Municipio.findByPk(municipioNum, {
      attributes: ["municipio_id", "municipio_nombre"],
    });

    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const { jerarquia, recursosGuardados } = await construirJerarquiaPartidasRecursos(
      municipioNum,
      ejercicioNum,
      mesNum
    );

    if (!recursosGuardados || recursosGuardados.length === 0) {
      return res.status(404).json({ error: "No hay datos guardados para generar el informe" });
    }

    const partidasPlanas = aplanarJerarquiaPartidasRecursos(jerarquia);

    const totalImporte = partidasPlanas.reduce((acumulado, partida) => {
      if (!partida.puedeCargar) {
        return acumulado;
      }

      if (partida.importePercibido === null || partida.importePercibido === undefined) {
        return acumulado;
      }

      const importeNumerico = Number(partida.importePercibido);
      if (!Number.isFinite(importeNumerico)) {
        return acumulado;
      }

      return acumulado + importeNumerico;
    }, 0);

    const userRequest = req.user ?? null;
    const user = await Usuario.findOne({where: { usuario_id: userRequest.usuario_id }});

    const ejercicioMes = await EjercicioMes.findOne({where: { ejercicio: ejercicio, mes: mes }});

    const convenio = await Convenio.findOne({where: { convenio_id: ejercicioMes.convenio_id }});

    const buffer = await buildInformeRecursos({
      municipioNombre: municipio.municipio_nombre,
      ejercicio: ejercicioNum,
      mes: mesNum,
      partidas: partidasPlanas,
      totalImporte,
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

    const conceptos = await ConceptoRecaudacion.findAll();

    const conceptosCargados = await Recaudacion.findAll({
      where: {
        recaudaciones_ejercicio: ejercicioNum,
        recaudaciones_mes: mesNum,
        municipio_id: municipioNum,
      },
    });

    const conceptosCargadosMap = conceptos.map((concepto) => {
      const recaudacion = conceptosCargados.find((recaudacionItem) =>
        recaudacionItem.cod_concepto === concepto.cod_concepto
      );
      return {
        ...concepto.get(),
        importe_recaudacion: recaudacion ? recaudacion.importe_recaudacion: null,
      };
    });

    return res.json(conceptosCargadosMap);
  } catch (error) {
    console.error("❌ Error obteniendo partidas de gastos del municipio:", error);
    return res.status(500).json({ error: "Error obteniendo partidas de gastos" });
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

  const sequelize = Recurso.sequelize;
  const transaction = await sequelize.transaction();

  try {
    const disponible = await verificarRecaudacionRemuneracionDisponible(ejercicioNum, mesNum);
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
    let errores = [];

    for (const item of conceptos) {
      const tieneImporte = Object.prototype.hasOwnProperty.call(item, "importe_recaudacion");

      const validRecurso = RecaudacionSchema.safeParse({
        cod_concepto: item?.cod_concepto,
        importe_recaudacion: item?.importe_recaudacion,
      });

      if (!validRecurso.success) {
        errores.push(`Error procesando el concepto con código ${item?.cod_concepto}: ${zodErrorsToArray(validRecurso.error.issues).join(", ")}`);
        continue;
      }

      const codigo = Number(item?.cod_concepto);

      const concepto = await ConceptoRecaudacion.findOne({ where: { cod_concepto: codigo } });

      if (!concepto) {
        errores.push(`El concepto con código ${codigo} no existe`);
        continue;
      }

      const where = {
        recaudaciones_ejercicio: ejercicioNum,
        recaudaciones_mes: mesNum,
        municipio_id: municipioNum,
        cod_concepto: concepto.cod_concepto,
      };

      const existente = await Recaudacion.findOne({ where, transaction });

      if (!existente) {
        const data = { ...where, importe_recaudacion: item.importe_recaudacion};

        await Recaudacion.create(
          {
            ...data,
          },
          { transaction }
        );
        creados += 1;
        continue;
      }

      let huboCambios = false;

      if (tieneImporte) {
        const importeActual = Number(existente.importe_recaudacion);
        if (!Number.isNaN(importeActual) && importeActual !== item.importe_recaudacion) {
          existente.importe_recaudacion = item.importe_recaudacion;
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
    const disponible = await verificarRecaudacionRemuneracionDisponible(ejercicioNum, mesNum);
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
    });

    if (!recaudaciones || recaudaciones.length === 0) {
      return res.status(404).json({ error: "No hay datos guardados para generar el informe" });
    }

    const conceptos = await ConceptoRecaudacion.findAll();

    const mappedConceptos = conceptos.map((concepto) => {
      const recaudacion = recaudaciones.find(rec => rec.cod_concepto === concepto.cod_concepto);
      const importeRecaudacion = recaudacion ? recaudacion.importe_recaudacion : null;

      return {
        cod_concepto: concepto.cod_concepto,
        descripcion: concepto.descripcion,
        importe_recaudacion: importeRecaudacion
      }
    })

    const totalImporte = mappedConceptos.reduce((acumulado, recaudacion) => {
      if (recaudacion.importe_recaudacion === null || recaudacion.importe_recaudacion === undefined) {
        return acumulado;
      }

      const importeNumerico = Number(recaudacion.importe_recaudacion);
      if (!Number.isFinite(importeNumerico)) {
        return acumulado;
      }

      return acumulado + importeNumerico;
    }, 0);

    const userRequest = req.user ?? null;
    const user = await Usuario.findOne({where: { usuario_id: userRequest.usuario_id }});

    const ejercicioMes = await EjercicioMes.findOne({where: { ejercicio: ejercicio, mes: mes }});

    const convenio = await Convenio.findOne({where: { convenio_id: ejercicioMes.convenio_id }});

    const buffer = await buildInformeRecaudaciones({
      municipioNombre: municipio.municipio_nombre,
      ejercicio: ejercicioNum,
      mes: mesNum,
      conceptos: mappedConceptos,
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
    const disponible = await verificarRecaudacionRemuneracionDisponible(ejercicioNum, mesNum);
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
      return res.status(404).json({ error: "No hay datos guardados para generar el informe" });
    }

    const situacionesRevista = await SituacionRevista.findAll();

    const tipoLiquidaciones = await TipoGasto.findAll();

    const regimenes = await RegimenLaboral.findAll();

    const regimenesPlanos = regimenes.map((regimen) => ({
      nombre: regimen.nombre
    }))

    const remuneracionesPlanas = remuneraciones.map((remuneracion) => ({
      cuil: remuneracion.cuil,
      apellido_nombre: remuneracion.apellido_nombre,
      legajo: remuneracion.legajo,
      fecha_alta: remuneracion.fecha_alta,
      remuneracion_neta: remuneracion.remuneracion_neta,
      bonificacion: remuneracion.bonificacion,
      cant_hs_extra_50: remuneracion.cant_hs_extra_50,
      importe_hs_extra_50: remuneracion.importe_hs_extra_50,
      cant_hs_extra_100: remuneracion.cant_hs_extra_100,
      importe_hs_extra_100: remuneracion.importe_hs_extra_100,
      art: remuneracion.art,
      seguro_vida: remuneracion.seguro_vida,
      otros_conceptos: remuneracion.otros_conceptos,
      situacion_revista: situacionesRevista.find((sr) => sr.situacion_revista_id === remuneracion.situacion_revista_id)?.nombre ?? 'Sin especificar',
      tipo_liquidacion: tipoLiquidaciones.find((tl) => tl.tipo_gasto_id === remuneracion.tipo_liquidacion)?.descripcion ?? 'Sin especificar',
      regimen: regimenes.find((r) => r.regimen_id === remuneracion.regimen_id)?.nombre ?? 'Sin especificar'

    }));

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

export const upsertRemuneracionesMunicipio = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;
  const { remuneraciones } = req.body ?? {};

  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);
  const municipioNum = Number(municipioId);

  const valid = EjerciciosSchema.safeParse({ ejercicio: ejercicioNum, mes: mesNum, municipio_id: municipioNum });

  if (!valid.success) {
    return res.status(400).json({ message: "Error en los datos de entrada", errors: zodErrorsToArray(valid.error.issues) });
  }

  const sequelize = Recurso.sequelize;
  const transaction = await sequelize.transaction();

  try {
    const disponible = await verificarRecaudacionRemuneracionDisponible(ejercicioNum, mesNum);
    if (!disponible) {
      await transaction.rollback();
      return res.status(400).json({ error: "El período no está disponible para modificar remuneraciones" });
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

    for (const item of remuneraciones) {
      const validRecurso = RemuneracionSchema.safeParse({
        cuil: item?.cuil,
        remuneracion_neta: item?.remuneracion_neta,
        bonificacion: item?.bonificacion,
        cant_hs_extra_50: item?.cant_hs_extra_50,
        importe_hs_extra_50: item?.importe_hs_extra_50,
        cant_hs_extra_100: item?.cant_hs_extra_100,
        importe_hs_extra_100: item?.importe_hs_extra_100,
        art: item?.art,
        seguro_vida: item?.seguro_vida,
        otros_conceptos: item?.otros_conceptos,
        legajo: item?.legajo
      });

      if (!validRecurso.success) {
        errores.push(`Error procesando la remuneracion con CUIL ${item?.cuil}: ${zodErrorsToArray(validRecurso.error.issues).join(", ")}`);
        continue;
      }
      const tieneRemuneracionNeta = Object.prototype.hasOwnProperty.call(item, "remuneracion_neta");
      const tieneApellidoNombre = Object.prototype.hasOwnProperty.call(item, "apellido_nombre");
      const tieneTipoLiquidacion = Object.prototype.hasOwnProperty.call(item, "tipo_liquidacion");
      const tieneBonificacion = Object.prototype.hasOwnProperty.call(item, "bonificacion");
      const tieneCantHsExtra50 = Object.prototype.hasOwnProperty.call(item, "cant_hs_extra_50");
      const tieneImporteHsExtra50 = Object.prototype.hasOwnProperty.call(item, "importe_hs_extra_50");
      const tieneCantHsExtra100 = Object.prototype.hasOwnProperty.call(item, "cant_hs_extra_100");
      const tieneImporteHsExtra100 = Object.prototype.hasOwnProperty.call(item, "importe_hs_extra_100");
      const tieneArt = Object.prototype.hasOwnProperty.call(item, "art");
      const tieneSeguroVida = Object.prototype.hasOwnProperty.call(item, "seguro_vida");
      const tieneOtrosConceptos = Object.prototype.hasOwnProperty.call(item, "otros_conceptos");

      const regimenNombre = item.regimen ?? '';
      const regimen = await RegimenLaboral.findOne({ where: { nombre: regimenNombre } });
      if (!regimen) {
        errores.push(`El regimen con nombre ${regimenNombre} no existe`);
        continue;
      }

      const situacionRevistaNombre = item.situacion_revista ?? ''
      const situacionRevista = await SituacionRevista.findOne({ where: { nombre: situacionRevistaNombre } })
      if(!situacionRevista){
        errores.push(`La situación de revista con nombre ${situacionRevistaNombre} no existe`);
        continue;
      }

      const tipoLiquidacionNombre = item.tipo_liquidacion ?? '';
      const tipoLiquidacion = await TipoGasto.findOne({ where: { descripcion: tipoLiquidacionNombre } });
      if(!tipoLiquidacion){
        errores.push(`El tipo de liquidación con nombre ${tipoLiquidacion} no existe`);
        continue;
      }

      const where = {
        remuneraciones_ejercicio: ejercicioNum,
        remuneraciones_mes: mesNum,
        municipio_id: municipioNum,
        cuil: item.cuil,
        legajo: item.legajo,
      };

      const existente = await Remuneracion.findOne({ where, transaction });

      if (!existente) {
        const data = { 
          ...where, 
          apellido_nombre: item.apellido_nombre,
          regimen_id: regimen.regimen_id,
          situacion_revista_id: situacionRevista.situacion_revista_id,
          tipo_liquidacion: tipoLiquidacion.tipo_gasto_id,
          fecha_alta: obtenerFecha(item.fecha_alta),
          remuneracion_neta: item.remuneracion_neta,
          bonificacion: item.bonificacion ?? 0,
          cant_hs_extra_50: item.cant_hs_extra_50 ?? 0,
          importe_hs_extra_50: item.importe_hs_extra_50 ?? 0,
          cant_hs_extra_100: item.cant_hs_extra_100 ?? 0,
          importe_hs_extra_100: item.importe_hs_extra_100 ?? 0,
          art: item.art ?? 0,
          seguro_vida: item.seguro_vida ?? 0,
          otros_conceptos: item.otros_conceptos ?? 0
        };

        await Remuneracion.create(
          {
            ...data,
          },
          { transaction }
        );
        creados += 1;
        continue;
      }

      if(
        existente.regimen_id != regimen.regimen_id || 
        existente.situacion_revista_id != situacionRevista.situacion_revista_id
      ){
        errores.push(`El usuario con CUIL ${item.cuil} ya se encuentra cargado en el sistema con otro régimen y otra situación de revista asignados`);
        continue;
      }

      let huboCambios = false;

      if (tieneApellidoNombre && !compararValores(existente.apellido_nombre, item.apellido_nombre)) {
        existente.apellido_nombre = item.apellido_nombre;
        huboCambios = true;
      }
      if (tieneTipoLiquidacion&& !compararValores(existente.tipo_liquidacion, tipoLiquidacion.tipo_gasto_id, 'number')) {
        existente.tipo_liquidacion = tipoLiquidacion.tipo_gasto_id;
        huboCambios = true;
      }
      if (tieneBonificacion && !compararValores(existente.bonificacion, item.bonificacion, 'number')) {
        existente.bonificacion = item.bonificacion;
        huboCambios = true;
      }
      if (tieneCantHsExtra50 && !compararValores(existente.cant_hs_extra_50, item.cant_hs_extra_50, 'number')) {
        existente.cant_hs_extra_50 = item.cant_hs_extra_50;
        huboCambios = true;
      }
      if (tieneImporteHsExtra50 && !compararValores(existente.importe_hs_extra_50, item.importe_hs_extra_50, 'number')) {
        existente.importe_hs_extra_50 = item.importe_hs_extra_50;
        huboCambios = true;
      }
      if (tieneCantHsExtra100 && !compararValores(existente.cant_hs_extra_100, item.cant_hs_extra_100, 'number')) {
        existente.cant_hs_extra_100 = item.cant_hs_extra_100;
        huboCambios = true;
      }
      if (tieneImporteHsExtra100 && !compararValores(existente.importe_hs_extra_100, item.importe_hs_extra_100, 'number')) {
        existente.importe_hs_extra_100 = item.importe_hs_extra_100;
        huboCambios = true;
      }
      if (tieneArt && !compararValores(existente.art, item.art, 'number')) {
        existente.art = item.art;
        huboCambios = true;
      }
      if (tieneSeguroVida && !compararValores(existente.seguro_vida, item.seguro_vida, 'number')) {
        existente.seguro_vida = item.seguro_vida;
        huboCambios = true;
      }
      if (tieneOtrosConceptos && !compararValores(existente.otros_conceptos, item.otros_conceptos, 'number')) {
        existente.otros_conceptos = item.otros_conceptos;
        huboCambios = true;
      }
      if (tieneRemuneracionNeta && !compararValores(existente.remuneracion_neta, item.remuneracion_neta, 'number')) {
        existente.remuneracion_neta = item.remuneracion_neta;
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
      message: "Remuneraciones procesadas correctamente",
      resumen: {
        creados,
        actualizados,
        sinCambios,
        errores
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("❌ Error realizando upsert de remuneraciones del municipio:", error);
    return res.status(500).json({ error: "Error guardando los remuneraciones" });
  }
};

export const obtenerConceptosRecaudacionRectificadaMunicipio = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;

  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);
  const municipioNum = Number(municipioId);

  if ([ejercicioNum, mesNum, municipioNum].some((value) => Number.isNaN(value))) {
    return res.status(400).json({ error: "Ejercicio, mes y municipio deben ser numéricos" });
  }

  try {
    const disponible = await verificarRectificacionDisponible(ejercicioNum, mesNum);
    if (!disponible) {
      return res.status(400).json({ error: "La rectificación no está disponible para este ejercicio y mes" });
    }

    const municipio = await Municipio.findByPk(municipioNum, { attributes: ["municipio_id"] });
    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const conceptos = await ConceptoRecaudacion.findAll();

    const conceptosCargados = await RecaudacionRectificada.findAll({
      where: {
        recaudaciones_ejercicio: ejercicioNum,
        recaudaciones_mes: mesNum,
        municipio_id: municipioNum,
      },
    });

    const conceptosCargadosMap = conceptos.map((concepto) => {
      const recaudacion = conceptosCargados.find((recaudacionItem) =>
        recaudacionItem.cod_concepto === concepto.cod_concepto
      );
      return {
        ...concepto.get(),
        importe_recaudacion: recaudacion ? recaudacion.importe_recaudacion: null,
      };
    });

    return res.json(conceptosCargadosMap);
  } catch (error) {
    console.error("❌ Error obteniendo partidas de gastos del municipio:", error);
    return res.status(500).json({ error: "Error obteniendo partidas de gastos" });
  }
}

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

  const sequelize = Recurso.sequelize;
  const transaction = await sequelize.transaction();

  try {
    const municipio = await Municipio.findByPk(municipioNum, { attributes: ["municipio_id"] });
    if (!municipio) {
      await transaction.rollback();
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const disponible = await verificarRectificacionDisponible(ejercicioNum, mesNum);
    if (!disponible) {
      return res.status(400).json({ error: "La rectificación no está disponible para este ejercicio y mes" });
    }

    let creados = 0;
    let actualizados = 0;
    let sinCambios = 0;
    let errores = [];

    for (const item of conceptos) {
      const tieneImporte = Object.prototype.hasOwnProperty.call(item, "importe_recaudacion");

      const validRecurso = RecaudacionSchema.safeParse({
        cod_concepto: item?.cod_concepto,
        importe_recaudacion: item?.importe_recaudacion,
      });

      if (!validRecurso.success) {
        errores.push(`Error procesando el concepto con código ${item?.cod_concepto}: ${zodErrorsToArray(validRecurso.error.issues).join(", ")}`);
        continue;
      }

      const codigo = Number(item?.cod_concepto);

      const concepto = await ConceptoRecaudacion.findOne({ where: { cod_concepto: codigo } });

      if (!concepto) {
        errores.push(`El concepto con código ${codigo} no existe`);
        continue;
      }

      const where = {
        recaudaciones_ejercicio: ejercicioNum,
        recaudaciones_mes: mesNum,
        municipio_id: municipioNum,
        cod_concepto: concepto.cod_concepto,
      };

      const existente = await RecaudacionRectificada.findOne({ where, transaction });

      if (!existente) {
        const data = { ...where, importe_recaudacion: item.importe_recaudacion};

        await RecaudacionRectificada.create(
          {
            ...data,
          },
          { transaction }
        );
        creados += 1;
        continue;
      }

      let huboCambios = false;

      if (tieneImporte) {
        const importeActual = Number(existente.importe_recaudacion);
        if (!Number.isNaN(importeActual) && importeActual !== item.importe_recaudacion) {
          existente.importe_recaudacion = item.importe_recaudacion;
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
    const disponible = await verificarRectificacionDisponible(ejercicioNum, mesNum);
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
    });

    if (!recaudaciones || recaudaciones.length === 0) {
      return res.status(404).json({ error: "No hay datos guardados para generar el informe" });
    }

    const conceptos = await ConceptoRecaudacion.findAll();

    const mappedConceptos = conceptos.map((concepto) => {
      const recaudacion = recaudaciones.find(rec => rec.cod_concepto === concepto.cod_concepto);
      const importeRecaudacion = recaudacion ? recaudacion.importe_recaudacion : null;

      return {
        cod_concepto: concepto.cod_concepto,
        descripcion: concepto.descripcion,
        importe_recaudacion: importeRecaudacion
      }
    })

    const totalImporte = mappedConceptos.reduce((acumulado, recaudacion) => {
      if (recaudacion.importe_recaudacion === null || recaudacion.importe_recaudacion === undefined) {
        return acumulado;
      }

      const importeNumerico = Number(recaudacion.importe_recaudacion);
      if (!Number.isFinite(importeNumerico)) {
        return acumulado;
      }

      return acumulado + importeNumerico;
    }, 0);

    const userRequest = req.user ?? null;
    const user = await Usuario.findOne({where: { usuario_id: userRequest.usuario_id }});

    const ejercicioMes = await EjercicioMes.findOne({where: { ejercicio: ejercicio, mes: mes }});

    const convenio = await Convenio.findOne({where: { convenio_id: ejercicioMes.convenio_id }});

    const buffer = await buildInformeRecaudaciones({
      municipioNombre: municipio.municipio_nombre,
      ejercicio: ejercicioNum,
      mes: mesNum,
      conceptos: mappedConceptos,
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
    const disponible = await verificarRectificacionDisponible(ejercicioNum, mesNum);
    if (!disponible) {
      return res.status(400).json({ error: "La rectificación no está disponible para este ejercicio y mes" });
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
      return res.status(404).json({ error: "No hay datos guardados para generar el informe" });
    }

    const situacionesRevista = await SituacionRevista.findAll();

    const tipoLiquidaciones = await TipoGasto.findAll();

    const regimenes = await RegimenLaboral.findAll();

    const regimenesPlanos = regimenes.map((regimen) => ({
      nombre: regimen.nombre
    }))

    const remuneracionesPlanas = remuneraciones.map((remuneracion) => ({
      cuil: remuneracion.cuil,
      apellido_nombre: remuneracion.apellido_nombre,
      legajo: remuneracion.legajo,
      fecha_alta: remuneracion.fecha_alta,
      remuneracion_neta: remuneracion.remuneracion_neta,
      bonificacion: remuneracion.bonificacion,
      cant_hs_extra_50: remuneracion.cant_hs_extra_50,
      importe_hs_extra_50: remuneracion.importe_hs_extra_50,
      cant_hs_extra_100: remuneracion.cant_hs_extra_100,
      importe_hs_extra_100: remuneracion.importe_hs_extra_100,
      art: remuneracion.art,
      seguro_vida: remuneracion.seguro_vida,
      otros_conceptos: remuneracion.otros_conceptos,
      situacion_revista: situacionesRevista.find((sr) => sr.situacion_revista_id === remuneracion.situacion_revista_id)?.nombre ?? 'Sin especificar',
      tipo_liquidacion: tipoLiquidaciones.find((tl) => tl.tipo_gasto_id === remuneracion.tipo_liquidacion)?.descripcion ?? 'Sin especificar',
      regimen: regimenes.find((r) => r.regimen_id === remuneracion.regimen_id)?.nombre ?? 'Sin especificar'

    }));

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
      convenioNombre: convenio.nombre,
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

export const upsertRemuneracionesRectificadasMunicipio = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;
  const { remuneraciones } = req.body ?? {};

  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);
  const municipioNum = Number(municipioId);

  const valid = EjerciciosSchema.safeParse({ ejercicio: ejercicioNum, mes: mesNum, municipio_id: municipioNum });

  if (!valid.success) {
    return res.status(400).json({ message: "Error en los datos de entrada", errors: zodErrorsToArray(valid.error.issues) });
  }

  const sequelize = Recurso.sequelize;
  const transaction = await sequelize.transaction();

  try {
    const disponible = await verificarRectificacionDisponible(ejercicioNum, mesNum);
    if (!disponible) {
      return res.status(400).json({ error: "La rectificación no está disponible para este ejercicio y mes" });
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

    for (const item of remuneraciones) {
      const validRecurso = RemuneracionSchema.safeParse({
        cuil: item?.cuil,
        remuneracion_neta: item?.remuneracion_neta,
        bonificacion: item?.bonificacion,
        cant_hs_extra_50: item?.cant_hs_extra_50,
        importe_hs_extra_50: item?.importe_hs_extra_50,
        cant_hs_extra_100: item?.cant_hs_extra_100,
        importe_hs_extra_100: item?.importe_hs_extra_100,
        art: item?.art,
        seguro_vida: item?.seguro_vida,
        otros_conceptos: item?.otros_conceptos,
        legajo: item?.legajo
      });

      if (!validRecurso.success) {
        errores.push(`Error procesando la remuneracion con CUIL ${item?.cuil}: ${zodErrorsToArray(validRecurso.error.issues).join(", ")}`);
        continue;
      }
      const tieneRemuneracionNeta = Object.prototype.hasOwnProperty.call(item, "remuneracion_neta");
      const tieneApellidoNombre = Object.prototype.hasOwnProperty.call(item, "apellido_nombre");
      const tieneTipoLiquidacion = Object.prototype.hasOwnProperty.call(item, "tipo_liquidacion");
      const tieneBonificacion = Object.prototype.hasOwnProperty.call(item, "bonificacion");
      const tieneCantHsExtra50 = Object.prototype.hasOwnProperty.call(item, "cant_hs_extra_50");
      const tieneImporteHsExtra50 = Object.prototype.hasOwnProperty.call(item, "importe_hs_extra_50");
      const tieneCantHsExtra100 = Object.prototype.hasOwnProperty.call(item, "cant_hs_extra_100");
      const tieneImporteHsExtra100 = Object.prototype.hasOwnProperty.call(item, "importe_hs_extra_100");
      const tieneArt = Object.prototype.hasOwnProperty.call(item, "art");
      const tieneSeguroVida = Object.prototype.hasOwnProperty.call(item, "seguro_vida");
      const tieneOtrosConceptos = Object.prototype.hasOwnProperty.call(item, "otros_conceptos");

      const regimenNombre = item.regimen ?? '';
      const regimen = await RegimenLaboral.findOne({ where: { nombre: regimenNombre } });
      if (!regimen) {
        errores.push(`El regimen con nombre ${regimenNombre} no existe`);
        continue;
      }

      const situacionRevistaNombre = item.situacion_revista ?? ''
      const situacionRevista = await SituacionRevista.findOne({ where: { nombre: situacionRevistaNombre } })
      if(!situacionRevista){
        errores.push(`La situación de revista con nombre ${situacionRevistaNombre} no existe`);
        continue;
      }

      const tipoLiquidacionNombre = item.tipo_liquidacion ?? '';
      const tipoLiquidacion = await TipoGasto.findOne({ where: { descripcion: tipoLiquidacionNombre } });
      if(!tipoLiquidacion){
        errores.push(`El tipo de liquidación con nombre ${tipoLiquidacion} no existe`);
        continue;
      }

      const where = {
        remuneraciones_ejercicio: ejercicioNum,
        remuneraciones_mes: mesNum,
        municipio_id: municipioNum,
        cuil: item.cuil,
        legajo: item.legajo,
      };

      const existente = await RemuneracionRectificada.findOne({ where, transaction });

      if (!existente) {
        const data = { 
          ...where, 
          apellido_nombre: item.apellido_nombre,
          regimen_id: regimen.regimen_id,
          situacion_revista_id: situacionRevista.situacion_revista_id,
          tipo_liquidacion: tipoLiquidacion.tipo_gasto_id,
          fecha_alta: obtenerFecha(item.fecha_alta),
          remuneracion_neta: item.remuneracion_neta,
          bonificacion: item.bonificacion ?? 0,
          cant_hs_extra_50: item.cant_hs_extra_50 ?? 0,
          importe_hs_extra_50: item.importe_hs_extra_50 ?? 0,
          cant_hs_extra_100: item.cant_hs_extra_100 ?? 0,
          importe_hs_extra_100: item.importe_hs_extra_100 ?? 0,
          art: item.art ?? 0,
          seguro_vida: item.seguro_vida ?? 0,
          otros_conceptos: item.otros_conceptos ?? 0
        };

        await RemuneracionRectificada.create(
          {
            ...data,
          },
          { transaction }
        );
        creados += 1;
        continue;
      }

      if(
        existente.regimen_id != regimen.regimen_id || 
        existente.situacion_revista_id != situacionRevista.situacion_revista_id
      ){
        errores.push(`El usuario con CUIL ${item.cuil} ya se encuentra cargado en el sistema con otro régimen y otra situación de revista asignados`);
        continue;
      }

      let huboCambios = false;

      if (tieneApellidoNombre && !compararValores(existente.apellido_nombre, item.apellido_nombre)) {
        existente.apellido_nombre = item.apellido_nombre;
        huboCambios = true;
      }
      if (tieneTipoLiquidacion&& !compararValores(existente.tipo_liquidacion, tipoLiquidacion.tipo_gasto_id, 'number')) {
        existente.tipo_liquidacion = tipoLiquidacion.tipo_gasto_id;
        huboCambios = true;
      }
      if (tieneBonificacion && !compararValores(existente.bonificacion, item.bonificacion, 'number')) {
        existente.bonificacion = item.bonificacion;
        huboCambios = true;
      }
      if (tieneCantHsExtra50 && !compararValores(existente.cant_hs_extra_50, item.cant_hs_extra_50, 'number')) {
        existente.cant_hs_extra_50 = item.cant_hs_extra_50;
        huboCambios = true;
      }
      if (tieneImporteHsExtra50 && !compararValores(existente.importe_hs_extra_50, item.importe_hs_extra_50, 'number')) {
        existente.importe_hs_extra_50 = item.importe_hs_extra_50;
        huboCambios = true;
      }
      if (tieneCantHsExtra100 && !compararValores(existente.cant_hs_extra_100, item.cant_hs_extra_100, 'number')) {
        existente.cant_hs_extra_100 = item.cant_hs_extra_100;
        huboCambios = true;
      }
      if (tieneImporteHsExtra100 && !compararValores(existente.importe_hs_extra_100, item.importe_hs_extra_100, 'number')) {
        existente.importe_hs_extra_100 = item.importe_hs_extra_100;
        huboCambios = true;
      }
      if (tieneArt && !compararValores(existente.art, item.art, 'number')) {
        existente.art = item.art;
        huboCambios = true;
      }
      if (tieneSeguroVida && !compararValores(existente.seguro_vida, item.seguro_vida, 'number')) {
        existente.seguro_vida = item.seguro_vida;
        huboCambios = true;
      }
      if (tieneOtrosConceptos && !compararValores(existente.otros_conceptos, item.otros_conceptos, 'number')) {
        existente.otros_conceptos = item.otros_conceptos;
        huboCambios = true;
      }
      if (tieneRemuneracionNeta && !compararValores(existente.remuneracion_neta, item.remuneracion_neta, 'number')) {
        existente.remuneracion_neta = item.remuneracion_neta;
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
      message: "Remuneraciones procesadas correctamente",
      resumen: {
        creados,
        actualizados,
        sinCambios,
        errores
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("❌ Error realizando upsert de remuneraciones del municipio:", error);
    return res.status(500).json({ error: "Error guardando los remuneraciones" });
  }
};

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

  const usuarioMunicipio = await UsuarioMunicipio.findOne({ where: { municipio_id: municipioId } });
  if(usuarioMunicipio) return false;

  return true;
}

const verificarGastosRecursosDisponibles = async (ejercicio, mes) => {
  const fechaHoyArgentina = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires"
  });
  const { ejercicioMes } = await obtenerConvenioPautaEjercicioMes(ejercicio, mes, 'gastos_recursos', fechaHoyArgentina, fechaHoyArgentina);
  if(!ejercicioMes) return false;

  return true;
}

const verificarRecaudacionRemuneracionDisponible = async (ejercicio, mes) => {
  const fechaHoyArgentina = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires"
  });
  const { ejercicioMes } = await obtenerConvenioPautaEjercicioMes(ejercicio, mes, 'recaudacion_remuneracion', fechaHoyArgentina, fechaHoyArgentina);
  if(!ejercicioMes) return false;

  return true;
}

const obtenerFechaCierrerectificacion = (fechaFin, plazoMesRectifica, cantDiasRectifica) => {
  const fechaFinDate = new Date(fechaFin);

  const fechaRectificacion = new Date(
    fechaFinDate.getFullYear(),
    fechaFinDate.getMonth() + plazoMesRectifica,
    cantDiasRectifica
  )
  return fechaRectificacion;
}

const verificarPeriodoRectificacionDisponible = (fechaFin, plazoMesRectifica, cantDiasRectifica) => {
  const fechaFinDate = new Date(fechaFin);
  const hoy = new Date();
  let disponible = false;

  const fechaRectificacion = new Date(
    fechaFinDate.getFullYear(),
    fechaFinDate.getMonth() + plazoMesRectifica,
    1
  )
  if(fechaRectificacion < hoy){
    fechaRectificacion.setDate(fechaRectificacion.getDate() + (cantDiasRectifica - 1));
    disponible = hoy <= fechaRectificacion;
  }

  return disponible;
}

const obtenerConvenioPautaEjercicioMes = async (ejercicio, mes, tipoPauta, fechaInicio = null, fechaFin = null) => {
  const conveniosActivos = await Convenio.findAll(
    { 
      where: { fecha_fin: { [Op.gt]: new Date() } }
    }
  );
  const conveniosActivosIds = conveniosActivos.map(c => c.convenio_id);

  let pautas = null;
  if(tipoPauta === 'recaudacion_remuneracion'){
    pautas = await PautaConvenio.findAll({
      where: {
        [Op.and]: [
          {
            cant_dias_rectifica: {
              [Op.ne]: null,
              [Op.ne]: 0
            }
          },
          {
            plazo_mes_rectifica: {
              [Op.ne]: null,
              [Op.ne]: 0
            }
          },
          {
            convenio_id: {
              [Op.in]: conveniosActivosIds
            }
          }
        ]
      },
    });
  }else if(tipoPauta === 'gastos_recursos'){
    pautas = await PautaConvenio.findAll({
      where: {
        convenio_id: {
          [Op.in]: conveniosActivosIds
        },
        [Op.and]: [
          {
            [Op.or]: [
              { cant_dias_rectifica: 0 },
              { cant_dias_rectifica: { [Op.is]: null } }
            ]
          },
          {
            [Op.or]: [
              { plazo_mes_rectifica: 0 },
              { plazo_mes_rectifica: { [Op.is]: null } }
            ]
          }
        ]
      }
    });
  }
  if(!pautas || pautas.length === 0) return { convenio: null, pauta: null, ejercicioMes: null };
  const pautasIds = pautas.map(p => p.pauta_id);

  const whereEjercicioMes = {
    pauta_id: {
      [Op.in]: pautasIds
    },
    ejercicio,
    mes
  }

  if(fechaInicio) whereEjercicioMes.fecha_inicio = { [Op.lte]: fechaInicio };
  if(fechaFin) whereEjercicioMes.fecha_fin = { [Op.gte]: fechaFin };

  const ejercicioMes = await EjercicioMes.findOne({
    where: whereEjercicioMes
  });

  if(!ejercicioMes) return { convenio: null, pauta: null, ejercicioMes: null };

  const convenio = conveniosActivos.find(c => c.convenio_id === ejercicioMes.convenio_id);
  const pauta = pautas.find(p => p.pauta_id === ejercicioMes.pauta_id);

  return { convenio, pauta, ejercicioMes };
}

const verificarRectificacionDisponible = async (ejercicio, mes) => {
  const conveniosActivos = await Convenio.findAll(
    { 
      where: { fecha_fin: { [Op.gt]: new Date() } }
    }
  );
  const conveniosActivosIds = conveniosActivos.map(c => c.convenio_id);

  const pautasRectificables = await PautaConvenio.findAll({
    where: {
      [Op.and]: [
        {
          cant_dias_rectifica: {
            [Op.ne]: null,
            [Op.ne]: 0
          }
        },
        {
          plazo_mes_rectifica: {
            [Op.ne]: null,
            [Op.ne]: 0
          }
        },
        {
          convenio_id: {
            [Op.in]: conveniosActivosIds
          }
        }
      ]
    },
  });
  const pautasRectificablesIds = pautasRectificables.map(p => p.pauta_id);

  const ejercicioMesRectificable = await EjercicioMes.findOne({
    where: {
      pauta_id: {
        [Op.in]: pautasRectificablesIds
      },
      fecha_fin: {
        [Op.lt]: new Date()
      },
      ejercicio,
      mes
    }
  });

  if(!ejercicioMesRectificable) return false;

  const pauta = pautasRectificables.find(p => p.pauta_id === ejercicioMesRectificable.pauta_id);

  return verificarPeriodoRectificacionDisponible(ejercicioMesRectificable.fecha_fin, pauta.plazo_mes_rectifica, pauta.cant_dias_rectifica);
}