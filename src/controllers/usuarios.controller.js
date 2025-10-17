import { Op, literal  } from "sequelize";
// Modelos
import { Usuario, Rol, Municipio, EjercicioMesMunicipioAuditoria } from "../models/index.js";

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
  console.log("Body recibido", req.body)

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


export const getUsuarioMunicipios = async (req, res) => {
  const { id } = req.params;

  try {
    const usuario = await Usuario.findByPk(id, {
      include: [{
        model: Municipio,
        attributes: ["municipio_id", "municipio_nombre"],
        through: { attributes: [] }
      }],
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const municipios = (usuario.Municipios || []).map((municipio) => ({
      municipio_id: municipio.municipio_id,
      municipio_nombre: municipio.municipio_nombre,
    }));

    return res.json({ municipios });
  } catch (error) {
    console.error("❌ Error obteniendo municipios del usuario:", error);
    return res.status(500).json({ error: "Error obteniendo municipios del usuario" });
  }
};

// EDIT MUNICIPIO - Modificar municipios asociados al usuario (uno o más)
export const updateUsuarioMunicipios = async (req, res) => {
  const { id } = req.params;
  const { municipios } = req.body;

  console.log("Body recibido", req.body)
  if (!municipios || !Array.isArray(municipios)) {
    return res.status(400).json({ error: "Debes enviar un arreglo de municipios" });
  }

  try {
    const user = await Usuario.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const uniqueMunicipios = [...new Set(municipios)]
      .map((mun) => Number(mun))
      .filter((mun) => !Number.isNaN(mun));

    if (municipios.length > 0 && uniqueMunicipios.length === 0) {
      return res.status(400).json({ error: "Debes enviar IDs válidos de municipios" });
    }

    const municipiosEncontrados = uniqueMunicipios.length > 0
      ? await Municipio.findAll({ where: { municipio_id: uniqueMunicipios } })
      : [];

    if (uniqueMunicipios.length > 0 && municipiosEncontrados.length !== uniqueMunicipios.length) {
      const encontrados = new Set(municipiosEncontrados.map((municipio) => municipio.municipio_id));
      const faltantes = uniqueMunicipios.filter((munId) => !encontrados.has(munId));
      return res.status(400).json({
        error: "Uno o más municipios no existen",
        faltantes,
      });
    }

    await user.setMunicipios(municipiosEncontrados);

    await user.reload({
      include: [{
        model: Municipio,
        attributes: ["municipio_id", "municipio_nombre"],
        through: { attributes: [] }
      }],
    });

    const municipiosAsignados = (user.Municipios || []).map((municipio) => ({
      municipio_id: municipio.municipio_id,
      municipio_nombre: municipio.municipio_nombre,
    }));

    return res.json({
      message: "Municipios actualizados correctamente",
      municipios: municipiosAsignados,
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



// DELETE - Eliminar usuario permanentemente (con verificación de auditorías)
export const deleteUsuario = async (req, res) => {
  const { id } = req.params;

  try {
    // 1️⃣ Verificar si el usuario existe
    const user = await Usuario.findByPk(id);
    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado",
        code: "USER_NOT_FOUND",
      });
    }

    // 2️⃣ Verificar si tiene registros en auditorías
    const auditorias = await EjercicioMesMunicipioAuditoria.count({
      where: { usuario_id: id },
    });

    if (auditorias > 0) {
      return res.status(409).json({
        error:
          "No se puede eliminar el usuario debido a restricciones de integridad de la base de datos.",
        code: "USER_HAS_AUDIT_LOGS",
        details: {
          auditorias_vinculadas: auditorias,
        },
      });
    }

    // 3️⃣ Eliminar usuario (y sus relaciones en cascada)
    await user.destroy();

    return res.json({
      message: "Usuario eliminado permanentemente.",
      code: "USER_DELETED",
    });

  } catch (error) {
    console.error("❌ Error eliminando usuario:", error);

    // 4️⃣ Captura de errores por restricciones FK o errores de BD
    if (error.name === "SequelizeForeignKeyConstraintError") {
      return res.status(409).json({
        error:
          "El usuario tiene registros asociados en otras tablas y no puede eliminarse.",
        code: "USER_HAS_DEPENDENCIES",
      });
    }

    // 5️⃣ Error genérico
    return res.status(500).json({
      error: "Error eliminando usuario",
      code: "USER_DELETE_ERROR",
    });
  }
};



// Municipios del usuario autenticado (según JWT)
export const obtenerMisMunicipios = async (req, res) => {
  try {
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

    // Si no tiene municipios, mando {}
    const municipios = usuario.Municipios || [];
    return res.json(municipios);
  } catch (err) {
    console.error("❌ obtenerMisMunicipios:", err);
    return res.status(500).json({ error: "Error obteniendo municipios" });
  }
};



// GET /api/usuarios?pagina=1&limite=10&nombre=...&apellido=...&rol=1&municipio=5&activo=true
// controllers/usuarios.controller.js
export const getUsuarios = async (req, res) => {
  try {
    let { pagina = 1, limite = 10, search, rol, municipio, activo } = req.query;
    pagina = Math.max(parseInt(pagina) || 1, 1);
    limite = Math.max(parseInt(limite) || 10, 1);

    const where = {};
    if (search) {
      where[Op.or] = [
        { usuario:  { [Op.like]: `%${search}%` } },
        { nombre:   { [Op.like]: `%${search}%` } },
        { apellido: { [Op.like]: `%${search}%` } },
        { email:    { [Op.like]: `%${search}%` } },
      ];
    }
    if (activo !== undefined && activo !== "") {
      where.activo = activo === "true";
    }

    // 🔹 Includes sólo para aplicar filtros (no traen datos)
    const includeFilters = [];
    if (rol) {
      includeFilters.push({
        model: Rol,
        through: { attributes: [] },
        where: { rol_id: rol },
        required: true,
        attributes: []
      });
    }
    if (municipio) {
      includeFilters.push({
        model: Municipio,
        through: { attributes: [] },
        where: { municipio_id: municipio },
        required: true,
        attributes: []
      });
    }

    // 1️⃣ IDs únicos (paginación real)
    const offset = (pagina - 1) * limite;
    const usuariosIds = await Usuario.findAll({
      attributes: ["usuario_id"],
      where,
      include: includeFilters,
      group: ["Usuario.usuario_id"],
      order: [["apellido", "ASC"], ["usuario_id", "ASC"]],
      limit: limite,
      offset,
      raw: true,
      subQuery: false,
    });
    const ids = usuariosIds.map(u => u.usuario_id);

    // 2️⃣ Conteo total exacto (con filtros)
    const total = await Usuario.count({
      where,
      include: includeFilters,
      distinct: true,
      col: "usuario_id",
    });

    if (ids.length === 0) {
      return res.json({ total, pagina, limite, totalPaginas: 0, data: [] });
    }

    // 3️⃣ Usuarios básicos de la página (sin includes)
    const usuariosBase = await Usuario.findAll({
      where: { usuario_id: ids },
      order: [[literal(`FIELD(Usuario.usuario_id, ${ids.join(",")})`), "ASC"]],
      raw: true,
      nest: true,
    });

    // 4️⃣ Cargar Roles y Municipios en consultas separadas
    const rolesPorUsuario = await Usuario.findAll({
      where: { usuario_id: ids },
      include: [{ model: Rol, through: { attributes: [] } }],
    });
    const municipiosPorUsuario = await Usuario.findAll({
      where: { usuario_id: ids },
      include: [{ model: Municipio, through: { attributes: [] } }],
    });

    // 5️⃣ Armar maps de relaciones
    const rolesMap = {};
    rolesPorUsuario.forEach(u => {
      rolesMap[u.usuario_id] = u.Rols?.map(r => ({
        rol_id: r.rol_id,
        nombre: r.nombre
      })) || [];
    });

    const municipiosMap = {};
    municipiosPorUsuario.forEach(u => {
      municipiosMap[u.usuario_id] = u.Municipios?.map(m => ({
        municipio_id: m.municipio_id,
        municipio_nombre: m.municipio_nombre
      })) || [];
    });

    // 6️⃣ Combinar usuarios con sus relaciones
    const data = usuariosBase.map(u => ({
      ...u,
      Roles: rolesMap[u.usuario_id] || [],
      Municipios: municipiosMap[u.usuario_id] || [],
    }));

    const totalPaginas = Math.ceil(total / limite);

    return res.json({
      total,
      pagina,
      limite,
      totalPaginas,
      data,
    });

  } catch (error) {
    console.error("❌ Error en getUsuarios:", error);
    return res.status(500).json({ error: "Error listando usuarios" });
  }
};


// Cambiar estado activo/inactivo al user
export const toggleUsuarioActivo = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await Usuario.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    user.activo = !user.activo;
    await user.save();

    return res.json({
      message: `Usuario ${user.activo ? "habilitado" : "deshabilitado"} correctamente`,
      user,
    });
  } catch (error) {
    console.error("❌ Error cambiando estado de usuario:", error);
    return res.status(500).json({ error: "Error cambiando estado de usuario" });
  }
};
