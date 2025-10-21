// Modelo
import { Municipio, EjercicioMes, EjercicioMesMunicipio, EjercicioMesCerrado } from "../models/index.js";

const toISODate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
};

// Obtener todos los municipios
export const getMunicipios = async (req, res) => {
  try {
    const municipios = await Municipio.findAll();
    res.json(municipios);
  } catch (error) {
    console.error("❌ Error consultando municipios:", error);
    res.status(500).json({ error: "Error consultando municipios" });
  }
};

export const listarEjerciciosDisponiblesPorMunicipio = async (req, res) => {
  const municipioId = Number(req.params.id || req.params.municipioId);
  console.log(req.params)
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

    if (ejercicios.length === 0) {
      return res.json({
        municipio: municipio.get(),
        ejercicios: [],
      });
    }

    const overrides = await EjercicioMesMunicipio.findAll({
      where: { municipio_id: municipioId },
    });
    const cierres = await EjercicioMesCerrado.findAll({
      where: { municipio_id: municipioId },
    });

    const overrideMap = new Map(
      overrides.map((o) => [`${o.ejercicio}-${o.mes}`, o])
    );
    const cierreMap = new Map(
      cierres.map((c) => [`${c.ejercicio}-${c.mes}`, c])
    );

    const hoy = toISODate(new Date());
    const disponibles = ejercicios
      .map((em) => {
        const key = `${em.ejercicio}-${em.mes}`;
        const override = overrideMap.get(key);
        const cierre = cierreMap.get(key);

        const fechaInicio = override?.fecha_inicio || em.fecha_inicio;
        const fechaFin = override?.fecha_fin || em.fecha_fin;
        const fechaCierre = cierre?.fecha || null;

        const fechaFinStr = toISODate(fechaFin);
        const fechaCierreStr = toISODate(fechaCierre);

        const vencido = fechaFinStr ? hoy > fechaFinStr : false;
        const cerrado = Boolean(cierre);
        const disponible = !vencido && !cerrado;

        return {
          ejercicio: em.ejercicio,
          mes: em.mes,
          fecha_inicio: toISODate(fechaInicio),
          fecha_fin: fechaFinStr,
          fecha_fin_oficial: toISODate(em.fecha_fin),
          tiene_prorroga: Boolean(override),
          fecha_cierre: fechaCierreStr,
          vencido,
          cerrado,
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
// export const deleteMunicipio = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const municipio = await Municipio.findByPk(id);

//     if (!municipio) {
//       return res.status(404).json({ error: "Municipio no encontrado" });
//     }

//     await municipio.destroy();

//     res.json({ message: "Municipio eliminado correctamente" });
//   } catch (error) {
//     console.error("❌ Error eliminando municipio:", error);
//     res.status(500).json({ error: "Error eliminando municipio" });
//   }
// };
