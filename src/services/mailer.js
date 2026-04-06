import nodemailer from "nodemailer";

const smtpPort = Number(process.env.SMTP_PORT || 25);

export const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: process.env.SMTP_SECURE === "true" || smtpPort === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const sender = process.env.EMAIL_FROM || "OVIF <ovif@haciendanqn.gob.ar>";

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

const obtenerNombreMes = (mesNumero) => {
    switch(mesNumero) {
        case 1:
            return "Enero";
        case 2: 
            return "Febrero";
        case 3:
            return "Marzo";
        case 4: 
            return "Abril";
        case 5:
            return "Mayo";
        case 6:
            return "Junio";
        case 7: 
            return "Julio";
        case 8: 
            return "Agosto";
        case 9: 
            return "Septiembre";
        case 10: 
            return "Octubre";
        case 11:
            return "Noviembre";
        case 12:
            return "Diciembre";
        default:
            return "Sin especificar";
    }
}

const armarMensajeCierreModulos = (ejercicio, mes, modulos, esProrroga) => {
    const fallback = "Le informamos que se cerró el plazo de entrega de información";

    if(!Number(ejercicio) && !Number(mes)) return fallback;

    if(!Array.isArray(modulos) && modulos.length < 2) return fallback;

    const seccionEjercicioMes = `${obtenerNombreMes(mes)} ${ejercicio}`

    let mensajeCierre = `Le informamos que se cerró el plazo de entrega de información para los módulos ${modulos[0]} y ${modulos[1]}`

    if (esProrroga) {
        mensajeCierre += ` correspondientes a la prorroga para el período ${seccionEjercicioMes}`;
    } else {
        mensajeCierre += ` correspondientes al período ${seccionEjercicioMes}`
    }

    return mensajeCierre;
}

export async function enviarMensajeCierreModulos(to, nombre, ejercicio, mes, modulos, esProrroga) {
    try {
        const mensaje = armarMensajeCierreModulos(ejercicio, mes, modulos, esProrroga);
        const response = await transporter.sendMail({
            from: sender,
            to,
            subject: "Cierre de módulos",
            html: `
                <!--  Banner institucional OVIF -->
                <div style="
                    background-color: #2b3e4c;
                    padding: 20px 10px;
                    text-align: center;
                    color: #f4e0b6;
                    font-family: 'Arial', sans-serif;
                    max-width: 100%;      
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
                <p>${mensaje}</p>
                <p style="margin: 2rem 0;">
                </p>
                <p>Ya puedes solicitar el informe de cierre correspondiente en la sección "Grilla de ejercicios históricos" de nuestra plataforma</p>
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

        //console.log(`Mail a enviar: to:${to}, nombre:${nombre}, mensaje: ${mensaje}`)
    } catch (error) {
        console.error("❌ Error enviando correo:", error);
        throw new Error("No se pudo enviar el correo de cierre de modulo");
    }
}
