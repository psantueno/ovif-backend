import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks hoisted ───────────────────────────────────────────────────────────

const {
  mockAuditoriaBorradoCount,
  mockAuditoriaBorradoCreate,
  mockCierreModuloFindOne,
  mockGastoDestroy,
  mockRecursoDestroy,
  mockRecaudacionDestroy,
  mockRecaudacionRectificadaDestroy,
  mockRemuneracionDestroy,
  mockRemuneracionRectificadaDestroy,
  mockDeterminacionDestroy,
  mockTransactionCommit,
  mockTransactionRollback,
  mockResolverPeriodoRegular,
} = vi.hoisted(() => ({
  mockAuditoriaBorradoCount: vi.fn(),
  mockAuditoriaBorradoCreate: vi.fn(),
  mockCierreModuloFindOne: vi.fn(),
  mockGastoDestroy: vi.fn(),
  mockRecursoDestroy: vi.fn(),
  mockRecaudacionDestroy: vi.fn(),
  mockRecaudacionRectificadaDestroy: vi.fn(),
  mockRemuneracionDestroy: vi.fn(),
  mockRemuneracionRectificadaDestroy: vi.fn(),
  mockDeterminacionDestroy: vi.fn(),
  mockTransactionCommit: vi.fn(),
  mockTransactionRollback: vi.fn(),
  mockResolverPeriodoRegular: vi.fn(),
}));

vi.mock("../src/models/index.js", () => ({
  AuditoriaBorrado: {
    count: (...args) => mockAuditoriaBorradoCount(...args),
    create: (...args) => mockAuditoriaBorradoCreate(...args),
  },
  CierreModulo: {
    findOne: (...args) => mockCierreModuloFindOne(...args),
  },
  Gasto: {
    destroy: (...args) => mockGastoDestroy(...args),
  },
  Recurso: {
    destroy: (...args) => mockRecursoDestroy(...args),
  },
  Recaudacion: {
    destroy: (...args) => mockRecaudacionDestroy(...args),
  },
  RecaudacionRectificada: {
    destroy: (...args) => mockRecaudacionRectificadaDestroy(...args),
  },
  Remuneracion: {
    destroy: (...args) => mockRemuneracionDestroy(...args),
  },
  RemuneracionRectificada: {
    destroy: (...args) => mockRemuneracionRectificadaDestroy(...args),
  },
  DeterminacionTributaria: {
    destroy: (...args) => mockDeterminacionDestroy(...args),
  },
}));

vi.mock("../src/config/db.js", () => ({
  default: {
    transaction: async () => ({
      commit: mockTransactionCommit,
      rollback: mockTransactionRollback,
    }),
  },
}));

vi.mock("../src/utils/periodosRegulares.js", () => ({
  resolverPeriodoRegular: (...args) => mockResolverPeriodoRegular(...args),
}));

// ─── Import después de los mocks ─────────────────────────────────────────────

const { ejecutarBorrado } = await import("../src/services/borrado.service.js");

// ─── Params base ─────────────────────────────────────────────────────────────

const baseParams = {
  modulo: "GASTOS",
  tipoCarga: "REGULAR",
  tipoPautaCodigo: "gastos_recursos",
  ejercicio: 2026,
  mes: 3,
  municipioId: 1,
  usuarioId: 42,
  ip: "192.168.1.10",
};

const fakePeriodo = {
  disponible: true,
  periodo: { convenio_id: 5, pauta_id: 8 },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ejecutarBorrado()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults felices
    mockAuditoriaBorradoCount.mockResolvedValue(0);
    mockCierreModuloFindOne.mockResolvedValue(null);
    mockResolverPeriodoRegular.mockResolvedValue(fakePeriodo);
    mockTransactionCommit.mockResolvedValue(undefined);
    mockTransactionRollback.mockResolvedValue(undefined);
  });

  it("borra datos existentes y retorna DATA_DELETED con deleted_count correcto", async () => {
    mockGastoDestroy.mockResolvedValue(5);
    mockAuditoriaBorradoCreate.mockResolvedValue({ borrado_id: 101 });

    const result = await ejecutarBorrado(baseParams);

    expect(result.code).toBe("DATA_DELETED");
    expect(result.deleted_count).toBe(5);
    expect(result.audit_id).toBe(101);
    expect(mockTransactionCommit).toHaveBeenCalledOnce();
    expect(mockTransactionRollback).not.toHaveBeenCalled();
  });

  it("retorna NO_DATA_TO_DELETE cuando no hay registros para esos params", async () => {
    mockGastoDestroy.mockResolvedValue(0);

    const result = await ejecutarBorrado(baseParams);

    expect(result.code).toBe("NO_DATA_TO_DELETE");
    expect(result.deleted_count).toBe(0);
    expect(result.audit_id).toBeNull();
    expect(mockAuditoriaBorradoCreate).not.toHaveBeenCalled();
    expect(mockTransactionRollback).toHaveBeenCalledOnce();
  });

  it("rechaza con MODULE_CLOSED si CierreModulo existe para el módulo+ejercicio+mes+municipio", async () => {
    mockCierreModuloFindOne.mockResolvedValue({ cierre_id: 7, modulo: "GASTOS" });

    const result = await ejecutarBorrado(baseParams);

    expect(result.code).toBe("MODULE_CLOSED");
    expect(mockGastoDestroy).not.toHaveBeenCalled();
  });

  it("hace rollback si falla INSERT de auditoría", async () => {
    mockGastoDestroy.mockResolvedValue(3);
    mockAuditoriaBorradoCreate.mockRejectedValue(new Error("DB error en auditoría"));

    await expect(ejecutarBorrado(baseParams)).rejects.toThrow("DB error en auditoría");
    expect(mockTransactionRollback).toHaveBeenCalledOnce();
    expect(mockTransactionCommit).not.toHaveBeenCalled();
  });

  it("resuelve convenio_id y pauta_id internamente desde resolverPeriodoRegular()", async () => {
    mockGastoDestroy.mockResolvedValue(2);
    mockAuditoriaBorradoCreate.mockResolvedValue({ borrado_id: 55 });

    await ejecutarBorrado(baseParams);

    const createCall = mockAuditoriaBorradoCreate.mock.calls[0][0];
    expect(createCall.convenio_id).toBe(5);
    expect(createCall.pauta_id).toBe(8);
    expect(mockResolverPeriodoRegular).toHaveBeenCalledWith(
      expect.objectContaining({ tipoPautaCodigo: "gastos_recursos", municipioId: 1 })
    );
  });

  it("registra anomalía en console.warn si el usuario tiene ≥3 borrados en la última hora, pero permite continuar", async () => {
    mockAuditoriaBorradoCount.mockResolvedValue(3);
    mockGastoDestroy.mockResolvedValue(1);
    mockAuditoriaBorradoCreate.mockResolvedValue({ borrado_id: 99 });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await ejecutarBorrado(baseParams);

    expect(result.code).toBe("DATA_DELETED");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("ANOMALIA_BORRADO"));
    warnSpy.mockRestore();
  });

  it("permite borrado si el usuario tiene exactamente 2 borrados en la última hora", async () => {
    mockAuditoriaBorradoCount.mockResolvedValue(2);
    mockGastoDestroy.mockResolvedValue(1);
    mockAuditoriaBorradoCreate.mockResolvedValue({ borrado_id: 77 });

    const result = await ejecutarBorrado(baseParams);

    expect(result.code).toBe("DATA_DELETED");
  });

  it("guarda ip_origen correctamente en la auditoría", async () => {
    mockGastoDestroy.mockResolvedValue(1);
    mockAuditoriaBorradoCreate.mockResolvedValue({ borrado_id: 20 });

    await ejecutarBorrado({ ...baseParams, ip: "10.0.0.5" });

    const createCall = mockAuditoriaBorradoCreate.mock.calls[0][0];
    expect(createCall.ip_origen).toBe("10.0.0.5");
  });

  it("funciona correctamente para módulo RECURSOS", async () => {
    mockRecursoDestroy.mockResolvedValue(4);
    mockAuditoriaBorradoCreate.mockResolvedValue({ borrado_id: 30 });

    const result = await ejecutarBorrado({
      ...baseParams,
      modulo: "RECURSOS",
      tipoPautaCodigo: "gastos_recursos",
    });

    expect(result.code).toBe("DATA_DELETED");
    expect(result.deleted_count).toBe(4);
    expect(mockRecursoDestroy).toHaveBeenCalledOnce();
    expect(mockGastoDestroy).not.toHaveBeenCalled();
  });

  it("funciona correctamente para módulo RECAUDACIONES (REGULAR)", async () => {
    mockRecaudacionDestroy.mockResolvedValue(10);
    mockAuditoriaBorradoCreate.mockResolvedValue({ borrado_id: 31 });

    const result = await ejecutarBorrado({
      ...baseParams,
      modulo: "RECAUDACIONES",
      tipoCarga: "REGULAR",
      tipoPautaCodigo: "recaudaciones_remuneraciones",
    });

    expect(result.code).toBe("DATA_DELETED");
    expect(mockRecaudacionDestroy).toHaveBeenCalledOnce();
  });

  it("funciona correctamente para módulo RECAUDACIONES (RECTIFICACION)", async () => {
    mockRecaudacionRectificadaDestroy.mockResolvedValue(6);
    mockAuditoriaBorradoCreate.mockResolvedValue({ borrado_id: 32 });

    const result = await ejecutarBorrado({
      ...baseParams,
      modulo: "RECAUDACIONES",
      tipoCarga: "RECTIFICACION",
      tipoPautaCodigo: "recaudaciones_remuneraciones",
    });

    expect(result.code).toBe("DATA_DELETED");
    expect(mockRecaudacionRectificadaDestroy).toHaveBeenCalledOnce();
    expect(mockRecaudacionDestroy).not.toHaveBeenCalled();
  });

  it("funciona correctamente para módulo REMUNERACIONES (REGULAR)", async () => {
    mockRemuneracionDestroy.mockResolvedValue(2500);
    mockAuditoriaBorradoCreate.mockResolvedValue({ borrado_id: 33 });

    const result = await ejecutarBorrado({
      ...baseParams,
      modulo: "REMUNERACIONES",
      tipoCarga: "REGULAR",
      tipoPautaCodigo: "recaudaciones_remuneraciones",
    });

    expect(result.code).toBe("DATA_DELETED");
    expect(result.deleted_count).toBe(2500);
    expect(mockRemuneracionDestroy).toHaveBeenCalledOnce();
  });

  it("funciona correctamente para módulo REMUNERACIONES (RECTIFICACION)", async () => {
    mockRemuneracionRectificadaDestroy.mockResolvedValue(1800);
    mockAuditoriaBorradoCreate.mockResolvedValue({ borrado_id: 34 });

    const result = await ejecutarBorrado({
      ...baseParams,
      modulo: "REMUNERACIONES",
      tipoCarga: "RECTIFICACION",
      tipoPautaCodigo: "recaudaciones_remuneraciones",
    });

    expect(result.code).toBe("DATA_DELETED");
    expect(result.deleted_count).toBe(1800);
    expect(mockRemuneracionRectificadaDestroy).toHaveBeenCalledOnce();
  });

  it("funciona correctamente para módulo DETERMINACION_TRIBUTARIA", async () => {
    mockDeterminacionDestroy.mockResolvedValue(15);
    mockAuditoriaBorradoCreate.mockResolvedValue({ borrado_id: 35 });

    const result = await ejecutarBorrado({
      ...baseParams,
      modulo: "DETERMINACION_TRIBUTARIA",
      tipoCarga: "REGULAR",
      tipoPautaCodigo: "determinacion_tributaria",
    });

    expect(result.code).toBe("DATA_DELETED");
    expect(mockDeterminacionDestroy).toHaveBeenCalledOnce();
  });

  it("lanza error si la combinación modulo/tipoCarga no es soportada", async () => {
    await expect(
      ejecutarBorrado({ ...baseParams, modulo: "GASTOS", tipoCarga: "RECTIFICACION" })
    ).rejects.toThrow("Combinación de módulo/tipoCarga no soportada");
  });

  it("guarda usuario_id y registros_eliminados correctamente en la auditoría", async () => {
    mockGastoDestroy.mockResolvedValue(7);
    mockAuditoriaBorradoCreate.mockResolvedValue({ borrado_id: 99 });

    await ejecutarBorrado({ ...baseParams, usuarioId: 42 });

    const createCall = mockAuditoriaBorradoCreate.mock.calls[0][0];
    expect(createCall.usuario_id).toBe(42);
    expect(createCall.registros_eliminados).toBe(7);
    expect(createCall.modulo).toBe("GASTOS");
    expect(createCall.tipo_carga).toBe("REGULAR");
  });
});
