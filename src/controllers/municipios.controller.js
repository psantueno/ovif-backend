// Modelo
import { Municipio, EjercicioMes, ProrrogaMunicipio, AuditoriaProrrogaMunicipio, Gasto, PartidaGasto, PartidaRecurso, Recurso, Convenio, PautaConvenio } from "../models/index.js";
import { buildInformeGastos } from "../utils/pdf/municipioGastos.js";
import { buildInformeRecursos } from "../utils/pdf/municipioRecursos.js";
import { Op } from "sequelize";

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
      importe === null ? null : Number(importe)
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
      importe: importe === null ? null : Number(importe),
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

    const totalPaginas = limiteFinal > 0 ? Math.ceil(count / limiteFinal) : 0;

    res.json({
      total: count,
      pagina: paginaFinal,
      limite: limiteFinal,
      totalPaginas,
      data: rows,
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


export const listarEjerciciosCerradosPorMunicipio = async (req, res) => {
  const municipioId = Number(req.params.municipioId || req.params.id);
  if (Number.isNaN(municipioId)) {
    return res.status(400).json({ error: "municipioId inválido" });
  }

  const currentYear = new Date().getFullYear();
  const normalizeQueryValue = (value) => (Array.isArray(value) ? value[0] : value);
  const ejercicioParam = normalizeQueryValue(
    req.query?.anio ?? req.query?.ejercicio ?? req.query?.year
  );
  const ejercicio = ejercicioParam === undefined ? currentYear : Number(ejercicioParam);

  if (Number.isNaN(ejercicio)) {
    return res.status(400).json({ error: "El año del ejercicio es inválido" });
  }

  try {
    const municipio = await Municipio.findByPk(municipioId, {
      attributes: ["municipio_id", "municipio_nombre"],
    });
    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const oficiales = await EjercicioMes.findAll({
      where: { ejercicio },
      order: [
        ["mes", "ASC"],
        ["convenio_id", "ASC"],
        ["pauta_id", "ASC"],
      ],
    });

    if (oficiales.length === 0) {
      return res.json({
        municipio: municipio.get(),
        ejercicio,
        cierres: [],
      });
    }

    const prorrogas = await ProrrogaMunicipio.findAll({
      where: {
        ejercicio,
        municipio_id: municipioId,
      },
    });

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

    const convenioMap = new Map(convenios.map((item) => [item.convenio_id, item]));
    const pautaMap = new Map(pautas.map((item) => [item.pauta_id, item]));

    const prorrogaMap = new Map(
      prorrogas.map((item) => [
        buildCalendarioKey(item.ejercicio, item.mes, item.convenio_id, item.pauta_id),
        item,
      ])
    );

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
      ejercicio,
      cierres: respuesta,
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
    municipio_usuario,
    municipio_password,
    municipio_spar,
    municipio_ubge,
    municipio_subir_archivos,
    municipio_poblacion,
  } = req.body;

  if (
    !municipio_nombre ||
    !municipio_usuario ||
    !municipio_password ||
    municipio_spar === undefined ||
    municipio_ubge === undefined ||
    municipio_subir_archivos === undefined ||
    municipio_poblacion === undefined
  ) {
    return res.status(400).json({ error: "Todos los campos del municipio son obligatorios" });
  }

  try {
    const municipioExistente = await Municipio.findOne({
      where: { municipio_nombre },
    });

    if (municipioExistente) {
      return res.status(400).json({ error: "Ya existe un municipio con ese nombre" });
    }

    const nuevoMunicipio = await Municipio.create({
      municipio_nombre,
      municipio_usuario,
      municipio_password,
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
    municipio_usuario,
    municipio_password,
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

    if (municipio_nombre && municipio_nombre !== municipio.municipio_nombre) {
      const municipioDuplicado = await Municipio.findOne({ where: { municipio_nombre } });

      if (municipioDuplicado && municipioDuplicado.municipio_id !== municipio.municipio_id) {
        return res.status(400).json({ error: "Ya existe otro municipio con ese nombre" });
      }

      municipio.municipio_nombre = municipio_nombre;
    }

    if (municipio_usuario !== undefined) municipio.municipio_usuario = municipio_usuario;
    if (municipio_password !== undefined) municipio.municipio_password = municipio_password;
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

// === Upsert masivo de gastos por municipio ===

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
      where: { ejercicio, mes, municipio_id: municipioId },
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
      tipo: tipo || "PRORROGA",
      motivo: motivo || comentario || null,
      gestionado_por: usuarioId,
      observaciones: observaciones ?? null,
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

  if ([ejercicioNum, mesNum, municipioNum].some((value) => Number.isNaN(value))) {
    return res.status(400).json({ error: "Ejercicio, mes y municipio deben ser numéricos" });
  }

  if (!Array.isArray(partidas) || partidas.length === 0) {
    return res.status(400).json({ error: "Debe enviar un arreglo 'partidas' con al menos un elemento" });
  }

  const sequelize = Gasto.sequelize;
  const transaction = await sequelize.transaction();

  try {
    const municipio = await Municipio.findByPk(municipioNum, { attributes: ["municipio_id"] });
    if (!municipio) {
      await transaction.rollback();
      return res.status(404).json({ error: "Municipio no encontrado" });
    }
    let creados = 0;
    let actualizados = 0;
    let sinCambios = 0;

    for (const item of partidas) {
      const codigo = Number(item?.partidas_gastos_codigo);

      if (Number.isNaN(codigo)) {
        await transaction.rollback();
        return res.status(400).json({ error: "Cada partida debe incluir 'partidas_gastos_codigo' numérico" });
      }

      const tieneImporte = Object.prototype.hasOwnProperty.call(item, "gastos_importe_devengado");
      const importeValor = item?.gastos_importe_devengado;
      let importeParsed;

      if (tieneImporte) {
        const normalizado = importeValor === null || importeValor === "" ? 0 : importeValor;
        importeParsed = Number(normalizado);
        if (Number.isNaN(importeParsed)) {
          await transaction.rollback();
          return res.status(400).json({ error: `El importe para la partida ${codigo} debe ser numérico` });
        }
      }

      const where = {
        gastos_ejercicio: ejercicioNum,
        gastos_mes: mesNum,
        municipio_id: municipioNum,
        partidas_gastos_codigo: codigo,
      };

      const existente = await Gasto.findOne({ where, transaction });

      if (!existente) {
        if (!tieneImporte) {
          await transaction.rollback();
          return res.status(400).json({
            error: `La partida ${codigo} no existe y requiere 'gastos_importe_devengado' para crearla`,
          });
        }

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
    }

    await transaction.commit();

    return res.json({
      message: "Gastos procesados correctamente",
      resumen: {
        creados,
        actualizados,
        sinCambios,
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

  if ([ejercicioNum, mesNum, municipioNum].some((value) => Number.isNaN(value))) {
    return res.status(400).json({ error: "Ejercicio, mes y municipio deben ser numéricos" });
  }

  if (!Array.isArray(partidas) || partidas.length === 0) {
    return res.status(400).json({ error: "Debe enviar un arreglo 'partidas' con al menos un elemento" });
  }

  const sequelize = Recurso.sequelize;
  const transaction = await sequelize.transaction();

  try {
    const municipio = await Municipio.findByPk(municipioNum, { attributes: ["municipio_id"] });
    if (!municipio) {
      await transaction.rollback();
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    let creados = 0;
    let actualizados = 0;
    let sinCambios = 0;

    const parseDecimal = (valor, codigo, campo) => {
      const normalizado = valor === null || valor === "" ? 0 : valor;
      const parsed = Number(normalizado);
      if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
        throw new Error(`El campo ${campo} para la partida ${codigo} debe ser numérico`);
      }
      return parsed;
    };

    const parseEntero = (valor, codigo, campo) => {
      const normalizado = valor === null || valor === "" ? 0 : valor;
      const parsed = Number(normalizado);
      if (Number.isNaN(parsed) || !Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        throw new Error(`El campo ${campo} para la partida ${codigo} debe ser un número entero`);
      }
      return parsed;
    };

    for (const item of partidas) {
      const codigo = Number(item?.partidas_recursos_codigo);
      if (Number.isNaN(codigo)) {
        await transaction.rollback();
        return res.status(400).json({
          error: "Cada partida debe incluir 'partidas_recursos_codigo' numérico",
        });
      }

      const tieneImporte = Object.prototype.hasOwnProperty.call(item, "recursos_importe_percibido");
      const tieneContribuyentes = Object.prototype.hasOwnProperty.call(
        item,
        "recursos_cantidad_contribuyentes"
      );
      const tienePagaron = Object.prototype.hasOwnProperty.call(
        item,
        "recursos_cantidad_pagaron"
      );

      const where = {
        recursos_ejercicio: ejercicioNum,
        recursos_mes: mesNum,
        municipio_id: municipioNum,
        partidas_recursos_codigo: codigo,
      };

      const existente = await Recurso.findOne({ where, transaction });

      if (!existente) {
        if (!tieneImporte) {
          await transaction.rollback();
          return res.status(400).json({
            error: `La partida ${codigo} no existe y requiere 'recursos_importe_percibido' para crearla`,
          });
        }

        let importeParsed;
        let contribuyentesParsed = 0;
        let pagaronParsed = 0;

        try {
          importeParsed = parseDecimal(item.recursos_importe_percibido, codigo, "recursos_importe_percibido");
          if (tieneContribuyentes) {
            contribuyentesParsed = parseEntero(
              item.recursos_cantidad_contribuyentes,
              codigo,
              "recursos_cantidad_contribuyentes"
            );
          }
          if (tienePagaron) {
            pagaronParsed = parseEntero(
              item.recursos_cantidad_pagaron,
              codigo,
              "recursos_cantidad_pagaron"
            );
          }
        } catch (error) {
          await transaction.rollback();
          return res.status(400).json({ error: error.message });
        }

        await Recurso.create(
          {
            ...where,
            recursos_importe_percibido: importeParsed,
            recursos_cantidad_contribuyentes: contribuyentesParsed,
            recursos_cantidad_pagaron: pagaronParsed,
          },
          { transaction }
        );
        creados += 1;
        continue;
      }

      let huboCambios = false;

      if (tieneImporte) {
        let importeParsed;
        try {
          importeParsed = parseDecimal(item.recursos_importe_percibido, codigo, "recursos_importe_percibido");
        } catch (error) {
          await transaction.rollback();
          return res.status(400).json({ error: error.message });
        }

        const importeActual = Number(existente.recursos_importe_percibido);
        if (!Number.isNaN(importeActual) && importeActual !== importeParsed) {
          existente.recursos_importe_percibido = importeParsed;
          huboCambios = true;
        }
      }

      if (tieneContribuyentes) {
        let contribuyentesParsed;
        try {
          contribuyentesParsed = parseEntero(
            item.recursos_cantidad_contribuyentes,
            codigo,
            "recursos_cantidad_contribuyentes"
          );
        } catch (error) {
          await transaction.rollback();
          return res.status(400).json({ error: error.message });
        }

        const contribuyentesActual = Number(existente.recursos_cantidad_contribuyentes);
        if (!Number.isNaN(contribuyentesActual) && contribuyentesActual !== contribuyentesParsed) {
          existente.recursos_cantidad_contribuyentes = contribuyentesParsed;
          huboCambios = true;
        }
      }

      if (tienePagaron) {
        let pagaronParsed;
        try {
          pagaronParsed = parseEntero(
            item.recursos_cantidad_pagaron,
            codigo,
            "recursos_cantidad_pagaron"
          );
        } catch (error) {
          await transaction.rollback();
          return res.status(400).json({ error: error.message });
        }

        const pagaronActual = Number(existente.recursos_cantidad_pagaron);
        if (!Number.isNaN(pagaronActual) && pagaronActual !== pagaronParsed) {
          existente.recursos_cantidad_pagaron = pagaronParsed;
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

    const buffer = await buildInformeGastos({
      municipioNombre: municipio.municipio_nombre,
      ejercicio: ejercicioNum,
      mes: mesNum,
      partidas: partidasPlanas,
      totalImporte,
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

    const buffer = await buildInformeRecursos({
      municipioNombre: municipio.municipio_nombre,
      ejercicio: ejercicioNum,
      mes: mesNum,
      partidas: partidasPlanas,
      totalImporte,
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
