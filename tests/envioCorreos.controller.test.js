import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindAndCountAll = vi.fn();

vi.mock("../src/models/moduloEjercicios/EnvioCorreo.js", () => ({
  default: {
    findAndCountAll: (...args) => mockFindAndCountAll(...args),
    sequelize: { fn: vi.fn(), col: vi.fn() },
  },
}));

const { listarEnviosCorreos } = await import("../src/controllers/envioCorreos.controller.js");
const { Op } = await import("sequelize");

const crearRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

describe("envioCorreos.controller — listarEnviosCorreos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindAndCountAll.mockResolvedValue({ count: 0, rows: [] });
  });

  it("acota limit/offset y no devuelve payload ni clave idempotente", async () => {
    const res = crearRes();
    await listarEnviosCorreos({ query: { limit: "99999", offset: "-5" } }, res);

    const args = mockFindAndCountAll.mock.calls[0][0];
    expect(args.limit).toBe(100);
    expect(args.offset).toBe(0);
    expect(args.attributes.exclude).toEqual(["payload", "idempotency_key"]);
    expect(res.body).toMatchObject({ total: 0, limit: 100, offset: 0 });
  });

  it("rechaza estados inválidos y fechas mal formadas", async () => {
    let res = crearRes();
    await listarEnviosCorreos({ query: { estado: "X'; DROP" } }, res);
    expect(res.statusCode).toBe(400);

    res = crearRes();
    await listarEnviosCorreos({ query: { desde: "17/10/2026" } }, res);
    expect(res.statusCode).toBe(400);
    expect(mockFindAndCountAll).not.toHaveBeenCalled();
  });

  it("filtra por destinatario escapando comodines y por rango de fechas AR", async () => {
    const res = crearRes();
    await listarEnviosCorreos(
      { query: { destinatario: " 50%_ok ", estado: "ERROR", tipo: "RECORDATORIO_CIERRE", desde: "2026-10-01", hasta: "2026-10-31" } },
      res
    );

    const { where } = mockFindAndCountAll.mock.calls[0][0];
    expect(where.estado).toBe("ERROR");
    expect(where.tipo).toBe("RECORDATORIO_CIERRE");
    expect(where[Op.or][0].destinatario[Op.like]).toBe("%50\\%\\_ok%");
    const [d, h] = where.created_at[Op.between];
    expect(d.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(h.toISOString()).toBe("2026-11-01T02:59:59.000Z");
  });
});
