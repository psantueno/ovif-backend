import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

const mockCreate = vi.fn();
const mockFindOne = vi.fn();
const mockFindAll = vi.fn();
const mockUpdate = vi.fn();
const mockSendMail = vi.fn();
const mockRenderizarCorreoHtml = vi.fn(() => "<html>Test</html>");

vi.mock("../src/models/moduloEjercicios/EnvioCorreo.js", () => ({
  default: {
    create: (...args) => mockCreate(...args),
    findOne: (...args) => mockFindOne(...args),
    findAll: (...args) => mockFindAll(...args),
    update: (...args) => mockUpdate(...args),
  },
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail: (...args) => mockSendMail(...args) }),
  },
}));

vi.mock("../src/services/plantillasCorreo.js", () => ({
  renderizarCorreoHtml: (...args) => mockRenderizarCorreoHtml(...args),
}));

const {
  encolarEnvioCierreModulos,
  procesarMailsPendientes,
} = await import("../src/services/emailService.js");

const baseParams = {
  destinatario: "test@municipio.gob.ar",
  nombre: "Juan Pérez",
  ejercicio: 2026,
  mes: 3,
  modulos: ["GASTOS", "RECURSOS"],
  esProrroga: false,
};

function calcularKeyEsperada(params) {
  const modulosOrdenados = [...params.modulos].sort().join(",");
  const tipo = params.esProrroga ? "PRORROGA" : "REGULAR";
  const raw = `CIERRE_MODULOS|${params.destinatario}|${params.ejercicio}|${params.mes}|${modulosOrdenados}|${tipo}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

describe("envioCorreo.service — encolarEnvioCierreModulos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debería crear un nuevo registro y retornar created: true", async () => {
    const fakeCorreo = { id: 1, ...baseParams };
    mockCreate.mockResolvedValue(fakeCorreo);

    const result = await encolarEnvioCierreModulos(baseParams);

    expect(result.created).toBe(true);
    expect(result.correo).toBe(fakeCorreo);
    expect(mockCreate).toHaveBeenCalledOnce();

    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.idempotency_key).toBe(calcularKeyEsperada(baseParams));
    expect(callArg.tipo).toBe("CIERRE_MODULOS");
    expect(callArg.destinatario).toBe("test@municipio.gob.ar");
    expect(callArg.asunto).toBe("Cierre de módulos");
    expect(callArg.estado).toBe("PENDIENTE");
    expect(callArg.payload.modulos).toEqual(["GASTOS", "RECURSOS"]);
  });

  it("debería retornar created: false si ya existe (UniqueConstraintError)", async () => {
    const uniqueError = new Error("Duplicate entry");
    uniqueError.name = "SequelizeUniqueConstraintError";
    mockCreate.mockRejectedValue(uniqueError);

    const fakeExistente = { id: 99, estado: "PENDIENTE" };
    mockFindOne.mockResolvedValue(fakeExistente);

    const result = await encolarEnvioCierreModulos(baseParams);

    expect(result.created).toBe(false);
    expect(result.correo).toBe(fakeExistente);
    expect(mockFindOne).toHaveBeenCalledOnce();
  });

  it("debería propagar errores que no sean UniqueConstraintError", async () => {
    const dbError = new Error("Connection refused");
    dbError.name = "SequelizeConnectionError";
    mockCreate.mockRejectedValue(dbError);

    await expect(encolarEnvioCierreModulos(baseParams)).rejects.toThrow("Connection refused");
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it("debería generar la misma idempotency_key sin importar el orden de módulos", async () => {
    mockCreate.mockResolvedValue({ id: 1 });

    await encolarEnvioCierreModulos({ ...baseParams, modulos: ["RECURSOS", "GASTOS"] });
    const call1Key = mockCreate.mock.calls[0][0].idempotency_key;

    mockCreate.mockClear();
    await encolarEnvioCierreModulos({ ...baseParams, modulos: ["GASTOS", "RECURSOS"] });
    const call2Key = mockCreate.mock.calls[0][0].idempotency_key;

    expect(call1Key).toBe(call2Key);
  });

  it("debería generar diferente idempotency_key para prórroga vs regular", async () => {
    mockCreate.mockResolvedValue({ id: 1 });

    await encolarEnvioCierreModulos({ ...baseParams, esProrroga: false });
    const keyRegular = mockCreate.mock.calls[0][0].idempotency_key;

    mockCreate.mockClear();
    await encolarEnvioCierreModulos({ ...baseParams, esProrroga: true });
    const keyProrroga = mockCreate.mock.calls[0][0].idempotency_key;

    expect(keyRegular).not.toBe(keyProrroga);
  });

  it("debería relanzar UniqueConstraintError si findOne no encuentra el registro", async () => {
    const uniqueError = new Error("Duplicate entry");
    uniqueError.name = "SequelizeUniqueConstraintError";
    mockCreate.mockRejectedValue(uniqueError);
    mockFindOne.mockResolvedValue(null);

    await expect(encolarEnvioCierreModulos(baseParams)).rejects.toThrow();
  });
});

describe("envioCorreo.service — procesarMailsPendientes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debería enviar un correo y marcarlo como ENVIADO en el primer intento", async () => {
    const correo = {
      id: 1,
      tipo: "CIERRE_MODULOS",
      destinatario: "test@muni.gob.ar",
      asunto: "Cierre de módulos",
      payload: { nombre: "Test" },
      estado: "PENDIENTE",
      intentos: 0,
      max_intentos: 5,
    };

    mockFindAll.mockResolvedValue([correo]);
    mockUpdate
      .mockResolvedValueOnce([1])
      .mockResolvedValueOnce([1]);
    mockSendMail.mockResolvedValueOnce({ messageId: "<abc123@smtp>" });

    const result = await procesarMailsPendientes({
      ids: [1],
      maxAttemptsPerRun: 3,
      retryDelaysMs: [0, 0, 0],
    });

    expect(result).toEqual({ total: 1, sent: 1, failed: 0, skipped: 0 });
    expect(mockRenderizarCorreoHtml).toHaveBeenCalledWith("CIERRE_MODULOS", { nombre: "Test" });
    expect(mockSendMail).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate.mock.calls[1][0]).toMatchObject({
      estado: "ENVIADO",
      intentos: 1,
      message_id: "<abc123@smtp>",
      ultimo_error: null,
      next_retry_at: null,
    });
  });

  it("debería reintentar en la misma corrida y terminar enviado si el segundo intento funciona", async () => {
    const correo = {
      id: 2,
      tipo: "CIERRE_MODULOS",
      destinatario: "retry@muni.gob.ar",
      asunto: "Cierre de módulos",
      payload: { nombre: "Retry" },
      estado: "PENDIENTE",
      intentos: 0,
      max_intentos: 5,
    };

    mockFindAll.mockResolvedValue([correo]);
    mockUpdate
      .mockResolvedValueOnce([1])
      .mockResolvedValueOnce([1])
      .mockResolvedValueOnce([1])
      .mockResolvedValueOnce([1]);
    mockSendMail
      .mockRejectedValueOnce(new Error("SMTP timeout"))
      .mockResolvedValueOnce({ messageId: "<ok@smtp>" });

    const result = await procesarMailsPendientes({
      ids: [2],
      maxAttemptsPerRun: 3,
      retryDelaysMs: [0, 0, 0],
    });

    expect(result).toEqual({ total: 1, sent: 1, failed: 0, skipped: 0 });
    expect(mockSendMail).toHaveBeenCalledTimes(2);
    expect(mockUpdate.mock.calls[1][0]).toMatchObject({
      estado: "ERROR",
      intentos: 1,
      ultimo_error: "SMTP timeout",
    });
    expect(mockUpdate.mock.calls[3][0]).toMatchObject({
      estado: "ENVIADO",
      intentos: 2,
      message_id: "<ok@smtp>",
    });
  });

  it("debería agotar intentos y dejar el correo en ERROR", async () => {
    const correo = {
      id: 3,
      tipo: "CIERRE_MODULOS",
      destinatario: "fail@muni.gob.ar",
      asunto: "Cierre de módulos",
      payload: { nombre: "Fail" },
      estado: "ERROR",
      intentos: 3,
      max_intentos: 5,
    };

    mockFindAll.mockResolvedValue([correo]);
    mockUpdate
      .mockResolvedValueOnce([1])
      .mockResolvedValueOnce([1])
      .mockResolvedValueOnce([1])
      .mockResolvedValueOnce([1]);
    mockSendMail
      .mockRejectedValueOnce(new Error("SMTP down"))
      .mockRejectedValueOnce(new Error("SMTP still down"));

    const result = await procesarMailsPendientes({
      ids: [3],
      maxAttemptsPerRun: 3,
      retryDelaysMs: [0, 0, 0],
    });

    expect(result).toEqual({ total: 1, sent: 0, failed: 1, skipped: 0 });
    expect(mockSendMail).toHaveBeenCalledTimes(2);
    expect(mockUpdate.mock.calls[3][0]).toMatchObject({
      estado: "ERROR",
      intentos: 5,
      ultimo_error: "SMTP still down",
      next_retry_at: null,
    });
  });

  it("debería omitir ids que no estén pendientes o ya no sean retriables", async () => {
    const correo = {
      id: 4,
      tipo: "CIERRE_MODULOS",
      destinatario: "ok@muni.gob.ar",
      asunto: "Cierre de módulos",
      payload: { nombre: "OK" },
      estado: "PENDIENTE",
      intentos: 0,
      max_intentos: 5,
    };

    mockFindAll.mockResolvedValue([correo]);
    mockUpdate
      .mockResolvedValueOnce([1])
      .mockResolvedValueOnce([1]);
    mockSendMail.mockResolvedValueOnce({ messageId: "<ok@smtp>" });

    const result = await procesarMailsPendientes({
      ids: [4, 5],
      maxAttemptsPerRun: 3,
      retryDelaysMs: [0, 0, 0],
    });

    expect(result).toEqual({ total: 2, sent: 1, failed: 0, skipped: 1 });
  });

  it("debería contar como omitido si no puede tomar el lock optimista", async () => {
    const correo = {
      id: 6,
      tipo: "CIERRE_MODULOS",
      destinatario: "lock@muni.gob.ar",
      asunto: "Cierre de módulos",
      payload: { nombre: "Lock" },
      estado: "PENDIENTE",
      intentos: 0,
      max_intentos: 5,
    };

    mockFindAll.mockResolvedValue([correo]);
    mockUpdate.mockResolvedValueOnce([0]);

    const result = await procesarMailsPendientes({
      ids: [6],
      maxAttemptsPerRun: 3,
      retryDelaysMs: [0, 0, 0],
    });

    expect(result).toEqual({ total: 1, sent: 0, failed: 0, skipped: 1 });
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});
