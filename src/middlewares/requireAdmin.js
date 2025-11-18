import { Usuario, Rol } from "../models/index.js";

const adminRoleNames = (process.env.ADMIN_ROLE_NAMES || process.env.ADMIN_ROLE_NAME || "Administrador")
  .split(",")
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean);

export const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.usuario_id;

    if (!userId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    const usuario = await Usuario.findByPk(userId, {
      attributes: ["usuario_id"],
      include: [
        {
          model: Rol,
          as: "Roles",
          attributes: ["rol_id", "nombre"],
          through: { attributes: [] },
        },
      ],
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const isAdmin = (usuario.Roles || []).some((rol) =>
      adminRoleNames.includes((rol.nombre || "").toLowerCase())
    );

    if (!isAdmin) {
      return res.status(403).json({ error: "Acceso restringido a administradores" });
    }

    return next();
  } catch (error) {
    console.error("❌ Error verificando rol administrador:", error);
    return res.status(500).json({ error: "Error verificando permisos de administrador" });
  }
};
