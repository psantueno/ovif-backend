import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

const mockCreate = vi.fn();
const mockFindOne = vi.fn();

vi.mock("../src/models/moduloEjercicios/EnvioCorreo.js", () => ({
  default: {
    create: (...args) => mockCreate(...args),
    findOne: (...args) => mockFindOne(...args),
    findAll: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: vi.fn() }) },
}));

const { renderizarCorreoHtml } = await import("../src/services/plantillasCorreo.js");
const {
  calcularClaveRecordatorioCierre,
  encolarRecordatorioCierre,
  armarAsuntoRecordatorioCierre,
} = await import("../src/services/emailService.js");

const periodo = {
  ejercicio: 2026,
  mes: 9,
  convenio_id: 1,
  pauta_id: 10,
  fecha_cierre: "2026-10-20",
  tiene_prorroga: false,
};

// ─── Plantilla ───────────────────────────────────────────────────────────────

describe("plantillasCorreo — RECORDATORIO_CIERRE", () => {
  const render = (overrides = {}) =>
    renderizarCorreoHtml("RECORDATORIO_CIERRE", {
      nombre: "Juan Pérez",
      municipio: "Zapala",
      ejercicio: 2026,
      mes: 9,
      modulos: ["GASTOS", "RECURSOS"],
      fecha_cierre: "2026-10-20",
      tiene_prorroga: false,
      fecha_referencia: "2026-10-17",
      ...overrides,
    });

  it("usa el mismo encabezado, pie y logos que el aviso de cierre", () => {
    const { html, attachments } = render();
    const cierre = renderizarCorreoHtml("CIERRE_MODULOS", {
      nombre: "Juan", ejercicio: 2026, mes: 9, modulos: ["GASTOS"], esProrroga: false,
    });

    for (const cid of ["cid:ovif-logo", "cid:gobierno-logo", "cid:neuquen-logo"]) {
      expect(html).toContain(cid);
    }
    const cids = attachments.map((a) => a.cid);
    for (const a of cierre.attachments) expect(cids).toContain(a.cid);
  });

  it("adjunta las imágenes de alerta y cada cid usado tiene su archivo", () => {
    const { html, attachments, priority } = render();
    const cids = attachments.map((a) => a.cid);
    expect(priority).toBe("high");
    expect(cids).toEqual(expect.arrayContaining(["alerta-triangulo", "megafono"]));

    const usados = [...html.matchAll(/cid:([\w-]+)/g)].map((m) => m[1]);
    for (const cid of new Set(usados)) expect(cids).toContain(cid);
    for (const a of attachments) expect(fs.existsSync(path.resolve(a.path))).toBe(true);
    expect(html).toContain("https://ovif.economianqn.gob.ar");
    expect(html).toContain("IR A OVIF");
  });

  it("muestra período, módulos de la pauta, fecha y días restantes", () => {
    const { html } = render();
    expect(html).toContain("Hola Juan Pérez");
    expect(html).toContain("Septiembre 2026");
    expect(html).toContain("Gastos y Recursos");
    expect(html).toContain("20/10/2026");
    expect(html).toContain("Faltan 3 días");
    expect(html).not.toContain("(Prórroga)");
  });

  it("ajusta la leyenda para mañana, hoy y prórroga", () => {
    expect(render({ fecha_referencia: "2026-10-19" }).html).toContain("Mañana es el último día");
    expect(render({ fecha_referencia: "2026-10-20" }).html).toContain("Hoy es el último día");
    expect(render({ tiene_prorroga: true }).html).toContain("(Prórroga)");
    expect(render({ modulos: ["DETERMINACION_TRIBUTARIA"] }).html).toContain("al módulo");
  });

  it("escapa HTML en los datos interpolados", () => {
    const { html } = render({ nombre: "<script>alert(1)</script>", municipio: "A & B" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
  });
});

// ─── Clave idempotente y encolado ────────────────────────────────────────────

describe("emailService — recordatorio de cierre", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("la clave es estable e insensible a mayúsculas/espacios del email", () => {
    const a = calcularClaveRecordatorioCierre({ destinatario: "Contacto@Muni.gob.ar", municipioId: 1, periodo });
    const b = calcularClaveRecordatorioCierre({ destinatario: " contacto@muni.gob.ar ", municipioId: 1, periodo });
    expect(a).toBe(b);
  });

  it("la clave cambia si cambia la fecha de cierre, la pauta o el municipio", () => {
    const base = calcularClaveRecordatorioCierre({ destinatario: "a@muni.gob.ar", municipioId: 1, periodo });
    expect(calcularClaveRecordatorioCierre({ destinatario: "a@muni.gob.ar", municipioId: 1, periodo: { ...periodo, fecha_cierre: "2026-10-30" } })).not.toBe(base);
    expect(calcularClaveRecordatorioCierre({ destinatario: "a@muni.gob.ar", municipioId: 1, periodo: { ...periodo, pauta_id: 11 } })).not.toBe(base);
    expect(calcularClaveRecordatorioCierre({ destinatario: "a@muni.gob.ar", municipioId: 2, periodo })).not.toBe(base);
  });

  it("encola con tipo, asunto y payload esperados", async () => {
    mockCreate.mockImplementation(async (datos) => ({ id: 1, ...datos }));

    const { correo, created } = await encolarRecordatorioCierre({
      destinatario: "a@muni.gob.ar",
      nombre: "A",
      municipioId: 1,
      municipioNombre: "Zapala",
      periodo,
      modulos: ["RECURSOS", "GASTOS"],
    });

    expect(created).toBe(true);
    expect(correo.tipo).toBe("RECORDATORIO_CIERRE");
    expect(correo.asunto).toBe("\u26A0\uFE0F [OVIF - APP] - RECORDATORIO DE CIERRE: GASTOS Y RECURSOS - 09/2026");
    expect(correo.payload).toMatchObject({ municipio: "Zapala", modulos: ["GASTOS", "RECURSOS"], fecha_cierre: "2026-10-20" });
    expect(correo.payload).not.toHaveProperty("fecha_referencia");
  });

  it("ante clave duplicada devuelve el registro existente", async () => {
    const error = new Error("dup");
    error.name = "SequelizeUniqueConstraintError";
    mockCreate.mockRejectedValue(error);
    mockFindOne.mockResolvedValue({ id: 9, estado: "ENVIADO" });

    const { correo, created } = await encolarRecordatorioCierre({
      destinatario: "a@muni.gob.ar", nombre: "A", municipioId: 1, municipioNombre: "Zapala", periodo, modulos: ["GASTOS"],
    });

    expect(created).toBe(false);
    expect(correo.id).toBe(9);
  });

  it("el asunto no admite saltos de línea", () => {
    const asunto = armarAsuntoRecordatorioCierre("[OVIF]\r\nBcc: x@y.com", periodo, ["GASTOS"]);
    expect(asunto).not.toMatch(/[\r\n]/);
  });
});
