import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockTransaction,
  mockCommit,
  mockRollback,
  mockMunicipioFindByPk,
  mockResolverPeriodoRegular,
  mockVerificarRectificacionDisponible,
  mockRemuneracionFindOne,
  mockRemuneracionCreate,
  mockRemuneracionRectificadaFindOne,
  mockRemuneracionRectificadaCreate,
} = vi.hoisted(() => ({
  mockCommit: vi.fn(),
  mockRollback: vi.fn(),
  mockTransaction: vi.fn(),
  mockMunicipioFindByPk: vi.fn(),
  mockResolverPeriodoRegular: vi.fn(),
  mockVerificarRectificacionDisponible: vi.fn(),
  mockRemuneracionFindOne: vi.fn(),
  mockRemuneracionCreate: vi.fn(),
  mockRemuneracionRectificadaFindOne: vi.fn(),
  mockRemuneracionRectificadaCreate: vi.fn(),
}));

vi.mock("../src/config/db.js", () => ({
  default: {
    transaction: (...args) => mockTransaction(...args),
  },
}));

vi.mock("../src/utils/periodosRegulares.js", () => ({
  obtenerPeriodosRegularesDisponiblesPorMunicipio: vi.fn(),
  resolverPeriodoRegular: (...args) => mockResolverPeriodoRegular(...args),
}));

vi.mock("../src/utils/rectificaciones.js", () => ({
  obtenerPeriodoRectificableAnterior: vi.fn(),
  evaluarPeriodosRectificacion: vi.fn(),
  verificarRectificacionDisponible: (...args) => mockVerificarRectificacionDisponible(...args),
}));

vi.mock("../src/utils/pdf/municipioGastos.js", () => ({ buildInformeGastos: vi.fn() }));
vi.mock("../src/utils/pdf/municipioRecursos.js", () => ({ buildInformeRecursos: vi.fn() }));
vi.mock("../src/utils/pdf/municipioRecaudaciones.js", () => ({ buildInformeRecaudaciones: vi.fn() }));
vi.mock("../src/utils/pdf/municipioRemuneraciones.js", () => ({ buildInformeRemuneraciones: vi.fn() }));
vi.mock("../src/utils/pdf/municipioDeterminacionTributaria.js", () => ({ buildInformeDeterminacionTributaria: vi.fn() }));

vi.mock("../src/models/index.js", () => ({
  Municipio: { findByPk: (...args) => mockMunicipioFindByPk(...args) },
  Remuneracion: {
    findOne: (...args) => mockRemuneracionFindOne(...args),
    create: (...args) => mockRemuneracionCreate(...args),
  },
  RemuneracionRectificada: {
    findOne: (...args) => mockRemuneracionRectificadaFindOne(...args),
    create: (...args) => mockRemuneracionRectificadaCreate(...args),
  },
  Usuario: {},
  EjercicioMes: {},
  ProrrogaMunicipio: {},
  AuditoriaProrrogaMunicipio: {},
  Gasto: {},
  Recurso: {},
  Convenio: {},
  PautaConvenio: {},
  Recaudacion: {},
  RegimenLaboral: {},
  SituacionRevista: {},
  TipoGasto: {},
  Archivo: {},
  CierreModulo: {},
  EjercicioMesCerrado: {},
  Poblacion: {},
  UsuarioMunicipio: {},
  RecaudacionRectificada: {},
  TipoPauta: {},
  DeterminacionTributaria: {},
  ConceptoRecaudacion: {},
  Parametros: {},
  MunicipioMail: {},
  EnvioCorreo: {},
  AuthSession: {},
  ApiRequestLog: {},
  RateLimitEvent: {},
  ApiRequestMetricHourly: {},
  SolicitudProrroga: {},
  SolicitudProrrogaEstados: {},
  AuditoriaBorrado: {},
}));

vi.mock("../src/services/borrado.service.js", () => ({ ejecutarBorrado: vi.fn() }));

const {
  upsertRemuneracionesMunicipio,
  upsertRemuneracionesRectificadasMunicipio,
} = await import("../src/controllers/municipios.controller.js");

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

const remuneracionBase = (overrides = {}) => ({
  cuil: "20-16678150-8",
  legajo: 123,
  apellido_nombre: "Persona X",
  regimen_laboral: "Monotributo",
  categoria: "A",
  sector: "Administracion",
  fecha_ingreso: "2026-01-01",
  fecha_inicio_servicio: "2026-01-01",
  fecha_fin_servicio: null,
  basico_cargo_salarial: 1,
  total_remunerativo: 1,
  sac: 0,
  cant_hs_extra_50: 0,
  importe_hs_extra_50: 0,
  cant_hs_extra_100: 0,
  importe_hs_extra_100: 0,
  total_no_remunerativo: 0,
  total_ropa: 0,
  total_bonos: 0,
  asignaciones_familiares: 0,
  total_descuentos: 0,
  total_issn: 0,
  art: 0,
  seguro_vida_obligatorio: 0,
  neto_a_cobrar: 1,
  ...overrides,
});

const crearReq = (remuneraciones) => ({
  params: { municipioId: "11", ejercicio: "2026", mes: "1" },
  body: { remuneraciones },
});

beforeEach(() => {
  vi.clearAllMocks();
  mockCommit.mockResolvedValue(undefined);
  mockRollback.mockResolvedValue(undefined);
  mockTransaction.mockResolvedValue({ commit: mockCommit, rollback: mockRollback });
  mockMunicipioFindByPk.mockResolvedValue({ municipio_id: 11 });
  mockResolverPeriodoRegular.mockResolvedValue({ disponible: true });
  mockVerificarRectificacionDisponible.mockResolvedValue(true);
  mockRemuneracionFindOne.mockResolvedValue(null);
  mockRemuneracionCreate.mockResolvedValue({});
  mockRemuneracionRectificadaFindOne.mockResolvedValue(null);
  mockRemuneracionRectificadaCreate.mockResolvedValue({});
});

describe("upsertRemuneracionesMunicipio", () => {
  it("actualiza si existe la misma PK CUIL + regimen y no usa legajo en el where de identidad", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    mockRemuneracionFindOne.mockResolvedValueOnce({
      legajo: 123,
      apellido_nombre: "Persona X",
      categoria: "A",
      sector: "Administracion",
      total_remunerativo: "1.00",
      save,
    });

    const res = crearRes();
    await upsertRemuneracionesMunicipio(crearReq([remuneracionBase({ total_remunerativo: 2 })]), res);

    expect(res.statusCode).toBe(200);
    expect(mockRemuneracionFindOne).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          cuil: "20-16678150-8",
          regimen_laboral: "Monotributo",
        }),
      })
    );
    expect(mockRemuneracionFindOne.mock.calls[0][0].where).not.toHaveProperty("legajo");
    expect(save).toHaveBeenCalledOnce();
    expect(mockRemuneracionCreate).not.toHaveBeenCalled();
  });

  it("crea otra fila para el mismo CUIL aunque cambie el legajo si cambia el regimen", async () => {
    const res = crearRes();
    await upsertRemuneracionesMunicipio(crearReq([remuneracionBase({ regimen_laboral: "Planta politica", legajo: 456 })]), res);

    expect(res.statusCode).toBe(200);
    expect(mockRemuneracionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        cuil: "20-16678150-8",
        legajo: 456,
        regimen_laboral: "Planta politica",
      }),
      expect.any(Object)
    );
  });

  it("rechaza 400 si el payload trae la misma combinación CUIL + regimen", async () => {
    const res = crearRes();
    await upsertRemuneracionesMunicipio(
      crearReq([
        remuneracionBase({ regimen_laboral: "Monotributo", legajo: 123 }),
        remuneracionBase({ regimen_laboral: " monotributo ", legajo: 456 }),
      ]),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.errors[0]).toContain("está duplicada");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rechaza 400 si se intenta cambiar el legajo de una combinación existente", async () => {
    mockRemuneracionFindOne.mockResolvedValueOnce({ legajo: 456 });

    const res = crearRes();
    await upsertRemuneracionesMunicipio(crearReq([remuneracionBase({ legajo: 123 })]), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("No se permite modificar el legajo");
    expect(mockRollback).toHaveBeenCalledOnce();
    expect(mockRemuneracionCreate).not.toHaveBeenCalled();
  });

  it("devuelve 409 ante conflicto de unicidad/concurrencia", async () => {
    mockRemuneracionFindOne.mockResolvedValue(null);
    mockRemuneracionCreate.mockRejectedValue({
      name: "SequelizeUniqueConstraintError",
      parent: { code: "ER_DUP_ENTRY", sqlMessage: "Duplicate entry" },
    });

    const res = crearRes();
    await upsertRemuneracionesMunicipio(crearReq([remuneracionBase()]), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("Duplicate entry");
  });
});

describe("upsertRemuneracionesRectificadasMunicipio", () => {
  it("usa las mismas reglas para crear rectificadas", async () => {
    const res = crearRes();
    await upsertRemuneracionesRectificadasMunicipio(
      crearReq([remuneracionBase({ categoria: 5, regimen_laboral: "Planta politica" })]),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(mockRemuneracionRectificadaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        categoria: "5",
        cuil: "20-16678150-8",
        legajo: 123,
        regimen_laboral: "Planta politica",
      }),
      expect.any(Object)
    );
  });

  it("devuelve 409 ante SIGNAL SQLSTATE 45000 de trigger", async () => {
    mockRemuneracionRectificadaFindOne.mockResolvedValue(null);
    mockRemuneracionRectificadaCreate.mockRejectedValue({
      parent: {
        sqlState: "45000",
        sqlMessage: "El CUIL ya existe en el periodo/municipio con otro legajo",
      },
    });

    const res = crearRes();
    await upsertRemuneracionesRectificadasMunicipio(crearReq([remuneracionBase()]), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toContain("otro legajo");
  });
});
