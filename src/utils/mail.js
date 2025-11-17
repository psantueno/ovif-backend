// utils/mail.js
import nodemailer from "nodemailer";

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

/**
 * Envía correo con enlace de restablecimiento de contraseña.
 */
export async function sendResetMail(to, nombre, resetLink) {
  try {
    const response = await transporter.sendMail({
      from: sender,
      to,
      subject: "Restablecer contraseña",
      html: `
        <!--  Banner institucional OVIF -->
        <div style="
          background-color: #2b3e4c;
          padding: 20px 10px;
          text-align: center;
          color: #f4e0b6;
          font-family: 'Arial', sans-serif;
          max-width: 60%;      
          padding: 20px 10px;  
          border-radius: 6px;  
        ">
          <h1 style="
            font-size: 22px;
            margin: 0;
            color: #f4e0b6;
            letter-spacing: 1px;
          ">
            <span style="color: #9ecf89; font-weight: bold;">OVIF</span>
            <span style="font-weight: bold;"> OFICINA VIRTUAL DE INFORMACIÓN FISCAL MUNICIPAL</span><br/>
          </h1>
        </div>

        <!-- 🔹 Cuerpo del mensaje -->
        <div style="font-family: Arial, sans-serif; color: #2b3e4c; padding: 2rem;">
          <p>Hola ${nombre || ""},</p>
          <p>Hacé clic en el siguiente botón para restablecer tu contraseña. Este enlace es válido por 1 hora:</p>
          <p style="margin: 2rem 0;">
          <a href="${resetLink}" target="_blank"
            style="display:inline-block;
            background:#2b3e4c;
            color:white;
            padding:12px 28px;
            border-radius:6px;
            text-decoration:none;
            font-weight:bold;">
          Restablecer contraseña
          </a>
          </p>
          <p>Si no solicitaste este cambio, simplemente ignorá este mensaje.</p>
          <hr style="border:none; border-top:1px solid #ddd; margin-top:2rem;">
          <small style="color:#555;">
            OVIF - Oficina Virtual de Información Fiscal Municipal<br/>
            Coordinación de Relaciones Fiscales con Municipios<br/>
            Gobierno de la Provincia del Neuquén
          </small>
        </div>
      `,
    });

    console.log("✅ Correo enviado:", response?.messageId || response);
    return response;
  } catch (error) {
    console.error("❌ Error enviando correo:", error);
    throw new Error("No se pudo enviar el correo de reseteo");
  }
}
