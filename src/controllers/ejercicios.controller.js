// Modelos
import {
  EjercicioMes,
  EjercicioMesMunicipio,
  EjercicioMesMunicipioAuditoria,
  EjercicioMesCerrado,
  Municipio,
} from "../models/index.js";

const isValidISODate = (value) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === trimmed;
};


// Listar todos los ejercicios
// GET /api/ejercicios
export const listarEjercicios = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 12;
    const yearRaw = req.query.year;

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

    const { rows, count } = await EjercicioMes.findAndCountAll({
      where,
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
  const { ejercicio, mes, fecha_inicio, fecha_fin } = req.body;
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
      where: { ejercicio: ejercicioParsed, mes: mesParsed },
    });

    if (existente) {
      return res.status(409).json({ error: "Ya existe un ejercicio/mes con esos valores." });
    }

    const nuevo = await EjercicioMes.create({
      ejercicio: ejercicioParsed,
      mes: mesParsed,
      fecha_inicio: fechaInicioDate,
      fecha_fin: fechaFinDate,
      creado_por: usuarioId,
    });
    res.status(201).json(nuevo);
  } catch (error) {
    res.status(500).json({ error: "Error creando ejercicio" });
  }
};


// Actualizar ejercicio existente
// PUT /api/ejercicios/:ejercicio/mes/:mes
export const updateEjercicio = async (req, res) => {
  const { ejercicio, mes } = req.params;
  const { fecha_inicio, fecha_fin } = req.body;
  const usuarioId = req.user?.usuario_id;

  if (!usuarioId) {
    return res.status(401).json({ error: "Usuario autenticado requerido para modificar el ejercicio." });
  }

  try {
    const em = await EjercicioMes.findOne({ where: { ejercicio, mes } });
    if (!em) return res.status(404).json({ error: "Ejercicio/Mes no encontrado" });
    em.fecha_inicio = fecha_inicio;
    em.fecha_fin = fecha_fin;
    em.modificado_por = usuarioId;
    await em.save();
    res.json(em);
  } catch (error) {
    res.status(500).json({ error: "Error actualizando ejercicio" });
  }
};

// Borrar ejercicio: DELETE /api/ejercicios/:ejercicio/mes/:mes
export const deleteEjercicio = async (req, res) => {
  const { ejercicio, mes } = req.params;
  try {
    const deleted = await EjercicioMes.destroy({ where: { ejercicio, mes } });
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
  const { fecha_fin, comentario } = req.body;
  const usuarioId = req.user?.usuario_id; // authMiddleware lo setea

  if (!fecha_fin) return res.status(400).json({ error: "Debe enviar fecha_fin" });

  try {
    // buscar oficial
    const oficial = await EjercicioMes.findOne({ where: { ejercicio, mes } });
    if (!oficial) return res.status(404).json({ error: "Ejercicio/Mes no encontrado" });

    // buscar override o crear
    let override = await EjercicioMesMunicipio.findOne({ where: { ejercicio, mes, municipio_id: municipioId } });
    if (!override) {
      override = await EjercicioMesMunicipio.create({
        ejercicio,
        mes,
        municipio_id: municipioId,
        fecha_inicio: oficial.fecha_inicio,
        fecha_fin: oficial.fecha_fin,
      });
    }

    const fechaVieja = override.fecha_fin;
    override.fecha_fin = fecha_fin;
    await override.save();

    await EjercicioMesMunicipioAuditoria.create({
      ejercicio,
      mes,
      municipio_id: municipioId,
      usuario_id: usuarioId,
      fecha_cierre_old: fechaVieja,
      fecha_cierre_new: fecha_fin,
      comentario,
    });

    res.json({
      message: "✅ Prórroga aplicada",
      ejercicio,
      mes,
      municipio_id: municipioId,
      fecha_cierre_old: fechaVieja,
      fecha_cierre_new: fecha_fin,
    });

  } catch (error) {
    res.status(500).json({ error: "Error aplicando prórroga" });
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
    const override = await EjercicioMesMunicipio.findOne({
      where: { ejercicio, mes, municipio_id: municipioId },
    });

    // 3. Calcular fechas efectivas
    const fecha_inicio = override?.fecha_inicio || oficial.fecha_inicio;
    const fecha_fin = override?.fecha_fin || oficial.fecha_fin;

    // 4. Devolver resultado
    return res.json({
      ejercicio,
      mes,
      municipio_id: municipioId,
      fecha_inicio,
      fecha_fin,
      override: !!override, // true si hubo prórroga
    });

  } catch (error) {
    console.error("❌ Error en getFechaLimite:", error);
    return res.status(500).json({ error: "Error consultando fecha límite" });
  }
};


// Registra el cierre de un ejercicio/mes por parte de un municipio
// POST /api/ejercicios/:ejercicio/mes/:mes/municipios/:municipioId/cerrar
export const cerrarMesMunicipio = async (req, res) => {
  const { ejercicio, mes, municipioId } = req.params;
  const { informe_recursos, informe_gastos, informe_personal } = req.body;
  const fechaHoy = new Date().toISOString().split("T")[0];

  try {
    // === 1. Validar que exista el ejercicio/mes oficial
    const oficial = await EjercicioMes.findOne({ where: { ejercicio, mes } });
    if (!oficial) {
      return res.status(404).json({ error: "Ejercicio/Mes no encontrado en calendario oficial" });
    }

    // === 2. Verificar si hay override de fechas para el municipio
    const override = await EjercicioMesMunicipio.findOne({
      where: { ejercicio, mes, municipio_id: municipioId },
    });

    const fechaLimite = override?.fecha_fin || oficial.fecha_fin;

    // Validar fecha de cierre
    if (fechaHoy > new Date(fechaLimite).toISOString().split("T")[0]) {
      return res.status(400).json({ error: "El plazo de carga ya venció, no se puede cerrar" });
    }

    // === 3. Validar si ya existe un cierre registrado
    const existente = await EjercicioMesCerrado.findOne({
      where: { ejercicio, mes, municipio_id: municipioId },
    });
    if (existente) {
      return res.status(400).json({ error: "El municipio ya cerró este ejercicio/mes" });
    }

    // === 4. Registrar el cierre
    // 📌 IMPORTANTE: no validamos si hay datos en gastos, recursos o personal.
    // Si no existen registros, simplemente el municipio queda "cerrado en blanco".
    const cierre = await EjercicioMesCerrado.create({
      ejercicio,
      mes,
      municipio_id: municipioId,
      fecha: fechaHoy,
      informe_recursos: informe_recursos || "",
      informe_gastos: informe_gastos || "",
      informe_personal: informe_personal || "",
    });

    return res.status(201).json({
      message: "✅ Cierre registrado correctamente",
      cierre,
    });
  } catch (error) {
    console.error("❌ Error en cerrarMesMunicipio:", error);
    return res.status(500).json({ error: "Error registrando cierre" });
  }
};


// Lista todos los municipios que completaron el cierre para un ejercicio y mes dados
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

    const override = await EjercicioMesMunicipio.findOne({
      where: { ejercicio, mes, municipio_id: municipioId },
    });

    const fechaLimite = override?.fecha_fin || oficial.fecha_fin;

    // 3. Comparar estado
    const fechaCierre = new Date(cierre.fecha);
    const limite = new Date(fechaLimite);

    const estado = fechaCierre <= limite ? "CUMPLIO" : "FUERA DE PLAZO";

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
    const overrides = await EjercicioMesMunicipio.findAll({
      where: { ejercicio, mes },
    });

    const cierres = await EjercicioMesCerrado.findAll({
      where: { ejercicio, mes },
    });

    // 4. Mapear para lookup rápido
    const overridesMap = new Map(
      overrides.map(o => [`${o.municipio_id}`, o])
    );
    const cierresMap = new Map(
      cierres.map(c => [`${c.municipio_id}`, c])
    );

    // 5. Armar resultado
    const resultado = municipios.map(m => {
      const override = overridesMap.get(`${m.municipio_id}`);
      const cierre = cierresMap.get(`${m.municipio_id}`);

      const fechaLimite = override?.fecha_fin || oficial.fecha_fin;
      let estado;
      let fechaCierre = null;

      if (!cierre) {
        estado = "SIN CERRAR";
      } else {
        fechaCierre = cierre.fecha;
        const fechaCierreDate = new Date(fechaCierre);
        const fechaLimiteDate = new Date(fechaLimite);
        estado = fechaCierreDate <= fechaLimiteDate ? "CUMPLIO" : "FUERA DE PLAZO";
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
