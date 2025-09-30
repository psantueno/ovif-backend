import jwt from "jsonwebtoken";
import TokenBlacklist from "../models/TokenBlacklist.js";

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];


console.log("👉 Header:", authHeader);
  console.log("👉 Token extraído:", token);

  if (!token) return res.status(401).json({ error: "Token requerido" });

  try {
    // Verificar si está en blacklist
    const blacklisted = await TokenBlacklist.findOne({ where: { token } });
  
     console.log("👉 Blacklist result:", blacklisted);
    if (blacklisted) {
      console.log("❌ Token encontrado en blacklist");
      return res.status(401).json({ error: "Token inválido (logout previo)" });
    }

    // Verificar JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token inválido o expirado" });
  }
}
