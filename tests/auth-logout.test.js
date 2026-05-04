import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "test-secret";

const { mockFindByPk, mockUpdate, mockSessionSave } = vi.hoisted(() => ({
  mockFindByPk: vi.fn(),
  mockUpdate: vi.fn(),
  mockSessionSave: vi.fn(),
}));

vi.mock("../src/config/db.js", () => ({ default: {} }));
vi.mock("../src/services/emailService.js", () => ({ sendResetMail: vi.fn() }));
vi.mock("../src/models/index.js", () => ({
  PasswordReset: {},
  Usuario: {},
  Rol: {},
  AuthSession: {
    findByPk: (...args) => mockFindByPk(...args),
    update: (...args) => mockUpdate(...args),
  },
}));

const { logout } = await import("../src/controllers/auth.controller.js");

const createRes = () => {
  const res = {
    cookies: [],
    statusCode: null,
    ended: false,
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
  return res;
};

const createAccessToken = (payload, options = {}) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    issuer: "ovif-backend",
    audience: "ovif-frontend",
    expiresIn: "10m",
    ...options,
  });

describe("auth.controller — logout idempotente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByPk.mockResolvedValue({ revoked_at: null, save: mockSessionSave });
    mockSessionSave.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue([1]);
  });

  it("devuelve 204 y limpia cookies aunque no haya cookies de sesión", async () => {
    const req = { cookies: {} };
    const res = createRes();

    await logout(req, res);

    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(res.cookies.map((cookie) => cookie.name)).toEqual(["ovif_at", "ovif_rt"]);
    expect(mockFindByPk).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("revoca por sid de access token firmado y limpia cookies", async () => {
    const token = createAccessToken({ sub: 7, usuario_id: 7, sid: "session-123" });
    const req = { cookies: { ovif_at: token } };
    const res = createRes();

    await logout(req, res);

    expect(mockFindByPk).toHaveBeenCalledWith("session-123");
    expect(mockSessionSave).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(204);
    expect(res.cookies).toHaveLength(2);
  });

  it("acepta access token expirado si la firma es válida", async () => {
    const token = createAccessToken(
      { sub: 7, usuario_id: 7, sid: "expired-session" },
      { expiresIn: "-1s" }
    );
    const req = { cookies: { ovif_at: token } };
    const res = createRes();

    await logout(req, res);

    expect(mockFindByPk).toHaveBeenCalledWith("expired-session");
    expect(mockSessionSave).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(204);
  });

  it("revoca por refresh cookie como fallback y limpia cookies", async () => {
    const rawRefresh = "refresh-token";
    const expectedHash = crypto.createHash("sha256").update(rawRefresh).digest("hex");
    const req = { cookies: { ovif_rt: rawRefresh } };
    const res = createRes();

    await logout(req, res);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ revoked_at: expect.any(Date) }),
      { where: { refresh_token_hash: expectedHash, revoked_at: null } }
    );
    expect(res.statusCode).toBe(204);
    expect(res.cookies).toHaveLength(2);
  });

  it("limpia cookies y responde 204 aunque falle la revocación en DB", async () => {
    const rawRefresh = "refresh-token";
    mockUpdate.mockRejectedValue(new Error("DB unavailable"));
    const req = { cookies: { ovif_rt: rawRefresh } };
    const res = createRes();

    await logout(req, res);

    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(res.cookies.map((cookie) => cookie.name)).toEqual(["ovif_at", "ovif_rt"]);
  });
});
