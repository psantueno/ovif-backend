import jwt from "jsonwebtoken";
import TokenBlacklist from "../models/TokenBlacklist.js";

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Token requerido" });

  try {

    const blacklisted = await TokenBlacklist.findOne({ where: { token } });
  
    if (blacklisted) {
      return res.status(401).json({ error: "Token inválido (logout previo)" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token inválido o expirado" });
  }
}
