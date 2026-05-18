import { Usuario, Rol } from "../models/index.js";

const adminRoleNames = (process.env.ADMIN_ROLE_NAMES || process.env.ADMIN_ROLE_NAME || "Administrador")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);

// Adjunta req.isAdmin sin bloquear la solicitud.
// Usar en rutas que deben comportarse diferente según el rol (no como guard).
export const setIsAdmin = async (req, res, next) => {
    try {
        const userId = req.user?.usuario_id;
        if (!userId) {
            req.isAdmin = false;
            return next();
        }
        const usuario = await Usuario.findByPk(userId, {
            attributes: ["usuario_id"],
            include: [{ model: Rol, as: "Roles", attributes: ["nombre"], through: { attributes: [] } }],
        });
        req.isAdmin = (usuario?.Roles || []).some((rol) =>
            adminRoleNames.includes((rol.nombre || "").toLowerCase())
        );
        return next();
    } catch {
        req.isAdmin = false;
        return next();
    }
};
