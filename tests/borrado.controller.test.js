import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks hoisted ───────────────────────────────────────────────────────────

const { mockEjecutarBorrado, mockAuditoriaBorradoCount, mockAuditoriaProrrogaCount } =
  vi.hoisted(() => ({
    mockEjecutarBorrado: vi.fn(),
    mockAuditoriaBorradoCount: vi.fn(),
    mockAuditoriaProrrogaCount: vi.fn(),
  }));

vi.mock("../src/services/borrado.service.js", () => ({
  ejecutarBorrado: (...args) => mockEjecutarBorrado(...args),
}));

vi.mock("../src/models/index.js", () => ({
  AuditoriaBorrado: { count: (...args) => mockAuditoriaBorradoCount(...args) },
  AuditoriaProrrogaMunicipio: { count: (...args) => mockAuditoriaProrrogaCount(...args) },
  // El resto de modelos usados por el controller se deja vacío para este test
  Municipio: {},
  Usuario: {},
  EjercicioMes: {},
  Gasto: {},
  Recurso: {},
  Recaudacion: {},
  Remuneracion: {},
  DeterminacionTributaria: {},
  CierreModulo: {},
  RecaudacionRectificada: {},
  RemuneracionRectificada: {},
  // ... otros modelos que el controller importa pero no usa en estos tests
  ProrrogaMunicipio: {},
  PautaConvenio: {},
  ConceptoRecaudacion: {},
  Archivo: {},
  SituacionRevista: {},
  TipoGasto: {},
  RegimenLaboral: {},
  UsuarioMunicipio: {},
  EjercicioMesCerrado: {},
  Poblacion: {},
  TipoPauta: {},
  Convenio: {},
}));

vi.mock("../src/config/db.js", () => ({ default: { transaction: vi.fn() } }));
vi.mock("../src/utils/periodosRegulares.js", () => ({
  obtenerPeriodosRegularesDisponiblesPorMunicipio: vi.fn(),
  resolverPeriodoRegular: vi.fn(),
}));
vi.mock("../src/utils/pdf/municipioGastos.js", () => ({ buildInformeGastos: vi.fn() }));
vi.mock("../src/utils/pdf/municipioRecursos.js", () => ({ buildInformeRecursos: vi.fn() }));
vi.mock("../src/utils/pdf/municipioRecaudaciones.js", () => ({ buildInformeRecaudaciones: vi.fn() }));
vi.mock("../src/utils/pdf/municipioRemuneraciones.js", () => ({ buildInformeRemuneraciones: vi.fn() }));
vi.mock("../src/utils/pdf/municipioDeterminacionTributaria.js", () => ({ buildInformeDeterminacionTributaria: vi.fn() }));
vi.mock("../src/utils/rectificaciones.js", () => ({
  obtenerPeriodoRectificableAnterior: vi.fn(),
  evaluarPeriodosRectificacion: vi.fn(),
  verificarRectificacionDisponible: vi.fn(),
}));

// ─── Import después de los mocks ─────────────────────────────────────────────

const {
  borrarGastos,
  borrarRecursos,
  borrarRecaudaciones,
  borrarRecaudacionesRectificadas,
  borrarRemuneraciones,
  borrarRemuneracionesRectificadas,
  borrarDeterminaciones,
  deleteUsuario,
} = await import("../src/controllers/municipios.controller.js");

// ─── Helpers ─────────────────────────────────────────────────────────────────

const createReq = (overrides = {}) => ({
  params: { municipioId: "1", ejercicio: "2026", mes: "3" },
  user: { usuario_id: 42 },
  ip: "192.168.1.1",
  ...overrides,
});

const createRes = () => {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
};

// ─── Tests: borrarGastos ─────────────────────────────────────────────────────

describe("borrarGastos()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 200 con DATA_DELETED cuando hay datos", async () => {
    mockEjecutarBorrado.mockResolvedValue({
      code: "DATA_DELETED",
      deleted_count: 5,
      audit_id: 101,
      message: "Se eliminaron 5 registros.",
    });
    const res = createRes();
    await borrarGastos(createReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.code).toBe("DATA_DELETED");
    expect(res.body.deleted_count).toBe(5);
  });

  it("retorna 200 con NO_DATA_TO_DELETE cuando no hay datos", async () => {
    mockEjecutarBorrado.mockResolvedValue({
      code: "NO_DATA_TO_DELETE",
      deleted_count: 0,
      audit_id: null,
      message: "No hay datos.",
    });
    const res = createRes();
    await borrarGastos(createReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.code).toBe("NO_DATA_TO_DELETE");
  });

  it("retorna 409 si MODULE_CLOSED", async () => {
    mockEjecutarBorrado.mockResolvedValue({
      code: "MODULE_CLOSED",
      deleted_count: 0,
      audit_id: null,
      message: "El módulo ya fue cerrado.",
    });
    const res = createRes();
    await borrarGastos(createReq(), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("MODULE_CLOSED");
  });

  it("retorna 403 con USER_RATE_LIMITED si ≥3 borrados en 1 hora", async () => {
    mockEjecutarBorrado.mockResolvedValue({
      code: "USER_RATE_LIMITED",
      deleted_count: 0,
      audit_id: null,
      message: "Límite alcanzado.",
    });
    const res = createRes();
    await borrarGastos(createReq(), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("USER_RATE_LIMITED");
  });

  it("retorna 500 si el servicio lanza una excepción", async () => {
    mockEjecutarBorrado.mockRejectedValue(new Error("DB failure"));
    const res = createRes();
    await borrarGastos(createReq(), res);
    expect(res.statusCode).toBe(500);
  });

  it("retorna 400 si municipioId no es un número válido", async () => {
    const res = createRes();
    await borrarGastos(
      createReq({ params: { municipioId: "abc", ejercicio: "2026", mes: "3" } }),
      res
    );
    expect(res.statusCode).toBe(400);
    expect(mockEjecutarBorrado).not.toHaveBeenCalled();
  });

  it("retorna 400 si mes está fuera de rango (13)", async () => {
    const res = createRes();
    await borrarGastos(
      createReq({ params: { municipioId: "1", ejercicio: "2026", mes: "13" } }),
      res
    );
    expect(res.statusCode).toBe(400);
  });

  it("pasa módulo GASTOS/REGULAR al servicio hardcodeado", async () => {
    mockEjecutarBorrado.mockResolvedValue({ code: "NO_DATA_TO_DELETE", deleted_count: 0, audit_id: null, message: "" });
    const res = createRes();
    await borrarGastos(createReq(), res);
    const call = mockEjecutarBorrado.mock.calls[0][0];
    expect(call.modulo).toBe("GASTOS");
    expect(call.tipoCarga).toBe("REGULAR");
    expect(call.tipoPautaCodigo).toBe("gastos_recursos");
  });

  it("no acepta módulo dinámico desde body — el módulo es siempre GASTOS", async () => {
    mockEjecutarBorrado.mockResolvedValue({ code: "NO_DATA_TO_DELETE", deleted_count: 0, audit_id: null, message: "" });
    const res = createRes();
    const req = createReq({ body: { modulo: "REMUNERACIONES" } });
    await borrarGastos(req, res);
    const call = mockEjecutarBorrado.mock.calls[0][0];
    expect(call.modulo).toBe("GASTOS");
  });
});

// ─── Tests: borrarRecursos ───────────────────────────────────────────────────

describe("borrarRecursos()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pasa módulo RECURSOS/REGULAR al servicio", async () => {
    mockEjecutarBorrado.mockResolvedValue({ code: "DATA_DELETED", deleted_count: 3, audit_id: 1, message: "" });
    const res = createRes();
    await borrarRecursos(createReq(), res);
    expect(mockEjecutarBorrado.mock.calls[0][0].modulo).toBe("RECURSOS");
    expect(mockEjecutarBorrado.mock.calls[0][0].tipoCarga).toBe("REGULAR");
  });
});

// ─── Tests: borrarRecaudaciones ──────────────────────────────────────────────

describe("borrarRecaudaciones()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pasa módulo RECAUDACIONES/REGULAR al servicio", async () => {
    mockEjecutarBorrado.mockResolvedValue({ code: "DATA_DELETED", deleted_count: 10, audit_id: 2, message: "" });
    const res = createRes();
    await borrarRecaudaciones(createReq(), res);
    const call = mockEjecutarBorrado.mock.calls[0][0];
    expect(call.modulo).toBe("RECAUDACIONES");
    expect(call.tipoCarga).toBe("REGULAR");
    expect(call.tipoPautaCodigo).toBe("recaudaciones_remuneraciones");
  });
});

// ─── Tests: borrarRecaudacionesRectificadas ──────────────────────────────────

describe("borrarRecaudacionesRectificadas()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pasa módulo RECAUDACIONES/RECTIFICACION al servicio", async () => {
    mockEjecutarBorrado.mockResolvedValue({ code: "DATA_DELETED", deleted_count: 6, audit_id: 3, message: "" });
    const res = createRes();
    await borrarRecaudacionesRectificadas(createReq(), res);
    const call = mockEjecutarBorrado.mock.calls[0][0];
    expect(call.modulo).toBe("RECAUDACIONES");
    expect(call.tipoCarga).toBe("RECTIFICACION");
  });
});

// ─── Tests: borrarRemuneraciones ─────────────────────────────────────────────

describe("borrarRemuneraciones()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pasa módulo REMUNERACIONES/REGULAR al servicio", async () => {
    mockEjecutarBorrado.mockResolvedValue({ code: "DATA_DELETED", deleted_count: 2500, audit_id: 4, message: "" });
    const res = createRes();
    await borrarRemuneraciones(createReq(), res);
    const call = mockEjecutarBorrado.mock.calls[0][0];
    expect(call.modulo).toBe("REMUNERACIONES");
    expect(call.tipoCarga).toBe("REGULAR");
  });

  it("retorna deleted_count de 3000 sin truncar (volumen alto)", async () => {
    mockEjecutarBorrado.mockResolvedValue({ code: "DATA_DELETED", deleted_count: 3000, audit_id: 5, message: "" });
    const res = createRes();
    await borrarRemuneraciones(createReq(), res);
    expect(res.body.deleted_count).toBe(3000);
  });
});

// ─── Tests: borrarRemuneracionesRectificadas ─────────────────────────────────

describe("borrarRemuneracionesRectificadas()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pasa módulo REMUNERACIONES/RECTIFICACION al servicio", async () => {
    mockEjecutarBorrado.mockResolvedValue({ code: "DATA_DELETED", deleted_count: 1800, audit_id: 6, message: "" });
    const res = createRes();
    await borrarRemuneracionesRectificadas(createReq(), res);
    const call = mockEjecutarBorrado.mock.calls[0][0];
    expect(call.modulo).toBe("REMUNERACIONES");
    expect(call.tipoCarga).toBe("RECTIFICACION");
  });
});

// ─── Tests: borrarDeterminaciones ────────────────────────────────────────────

describe("borrarDeterminaciones()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pasa módulo DETERMINACION_TRIBUTARIA/REGULAR al servicio", async () => {
    mockEjecutarBorrado.mockResolvedValue({ code: "DATA_DELETED", deleted_count: 15, audit_id: 7, message: "" });
    const res = createRes();
    await borrarDeterminaciones(createReq(), res);
    const call = mockEjecutarBorrado.mock.calls[0][0];
    expect(call.modulo).toBe("DETERMINACION_TRIBUTARIA");
    expect(call.tipoCarga).toBe("REGULAR");
    expect(call.tipoPautaCodigo).toBe("determinacion_tributaria");
  });
});
