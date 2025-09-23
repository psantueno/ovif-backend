import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// === Modelos ===
import Usuario from "../models/Usuario.js";
import TokenBlacklist from "../models/TokenBlacklist.js";


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

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    const payload = {
      sub: user.usuario_id,
      usuario: user.usuario,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "4h" });

    return res.json({
      token,
      user: {
        id: user.usuario_id,
        usuario: user.usuario,
      },
    });
  } catch (error) {
    console.error("❌ Error en login:", error);
    return res.status(500).json({ error: "Error en el login" });
  }
};




// ACTUALIZAR | BLANQUEAR CONTRASEÑA
export const setPassword = async (req, res) => {
  const { usuario_id, password } = req.body;

  if (!usuario_id || !password) {
    return res.status(400).json({ error: "usuario_id y contraseña son obligatorios" });
  }

  try {
    const user = await Usuario.findByPk(usuario_id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const hashed = await bcrypt.hash(password, 10);

    user.password = hashed;
    await user.save();

    return res.json({ message: `Contraseña actualizada para el usuario_id ${usuario_id}` });
  } catch (error) {
    console.error("❌ Error en setPassword:", error);
    return res.status(500).json({ error: "Error actualizando contraseña" });
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
      usuario_id: decoded.sub,
      fecha_expiracion: new Date(exp),
    });

    return res.json({ message: "Logout exitoso, token invalidado" });
  } catch (err) {
    console.error("❌ Error en logout:", err);
    return res.status(500).json({ error: "Error cerrando sesión" });
  }
};
