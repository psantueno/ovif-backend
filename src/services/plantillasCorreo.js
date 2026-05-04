/*
 * plantillasCorreo.js — Plantillas HTML para todos los correos del sistema OVIF.
 *
 * Cada tipo de correo tiene su función renderizadora registrada en el mapa `renderers`.
 * Para agregar un tipo nuevo:
 *   1. Crear una función renderXxx(payload) que devuelva HTML.
 *   2. Registrarla en `renderers` con su clave (ej: "NUEVO_TIPO").
 *   3. Llamar renderizarCorreoHtml("NUEVO_TIPO", payload) desde emailService.js.
 */
import path from "path";
import { getModuloCierreLabel } from "../utils/cierreModulo.js";

// ─── Bloques reutilizables ───────────────────────────────────────────────────

const BANNER = `
<tr>
    <td
        align="center"
        style="
            background-color:#2b3e4c;
            padding:20px 10px;
            color:#f4e0b6;
            font-family:Manrope, Arial, sans-serif;
            border-top-left-radius:20px;
            border-top-right-radius:20px;
        "
    >
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
            <tr>
                <td>
                    <img 
                        src="cid:ovif-logo" 
                        alt="Logo OVIF"
                        style="height:70px; width:auto; display:block;"
                    >
                </td>
            </tr>
        </table>
    </td>
</tr>
`;

const FOOTER = `
<tr>
    <td
        style="
            background-color:#2b3e4c;
            padding:16px;
            border-top:1px solid #d9e1e7;
            border-bottom-left-radius:20px;
            border-bottom-right-radius:20px;
            text-align:center;
    "
    >
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
            <tr>
                <td style="padding-right:10px;vertical-align: bottom;">
                    <img 
                        src="cid:gobierno-logo"
                        style="width:90px; display:block;"
                        alt="Logo Gobierno de la Provincia de Neuquen"
                    >
                </td>
                <td style="padding-left:10px;vertical-align: bottom;">
                    <img 
                        src="cid:neuquen-logo"
                        style="width:100px; display:block;"
                        alt="Logo de la Provincia de Neuquen"
                    >
                </td>
            </tr>
        </table>
    </td>
</tr>
`;

const cuerpoCierreModulos = (destinatario, ejercicio, mes, modulos, esProrroga) => {
    return `
        <tr>
            <td
                style="
                    font-family:Arial, sans-serif;
                    color:#2b3e4c;
                    padding:32px;
                "
            >
                <p style="margin-top:0;">Hola ${destinatario},</p>
                <p>
                    Le informamos que finalizó el plazo de entrega de información para el periodo 
                    <b>${mes} ${ejercicio}</b>, correspondiente ${modulos.length === 1 ? 'al módulo' : 'a los módulos'} 
                    <b>${modulos.join(" y ")}</b>.
                </p>
                <table 
                    role="presentation" 
                    width="100%" 
                    cellpadding="0" 
                    cellspacing="0" 
                    border="0"
                    style="
                        max-width:565px;
                        background:#2b3e4c;
                        color:#ffffff;
                        border-radius:8px;
                        overflow:hidden;
                        margin:20px auto;
                    "
                >
                    <tr>
                        <td style="padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.35);">
                            <div style="font-size:12px; color:#d0d0d0; margin-bottom:4px;">Ejercicio</div>
                            <div style="font-size:20px; font-weight:700;">${ejercicio}</div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:14px 20px; border-bottom:1px solid rgba(255,255,255,0.35);">
                            <div style="font-size:12px; color:#d0d0d0; margin-bottom:4px;">Mes</div>
                            <div style="font-size:20px; font-weight:700;">${mes}</div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:14px 20px; border-bottom:1px solid rgba(255,255,255,0.35);">
                            <div style="font-size:12px; color:#d0d0d0; margin-bottom:4px;">Módulo/s</div>
                            <div style="font-size:20px; font-weight:700;">
                                ${modulos.join(" y ")}
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:14px 20px;">
                            <div style="font-size:12px; color:#d0d0d0; margin-bottom:4px;">Período</div>
                            <div style="font-size:20px; font-weight:700;">${esProrroga ? 'Prórroga' : 'Regular'}</div>
                        </td>
                    </tr>
                </table>
                <p style="margin:16px 0;">
                    Ya puedes solicitar el informe de cierre correspondiente en la sección "Grilla de ejercicios históricos" de la
                    <a 
                        href="https://ovif.economianqn.gob.ar/historico-ejercicios-cerrados"
                        style="color:#1a73e8; text-decoration:none; font-weight:bold;"
                        target="_blank"
                    >
                        OVIF
                    </a>
                </p>
                <p style="margin-top:24px; font-size:13px; color:#6b7280;">
                    Este mensaje fue generado automáticamente por OVIF - APP.
                    Por favor, no responder este correo.
                </p>
            </td>
        </tr>
    `;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const obtenerNombreMes = (mesNumero) => {
  const meses = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
    5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
    9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
  };
  return meses[mesNumero] || "Sin especificar";
};

// ─── Plantilla: Cierre de módulos ────────────────────────────────────────────
// Notifica al municipio que se cerró el plazo de carga para uno o más módulos.
function renderCierreModulos(payload) {
  const { nombre, ejercicio, mes, modulos, esProrroga } = payload;

  let mensaje = "Le informamos que finalizó el plazo de entrega de información";
  let periodoBadge = "";
  let modulosBadges = "";
  let modulosNormalizados = [];

  if (Number(ejercicio) && Number(mes) && Array.isArray(modulos) && modulos.length > 0) {
    modulosNormalizados = modulos
      .map((m) => getModuloCierreLabel(m))
      .filter(Boolean);
    const modulosTexto = new Intl.ListFormat("es-AR", {
      style: "long",
      type: "conjunction",
    }).format(modulosNormalizados);
  }

  return { html: `
    <table 
			role="presentation" 
			width="100%" 
			cellpadding="0" 
			cellspacing="0" 
			border="0"
			style="background-color:#ffffff; padding:20px 0;"
    >
      <tr>
				<td align="center">
					<table 
						role="presentation" 
						width="632" 
						cellpadding="0" 
						cellspacing="0" 
						border="0"
						style="
						max-width:632px;
						width:632px;
						background-color:#F4E0B6;
						border-radius:20px;
						overflow:hidden;
						border-collapse:separate;
						"
					>
							${BANNER}
							${cuerpoCierreModulos(nombre, ejercicio, obtenerNombreMes(mes), modulosNormalizados , esProrroga)}
							${FOOTER}
						</table>
					</td>
			</tr>
	</table>`,
	attachments: [
			{
					filename: 'ovif-logo.svg',
					path: './src/assets/emails/ovif-logo.svg',
					cid: 'ovif-logo' // same cid value as in the html img src
			},
			{
					filename: 'gobierno-logo.svg',
					path: './src/assets/emails/gobierno-logo.svg',
					cid: 'gobierno-logo' // same cid value as in the html img src
			},
			{
					filename: 'neuquen-logo.svg',
					path: './src/assets/emails/neuquen-logo.svg',
					cid: 'neuquen-logo' // same cid value as in the html img src
			}
	],
};
}

// ─── Plantilla: Restablecimiento de contraseña ──────────────────────────────
// Envía un botón con enlace de reset válido por 1 hora.
function renderResetPassword(payload) {
  const { nombre, resetLink } = payload;

  return { html: `
    <table
			role="presentation"
			width="850px"
			cellpadding="0"
			cellspacing="0"
			border="0"
			style="
					margin:0;
					padding:40px 0;
					font-family: 'Manrope';
			"
		>
      <tr>
        <td align="center">
					<table
						role="presentation"
						width="850"
						cellpadding="0"
						cellspacing="0"
						border="0"
						style="
							width:850px;
							max-width:850px;
							background-color:#F4E0B6;
							border-radius:18px;
							overflow:hidden;
							border-collapse:separate;
						"
					>
            <tr>
							<td
								style="
									background-color:#2b3e4c;
									padding:26px 34px 28px 34px;
								"
							>
								<table
									role="presentation"
									width="100%"
									cellpadding="0"
									cellspacing="0"
									border="0"
								>
                  <tr>
                    <td>
											<p
												style="
													margin:0;
													font-size:22px;
													line-height:28px;
													color:#ffffff;
													font-weight:bold;
												"
											>
                        Reestablecimiento de contraseña
                      </p>
                        <img src="cid:ovif-logo" alt="Logo OVIF" style="width: auto; height: 50px;margin-top: 10px;">
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td
                style="
                  background-color:#F4E0B6;
                  padding:34px;
                "
              >
								<p
									style="
										margin:0 0 22px 0;
										font-size:18px;
										line-height:28px;
										color:#2b3e4c;
									"
								>
									Hola, ${nombre}
								</p>
								<p
									style="
										margin:0 0 16px 0;
										font-size:18px;
										line-height:28px;
										color:#2b3e4c;
									"
								>
									Hacé clic en el siguiente botón para restablecer tu contraseña. Este enlace es válido por 1 hora:
								</p>
								<p
									style="
										margin:0 0 26px 0;
										font-size:18px;
										line-height:28px;
										color:#2b3e4c;
									"
								>
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
								<p 
									style="
										margin-top:2rem;
										margin-bottom:0;
										font-size:13px;
										color:#6b7280;
									"
								>
									Este mensaje fue generado automáticamente por OVIF - APP.
									Por favor, no responder este correo.
								</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`,
    attachments: [
        {
            filename: 'ovif-logo.svg',
            path: './src/assets/emails/ovif-logo.svg',
            cid: 'ovif-logo'
        }
    ]
};
}

// ─── Registro de plantillas ──────────────────────────────────────────────────

const renderers = {
  CIERRE_MODULOS: renderCierreModulos,
  RESET_PASSWORD: renderResetPassword,
};

// Renderiza el HTML de un correo según su tipo y payload.
export function renderizarCorreoHtml(tipo, payload) {
  const renderer = renderers[tipo];
  if (!renderer) {
    throw new Error(`Tipo de correo no soportado: ${tipo}`);
  }
  return renderer(payload);
}
