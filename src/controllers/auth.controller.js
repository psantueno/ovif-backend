import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import * as crypto from "crypto";
import { sendResetMail } from "../utils/mail.js";
import { PasswordReset, Usuario, Rol, AuthSession } from "../models/index.js";
import {
  ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME,
  ACCESS_COOKIE_OPTS, REFRESH_COOKIE_OPTS,
  CLEAR_ACCESS_COOKIE_OPTS, CLEAR_REFRESH_COOKIE_OPTS,
  ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL,
} from "../config/cookies.js";

// ============ Variables de entorno ============
const RESET_EXP_MINUTES = process.env.RESET_EXP_MINUTES || 60;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:4200";
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = "ovif-backend";
const JWT_AUDIENCE = "ovif-frontend";

// ============ Helpers ============
function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

function signAccessToken(user, sessionId) {
  const userId = user.usuario_id || user.id;
  return jwt.sign(
    {
      sub: userId,
      usuario_id: userId,
      sid: sessionId,
    },
    JWT_SECRET,
    {
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, ACCESS_COOKIE_OPTS);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTS);
}

function clearAuthCookies(res) {
  res.cookie(ACCESS_COOKIE_NAME, "", CLEAR_ACCESS_COOKIE_OPTS);
  res.cookie(REFRESH_COOKIE_NAME, "", CLEAR_REFRESH_COOKIE_OPTS);
}

/**
 * Rehidrata el usuario completo desde la BD.
 * Devuelve null si el usuario no existe o fue desactivado.
 */
async function loadFullUser(userId) {
  const user = await Usuario.findByPk(userId, {
    attributes: ["usuario_id", "usuario", "email", "nombre", "apellido", "activo"],
    include: [{
      model: Rol,
      as: "Roles",
      attributes: ["rol_id", "nombre"],
      through: { attributes: [] },
    }],
  });
  if (!user || !user.activo) return null;
  return {
    id: user.usuario_id,
    usuario: user.usuario,
    nombre: user.nombre,
    apellido: user.apellido,
    email: user.email,
    activo: user.activo,
    Roles: (user.Roles || []).map(r => ({ id: r.rol_id, nombre: r.nombre })),
  };
}

// =========================================================
//  LOGIN
// =========================================================
export const login = async (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: "Faltan credenciales" });
  }

  try {
    const user = await Usuario.findOne({
      where: { usuario },
      attributes: ["usuario_id", "usuario", "password", "activo"],
      include: [{
        model: Rol,
        as: "Roles",
        attributes: ["rol_id", "nombre"],
        through: { attributes: [] },
      }],
    });

    if (!user || !user.password || user.password.trim() === "") {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    if (!user.activo) {
      return res.status(403).json({ error: "Tu cuenta se encuentra deshabilitada. Contactá al administrador.", code: "USER_DISABLED" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // Crear sesión con refresh token
    const rawRefresh = generateRefreshToken();
    const familyId = crypto.randomUUID();

    const session = await AuthSession.create({
      family_id: familyId,
      usuario_id: user.usuario_id,
      refresh_token_hash: hashToken(rawRefresh),
      expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL * 1000),
      created_ip: req.ip,
      last_ip: req.ip,
      user_agent: (req.headers["user-agent"] || "").slice(0, 512),
    });

    const accessToken = signAccessToken(user, session.session_id);
    setAuthCookies(res, accessToken, rawRefresh);

    const roles = (user.Roles || []).map(r => ({ id: r.rol_id, nombre: r.nombre }));

    return res.json({
      user: {
        id: user.usuario_id,
        usuario: user.usuario,
        activo: user.activo,
        Roles: roles,
      },
    });
  } catch (error) {
    console.error("❌ Error en login:", error);
    return res.status(500).json({ error: "Error en el login" });
  }
};

// =========================================================
//  REFRESH
// =========================================================
export const refresh = async (req, res) => {
  const rawRefresh = req.cookies[REFRESH_COOKIE_NAME];

  if (!rawRefresh) {
    clearAuthCookies(res);
    return res.status(401).json({ error: "Sesión expirada" });
  }

  try {
    const tokenHash = hashToken(rawRefresh);
    const session = await AuthSession.findOne({ where: { refresh_token_hash: tokenHash } });

    // Token no encontrado o ya expirado
    if (!session || new Date(session.expires_at) < new Date()) {
      clearAuthCookies(res);
      return res.status(401).json({ error: "Sesión expirada" });
    }

    // Token ya fue rotado → posible replay attack → revocar toda la familia
    if (session.revoked_at || session.rotated_at) {
      await AuthSession.update(
        { revoked_at: new Date() },
        { where: { family_id: session.family_id, revoked_at: null } }
      );
      clearAuthCookies(res);
      console.warn(`⚠️ Replay detectado en familia ${session.family_id}, usuario ${session.usuario_id}`);
      return res.status(401).json({ error: "Sesión revocada por seguridad. Volvé a iniciar sesión." });
    }

    // Verificar que el usuario sigue activo
    const fullUser = await loadFullUser(session.usuario_id);
    if (!fullUser) {
      await AuthSession.update(
        { revoked_at: new Date() },
        { where: { family_id: session.family_id, revoked_at: null } }
      );
      clearAuthCookies(res);
      return res.status(401).json({ error: "Usuario deshabilitado" });
    }

    // Rotar refresh token
    const newRawRefresh = generateRefreshToken();

    const newSession = await AuthSession.create({
      family_id: session.family_id,
      usuario_id: session.usuario_id,
      refresh_token_hash: hashToken(newRawRefresh),
      expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL * 1000),
      created_ip: session.created_ip,
      last_ip: req.ip,
      user_agent: (req.headers["user-agent"] || "").slice(0, 512),
    });

    // Marcar la sesión anterior como rotada
    session.rotated_at = new Date();
    session.replaced_by_session_id = newSession.session_id;
    await session.save();

    const accessToken = signAccessToken(fullUser, newSession.session_id);
    setAuthCookies(res, accessToken, newRawRefresh);

    return res.json({ user: fullUser });
  } catch (error) {
    console.error("❌ Error en refresh:", error);
    clearAuthCookies(res);
    return res.status(500).json({ error: "Error refrescando sesión" });
  }
};

// =========================================================
//  PROFILE (rehidrata desde BD)
// =========================================================
export const profile = async (req, res) => {
  try {
    const fullUser = await loadFullUser(req.user.usuario_id);
    if (!fullUser) {
      clearAuthCookies(res);
      return res.status(401).json({ error: "Usuario no encontrado o deshabilitado" });
    }
    return res.json({ user: fullUser });
  } catch (error) {
    console.error("❌ Error en profile:", error);
    return res.status(500).json({ error: "Error obteniendo perfil" });
  }
};

// =========================================================
//  LOGOUT
// =========================================================
export const logout = async (req, res) => {
  try {
    // Revocar la sesión actual si tenemos sid del access token
    if (req.user?.sid) {
      const session = await AuthSession.findByPk(req.user.sid);
      if (session && !session.revoked_at) {
        session.revoked_at = new Date();
        await session.save();
      }
    }

    // Fallback: si hay refresh cookie, revocar también
    const rawRefresh = req.cookies[REFRESH_COOKIE_NAME];
    if (rawRefresh) {
      const tokenHash = hashToken(rawRefresh);
      await AuthSession.update(
        { revoked_at: new Date() },
        { where: { refresh_token_hash: tokenHash, revoked_at: null } }
      );
    }

    clearAuthCookies(res);
    return res.status(204).end();
  } catch (error) {
    console.error("❌ Error en logout:", error);
    clearAuthCookies(res);
    return res.status(204).end();
  }
};

// =========================================================
//  CHANGE PASSWORD
// =========================================================
export const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "Debes enviar contraseña actual y nueva" });
  }

  try {
    const user = await Usuario.findByPk(req.user.usuario_id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const validPassword = await bcrypt.compare(oldPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Contraseña actual incorrecta" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    // Revocar todas las sesiones del usuario (forzar re-login en otros dispositivos)
    await AuthSession.update(
      { revoked_at: new Date() },
      { where: { usuario_id: user.usuario_id, revoked_at: null } }
    );

    // Crear nueva sesión para el dispositivo actual
    const rawRefresh = generateRefreshToken();
    const familyId = crypto.randomUUID();

    const session = await AuthSession.create({
      family_id: familyId,
      usuario_id: user.usuario_id,
      refresh_token_hash: hashToken(rawRefresh),
      expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL * 1000),
      created_ip: req.ip,
      last_ip: req.ip,
      user_agent: (req.headers["user-agent"] || "").slice(0, 512),
    });

    const accessToken = signAccessToken(user, session.session_id);
    setAuthCookies(res, accessToken, rawRefresh);

    return res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("❌ Error cambiando contraseña:", error);
    return res.status(500).json({ error: "Error cambiando contraseña" });
  }
};

// =========================================================
//  FORGOT PASSWORD
// =========================================================
export const forgotPassword = async (req, res) => {
  const { usuario } = req.body;

  if (!usuario) {
    return res.status(400).json({ error: "Usuario requerido" });
  }

  try {
    const user = await Usuario.findOne({ where: { usuario } });
    if (!user) {
      return res.json({
        message: "Si existe una cuenta con ese usuario, se enviará un mail con instrucciones.",
      });
    }
    const email = user.email;
    if (!email) {
      return res.json({
        message: "Si existe una cuenta con ese usuario, se enviará un mail con instrucciones.",
      });
    }
    const [name, domain] = email.split("@");
    const maskedName =
      name.length > 4
        ? "*".repeat(name.length - 4) + name.slice(-4)
        : "*".repeat(name.length - 1) + name.slice(-1);
    const maskedEmail = `${maskedName}@${domain}`;

    await PasswordReset.destroy({
      where: { usuario_id: user.usuario_id, used_at: null },
    });

    const tokenRaw = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(tokenRaw).digest("hex");
    const expiresAt = new Date(Date.now() + RESET_EXP_MINUTES * 60 * 1000);

    await PasswordReset.create({
      usuario_id: user.usuario_id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    const resetLink = `${FRONTEND_URL}/reset-password?token=${tokenRaw}`;
    await sendResetMail(email, user.nombre || user.usuario, resetLink);

    return res.json({
      message: "Correo de blanqueo enviado.",
      maskedEmail,
    });
  } catch (error) {
    console.error("❌ Error en forgotPassword:", error);
    return res.status(500).json({ error: "Error procesando solicitud de reseteo" });
  }
};

// =========================================================
//  RESET PASSWORD
// =========================================================
export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ error: "Datos incompletos" });

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const pr = await PasswordReset.findOne({ where: { token_hash: tokenHash } });

    if (!pr || pr.used_at || new Date(pr.expires_at) < new Date())
      return res.status(400).json({ error: "Token inválido o expirado", code: "INVALID_TOKEN" });

    const user = await Usuario.findByPk(pr.usuario_id);
    if (!user)
      return res.status(404).json({ error: "Usuario no encontrado", code: "USER_NOT_FOUND" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    pr.used_at = new Date();
    await pr.save();

    // Revocar todas las sesiones activas del usuario
    await AuthSession.update(
      { revoked_at: new Date() },
      { where: { usuario_id: user.usuario_id, revoked_at: null } }
    );

    return res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("❌ Error en resetPassword:", error);
    return res.status(500).json({ error: "Error restableciendo la contraseña" });
  }
};
