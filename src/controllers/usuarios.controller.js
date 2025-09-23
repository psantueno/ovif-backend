// Modelos
import Usuario from "../models/Usuario.js";
import Rol from "../models/Rol.js";

// Librerías
import bcrypt from "bcrypt";

// Obtener todos los usuarios
export const getUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.findAll();
    res.json(usuarios);
  } catch (err) {
    console.error("❌ Error consultando usuarios:", err);
    res.status(500).json({ error: "Error consultando usuarios" });
  }
};

// Obtener un usuario por ID
export const getUsuarioById = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json(usuario);
  } catch (err) {
    console.error("❌ Error consultando usuario:", err);
    res.status(500).json({ error: "Error consultando usuario" });
  }
};


// ============ CRUD DE USUARIOS ============ //

// CREATE - Crear nuevo usuario
export const createUsuario = async (req, res) => {
  const { usuario, email, password, nombre, apellido, roles } = req.body;

  if (!usuario || !password || !email) {
    return res.status(400).json({ error: "Usuario, email y contraseña son obligatorios" });
  }

  try {
    // Verificar que no exista ya
    const exists = await Usuario.findOne({ where: { usuario } });
    if (exists) {
      return res.status(400).json({ error: "El usuario ya existe" });
    }

    // Hashear contraseña
    const hashed = await bcrypt.hash(password, 10);

    // Crear usuario
    const newUser = await Usuario.create({
      usuario,
      email,
      password: hashed,
      nombre: nombre || "",
      apellido: apellido || "",
      activo: 1,
    });

    // Asignar roles si vienen en el body
    if (roles && roles.length > 0) {
      const rolesEncontrados = await Rol.findAll({ where: { rol_id: roles } });
      await newUser.setRoles(rolesEncontrados);
    }

    return res.status(201).json({
      message: "Usuario creado exitosamente",
      user: {
        id: newUser.usuario_id,
        usuario: newUser.usuario,
        email: newUser.email,
        nombre: newUser.nombre,
        apellido: newUser.apellido,
        activo: newUser.activo,
      },
    });
  } catch (error) {
    console.error("❌ Error creando usuario:", error);
    return res.status(500).json({ error: "Error creando usuario" });
  }
};


// EDIT - Actualizar usuario existente
export const updateUsuario = async (req, res) => {
  const { id } = req.params;
  const { email, nombre, apellido, activo, password } = req.body;

  try {
    const user = await Usuario.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (email) user.email = email;
    if (nombre) user.nombre = nombre;
    if (apellido) user.apellido = apellido;
    if (activo !== undefined) user.activo = activo ? 1 : 0;

    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      user.password = hashed;
    }

    await user.save();

    return res.json({
      message: "Usuario actualizado correctamente",
      user,
    });
  } catch (error) {
    console.error("❌ Error actualizando usuario:", error);
    return res.status(500).json({ error: "Error actualizando usuario" });
  }
};


// EDIT ROL - Modificar rol del usuario

export const updateUsuarioRoles = async (req, res) => {
  const { id } = req.params;
  const { roles } = req.body;

  if (!roles || !Array.isArray(roles)) {
    return res.status(400).json({ error: "Debes enviar un arreglo de roles" });
  }

  try {
    const user = await Usuario.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const rolesEncontrados = await Rol.findAll({ where: { rol_id: roles } });
    await user.setRoles(rolesEncontrados);

    const userWithRoles = await Usuario.findByPk(id, { include: Rol });

    return res.json({
      message: "Roles actualizados correctamente",
      user: userWithRoles,
    });
  } catch (error) {
    console.error("❌ Error actualizando roles:", error);
    return res.status(500).json({ error: "Error actualizando roles" });
  }
};


// DELETE - Soft delete para "borrar" usuario => (activo = 0)
export const softDeleteUsuario = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await Usuario.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    user.activo = 0;
    await user.save();

    return res.json({ message: "Usuario dado de baja correctamente" });
  } catch (error) {
    console.error("❌ Error dando de baja usuario:", error);
    return res.status(500).json({ error: "Error dando de baja usuario" });
  }
};

