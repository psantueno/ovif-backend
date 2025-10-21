// Modelos
import {
  EjercicioMes,
  EjercicioMesMunicipio,
  EjercicioMesMunicipioAuditoria,
  EjercicioMesCerrado,
  Municipio,
} from "../models/index.js";


// Listar todos los ejercicios
// GET /api/ejercicios
export const listarEjercicios = async (req, res) => {
  try {
    const ejercicios = await EjercicioMes.findAll();
    res.json(ejercicios);
  } catch (error) {
    res.status(500).json({ error: "Error listando ejercicios" });
  }
};


// Crear nuevo ejercicio
// POST /api/ejercicios
export const crearEjercicio = async (req, res) => {
  try {
    const { ejercicio, mes, fecha_inicio, fecha_fin } = req.body;
    const nuevo = await EjercicioMes.create({ ejercicio, mes, fecha_inicio, fecha_fin });
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
  try {
    const em = await EjercicioMes.findOne({ where: { ejercicio, mes } });
    if (!em) return res.status(404).json({ error: "Ejercicio/Mes no encontrado" });
    em.fecha_inicio = fecha_inicio;
    em.fecha_fin = fecha_fin;
    await em.save();
    res.json(em);
  } catch (error) {
    res.status(500).json({ error: "Error actualizando ejercicio" });
  }
};

// Borrar ejercicio
// DELETE /api/ejercicios/:ejercicio/mes/:mes
// export const deleteEjercicio = async (req, res) => {
//   const { ejercicio, mes } = req.params;
//   try {
//     const deleted = await EjercicioMes.destroy({ where: { ejercicio, mes } });
//     if (!deleted) return res.status(404).json({ error: "Ejercicio/Mes no encontrado" });
//     res.json({ message: "Ejercicio/Mes eliminado" });
//   } catch (error) {
//     res.status(500).json({ error: "Error eliminando ejercicio" });
//   }
// };

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