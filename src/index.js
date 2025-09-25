import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

// === DB & Models ===
import sequelize from "./config/db.js";   // 🔹 Usar la conexión centralizada
import "./models/index.js";               // 🔹 Importar para cargar asociaciones

// === Importación de Rutas ===
import usuariosRoutes from "./routes/usuarios.routes.js";
import rolesRoutes from "./routes/roles.routes.js";
import municipiosRoutes from "./routes/municipios.routes.js";
import authRoutes from "./routes/auth.routes.js";
import ejerciciosRoutes from "./routes/ejercicios.routes.js";

// Cargar variables de entorno
dotenv.config();

const app = express();

// === Configuración básica ===
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// === Middlewares ===
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use(morgan("dev"));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 500,                 // máx. 500 requests
  })
);

// === Rutas ===
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/municipios", municipiosRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/ejercicios", ejerciciosRoutes);

// === Healthcheck ===
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "ovif-backend",
    ts: new Date().toISOString(),
  });
});

// === Arrancar servidor después de conectar a DB ===
async function start() {
  try {
    await sequelize.authenticate();
    console.log("✅ Conexión a la base de datos OK");

    app.listen(PORT, () => {
      console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Error conectando a la base de datos:", error);
    process.exit(1);
  }
}

start();
