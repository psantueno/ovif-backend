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

const getDDMMYYYY = (str) => {
  if (!str) return null;
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

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
					filename: 'ovif-logo.png',
					path: './src/assets/emails/ovif-logo.png',
					cid: 'ovif-logo' // same cid value as in the html img src
			},
			{
					filename: 'gobierno-logo.png',
					path: './src/assets/emails/gobierno-logo.png',
					cid: 'gobierno-logo' // same cid value as in the html img src
			},
			{
					filename: 'neuquen-logo.png',
					path: './src/assets/emails/neuquen-logo.png',
					cid: 'neuquen-logo' // same cid value as in the html img src
			}
	],
};
}

// ─── Plantilla: Recordatorio de cierre ───────────────────────────────────────
// Avisa al municipio que se acerca el vencimiento del plazo de carga de una pauta
// (un mail por pauta, con los módulos que agrupa). Mismo encabezado y pie que el
// aviso de cierre de módulos.

const escaparHtml = (valor) =>
  String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Días calendario entre dos fechas YYYY-MM-DD (sin horas ni zona horaria).
const diasEntreFechas = (desdeISO, hastaISO) => {
  const parse = (str) => {
    const match = String(str ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  };
  const desde = parse(desdeISO);
  const hasta = parse(hastaISO);
  if (desde === null || hasta === null) return null;
  return Math.round((hasta - desde) / 86400000);
};

const leyendaDiasRestantes = (dias) => {
  if (dias === null || dias < 0) return "";
  if (dias === 0) return "Hoy es el último día para realizar la carga.";
  if (dias === 1) return "Mañana es el último día para realizar la carga.";
  return `Faltan ${dias} días para el vencimiento.`;
};

function renderRecordatorioCierre(payload) {
  const {
    nombre,
    municipio,
    ejercicio,
    mes,
    modulos = [],
    fecha_cierre: fechaCierre,
    tiene_prorroga: tieneProrroga,
    fecha_referencia: fechaReferencia,
  } = payload ?? {};

  const modulosLabels = (Array.isArray(modulos) ? modulos : [])
    .map((m) => getModuloCierreLabel(m))
    .filter(Boolean);
  const modulosTexto = new Intl.ListFormat("es-AR", { style: "long", type: "conjunction" })
    .format(modulosLabels);
  const periodoTexto = `${obtenerNombreMes(Number(mes))} ${ejercicio ?? ""}`.trim();
  const fechaCierreTexto = getDDMMYYYY(fechaCierre) ?? "Sin especificar";

  // Los días se calculan al momento de enviar (un reintento posterior muestra el dato vigente).
  const hoy = fechaReferencia ?? new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
  const dias = diasEntreFechas(hoy, fechaCierre);
  const leyenda = leyendaDiasRestantes(dias);

  const nombreSeguro = escaparHtml(nombre);
  const municipioSeguro = escaparHtml(municipio);
  const modulosSeguro = escaparHtml(modulosTexto);
  const periodoSeguro = escaparHtml(periodoTexto);
  const fechaSegura = escaparHtml(fechaCierreTexto);
  const leyendaSegura = escaparHtml(leyenda);

  const filaDetalle = (rotulo, valor, ultima = false) => `
                    <tr>
                      <td style="padding:12px 20px;${ultima ? "" : " border-bottom:1px solid #ead9ae;"}">
                        <div style="font-size:12px; line-height:16px; color:#5a6b78; text-transform:uppercase; letter-spacing:0.5px;">${rotulo}</div>
                        <div style="font-size:18px; line-height:24px; font-weight:700; color:#2b3e4c;">${valor}</div>
                      </td>
                    </tr>`;

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
            <tr>
              <td style="font-family:Arial, sans-serif; color:#2b3e4c; padding:28px 32px 32px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;">
                  <tr>
                    <td style="vertical-align:middle; padding-right:12px;">
                      <img src="cid:megafono" alt="Megáfono" width="44" height="44" style="display:block; width:44px; height:44px; border:0;">
                    </td>
                    <td style="vertical-align:middle; font-family:Arial, sans-serif; font-size:22px; line-height:28px; font-weight:700; color:#2b3e4c;">
                      RECORDATORIO DE CIERRE DE MÓDULOS
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 18px 0; font-size:16px; line-height:24px;">Hola ${nombreSeguro},</p>
                <p style="margin:0 0 20px 0; font-size:16px; line-height:24px;">
                  Le recordamos que el plazo de entrega de información del período
                  <b>${periodoSeguro}</b>, correspondiente ${modulosLabels.length === 1 ? "al módulo" : "a los módulos"}
                  <b>${modulosSeguro}</b>, vence el <b>${fechaSegura}</b>.
                </p>

                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="background-color:#fffaf0; border:2px solid #E0A100; border-radius:12px; border-collapse:separate; overflow:hidden;"
                >
                  <tr>
                    <td style="background-color:#E0A100; padding:8px 20px; font-family:Arial, sans-serif; font-size:13px; line-height:18px; font-weight:700; letter-spacing:1px; color:#2b3e4c; text-transform:uppercase;">
                      Atención &middot; Vencimiento próximo
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 20px 8px 20px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="96" style="width:96px; vertical-align:middle;">
                            <img src="cid:alerta-triangulo" alt="Signo de advertencia" width="88" height="88" style="display:block; width:88px; height:88px; border:0;">
                          </td>
                          <td style="vertical-align:middle; font-family:Arial, sans-serif; padding-left:4px;">
                            <div style="font-size:20px; line-height:26px; font-weight:700; color:#2b3e4c;">Vence el ${fechaSegura}${tieneProrroga ? " (Prórroga)" : ""}</div>
                            ${leyenda ? `<div style="font-size:15px; line-height:22px; color:#2b3e4c; margin-top:4px;">${leyendaSegura}</div>` : ""}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0 8px 0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ead9ae;">
                        ${municipioSeguro ? filaDetalle("Municipio", municipioSeguro) : ""}
                        ${filaDetalle("Período", periodoSeguro)}
                        ${filaDetalle("Módulo/s", modulosSeguro)}
                        ${filaDetalle(`Fecha de vencimiento${tieneProrroga ? " (Prórroga)" : ""}`, fechaSegura, true)}
                      </table>
                    </td>
                  </tr>
                </table>

                <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:26px auto 0 auto;">
                  <tr>
                    <td align="center" bgcolor="#2b3e4c" style="background-color:#2b3e4c; border-radius:8px;">
                      <a
                        href="https://ovif.economianqn.gob.ar"
                        target="_blank"
                        style="display:inline-block; padding:14px 40px; font-family:Arial, sans-serif; font-size:16px; line-height:20px; font-weight:700; color:#f4e0b6; text-decoration:none; border-radius:8px;"
                      >IR A OVIF</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:16px 0 0 0; text-align:center; font-size:13px; line-height:18px; color:#2b3e4c;">
                  o puede pegar la siguiente URL en su navegador: <a href="https://ovif.economianqn.gob.ar" target="_blank" style="color:#1a73e8; text-decoration:underline;">https://ovif.economianqn.gob.ar</a>
                </p>

                <p style="margin:24px 0 0 0; font-size:13px; line-height:18px; color:#4b5560; font-style:italic">
                  Este mensaje fue generado automáticamente por OVIF - APP.
                  Por favor, no responder este correo.
                </p>
              </td>
            </tr>
            ${FOOTER}
          </table>
        </td>
      </tr>
    </table>`,
    priority: "high", // se envía con X-Priority / Importance: High
    attachments: [
      { filename: "ovif-logo.png", path: "./src/assets/emails/ovif-logo.png", cid: "ovif-logo" },
      { filename: "gobierno-logo.png", path: "./src/assets/emails/gobierno-logo.png", cid: "gobierno-logo" },
      { filename: "neuquen-logo.png", path: "./src/assets/emails/neuquen-logo.png", cid: "neuquen-logo" },
      { filename: "alerta-triangulo.png", path: "./src/assets/emails/alerta-triangulo.png", cid: "alerta-triangulo" },
      { filename: "megafono.png", path: "./src/assets/emails/megafono.png", cid: "megafono" },
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
            filename: 'ovif-logo.png',
            path: './src/assets/emails/ovif-logo.png',
            cid: 'ovif-logo'
        }
    ]
};
}

// ─── Plantilla: Solicitud de prórroga creada ────────────────────────────────
// Notifica a los admins que un operario envió una nueva solicitud de prórroga.
function renderSolicitudProrrogaCreada(payload) {
  const { nombre, solicitante, municipios = [] } = payload;

  const filasTabla = municipios.map((item) => `
    <tr>
      <td style="padding:10px 20px; border-bottom:1px solid rgba(255,255,255,0.15); vertical-align:top;">
        <div style="font-size:13px; color:#d0d0d0; margin-bottom:2px;">Municipio</div>
        <div style="font-size:15px; font-weight:700;">${item.municipio}</div>
      </td>
      <td style="padding:10px 20px; border-bottom:1px solid rgba(255,255,255,0.15); vertical-align:top;">
        <div style="font-size:13px; color:#d0d0d0; margin-bottom:2px;">Período</div>
        <div style="font-size:15px; font-weight:700;">${obtenerNombreMes(item.mes)} ${item.ejercicio}</div>
      </td>
      <td style="padding:10px 20px; border-bottom:1px solid rgba(255,255,255,0.15); vertical-align:top;">
        <div style="font-size:13px; color:#d0d0d0; margin-bottom:2px;">Pauta</div>
        <div style="font-size:15px; font-weight:700;">${item.pauta}</div>
      </td>
      <td style="padding:10px 20px; border-bottom:1px solid rgba(255,255,255,0.15); vertical-align:top;">
        <div style="font-size:13px; color:#d0d0d0; margin-bottom:2px;">Fecha solicitada</div>
        <div style="font-size:15px; font-weight:700;">${getDDMMYYYY(item.fechaSolicitada)}</div>
      </td>
    </tr>
  `).join("");

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
            <tr>
              <td style="font-family:Arial, sans-serif; color:#2b3e4c; padding:32px;">
                <p style="margin-top:0;">Hola ${nombre},</p>
                <p>
                  <b>${solicitante}</b> realizó una nueva solicitud de prórroga para
                  ${municipios.length === 1 ? "el siguiente período" : "los siguientes períodos"}:
                </p>
                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="
                    background:#2b3e4c;
                    color:#ffffff;
                    border-radius:8px;
                    overflow:hidden;
                    margin:20px 0;
                  "
                >
                  ${filasTabla}
                </table>
                <p style="margin-top:16px; font-size:13px; color:#6b7280;">
                  Este mensaje fue generado automáticamente por OVIF - APP.
                  Por favor, no responder este correo.
                </p>
              </td>
            </tr>
            ${FOOTER}
          </table>
        </td>
      </tr>
    </table>`,
    attachments: [
      { filename: "ovif-logo.png", path: "./src/assets/emails/ovif-logo.png", cid: "ovif-logo" },
      { filename: "gobierno-logo.png", path: "./src/assets/emails/gobierno-logo.png", cid: "gobierno-logo" },
      { filename: "neuquen-logo.png", path: "./src/assets/emails/neuquen-logo.png", cid: "neuquen-logo" },
    ],
  };
}

// ─── Plantilla: Solicitud de prórroga cancelada ──────────────────────────────
// Notifica a los admins que una solicitud fue cancelada por el operario.
function renderSolicitudProrrogaCancelada(payload) {
  const { nombre, solicitante, municipio, ejercicio, mes, pauta, motivoCancelacion } = payload;

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
            <tr>
              <td style="font-family:Arial, sans-serif; color:#2b3e4c; padding:32px;">
                <p style="margin-top:0;">Hola ${nombre},</p>
                <p>
                  <b>${solicitante}</b> canceló una solicitud de prórroga.
                </p>
                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="
                    background:#2b3e4c;
                    color:#ffffff;
                    border-radius:8px;
                    overflow:hidden;
                    margin:20px 0;
                  "
                >
                  <tr>
                    <td style="padding:14px 20px; border-bottom:1px solid rgba(255,255,255,0.35);">
                      <div style="font-size:12px; color:#d0d0d0; margin-bottom:4px;">Municipio</div>
                      <div style="font-size:18px; font-weight:700;">${municipio}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 20px; border-bottom:1px solid rgba(255,255,255,0.35);">
                      <div style="font-size:12px; color:#d0d0d0; margin-bottom:4px;">Período</div>
                      <div style="font-size:18px; font-weight:700;">${obtenerNombreMes(mes)} ${ejercicio}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 20px; border-bottom:1px solid rgba(255,255,255,0.35);">
                      <div style="font-size:12px; color:#d0d0d0; margin-bottom:4px;">Pauta</div>
                      <div style="font-size:18px; font-weight:700;">${pauta}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 20px;">
                      <div style="font-size:12px; color:#d0d0d0; margin-bottom:4px;">Motivo de cancelación</div>
                      <div style="font-size:16px;">${motivoCancelacion}</div>
                    </td>
                  </tr>
                </table>
                <p style="margin-top:16px; font-size:13px; color:#6b7280;">
                  Este mensaje fue generado automáticamente por OVIF - APP.
                  Por favor, no responder este correo.
                </p>
              </td>
            </tr>
            ${FOOTER}
          </table>
        </td>
      </tr>
    </table>`,
    attachments: [
      { filename: "ovif-logo.png", path: "./src/assets/emails/ovif-logo.png", cid: "ovif-logo" },
      { filename: "gobierno-logo.png", path: "./src/assets/emails/gobierno-logo.png", cid: "gobierno-logo" },
      { filename: "neuquen-logo.png", path: "./src/assets/emails/neuquen-logo.png", cid: "neuquen-logo" },
    ],
  };
}

// ─── Plantilla: Solicitud de prórroga aprobada ───────────────────────────────
// Notifica al operario que su solicitud fue aprobada, con la fecha efectiva.
function renderSolicitudProrrogaAprobada(payload) {
  const { nombre, municipio, ejercicio, mes, pauta, fechaAprobada, comentario } = payload;

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
            <tr>
              <td style="font-family:Arial, sans-serif; color:#2b3e4c; padding:32px;">
                <p style="margin-top:0;">Hola ${nombre},</p>
                <p>
                  Tu solicitud de prórroga fue <b>aprobada</b>.
                  A continuación encontrás el detalle:
                </p>
                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="
                    background:#2b3e4c;
                    color:#ffffff;
                    border-radius:8px;
                    overflow:hidden;
                    margin:20px 0;
                  "
                >
                  <tr>
                    <td style="padding:14px 20px; border-bottom:1px solid rgba(255,255,255,0.35);">
                      <div style="font-size:12px; color:#d0d0d0; margin-bottom:4px;">Municipio</div>
                      <div style="font-size:18px; font-weight:700;">${municipio}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 20px; border-bottom:1px solid rgba(255,255,255,0.35);">
                      <div style="font-size:12px; color:#d0d0d0; margin-bottom:4px;">Período</div>
                      <div style="font-size:18px; font-weight:700;">${obtenerNombreMes(mes)} ${ejercicio}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 20px; border-bottom:1px solid rgba(255,255,255,0.35);">
                      <div style="font-size:12px; color:#d0d0d0; margin-bottom:4px;">Pauta</div>
                      <div style="font-size:18px; font-weight:700;">${pauta}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 20px;${comentario ? " border-bottom:1px solid rgba(255,255,255,0.35);" : ""}">
                      <div style="font-size:12px; color:#d0d0d0; margin-bottom:4px;">Nueva fecha de cierre</div>
                      <div style="font-size:20px; font-weight:700;">${getDDMMYYYY(fechaAprobada)}</div>
                    </td>
                  </tr>
                  ${comentario ? `
                  <tr>
                    <td style="padding:14px 20px;">
                      <div style="font-size:12px; color:#d0d0d0; margin-bottom:4px;">Comentario</div>
                      <div style="font-size:15px;">${comentario}</div>
                    </td>
                  </tr>` : ""}
                </table>
                <p style="margin-top:16px; font-size:13px; color:#6b7280;">
                  Este mensaje fue generado automáticamente por OVIF - APP.
                  Por favor, no responder este correo.
                </p>
              </td>
            </tr>
            ${FOOTER}
          </table>
        </td>
      </tr>
    </table>`,
    attachments: [
      { filename: "ovif-logo.png", path: "./src/assets/emails/ovif-logo.png", cid: "ovif-logo" },
      { filename: "gobierno-logo.png", path: "./src/assets/emails/gobierno-logo.png", cid: "gobierno-logo" },
      { filename: "neuquen-logo.png", path: "./src/assets/emails/neuquen-logo.png", cid: "neuquen-logo" },
    ],
  };
}

// ─── Plantilla: Solicitud de prórroga rechazada ──────────────────────────────
// Notifica al operario que su solicitud fue rechazada, con el motivo del rechazo.
function renderSolicitudProrrogaRechazada(payload) {
  const { nombre, municipio, ejercicio, mes, pauta, comentario } = payload;

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
            <tr>
              <td style="font-family:Arial, sans-serif; color:#2b3e4c; padding:32px;">
                <p style="margin-top:0;">Hola ${nombre},</p>
                <p>
                  Tu solicitud de prórroga fue <b>rechazada</b>.
                  A continuación encontrás el detalle:
                </p>
                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="
                    background:#2b3e4c;
                    color:#ffffff;
                    border-radius:8px;
                    overflow:hidden;
                    margin:20px 0;
                  "
                >
                  <tr>
                    <td style="padding:14px 20px; border-bottom:1px solid rgba(255,255,255,0.35);">
                      <div style="font-size:12px; color:#d0d0d0; margin-bottom:4px;">Municipio</div>
                      <div style="font-size:18px; font-weight:700;">${municipio}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 20px; border-bottom:1px solid rgba(255,255,255,0.35);">
                      <div style="font-size:12px; color:#d0d0d0; margin-bottom:4px;">Período</div>
                      <div style="font-size:18px; font-weight:700;">${obtenerNombreMes(mes)} ${ejercicio}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 20px; border-bottom:1px solid rgba(255,255,255,0.35);">
                      <div style="font-size:12px; color:#d0d0d0; margin-bottom:4px;">Pauta</div>
                      <div style="font-size:18px; font-weight:700;">${pauta}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 20px;">
                      <div style="font-size:12px; color:#d0d0d0; margin-bottom:4px;">Motivo del rechazo</div>
                      <div style="font-size:15px;">${comentario}</div>
                    </td>
                  </tr>
                </table>
                <p style="margin-top:16px; font-size:13px; color:#6b7280;">
                  Este mensaje fue generado automáticamente por OVIF - APP.
                  Por favor, no responder este correo.
                </p>
              </td>
            </tr>
            ${FOOTER}
          </table>
        </td>
      </tr>
    </table>`,
    attachments: [
      { filename: "ovif-logo.png", path: "./src/assets/emails/ovif-logo.png", cid: "ovif-logo" },
      { filename: "gobierno-logo.png", path: "./src/assets/emails/gobierno-logo.png", cid: "gobierno-logo" },
      { filename: "neuquen-logo.png", path: "./src/assets/emails/neuquen-logo.png", cid: "neuquen-logo" },
    ],
  };
}

// ─── Registro de plantillas ──────────────────────────────────────────────────

const renderers = {
  CIERRE_MODULOS: renderCierreModulos,
  CIERRE_MODULOS_TEST: renderCierreModulos,
  RECORDATORIO_CIERRE: renderRecordatorioCierre,
  RECORDATORIO_CIERRE_TEST: renderRecordatorioCierre,
  RESET_PASSWORD: renderResetPassword,
  SOLICITUD_PRORROGA_CREADA: renderSolicitudProrrogaCreada,
  SOLICITUD_PRORROGA_CANCELADA: renderSolicitudProrrogaCancelada,
  SOLICITUD_PRORROGA_APROBADA: renderSolicitudProrrogaAprobada,
  SOLICITUD_PRORROGA_RECHAZADA: renderSolicitudProrrogaRechazada,
};

// Renderiza el HTML de un correo según su tipo y payload.
export function renderizarCorreoHtml(tipo, payload) {
  const renderer = renderers[tipo];
  if (!renderer) {
    throw new Error(`Tipo de correo no soportado: ${tipo}`);
  }
  return renderer(payload);
}
