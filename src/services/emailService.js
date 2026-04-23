/*
 * emailService.js — Servicio centralizado de envío de correos electrónicos.
 *
 * Responsabilidades:
 *   - Configuración SMTP (transporter / sender)
 *   - Encolado de correos con idempotencia (outbox en ovif_envio_correos)
 *   - Procesamiento síncrono de pendientes con reintentos y lock optimista
 *   - Envío directo para correos puntuales (ej: reset de contraseña)
 *
 * Funciones exportadas:
 *   - encolarEnvioCierreModulos()  → Encola notificación de cierre de módulos
 *   - procesarMailsPendientes()    → Procesa lote de correos pendientes con retry
 *   - sendResetMail()              → Envía correo de restablecimiento de contraseña
 */
import nodemailer from "nodemailer";
import crypto from "crypto";
import { Op, UniqueConstraintError, col } from "sequelize";
import EnvioCorreo from "../models/moduloEjercicios/EnvioCorreo.js";
import { renderizarCorreoHtml } from "./plantillasCorreo.js";

// ─── Configuración SMTP ──────────────────────────────────────────────────────

const smtpPort = Number(process.env.SMTP_PORT || 25);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: process.env.SMTP_SECURE === "true" || smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sender = process.env.EMAIL_FROM || "OVIF <ovif@haciendanqn.gob.ar>";

// ─── Helpers internos ────────────────────────────────────────────────────────

const DEFAULT_RETRY_DELAYS_MS = [0, 1000, 3000];

// Pausa entre reintentos dentro de una misma corrida
const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

// Recorta el mensaje de error a 1000 chars para almacenar en BD
const truncarError = (error) => error?.message?.substring(0, 1000) ?? "Error desconocido";

/**
 * Encola un correo de cierre de módulos en la cola de envíos.
 * Usa una clave idempotente para evitar duplicados.
 *
 * @param {object} params
 * @param {string} params.destinatario - Email del destinatario
 * @param {string} params.nombre - Nombre del destinatario
 * @param {number} params.ejercicio
 * @param {number} params.mes
 * @param {string[]} params.modulos
 * @param {boolean} params.esProrroga
 * @returns {Promise<{ correo: EnvioCorreo, created: boolean }>}
 */
export async function encolarEnvioCierreModulos({ destinatario, nombre, ejercicio, mes, modulos, esProrroga }) {
  const modulosNormalizados = [...modulos].sort();
  const modulosOrdenados = modulosNormalizados.join(",");
  const tipo = esProrroga ? "PRORROGA" : "REGULAR";

  // Clave idempotente: mismo destinatario + ejercicio + mes + módulos + tipo = mismo mail
  const raw = `CIERRE_MODULOS|${destinatario}|${ejercicio}|${mes}|${modulosOrdenados}|${tipo}`;
  const idempotencyKey = crypto.createHash("sha256").update(raw).digest("hex");
  const payload = {
    idempotency_key: idempotencyKey,
    tipo: "CIERRE_MODULOS",
    destinatario,
    nombre_destinatario: nombre,
    asunto: "Cierre de módulos",
    payload: {
      nombre,
      ejercicio,
      mes,
      modulos: modulosNormalizados,
      esProrroga,
    },
    estado: "PENDIENTE",
    next_retry_at: new Date(),
  };

  try {
    const correo = await EnvioCorreo.create(payload);
    return { correo, created: true };
  } catch (error) {
    // El índice único es la fuente de verdad ante concurrencia.
    if (!(error instanceof UniqueConstraintError) && error?.name !== "SequelizeUniqueConstraintError") {
      throw error;
    }

    const existente = await EnvioCorreo.findOne({
      where: { idempotency_key: idempotencyKey },
    });

    if (existente) {
      return { correo: existente, created: false };
    }

    throw error;
  }
}

// Envía un correo individual usando lock optimista (UPDATE WHERE estado = estado_actual).
// Si otro proceso ya tomó el correo, retorna { status: "skipped" }.
async function enviarCorreo(correo, { nextRetryAt = null } = {}) {
  const [updated] = await EnvioCorreo.update(
    { estado: "ENVIANDO" },
    {
      where: {
        id: correo.id,
        estado: correo.estado,
      },
    }
  );

  if (updated === 0) {
    return { status: "skipped", correo };
  }

  try {
    const html = renderizarCorreoHtml(correo.tipo, correo.payload);
    const response = await transporter.sendMail({
      from: sender,
      to: correo.destinatario,
      subject: correo.asunto,
      html,
    });

    const enviadoAt = new Date();
    const correoActualizado = {
      ...correo,
      estado: "ENVIADO",
      intentos: Number(correo.intentos) + 1,
      enviado_at: enviadoAt,
      message_id: response?.messageId || null,
      ultimo_error: null,
      next_retry_at: null,
    };

    await EnvioCorreo.update(
      {
        estado: "ENVIADO",
        intentos: correoActualizado.intentos,
        enviado_at: enviadoAt,
        message_id: correoActualizado.message_id,
        ultimo_error: null,
        next_retry_at: null,
      },
      { where: { id: correo.id } }
    );

    return { status: "sent", correo: correoActualizado };
  } catch (error) {
    const intentos = Number(correo.intentos) + 1;
    const agotado = intentos >= Number(correo.max_intentos);
    const correoActualizado = {
      ...correo,
      estado: "ERROR",
      intentos,
      ultimo_error: truncarError(error),
      next_retry_at: agotado ? null : nextRetryAt,
    };

    await EnvioCorreo.update(
      {
        estado: "ERROR",
        intentos,
        ultimo_error: correoActualizado.ultimo_error,
        next_retry_at: correoActualizado.next_retry_at,
      },
      { where: { id: correo.id } }
    );

    return {
      status: "failed",
      correo: correoActualizado,
      agotado,
      error: correoActualizado.ultimo_error,
    };
  }
}

// Procesa un lote de correos pendientes por IDs. Para cada uno, intenta hasta
// maxAttemptsPerRun veces en la misma corrida, con pausa configurable entre reintentos.
// Retorna un resumen { total, sent, failed, skipped }.
export async function procesarMailsPendientes({
  ids = [],
  maxAttemptsPerRun = 3,
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
} = {}) {
  const uniqueIds = [...new Set((ids ?? []).filter((id) => Number.isInteger(Number(id))).map(Number))];

  if (!uniqueIds.length) {
    return { total: 0, sent: 0, failed: 0, skipped: 0 };
  }

  const pendientes = await EnvioCorreo.findAll({
    where: {
      id: { [Op.in]: uniqueIds },
      estado: { [Op.in]: ["PENDIENTE", "ERROR"] },
      intentos: { [Op.lt]: col("max_intentos") },
    },
    order: [["created_at", "ASC"]],
  });

  const pendientesPorId = new Map(
    pendientes.map((correo) => [Number(correo.id), correo.toJSON ? correo.toJSON() : correo])
  );

  const resumen = {
    total: uniqueIds.length,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  for (const id of uniqueIds) {
    let correo = pendientesPorId.get(id);
    if (!correo) {
      resumen.skipped += 1;
      continue;
    }

    const intentosDisponibles = Number(correo.max_intentos) - Number(correo.intentos);
    const intentosEnCorrida = Math.min(Math.max(maxAttemptsPerRun, 0), intentosDisponibles);

    if (intentosEnCorrida <= 0) {
      resumen.skipped += 1;
      continue;
    }

    let intentosEjecutados = 0;
    let resultadoFinal = "skipped";

    while (intentosEjecutados < intentosEnCorrida) {
      const intentosRestantes = intentosEnCorrida - intentosEjecutados - 1;
      const retryDelayMs =
        retryDelaysMs[Math.min(intentosEjecutados, retryDelaysMs.length - 1)] ?? 0;
      const nextRetryAt =
        intentosRestantes > 0 ? new Date(Date.now() + Math.max(retryDelayMs, 0)) : null;

      const resultado = await enviarCorreo(correo, { nextRetryAt });
      intentosEjecutados += 1;

      if (resultado.status === "sent") {
        resumen.sent += 1;
        resultadoFinal = "sent";
        break;
      }

      if (resultado.status === "skipped") {
        resumen.skipped += 1;
        resultadoFinal = "skipped";
        break;
      }

      correo = resultado.correo;
      if (resultado.agotado || intentosEjecutados >= intentosEnCorrida) {
        resumen.failed += 1;
        resultadoFinal = "failed";
        break;
      }

      if (retryDelayMs > 0) {
        await sleep(retryDelayMs);
      }
    }

    if (resultadoFinal === "skipped" && intentosEjecutados === 0) {
      resumen.skipped += 1;
    }
  }

  return resumen;
}

// ─── Envío directo (sin outbox) ──────────────────────────────────────────────

// Envía correo de restablecimiento de contraseña con enlace de un solo uso.
// Usado desde auth.controller.js en el flujo de "olvidé mi contraseña".
export async function sendResetMail(to, nombre, resetLink) {
  try {
    const html = renderizarCorreoHtml("RESET_PASSWORD", { nombre, resetLink });
    const response = await transporter.sendMail({
      from: sender,
      to,
      subject: "Restablecer contraseña",
      html,
    });

    console.log("✅ Correo enviado:", response?.messageId || response);
    return response;
  } catch (error) {
    console.error("❌ Error enviando correo:", error);
    throw new Error("No se pudo enviar el correo de reseteo");
  }
}
