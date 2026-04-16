import jwt from "jsonwebtoken";
import { ACCESS_COOKIE_NAME } from "../config/cookies.js";

const JWT_ISSUER = "ovif-backend";
const JWT_AUDIENCE = "ovif-frontend";

export async function authenticateToken(req, res, next) {
  // Leer access token desde cookie
  const token = req.cookies[ACCESS_COOKIE_NAME];

  if (!token) return res.status(401).json({ error: "Token requerido" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}
