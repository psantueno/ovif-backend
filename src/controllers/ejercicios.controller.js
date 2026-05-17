// Modelos
import {
  EjercicioMes,
  ProrrogaMunicipio,
  AuditoriaProrrogaMunicipio,
  EjercicioMesCerrado,
  Municipio,
  Convenio,
  PautaConvenio,
  CierreModulo,
  Parametros,
  TipoPauta
} from "../models/index.js";
import { Op } from "sequelize";
import {
  CIERRE_MODULOS,
  TIPOS_CIERRE_MODULO,
  getModuloCierreAliases,
  normalizeModuloCierre,
  normalizeTipoCierre,
} from "../utils/cierreModulo.js";
import { obtenerNombreInformeCierreModulo, obtenerPathInformeCierreModulo, filtrarCierresConInforme, filtrarEjerciciosMesesCerradosConInforme } from "../utils/descargaInformes.js";

import path from "path";
import fs from "fs";

const __dirname = path.resolve();

const isValidISODate = (value) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === trimmed;
};

const toISODateString = (value) => {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
};

const MODULOS_VALIDOS = [
  ...Object.values(CIERRE_MODULOS),
];
const TIPOS_CIERRE = [...Object.values(TIPOS_CIERRE_MODULO)];

const parsePositiveIntegerQuery = (value, nombreParametro) => {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== String(value).trim()) {
    return {
      ok: false,
      error: `El parámetro '${nombreParametro}' debe ser un número entero positivo.`,
    };
  }

  return { ok: true, value: parsed };
};


// Listar todos los ejercicios
// GET /api/ejercicios
export const listarEjercicios = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 12;
    const yearRaw = req.query.year;
    const convenioRaw = req.query.convenio_id;
    const tipoPautaRaw = req.query.tipo_pauta_id;

    const sanitizedPage = Number.isFinite(page) && page > 0 ? page : 1;
    const sanitizedLimit = Number.isFinite(limit) && limit > 0 ? limit : 12;
    const offset = (sanitizedPage - 1) * sanitizedLimit;

    const where = {};
    if (yearRaw !== undefined) {
      const yearParsed = Number.parseInt(yearRaw, 10);
      if (!Number.isFinite(yearParsed) || yearParsed < 0 || yearParsed > 9999) {
        return res.status(400).json({ error: "El parámetro 'year' debe ser un número de hasta 4 dígitos." });
      }
      where.ejercicio = yearParsed;
    }

    const convenioParsed = parsePositiveIntegerQuery(convenioRaw, "convenio_id");
    if (!convenioParsed.ok) {
      return res.status(400).json({ error: convenioParsed.error });
    }
    if (convenioParsed.value !== null) {
      where.convenio_id = convenioParsed.value;
    }

    const tipoPautaParsed = parsePositiveIntegerQuery(tipoPautaRaw, "tipo_pauta_id");
    if (!tipoPautaParsed.ok) {
      return res.status(400).json({ error: tipoPautaParsed.error });
    }

    const pautaInclude = {
      model: PautaConvenio,
      attributes: ["pauta_id", "descripcion", "tipo_pauta_id"],
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
    };

    if (tipoPautaParsed.value !== null) {
      pautaInclude.where = { tipo_pauta_id: tipoPautaParsed.value };
      pautaInclude.required = true;
    }

    const { rows, count } = await EjercicioMes.findAndCountAll({
      where,
      include: [
        {
          model: Convenio,
          attributes: ["convenio_id", "nombre"],
        },
        pautaInclude,
      ],
      order: [
        ["ejercicio", "DESC"],
        ["mes", "DESC"],
      ],
      offset,
      limit: sanitizedLimit,
    });

    res.json({
      data: rows,
      total: count,
      page: sanitizedPage,
      limit: sanitizedLimit,
    });
  } catch (error) {
    res.status(500).json({ error: "Error listando ejercicios" });
  }
};


// Crear nuevo ejercicio
// POST /api/ejercicios
export const crearEjercicio = async (req, res) => {
  const { ejercicio, mes, fecha_inicio, fecha_fin, convenio_id, pauta_id } = req.body;
  const errores = [];
  const usuarioId = req.user?.usuario_id;

  if (!usuarioId) {
    return res.status(401).json({ error: "Usuario autenticado requerido para registrar el ejercicio." });
  }

  let ejercicioParsed;
  if (ejercicio === undefined || ejercicio === null || String(ejercicio).trim() === "") {
    errores.push("El campo 'ejercicio' es obligatorio.");
  } else {
    const ejercicioStr = String(ejercicio).trim();
    if (!/^\d{1,4}$/.test(ejercicioStr)) {
      errores.push("El campo 'ejercicio' debe ser numérico y tener hasta 4 dígitos.");
    } else {
      ejercicioParsed = Number.parseInt(ejercicioStr, 10);
    }
  }

  let mesParsed;
  if (mes === undefined || mes === null || String(mes).trim() === "") {
    errores.push("El campo 'mes' es obligatorio.");
  } else {
    const mesStr = String(mes).trim();
    if (!/^\d+$/.test(mesStr)) {
      errores.push("El campo 'mes' debe ser numérico.");
    } else {
      mesParsed = Number.parseInt(mesStr, 10);
      if (mesParsed < 1 || mesParsed > 12) {
        errores.push("El campo 'mes' debe estar entre 1 y 12.");
      }
    }
  }

  let convenioIdParsed;
  if (convenio_id === undefined || convenio_id === null || String(convenio_id).trim() === "") {
    errores.push("El campo 'convenio_id' es obligatorio.");
  } else if (!/^\d+$/.test(String(convenio_id).trim())) {
    errores.push("El campo 'convenio_id' debe ser numérico.");
  } else {
    convenioIdParsed = Number.parseInt(String(convenio_id).trim(), 10);
  }

  let pautaIdParsed;
  if (pauta_id === undefined || pauta_id === null || String(pauta_id).trim() === "") {
    errores.push("El campo 'pauta_id' es obligatorio.");
  } else if (!/^\d+$/.test(String(pauta_id).trim())) {
    errores.push("El campo 'pauta_id' debe ser numérico.");
  } else {
    pautaIdParsed = Number.parseInt(String(pauta_id).trim(), 10);
  }

  let fechaInicioDate;
  if (!fecha_inicio) {
    errores.push("El campo 'fecha_inicio' es obligatorio.");
  } else if (!isValidISODate(fecha_inicio)) {
    errores.push("El campo 'fecha_inicio' debe tener formato YYYY-MM-DD y ser una fecha válida.");
  } else {
    fechaInicioDate = new Date(fecha_inicio);
  }

  let fechaFinDate;
  if (!fecha_fin) {
    errores.push("El campo 'fecha_fin' es obligatorio.");
  } else if (!isValidISODate(fecha_fin)) {
    errores.push("El campo 'fecha_fin' debe tener formato YYYY-MM-DD y ser una fecha válida.");
  } else {
    fechaFinDate = new Date(fecha_fin);
  }

  if (fechaInicioDate && fechaFinDate && fechaFinDate < fechaInicioDate) {
    errores.push("La 'fecha_fin' no puede ser anterior a 'fecha_inicio'.");
  }

  if (errores.length > 0) {
    return res.status(400).json({
      error: "Datos inválidos",
      detalles: errores,
    });
  }

  try {
    const existente = await EjercicioMes.findOne({
      where: {
        ejercicio: ejercicioParsed,
        mes: mesParsed,
        convenio_id: convenioIdParsed,
        pauta_id: pautaIdParsed,
      },
    });

    if (existente) {
      return res.status(409).json({ error: "Ya existe un ejercicio/mes para el convenio y pauta que intenta crear." });
    }

    const nuevo = await EjercicioMes.create({
      ejercicio: ejercicioParsed,
      mes: mesParsed,
      convenio_id: convenioIdParsed,
      pauta_id: pautaIdParsed,
      fecha_inicio: fechaInicioDate,
      fecha_fin: fechaFinDate,
      creado_por: usuarioId,
    });
    const nuevoConDetalles = await EjercicioMes.findOne({
      where: {
        ejercicio: ejercicioParsed,
        mes: mesParsed,
        convenio_id: convenioIdParsed,
        pauta_id: pautaIdParsed,
      },
      include: [
        {
          model: Convenio,
          attributes: ["convenio_id", "nombre"],
        },
        {
          model: PautaConvenio,
          attributes: ["pauta_id", "descripcion", "dia_vto", "plazo_vto", "tipo_pauta_id"],
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
        },
      ],
    });
    res.status(201).json(nuevoConDetalles);
  } catch (error) {
    res.status(500).json({ error: "Error creando ejercicio" });
  }
};


// Actualizar ejercicio existente
// PUT /api/ejercicios/:ejercicio/mes/:mes?convenio_id=...&pauta_id=...
export const updateEjercicio = async (req, res) => {
  const { ejercicio, mes } = req.params;
  const convenioIdParam = req.query.convenio_id;
  const pautaIdParam = req.query.pauta_id;
  const { fecha_inicio, fecha_fin } = req.body;
  const usuarioId = req.user?.usuario_id;

  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);
  if (!Number.isInteger(ejercicioNum) || ejercicioNum < 2000 || ejercicioNum > 2100) {
    return res.status(400).json({ error: "El campo 'ejercicio' debe ser un año válido (2000-2100)." });
  }
  if (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12) {
    return res.status(400).json({ error: "El campo 'mes' debe ser un número entre 1 y 12." });
  }

  const convenioId = Number(convenioIdParam);
  const pautaId = Number(pautaIdParam);
  if (!Number.isInteger(convenioId) || convenioId <= 0) {
    return res.status(400).json({ error: "El parámetro 'convenio_id' es obligatorio y debe ser un número válido." });
  }
  if (!Number.isInteger(pautaId) || pautaId <= 0) {
    return res.status(400).json({ error: "El parámetro 'pauta_id' es obligatorio y debe ser un número válido." });
  }

  if (!usuarioId) {
    return res.status(401).json({ error: "Usuario autenticado requerido para modificar el ejercicio." });
  }

  try {
    const em = await EjercicioMes.findOne({
      where: { ejercicio: ejercicioNum, mes: mesNum, convenio_id: convenioId, pauta_id: pautaId },
    });
    if (!em) return res.status(404).json({ error: "Ejercicio/Mes no encontrado" });
    if (fecha_inicio !== undefined) {
      em.fecha_inicio = fecha_inicio;
    }
    if (fecha_fin !== undefined) {
      em.fecha_fin = fecha_fin;
    }
    em.modificado_por = usuarioId;
    await em.save();
    await em.reload({
      include: [
        {
          model: Convenio,
          attributes: ["convenio_id", "nombre"],
        },
        {
          model: PautaConvenio,
          attributes: ["pauta_id", "descripcion", "dia_vto", "plazo_vto", "tipo_pauta_id"],
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
        },
      ],
    });
    res.json(em);
  } catch (error) {
    res.status(500).json({ error: "Error actualizando ejercicio" });
  }
};

// Borrar ejercicio: DELETE /api/ejercicios/:ejercicio/mes/:mes?convenio_id=...&pauta_id=...
export const deleteEjercicio = async (req, res) => {
  const { ejercicio, mes } = req.params;
  const convenioIdParam = req.query.convenio_id;
  const pautaIdParam = req.query.pauta_id;

  const ejercicioNum = Number(ejercicio);
  const mesNum = Number(mes);
  const convenioId = Number(convenioIdParam);
  const pautaId = Number(pautaIdParam);

  if (!Number.isInteger(ejercicioNum) || !Number.isInteger(mesNum)) {
    return res.status(400).json({ error: "Ejercicio y mes deben ser números válidos." });
  }
  if (!Number.isInteger(convenioId) || convenioId <= 0) {
    return res.status(400).json({ error: "El parámetro 'convenio_id' es obligatorio y debe ser un número válido." });
  }
  if (!Number.isInteger(pautaId) || pautaId <= 0) {
    return res.status(400).json({ error: "El parámetro 'pauta_id' es obligatorio y debe ser un número válido." });
  }

  try {
    const deleted = await EjercicioMes.destroy({
      where: { ejercicio: ejercicioNum, mes: mesNum, convenio_id: convenioId, pauta_id: pautaId },
    });
    if (!deleted) return res.status(404).json({ error: "Ejercicio/Mes no encontrado" });
    res.json({ message: "Ejercicio/Mes eliminado" });
  } catch (error) {
    if (error.name === "SequelizeForeignKeyConstraintError") {
      return res.status(409).json({
        error: "No se puede eliminar el ejercicio/mes porque está referenciado por otros registros.",
      });
    }
    console.error("Error eliminando ejercicio:", error);
    res.status(500).json({ error: "Error eliminando ejercicio" });
  }
};

// Prorrogar cierre para un municipio particular
// PUT /api/ejercicios/:ejercicio/mes/:mes/municipios/:municipioId/prorroga
export const prorrogarCierre = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;
  const {
    fecha_fin,
    comentario,
    convenio_id,
    pauta_id,
    motivo,
    observaciones,
    tipo,
  } = req.body;
  const usuarioId = req.user?.usuario_id;

  if (!fecha_fin) {
    return res.status(400).json({ error: "Debe enviar fecha_fin" });
  }

  if (!usuarioId) {
    return res.status(401).json({
      error: "Usuario autenticado requerido para registrar la prórroga.",
    });
  }

  try {
    const oficial = await EjercicioMes.findOne({ where: { ejercicio, mes } });
    if (!oficial) {
      return res.status(404).json({ error: "Ejercicio/Mes no encontrado" });
    }

    let prorroga = await ProrrogaMunicipio.findOne({
      where: { ejercicio, mes, municipio_id: municipioId },
    });

    const fechaAnterior = prorroga?.fecha_fin_nueva || oficial.fecha_fin;

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
      if (convenio_id !== undefined) {
        prorroga.convenio_id = convenio_id;
      }
      if (pauta_id !== undefined) {
        prorroga.pauta_id = pauta_id;
      }
      prorroga.fecha_fin_nueva = fecha_fin;
      await prorroga.save();
    }

    await AuditoriaProrrogaMunicipio.create({
      prorroga_id: prorroga.prorroga_id,
      ejercicio,
      mes,
      municipio_id: Number(municipioId),
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
      fecha_fin_anterior: fechaAnterior,
      fecha_fin_prorrogada: fecha_fin,
      convenio_id: prorroga.convenio_id,
      pauta_id: prorroga.pauta_id,
    });
  } catch (error) {
    console.error("❌ Error aplicando prórroga:", error);
    return res.status(500).json({ error: "Error aplicando prórroga" });
  }
};


// Consultar fecha límite (oficial o prórroga) para un municipio.
// GET /api/ejercicios/:ejercicio/mes/:mes/municipios/:municipioId
export const getFechaLimite = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;

  try {
    // 1. Buscar fechas oficiales
    const oficial = await EjercicioMes.findOne({ where: { ejercicio, mes } });
    if (!oficial) {
      return res.status(404).json({ error: "Ejercicio/Mes no encontrado en calendario oficial" });
    }

    // 2. Buscar override del municipio (si existe)
    const prorroga = await ProrrogaMunicipio.findOne({
      where: { ejercicio, mes, municipio_id: municipioId },
    });

    // 3. Calcular fechas efectivas
    const fecha_inicio = oficial.fecha_inicio;
    const fecha_fin = prorroga?.fecha_fin_nueva || oficial.fecha_fin;

    // 4. Devolver resultado
    return res.json({
      ejercicio,
      mes,
      municipio_id: municipioId,
      fecha_inicio,
      fecha_fin,
      override: !!prorroga, // true si hubo prórroga
    });

  } catch (error) {
    console.error("❌ Error en getFechaLimite:", error);
    return res.status(500).json({ error: "Error consultando fecha límite" });
  }
};

// Lista todos los municipios que completaron el cierre para un ejercicio y mes dados (sin uso aún)
// GET /api/ejercicios/:ejercicio/mes/:mes/cierres
export const listarCierres = async (req, res) => {
  const { ejercicio, mes } = req.params;

  try {
    const cierres = await EjercicioMesCerrado.findAll({
      where: { ejercicio, mes },
      include: [
        {
          model: Municipio,
          attributes: ["municipio_id", "municipio_nombre"],
        },
      ],
    });

    return res.json(cierres);
  } catch (error) {
    console.error("❌ Error en listarCierres:", error);
    return res.status(500).json({ error: "Error consultando cierres" });
  }
};


// Obtiene el detalle del cierre de un municipio en particular, incluyendo estado (cumplió o fuera de plazo)
// GET /api/ejercicios/:ejercicio/mes/:mes/municipios/:municipioId/cierre
export const getCierreMunicipio = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;

  try {
    // 1. Buscar el cierre
    const cierre = await EjercicioMesCerrado.findOne({
      where: { ejercicio, mes, municipio_id: municipioId },
      include: [
        {
          model: Municipio,
          attributes: ["municipio_id", "municipio_nombre"],
        },
      ],
    });

    if (!cierre) {
      return res.status(404).json({ error: "El municipio no tiene cierre registrado en este ejercicio/mes" });
    }

    // 2. Obtener fecha límite efectiva
    const oficial = await EjercicioMes.findOne({ where: { ejercicio, mes } });
    if (!oficial) {
      return res.status(404).json({ error: "Ejercicio/Mes no encontrado en calendario oficial" });
    }

    const prorroga = await ProrrogaMunicipio.findOne({
      where: { ejercicio, mes, municipio_id: municipioId },
    });

    // Normalizar a YYYY-MM-DD para comparar como día calendario AR,
    // ya que fecha_fin_nueva es DATEONLY y oficial.fecha_fin es DATETIME.
    const fechaLimite = toISODateString(prorroga?.fecha_fin_nueva || oficial.fecha_fin);

    // 3. Comparar estado (cierre.fecha es un string YYYY-MM-DD)
    const fechaCierreStr = toISODateString(cierre.fecha);

    const estado = fechaCierreStr <= fechaLimite ? "CUMPLIO" : "FUERA DE PLAZO";

    // 4. Responder
    return res.json({
      ejercicio: cierre.ejercicio,
      mes: cierre.mes,
      municipio_id: cierre.municipio_id,
      municipio_nombre: cierre.Municipio?.municipio_nombre || null,
      fecha_cierre: cierre.fecha,
      informe_recursos: cierre.informe_recursos,
      informe_gastos: cierre.informe_gastos,
      informe_personal: cierre.informe_personal,
      fecha_limite: fechaLimite,
      estado,
    });

  } catch (error) {
    console.error("❌ Error en getCierreMunicipio:", error);
    return res.status(500).json({ error: "Error consultando cierre del municipio" });
  }
};


// Lista todos los municipios con su estado respecto al cierre de un ejercicio/mes (sin detalles)
// GET /api/ejercicios/:ejercicio/mes/:mes/estado-municipios
export const listarEstadoMunicipios = async (req, res) => {
  const { ejercicio, mes } = req.params;

  try {
    // 1. Buscar fecha oficial
    const oficial = await EjercicioMes.findOne({ where: { ejercicio, mes } });
    if (!oficial) {
      return res.status(404).json({ error: "Ejercicio/Mes no encontrado en calendario oficial" });
    }

    // 2. Traer municipios
    const municipios = await Municipio.findAll();

    // 3. Traer overrides y cierres de golpe
    const prorrogas = await ProrrogaMunicipio.findAll({
      where: { ejercicio, mes },
    });

    const cierres = await EjercicioMesCerrado.findAll({
      where: { ejercicio, mes },
    });

    // 4. Mapear para lookup rápido
    const prorrogaMap = new Map(
      prorrogas.map((p) => [`${p.municipio_id}`, p])
    );
    const cierresMap = new Map(
      cierres.map(c => [`${c.municipio_id}`, c])
    );

    // 5. Armar resultado
    const resultado = municipios.map(m => {
      const prorroga = prorrogaMap.get(`${m.municipio_id}`);
      const cierre = cierresMap.get(`${m.municipio_id}`);

      // Normalizar a YYYY-MM-DD para comparar como día calendario AR
      const fechaLimite = toISODateString(prorroga?.fecha_fin_nueva || oficial.fecha_fin);
      let estado;
      let fechaCierre = null;

      if (!cierre) {
        estado = "SIN CERRAR";
      } else {
        fechaCierre = cierre.fecha;
        const fechaCierreStr = toISODateString(fechaCierre);
        estado = fechaCierreStr <= fechaLimite ? "CUMPLIO" : "FUERA DE PLAZO";
      }

      return {
        municipio_id: m.municipio_id,
        municipio_nombre: m.municipio_nombre,
        fecha_limite: fechaLimite,
        fecha_cierre: fechaCierre,
        estado,
      };
    });

    return res.json(resultado);
  } catch (error) {
    console.error("❌ Error en listarEstadoMunicipios:", error);
    return res.status(500).json({ error: "Error consultando estados de municipios" });
  }
};


// === Informes por módulo para un municipio ===
// GET /api/ejercicios/informes/filtros?municipio_id=...
export const obtenerFiltrosInformes = async (req, res) => {
  const municipioId = req.query?.municipio_id ?? req.params?.municipioId;

  if (!municipioId) {
    return res.status(400).json({ error: "municipio_id es requerido" });
  }

  try {
    const whereCierresModulos = { municipio_id: municipioId, informe_path: { [Op.ne]: null } };
    const cierresModulosMunicipioRaw = await CierreModulo.findAll({
      attributes: ['ejercicio', 'mes', 'modulo', 'informe_path'],
      where: whereCierresModulos,
      order: [['ejercicio', "DESC"], ['mes', 'ASC']],
      raw: true
    });

    const cierresModulosFiltrados = await filtrarCierresConInforme(cierresModulosMunicipioRaw);

    const whereEjerciciosMesesCerrados = {
      municipio_id: municipioId,
      informe_gastos: { [Op.ne]: null },
      informe_recursos: { [Op.ne]: null },
    };
    const ejerciciosMesesCerrados = await EjercicioMesCerrado.findAll({
      attributes: ['ejercicio', 'mes', 'informe_gastos', 'informe_recursos'],
      where: whereEjerciciosMesesCerrados,
      order: [['ejercicio', "DESC"], ['mes', 'ASC']],
      raw: true
    })

    const ejerciciosMesesCerradosFiltrados = await filtrarEjerciciosMesesCerradosConInforme(ejerciciosMesesCerrados);

    const cierresNormalizados = cierresModulosFiltrados
      .map((item) => ({
        ...item,
        modulo: normalizeModuloCierre(item.modulo),
      }))
      .filter((item) => item.modulo);

    const unicos = new Map();
    [...cierresNormalizados, ...ejerciciosMesesCerradosFiltrados].forEach((item) => {
      const key = `${item.ejercicio}-${item.mes}-${item.modulo}`;
      if (!unicos.has(key)) {
        unicos.set(key, item);
      }
    });

    return res.json(Array.from(unicos.values()))
  } catch (error) {
    console.error("❌ Error obteniendo filtros de informes:", error);
    return res.status(500).json({ error: "Error obteniendo filtros" });
  }
};

export const descargarInforme = async (req, res) => {
  const municipioId = req.query?.municipio_id ?? req.params?.municipioId;
  const ejercicioRaw = req.query?.ejercicio;
  const mesRaw = req.query?.mes;
  const modulo = normalizeModuloCierre(req.query?.modulo);

  const ejercicio = Number.parseInt(ejercicioRaw, 10);
  const mes = Number.parseInt(mesRaw, 10);

  if (!municipioId || Number.isNaN(ejercicio) || Number.isNaN(mes) || !modulo) {
    return res.status(400).json({
      error: "ID del municipio, ejercicio, mes y modulo son requeridos",
    });
  }

  if (mes < 1 || mes > 12) {
    return res.status(400).json({ error: "El mes debe estar entre 1 y 12" });
  }

  if (!MODULOS_VALIDOS.includes(modulo)) {
    return res.status(400).json({ error: "Modulo inválido" });
  }

  try{
    const { cierre, filename } = await obtenerNombreInformeCierreModulo(ejercicio, mes, municipioId, modulo);

    if (!cierre || !filename) {
      return res.status(404).json({ error: "No hay informe disponible con esos filtros" });
    }

    const filePath = await obtenerPathInformeCierreModulo(filename);

    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Disposition'
    );

    return res.download(filePath, filename, (err) => {
      if (err) {
        console.error("Error enviando archivo:", err);

        if (!res.headersSent) {
          res.status(500).json({
            error: "No se pudo descargar el archivo",
          });
        }
      }
    });
  }catch(error){
    console.error("❌ Error en descargarInforme:", error);
    return res.status(500).json({ error: "Error descargando informe" });
  }
};

export const listarCatalogoEjercicios = async (req, res) => {
  try {
    const ejercicios = await EjercicioMes.findAll({
      attributes: [
        [EjercicioMes.sequelize.fn("DISTINCT", EjercicioMes.sequelize.col("ejercicio")), "ejercicio"],
      ],
      order: [["ejercicio", "DESC"]],
      raw: true,
    });
    const catalogo = ejercicios.map((e) => e.ejercicio).filter(Boolean);
    res.json(catalogo);
  } catch (error) {
    console.error("❌ Error listando catálogo de ejercicios:", error);
    res.status(500).json({ error: "Error listando catálogo de ejercicios" });
  };
}
