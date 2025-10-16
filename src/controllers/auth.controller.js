import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendResetMail } from "../utils/mail.js";
import * as crypto from "crypto";

// === Modelos ===
import {PasswordReset, Usuario, TokenBlacklist } from "../models/index.js";
// ============ Variables de entorno ============
const RESET_EXP_MINUTES = process.env.RESET_EXP_MINUTES || 60; // default 60 min
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:4200";

// LOGIN (usuario y contraseña)
export const login = async (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: "Faltan credenciales" });
  }

  try {
    const user = await Usuario.findOne({ where: { usuario } });

    if (!user) return res.status(401).json({ error: "Usuario no encontrado" });
    if (!user.password || user.password.trim() === "") {
      return res.status(401).json({ error: "Usuario sin contraseña configurada" });
    }

    // 🚫 verificar usuario activo
    if (!user.activo) {
      return res.status(403).json({
        error: "El usuario se encuentra deshabilitado. Contacte al administrador.",
        code: "USER_DISABLED",
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    // 👇 Ahora guardamos usuario_id directamente
    const payload = {
      usuario_id: user.usuario_id,
      usuario: user.usuario,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "4h" });

    return res.json({
      token,
      user: {
        id: user.usuario_id,
        usuario: user.usuario,
        activo: user.activo,
      },
    });
  } catch (error) {
    console.error("❌ Error en login:", error);
    return res.status(500).json({ error: "Error en el login" });
  }
};

// ACTUALIZAR CONTRASEÑA (usuario autenticado)
export const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "Debes enviar contraseña actual y nueva" });
  }

  try {
    // 👇 Ahora usamos req.user.usuario_id
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

    return res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("❌ Error cambiando contraseña:", error);
    return res.status(500).json({ error: "Error cambiando contraseña" });
  }
};

// LOGOUT (invalida el token JWT)
export const logout = async (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(400).json({ error: "Token requerido para logout" });
  }

  try {
    const decoded = jwt.decode(token); // no usamos verify, solo leemos payload
    const exp = decoded.exp * 1000; // viene en segundos → pasamos a ms

    await TokenBlacklist.create({
      token,
      usuario_id: decoded.usuario_id, // 👈 ahora consistente
      fecha_expiracion: new Date(exp),
    });

    return res.json({ message: "Logout exitoso, token invalidado" });
  } catch (err) {
    console.error("❌ Error en logout:", err);
    return res.status(500).json({ error: "Error cerrando sesión" });
  }
};



// ==================================================
//  FORGOT PASSWORD (reset link con token temporal)
// ==================================================
export const forgotPassword = async (req, res) => {
  const { usuario } = req.body;

  if (!usuario) {
    return res.status(400).json({ error: "Usuario requerido" });
  }

  try {
    const user = await Usuario.findOne({ where: { usuario } });
    if (!user) {
      // respuesta neutra
      return res.json({
        message: "Si existe una cuenta con ese usuario, se enviará un mail con instrucciones.",
      });
    }
    //esto: " const email = user.email;" iría aca abajo cuando se configure el dominio en resend 👇🏼 
    const email = 'seba.antueno@gmail.com';
    const [name, domain] = email.split("@");
    const maskedName =
      name.length > 4
        ? "*".repeat(name.length - 4) + name.slice(-4)
        : "*".repeat(name.length - 1) + name.slice(-1);
    const maskedEmail = `${maskedName}@${domain}`;

    // 1️⃣ Eliminar tokens viejos no usados
    await PasswordReset.destroy({
      where: { usuario_id: user.usuario_id, used_at: null },
    });

    // 2️⃣ Generar token temporal
    const tokenRaw = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(tokenRaw).digest("hex");
    const expiresAt = new Date(Date.now() + RESET_EXP_MINUTES * 60 * 1000);

    // 3️⃣ Guardar en tabla ovif_password_resets
    await PasswordReset.create({
      usuario_id: user.usuario_id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    // 4️⃣ Crear enlace al frontend
    const resetLink = `${FRONTEND_URL}/reset-password?token=${tokenRaw}`;

    // 5️⃣ Enviar correo con Resend
    await sendResetMail(user.email, user.nombre || user.usuario, resetLink);

    // 6️⃣ Devolver respuesta con correo enmascarado
    return res.json({
      message: "Correo de blanqueo enviado.",
      maskedEmail,
    });
  } catch (error) {
    console.error("❌ Error en forgotPassword:", error);
    return res.status(500).json({ error: "Error procesando solicitud de reseteo" });
  }
};




// ==================================================
//  RESET PASSWORD (desde enlace)
// ==================================================
export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ error: "Datos incompletos" });

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const pr = await PasswordReset.findOne({ where: { token_hash: tokenHash } });

    if (!pr)
      return res.status(400).json({ error: "Token inválido", code: "INVALID_TOKEN" });
    if (pr.used_at)
      return res.status(400).json({ error: "Enlace ya utilizado", code: "TOKEN_USED" });
    if (new Date(pr.expires_at) < new Date())
      return res.status(400).json({ error: "El enlace expiró", code: "TOKEN_EXPIRED" });

    const user = await Usuario.findByPk(pr.usuario_id);
    if (!user)
      return res.status(404).json({ error: "Usuario no encontrado", code: "USER_NOT_FOUND" });

    const hash = await bcrypt.hash(newPassword, 10);
    user.password = hash;
    await user.save();

    pr.used_at = new Date();
    await pr.save();

    return res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("❌ Error en resetPassword:", error);
    return res.status(500).json({ error: "Error restableciendo la contraseña" });
  }
};
