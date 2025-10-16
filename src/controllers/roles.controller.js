// Modelo
import { Rol } from "../models/index.js";

// Obtener todos los roles
export const getRoles = async (req, res) => {
  try {
    const roles = await Rol.findAll();
    res.json(roles);
  } catch (error) {
    console.error("❌ Error consultando roles:", error);
    res.status(500).json({ error: "Error consultando roles" });
  }
};


// 📌 Endpoint liviano para selects
// GET /api/roles/select
export const getRolesSelect = async (req, res) => {
  try {
    const roles = await Rol.findAll({
      attributes: ["rol_id", "nombre"],
      order: [["nombre", "ASC"]],
    });
    res.json(roles);
  } catch (error) {
    console.error("❌ Error consultando roles:", error);
    res.status(500).json({ error: "Error consultando roles" });
  }
};

// Obtener un rol por ID
export const getRolById = async (req, res) => {
  const { id } = req.params;

  try {
    const rol = await Rol.findByPk(id);

    if (!rol) {
      return res.status(404).json({ error: "Rol no encontrado" });
    }

    res.json(rol);
  } catch (error) {
    console.error("❌ Error consultando rol:", error);
    res.status(500).json({ error: "Error consultando rol" });
  }
};

// Crear un nuevo rol
export const createRol = async (req, res) => {
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: "El nombre del rol es obligatorio" });
  }

  try {
    const exists = await Rol.findOne({ where: { nombre } });

    if (exists) {
      return res.status(400).json({ error: "El rol ya existe" });
    }

    const nuevoRol = await Rol.create({ nombre });

    res.status(201).json({
      message: "Rol creado correctamente",
      rol: nuevoRol,
    });
  } catch (error) {
    console.error("❌ Error creando rol:", error);
    res.status(500).json({ error: "Error creando rol" });
  }
};

// Actualizar un rol existente
export const updateRol = async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: "El nombre del rol es obligatorio" });
  }

  try {
    const rol = await Rol.findByPk(id);

    if (!rol) {
      return res.status(404).json({ error: "Rol no encontrado" });
    }

    const rolConNombre = await Rol.findOne({ where: { nombre } });

    if (rolConNombre && rolConNombre.rol_id !== rol.rol_id) {
      return res.status(400).json({ error: "Ya existe otro rol con ese nombre" });
    }

    rol.nombre = nombre;
    rol.fecha_actualizacion = new Date();
    await rol.save();

    res.json({
      message: "Rol actualizado correctamente",
      rol,
    });
  } catch (error) {
    console.error("❌ Error actualizando rol:", error);
    res.status(500).json({ error: "Error actualizando rol" });
  }
};

// Eliminar un rol definitivamente
export const deleteRol = async (req, res) => {
  const { id } = req.params;

  try {
    const rol = await Rol.findByPk(id);

    if (!rol) {
      return res.status(404).json({ error: "Rol no encontrado" });
    }

    // Verificar si está asignado a algún usuario
    const asignado = await UsuarioRol.findOne({ where: { rol_id: id } });

    if (asignado) {
      return res.status(400).json({
        error: "El rol no puede eliminarse porque está asignado a uno o más usuarios",
      });
    }

    await rol.destroy();

    res.json({ message: "Rol eliminado correctamente" });
  } catch (error) {
    console.error("❌ Error eliminando rol:", error);
    res.status(500).json({ error: "Error eliminando rol" });
  }
};

