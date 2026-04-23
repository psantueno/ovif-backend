import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

// === DB & Models ===
import sequelize from "./config/db.js";  
import "./models/index.js";              

// === Importación de Middlewares ===
import { maintenanceMode } from "./middlewares/maintenanceMode.js";

// === Importación de Rutas ===
import usuariosRoutes from "./routes/usuarios.routes.js";
import rolesRoutes from "./routes/roles.routes.js";
import municipiosRoutes from "./routes/municipios.routes.js";
import authRoutes from "./routes/auth.routes.js";
import ejerciciosRoutes from "./routes/ejercicios.routes.js";
import gastosRoutes from "./routes/gastos.routes.js";
import cronRoutes from "./routes/cron.routes.js";
import recursoRoutes from "./routes/recurso.routes.js";
import pautasConvenioRoutes from "./routes/pautasConvenio.routes.js";
import conveniosRoutes from "./routes/convenios.routes.js";
import logsRoutes from "./routes/logs.routes.js";
import parametrosRoutes from "./routes/parametros.routes.js";
import conceptosRecaudacionRoutes from "./routes/conceptosRecaudacion.routes.js";
import partidasRecursosRoutes from "./routes/partidasRecursos.routes.js";
import tiposPautaRoutes from "./routes/tiposPauta.routes.js";
import municipiosMailsRoutes from "./routes/municipiosMails.routes.js";

// === Importación de CRON cierre automático del ejercicio/mes ===
import "./cron/cierreAutomatico.js";


// Cargar variables de entorno
dotenv.config();

const app = express();

// === Configuración básica ===
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || false;
const IS_PROD = process.env.NODE_ENV === "production";

// Confiar en 1 nivel de proxy (nginx) — necesario para req.ip, cookies Secure, rate limiting
if (IS_PROD) {
  app.set("trust proxy", 1);
}

// === Middlewares ===
app.use(cookieParser());
app.use((req, res, next) => {
  const isDownload = req.path.startsWith("/api/ejercicios/informes/download") || req.originalUrl.includes("/informes/download");
  if (isDownload) {
    return helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false })(req, res, next);
  }
  return helmet()(req, res, next);
});
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ limit: "5mb", extended: true }));
app.use(morgan("dev"));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 500,                 // máx. 500 requests
  })
);

// === Mantenimiento ===
app.get("/api/status", (req, res) => {
  res.json({ maintenance: process.env.MAINTENANCE === "true" });
});
app.use(maintenanceMode);

// === Rutas ===
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/municipios", municipiosRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/ejercicios", ejerciciosRoutes);
app.use("/api/gastos", gastosRoutes);
app.use("/api/cron-logs", cronRoutes);
app.use("/api/recursos", recursoRoutes);
app.use("/api/pautas-convenio", pautasConvenioRoutes);
app.use("/api/convenios", conveniosRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/parametros", parametrosRoutes);
//app.use("/api/conceptos-recaudaciones", conceptosRecaudacionRoutes);
app.use("/api/partidas-recursos", partidasRecursosRoutes);
app.use("/api/tipos-pauta", tiposPautaRoutes);
app.use("/api/municipios-mails", municipiosMailsRoutes);

// === Healthcheck (con verificación de BD) ===
app.get("/api/health", async (req, res) => {
  try {
    await sequelize.query("SELECT 1");
    res.json({
      ok: true,
      service: "ovif-backend",
      db: "connected",
      ts: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      ok: false,
      service: "ovif-backend",
      db: "disconnected",
      ts: new Date().toISOString(),
    });
  }
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
