// Modelo
import Municipio from "../models/Municipio.js";

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
