import { describe, it, expect, vi, beforeEach } from "vitest";

/*
 * Tests para verificar que updateEjercicio y deleteEjercicio usan la PK
 * completa (ejercicio + mes + convenio_id + pauta_id) y no afectan
 * registros de otras pautas/convenios del mismo ejercicio/mes.
 *
 * Se mockean los modelos de Sequelize para testear la lógica del
 * controller de forma aislada, sin necesidad de base de datos.
 */

// ─── Mocks de modelos (vi.hoisted para que estén disponibles en vi.mock) ──

const { mockFindOne, mockDestroy, mockSave, mockReload, mockFindAndCountAll } = vi.hoisted(() => {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockReload = vi.fn().mockResolvedValue(undefined);
  const mockFindAndCountAll = vi.fn().mockResolvedValue({ rows: [], count: 0 });

  const REGISTROS = [
    { ejercicio: 2026, mes: 3, convenio_id: 4, pauta_id: 7, fecha_inicio: "2026-03-01", fecha_fin: "2026-04-25" },
    { ejercicio: 2026, mes: 3, convenio_id: 4, pauta_id: 8, fecha_inicio: "2026-03-01", fecha_fin: "2026-04-25" },
    { ejercicio: 2026, mes: 3, convenio_id: 1, pauta_id: 1, fecha_inicio: "2026-03-01", fecha_fin: "2026-04-15" },
  ];

  const mockFindOne = vi.fn(({ where }) => {
    const match = REGISTROS.find(
      (r) =>
        r.ejercicio === where.ejercicio &&
        r.mes === where.mes &&
        r.convenio_id === where.convenio_id &&
        r.pauta_id === where.pauta_id
    );
    return Promise.resolve(
      match ? { ...match, save: mockSave, reload: mockReload } : null
    );
  });

  const mockDestroy = vi.fn(({ where }) => {
    const idx = REGISTROS.findIndex(
      (r) =>
        r.ejercicio === where.ejercicio &&
        r.mes === where.mes &&
        r.convenio_id === where.convenio_id &&
        r.pauta_id === where.pauta_id
    );
    return Promise.resolve(idx >= 0 ? 1 : 0);
  });

  return { mockFindOne, mockDestroy, mockSave, mockReload, mockFindAndCountAll };
});

// Mock de Sequelize y modelos
vi.mock("../src/models/index.js", () => ({
  EjercicioMes: {
    findAndCountAll: mockFindAndCountAll,
    findOne: mockFindOne,
    destroy: mockDestroy,
  },
  Convenio: {},
  PautaConvenio: {},
  TipoPauta: {},
  ProrrogaMunicipio: {},
  AuditoriaProrrogaMunicipio: {},
  EjercicioMesCerrado: {},
  Municipio: {},
  CierreModulo: {},
  Parametros: {},
}));

vi.mock("../src/utils/cierreModulo.js", () => ({
  CIERRE_MODULOS: { GASTOS: "GASTOS", RECURSOS: "RECURSOS" },
  TIPOS_CIERRE_MODULO: { REGULAR: "REGULAR", PRORROGA: "PRORROGA" },
  getModuloCierreAliases: vi.fn(),
  normalizeModuloCierre: vi.fn(),
  normalizeTipoCierre: vi.fn(),
}));

import { listarEjercicios, updateEjercicio, deleteEjercicio } from "../src/controllers/ejercicios.controller.js";

// ─── Helpers para crear req/res fake ────────────────────────────────

const crearRes = () => {
  const res = {
    statusCode: 200,
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

const crearReqUpdate = ({ ejercicio, mes, convenio_id, pauta_id, body = {} }) => ({
  params: { ejercicio: String(ejercicio), mes: String(mes) },
  query: {
    convenio_id: convenio_id !== undefined ? String(convenio_id) : undefined,
    pauta_id: pauta_id !== undefined ? String(pauta_id) : undefined,
  },
  body,
  user: { usuario_id: 1 },
});

const crearReqDelete = ({ ejercicio, mes, convenio_id, pauta_id }) => ({
  params: { ejercicio: String(ejercicio), mes: String(mes) },
  query: {
    convenio_id: convenio_id !== undefined ? String(convenio_id) : undefined,
    pauta_id: pauta_id !== undefined ? String(pauta_id) : undefined,
  },
  user: { usuario_id: 1 },
});

const crearReqList = (query = {}) => ({
  query,
});

// ─── Tests ──────────────────────────────────────────────────────────

describe("listarEjercicios — filtros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtra por ejercicio, convenio_id y tipo_pauta_id", async () => {
    const req = crearReqList({
      page: "2",
      limit: "5",
      year: "2026",
      convenio_id: "4",
      tipo_pauta_id: "3",
    });
    const res = crearRes();

    await listarEjercicios(req, res);

    expect(mockFindAndCountAll).toHaveBeenCalledTimes(1);
    const options = mockFindAndCountAll.mock.calls[0][0];
    expect(options.where).toEqual({ ejercicio: 2026, convenio_id: 4 });
    expect(options.offset).toBe(5);
    expect(options.limit).toBe(5);

    const pautaInclude = options.include.find((include) => include.attributes?.includes("pauta_id"));
    expect(pautaInclude.where).toEqual({ tipo_pauta_id: 3 });
    expect(pautaInclude.required).toBe(true);
  });

  it("no fuerza inner join de pauta si no se filtra por tipo_pauta_id", async () => {
    const req = crearReqList({ convenio_id: "4" });
    const res = crearRes();

    await listarEjercicios(req, res);

    const options = mockFindAndCountAll.mock.calls[0][0];
    const pautaInclude = options.include.find((include) => include.attributes?.includes("pauta_id"));
    expect(options.where).toEqual({ convenio_id: 4 });
    expect(pautaInclude.where).toBeUndefined();
    expect(pautaInclude.required).toBeUndefined();
  });

  it("rechaza convenio_id inválido", async () => {
    const req = crearReqList({ convenio_id: "abc" });
    const res = crearRes();

    await listarEjercicios(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/convenio_id/i);
    expect(mockFindAndCountAll).not.toHaveBeenCalled();
  });

  it("rechaza tipo_pauta_id inválido", async () => {
    const req = crearReqList({ tipo_pauta_id: "0" });
    const res = crearRes();

    await listarEjercicios(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/tipo_pauta_id/i);
    expect(mockFindAndCountAll).not.toHaveBeenCalled();
  });
});

describe("updateEjercicio — PK completa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("busca con los 4 campos de la PK", async () => {
    const req = crearReqUpdate({
      ejercicio: 2026, mes: 3, convenio_id: 4, pauta_id: 7,
      body: { fecha_fin: "2026-05-01" },
    });
    const res = crearRes();
    await updateEjercicio(req, res);

    expect(mockFindOne).toHaveBeenCalledWith({
      where: { ejercicio: 2026, mes: 3, convenio_id: 4, pauta_id: 7 },
    });
  });

  it("actualiza solo el registro que coincide con la PK completa", async () => {
    const req = crearReqUpdate({
      ejercicio: 2026, mes: 3, convenio_id: 4, pauta_id: 7,
      body: { fecha_fin: "2026-05-01" },
    });
    const res = crearRes();
    await updateEjercicio(req, res);

    expect(mockSave).toHaveBeenCalledTimes(1);
    // El registro guardado debe tener la fecha actualizada
    expect(res.statusCode).toBe(200);
  });

  it("no afecta registros de otra pauta del mismo ejercicio/mes", async () => {
    // Actualizar pauta_id=7
    const req1 = crearReqUpdate({
      ejercicio: 2026, mes: 3, convenio_id: 4, pauta_id: 7,
      body: { fecha_fin: "2026-05-10" },
    });
    const res1 = crearRes();
    await updateEjercicio(req1, res1);

    // Verificar que findOne fue llamado solo con pauta_id=7, no con 8
    expect(mockFindOne).toHaveBeenCalledTimes(1);
    expect(mockFindOne.mock.calls[0][0].where.pauta_id).toBe(7);
  });

  it("retorna 404 si la combinación exacta no existe", async () => {
    const req = crearReqUpdate({
      ejercicio: 2026, mes: 3, convenio_id: 99, pauta_id: 99,
      body: { fecha_fin: "2026-05-01" },
    });
    const res = crearRes();
    await updateEjercicio(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/no encontrado/i);
  });

  it("rechaza si falta convenio_id", async () => {
    const req = crearReqUpdate({
      ejercicio: 2026, mes: 3, convenio_id: undefined, pauta_id: 7,
      body: { fecha_fin: "2026-05-01" },
    });
    const res = crearRes();
    await updateEjercicio(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/convenio_id/i);
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it("rechaza si falta pauta_id", async () => {
    const req = crearReqUpdate({
      ejercicio: 2026, mes: 3, convenio_id: 4, pauta_id: undefined,
      body: { fecha_fin: "2026-05-01" },
    });
    const res = crearRes();
    await updateEjercicio(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/pauta_id/i);
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it("rechaza si convenio_id no es numérico", async () => {
    const req = crearReqUpdate({
      ejercicio: 2026, mes: 3, convenio_id: "abc", pauta_id: 7,
      body: { fecha_fin: "2026-05-01" },
    });
    const res = crearRes();
    await updateEjercicio(req, res);

    expect(res.statusCode).toBe(400);
  });

  it("rechaza sin usuario autenticado", async () => {
    const req = crearReqUpdate({
      ejercicio: 2026, mes: 3, convenio_id: 4, pauta_id: 7,
      body: { fecha_fin: "2026-05-01" },
    });
    req.user = null;
    const res = crearRes();
    await updateEjercicio(req, res);

    expect(res.statusCode).toBe(401);
  });
});

describe("deleteEjercicio — PK completa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("elimina con los 4 campos de la PK", async () => {
    const req = crearReqDelete({ ejercicio: 2026, mes: 3, convenio_id: 4, pauta_id: 7 });
    const res = crearRes();
    await deleteEjercicio(req, res);

    expect(mockDestroy).toHaveBeenCalledWith({
      where: { ejercicio: 2026, mes: 3, convenio_id: 4, pauta_id: 7 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/eliminado/i);
  });

  it("no elimina registros de otras pautas", async () => {
    const req = crearReqDelete({ ejercicio: 2026, mes: 3, convenio_id: 4, pauta_id: 8 });
    const res = crearRes();
    await deleteEjercicio(req, res);

    // destroy fue llamado solo con pauta_id=8
    expect(mockDestroy.mock.calls[0][0].where.pauta_id).toBe(8);
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it("retorna 404 si la combinación no existe", async () => {
    const req = crearReqDelete({ ejercicio: 2026, mes: 3, convenio_id: 99, pauta_id: 99 });
    const res = crearRes();
    await deleteEjercicio(req, res);

    expect(res.statusCode).toBe(404);
  });

  it("rechaza si falta convenio_id", async () => {
    const req = crearReqDelete({ ejercicio: 2026, mes: 3, convenio_id: undefined, pauta_id: 7 });
    const res = crearRes();
    await deleteEjercicio(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/convenio_id/i);
    expect(mockDestroy).not.toHaveBeenCalled();
  });

  it("rechaza si falta pauta_id", async () => {
    const req = crearReqDelete({ ejercicio: 2026, mes: 3, convenio_id: 4, pauta_id: undefined });
    const res = crearRes();
    await deleteEjercicio(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/pauta_id/i);
    expect(mockDestroy).not.toHaveBeenCalled();
  });
});
