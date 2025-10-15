// utils/mail.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const sender = process.env.EMAIL_SENDER || "no-reply@ovif.neuquen.gob.ar";

/**
 * Envía correo con enlace de restablecimiento de contraseña.
 */
export async function sendResetMail(to, nombre, resetLink) {
  await resend.emails.send({
    from: `OVIF <${sender}>`,
    to,
    subject: "Restablecer contraseña",
    html: `
      <div style="font-family: Arial, sans-serif; color: #2b3e4c;">
        <h2 style="color: #2b3e4c;">Restablecer tu contraseña</h2>
        <p>Hola ${nombre || ""},</p>
        <p>Hacé clic en el siguiente enlace para restablecer tu contraseña. Este enlace es válido por 1 hora:</p>
        <p>
          <a href="${resetLink}" target="_blank"
             style="display:inline-block;background:#2b3e4c;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;">
             Restablecer contraseña
          </a>
        </p>
        <p>Si no solicitaste este cambio, simplemente ignorá este mensaje.</p>
        <hr>
        <small>OVIF - Oficina Virtual de Información Fiscal</small>
      </div>
    `,
  });
}
