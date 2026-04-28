/*
 * plantillasCorreo.js — Plantillas HTML para todos los correos del sistema OVIF.
 *
 * Cada tipo de correo tiene su función renderizadora registrada en el mapa `renderers`.
 * Para agregar un tipo nuevo:
 *   1. Crear una función renderXxx(payload) que devuelva HTML.
 *   2. Registrarla en `renderers` con su clave (ej: "NUEVO_TIPO").
 *   3. Llamar renderizarCorreoHtml("NUEVO_TIPO", payload) desde emailService.js.
 */
import { getModuloCierreLabel } from "../utils/cierreModulo.js";

// ─── Bloques reutilizables ───────────────────────────────────────────────────

const BANNER_HTML = `
<div style="
  background-color: #2b3e4c;
  padding: 20px 10px;
  text-align: center;
  color: #f4e0b6;
  font-family: 'Arial', sans-serif;
  max-width: 100%;
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
</div>`;

const FOOTER_HTML = `
<div style="
  margin-top:1rem;
  padding-top:1.5rem;
  border-top:1px solid #d9e1e7;
  font-family: Arial, sans-serif;
  color:#2b3e4c;
  margin-top: 2rem;
">
  <p style="
    margin:0 0 8px 0;
    font-size:15px;
    font-weight:700;
    letter-spacing:0.3px;
    color:#1f2d3a;
  ">
    OVIF - Oficina Virtual de Información Fiscal Municipal
  </p>

  <p style="
    margin:0 0 6px 0;
    font-size:13px;
    font-weight:500;
    color:#5b6b79;
  ">
    Coordinación de Relaciones Fiscales con Municipios
  </p>

  <p style="
    margin:0;
    font-size:12px;
    font-weight:400;
    color:#7a8793;
    text-transform:uppercase;
    letter-spacing:0.6px;
  ">
    Gobierno de la Provincia del Neuquén
  </p>
</div>
`;

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

  if (Number(ejercicio) && Number(mes) && Array.isArray(modulos) && modulos.length > 0) {
    const seccionEjercicioMes = `${obtenerNombreMes(mes)} ${ejercicio}`;
    const modulosNormalizados = modulos
      .map((m) => getModuloCierreLabel(m))
      .filter(Boolean);
    const modulosTexto = new Intl.ListFormat("es-AR", {
      style: "long",
      type: "conjunction",
    }).format(modulosNormalizados);

    mensaje = `Le informamos que finalizó el plazo de entrega de información para ${modulosNormalizados.length > 1 ? "los módulos" : "el módulo"}:`;

    periodoBadge = `
      <div>
        <span style="
          display:inline-block;
          background:#e8f0fe;
          color:#1a73e8;
          padding:8px 14px;
          border-radius:999px;
          font-size:14px;
          font-weight:bold;
          margin-left:10px;
        ">
          ${
            esProrroga
              ? `Prórroga - ${seccionEjercicioMes}`
              : `Período - ${seccionEjercicioMes}`
          }
        </span>
      </div>
    `;

    modulosBadges = `
      <div>
          <span style="
            display:inline-block;
            background:#eef2f7;
            color:#2b3e4c;
            padding:8px 14px;
            border-radius:999px;
            font-size:14px;
            font-weight:600;
          ">
            ${modulosNormalizados.join(" y ")}
          </span>
      </div>
    `;
  }

  return `
    ${BANNER_HTML}
    <div style="font-family: Arial, sans-serif; color: #2b3e4c; padding: 2rem;">
      <p>Hola ${nombre || ""},</p>
      <p>${mensaje}</p>
      <div style="margin: 1rem 0; display:flex;">
        ${modulosBadges}
        ${periodoBadge}
      </div>
      <p style="margin: 1rem 0;">Ya puedes solicitar el informe de cierre correspondiente en la sección "Grilla de ejercicios históricos" de la
        <a 
          href="https://ovif.economianqn.gob.ar/historico-ejercicios-cerrados"
          style="
            color:#1a73e8;
            text-decoration:none;
            font-weight:bold;
          "
          target="_blank"
        >
          OVIF
        </a>
      </p>
      <p style="
        margin-top:2rem;
        margin-bottom:0;
        font-size:13px;
        color:#6b7280;
      ">
        Este mensaje fue generado automáticamente por el sistema OVIF.
        Por favor, no responder este correo.
      </p>
      ${FOOTER_HTML}
    </div>`;
}

// ─── Plantilla: Restablecimiento de contraseña ──────────────────────────────
// Envía un botón con enlace de reset válido por 1 hora.
function renderResetPassword(payload) {
  const { nombre, resetLink } = payload;

  return `
    ${BANNER_HTML}
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
      ${FOOTER_HTML}
    </div>`;
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
