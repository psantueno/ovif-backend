import { Op } from "sequelize";
// Modelos
import Usuario from "../models/Usuario.js";
import Rol from "../models/Rol.js";
import Municipio from "../models/Municipio.js";

// Librerías
import bcrypt from "bcrypt";


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
  const { email, nombre, apellido, activo } = req.body;

  try {
    const user = await Usuario.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (email) user.email = email;
    if (nombre) user.nombre = nombre;
    if (apellido) user.apellido = apellido;
    if (activo !== undefined) user.activo = activo ? 1 : 0;

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


// EDIT MUNICIPIO - Modificar municipios asociados al usuario (uno o más)
export const updateUsuarioMunicipios = async (req, res) => {
  const { id } = req.params;
  const { municipios } = req.body;

  if (!municipios || !Array.isArray(municipios)) {
    return res.status(400).json({ error: "Debes enviar un arreglo de municipios" });
  }

  try {
    const user = await Usuario.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const municipiosEncontrados = await Municipio.findAll({
      where: { municipio_id: municipios },
    });

    await user.setMunicipios(municipiosEncontrados);

    const userWithMunicipios = await Usuario.findByPk(id, { include: Municipio });

    return res.json({
      message: "Municipios actualizados correctamente",
      user: userWithMunicipios,
    });
  } catch (error) {
    console.error("❌ Error actualizando municipios:", error);
    return res.status(500).json({ error: "Error actualizando municipios" });
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



// DELETE - Eliminar usuario permanentemente
export const deleteUsuario = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await Usuario.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    await user.destroy(); // 👈 elimina definitivamente de la DB

    return res.json({ message: "Usuario eliminado permanentemente" });
  } catch (error) {
    console.error("❌ Error eliminando usuario:", error);
    return res.status(500).json({ error: "Error eliminando usuario" });
  }
};


// Municipios del usuario autenticado (según JWT)
export const obtenerMisMunicipios = async (req, res) => {
  try {
    // Asumiendo que authenticateToken setea req.user.usuario_id
    const usuarioId = Number(req.user?.usuario_id);
    if (!usuarioId) return res.status(401).json({ error: "No autenticado" });

    const usuario = await Usuario.findByPk(usuarioId, {
      include: [{
        model: Municipio,
        attributes: ["municipio_id", "municipio_nombre"],
        through: { attributes: [] }
      }],
    });

    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
    return res.json(usuario.Municipios);
  } catch (err) {
    console.error("❌ obtenerMisMunicipios:", err);
    return res.status(500).json({ error: "Error obteniendo municipios" });
  }
};


// GET /api/usuarios?pagina=1&limite=10&nombre=...&apellido=...&rol=1&municipio=5&activo=true
export const getUsuarios = async (req, res) => {
  try {
    let { pagina = 1, limite = 10, search, rol, municipio, activo } = req.query;
    pagina = parseInt(pagina);
    limite = parseInt(limite);

    // WHERE dinámico
    const where = {};

    // 🔎 búsqueda global (usuario, nombre, apellido, email)
    if (search) {
      where[Op.or] = [
        { usuario: { [Op.like]: `%${search}%` } },
        { nombre: { [Op.like]: `%${search}%` } },
        { apellido: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    // 🔹 activo / inactivo
    if (activo !== undefined && activo !== "") {
      where.activo = activo === "true";
    }

    // Includes dinámicos
    const include = [];

    // 🔹 Rol
    if (rol) {
      include.push({
        model: Rol,
        through: { attributes: [] },
        where: { rol_id: rol },
        required: true,
      });
    } else {
      include.push({ model: Rol, through: { attributes: [] } });
    }

    // 🔹 Municipio
    if (municipio) {
      include.push({
        model: Municipio,
        through: { attributes: [] },
        where: { municipio_id: municipio },
        required: true,
      });
    } else {
      include.push({ model: Municipio, through: { attributes: [] } });
    }

    // Consulta con Sequelize
    const { count, rows } = await Usuario.findAndCountAll({
      where,
      include,
      offset: (pagina - 1) * limite,
      limit: limite,
      order: [["apellido", "ASC"]],
    });

    return res.json({
      total: count,
      pagina,
      limite,
      data: rows,
    });
  } catch (error) {
    console.error("❌ Error en getUsuarios:", error);
    return res.status(500).json({ error: "Error listando usuarios" });
  }
};