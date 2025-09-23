import { Router } from "express";

// === Controllers ===
import { login, register, setPassword, logout } from "../controllers/auth.controller.js";

// === Middlewares ===
import { authenticateToken } from "../middlewares/auth.js";


const router = Router();

// Login con usuario y password
router.post("/login", login);

// Registro de nuevo usuario


// Actualizar o blanquear contraseña
router.post("/set-password", setPassword);

// Logout (invalida el token)
router.post("/logout", authenticateToken, logout);

// Ruta protegida de ejemplo
router.get("/profile", authenticateToken, (req, res) => {
  res.json({ message: "Perfil de usuario", user: req.user });
});


export default router;
