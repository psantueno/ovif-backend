import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockResolverPeriodoRegular,
  mockVerificarRectificacionDisponible,
  mockMunicipioFindByPk,
  mockGastoFindAll,
  mockRecursoFindAll,
  mockRecaudacionFindAll,
  mockRemuneracionFindAll,
  mockDeterminacionFindAll,
  mockRecaudacionRectificadaFindAll,
  mockRemuneracionRectificadaFindAll,
  mockBuildInformeGastos,
  mockBuildInformeRecursos,
  mockBuildInformeRecaudaciones,
  mockBuildInformeRemuneraciones,
  mockBuildInformeDeterminacionTributaria,
} = vi.hoisted(() => ({
  mockResolverPeriodoRegular: vi.fn(),
  mockVerificarRectificacionDisponible: vi.fn(),
  mockMunicipioFindByPk: vi.fn(),
  mockGastoFindAll: vi.fn(),
  mockRecursoFindAll: vi.fn(),
  mockRecaudacionFindAll: vi.fn(),
  mockRemuneracionFindAll: vi.fn(),
  mockDeterminacionFindAll: vi.fn(),
  mockRecaudacionRectificadaFindAll: vi.fn(),
  mockRemuneracionRectificadaFindAll: vi.fn(),
  mockBuildInformeGastos: vi.fn(),
  mockBuildInformeRecursos: vi.fn(),
  mockBuildInformeRecaudaciones: vi.fn(),
  mockBuildInformeRemuneraciones: vi.fn(),
  mockBuildInformeDeterminacionTributaria: vi.fn(),
}));

vi.mock("../src/config/db.js", () => ({
  default: {
    transaction: vi.fn(),
  },
}));

vi.mock("../src/utils/periodosRegulares.js", () => ({
  obtenerPeriodosRegularesDisponiblesPorMunicipio: vi.fn(),
  resolverPeriodoRegular: (...args) => mockResolverPeriodoRegular(...args),
}));

vi.mock("../src/utils/rectificaciones.js", () => ({
  obtenerPeriodoRectificableAnterior: vi.fn(),
  evaluarPeriodosRectificacion: vi.fn(),
  verificarRectificacionDisponible: (...args) =>
    mockVerificarRectificacionDisponible(...args),
}));

vi.mock("../src/utils/pdf/municipioGastos.js", () => ({
  buildInformeGastos: (...args) => mockBuildInformeGastos(...args),
}));
vi.mock("../src/utils/pdf/municipioRecursos.js", () => ({
  buildInformeRecursos: (...args) => mockBuildInformeRecursos(...args),
}));
vi.mock("../src/utils/pdf/municipioRecaudaciones.js", () => ({
  buildInformeRecaudaciones: (...args) => mockBuildInformeRecaudaciones(...args),
}));
vi.mock("../src/utils/pdf/municipioRemuneraciones.js", () => ({
  buildInformeRemuneraciones: (...args) => mockBuildInformeRemuneraciones(...args),
}));
vi.mock("../src/utils/pdf/municipioDeterminacionTributaria.js", () => ({
  buildInformeDeterminacionTributaria: (...args) =>
    mockBuildInformeDeterminacionTributaria(...args),
}));

vi.mock("../src/models/index.js", () => ({
  Municipio: { findByPk: (...args) => mockMunicipioFindByPk(...args) },
  Gasto: { findAll: (...args) => mockGastoFindAll(...args), findOne: vi.fn() },
  Recurso: { findAll: (...args) => mockRecursoFindAll(...args), findOne: vi.fn() },
  Recaudacion: {
    findAll: (...args) => mockRecaudacionFindAll(...args),
    findOne: vi.fn(),
  },
  Remuneracion: {
    findAll: (...args) => mockRemuneracionFindAll(...args),
    findOne: vi.fn(),
  },
  DeterminacionTributaria: {
    findAll: (...args) => mockDeterminacionFindAll(...args),
    findOne: vi.fn(),
  },
  RecaudacionRectificada: {
    findAll: (...args) => mockRecaudacionRectificadaFindAll(...args),
    findOne: vi.fn(),
  },
  RemuneracionRectificada: {
    findAll: (...args) => mockRemuneracionRectificadaFindAll(...args),
    findOne: vi.fn(),
  },
  Usuario: { findOne: vi.fn() },
  EjercicioMes: { findAll: vi.fn(), findOne: vi.fn() },
  ProrrogaMunicipio: { findAll: vi.fn() },
  AuditoriaProrrogaMunicipio: {},
  Convenio: { findAll: vi.fn(), findOne: vi.fn(), findByPk: vi.fn() },
  PautaConvenio: { findAll: vi.fn() },
  RegimenLaboral: { findAll: vi.fn() },
  SituacionRevista: {},
  TipoGasto: {},
  Archivo: {},
  CierreModulo: {},
  EjercicioMesCerrado: {},
  Poblacion: {},
  UsuarioMunicipio: { findOne: vi.fn() },
  TipoPauta: {},
}));

vi.mock("../src/services/borrado.service.js", () => ({ ejecutarBorrado: vi.fn() }));

const {
  generarInformeGastosMunicipio,
  generarInformeRecursosMunicipio,
  generarInformeRecaudacionesMunicipio,
  generarInformeRemuneracionesMunicipio,
  generarInformeDeterminacionTributariaMunicipio,
  generarInformeRecaudacionesRectificadasMunicipio,
  generarInformeRemuneracionesRectificadasMunicipio,
} = await import("../src/controllers/municipios.controller.js");

const crearReq = () => ({
  params: {
    municipioId: "1",
    ejercicio: "2026",
    mes: "1",
  },
  user: { usuario_id: 10 },
});

const crearRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

describe("informes mensuales sin datos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolverPeriodoRegular.mockResolvedValue({
      disponible: true,
      periodo: { convenio_id: 1 },
    });
    mockVerificarRectificacionDisponible.mockResolvedValue(true);
    mockMunicipioFindByPk.mockResolvedValue({
      municipio_id: 1,
      municipio_nombre: "Municipio Test",
    });
    mockGastoFindAll.mockResolvedValue([]);
    mockRecursoFindAll.mockResolvedValue([]);
    mockRecaudacionFindAll.mockResolvedValue([]);
    mockRemuneracionFindAll.mockResolvedValue([]);
    mockDeterminacionFindAll.mockResolvedValue([]);
    mockRecaudacionRectificadaFindAll.mockResolvedValue([]);
    mockRemuneracionRectificadaFindAll.mockResolvedValue([]);
  });

  const casos = [
    ["gastos", generarInformeGastosMunicipio, mockBuildInformeGastos],
    ["recursos", generarInformeRecursosMunicipio, mockBuildInformeRecursos],
    ["recaudaciones", generarInformeRecaudacionesMunicipio, mockBuildInformeRecaudaciones],
    ["remuneraciones", generarInformeRemuneracionesMunicipio, mockBuildInformeRemuneraciones],
    [
      "determinacion tributaria",
      generarInformeDeterminacionTributariaMunicipio,
      mockBuildInformeDeterminacionTributaria,
    ],
    [
      "recaudaciones rectificadas",
      generarInformeRecaudacionesRectificadasMunicipio,
      mockBuildInformeRecaudaciones,
    ],
    [
      "remuneraciones rectificadas",
      generarInformeRemuneracionesRectificadasMunicipio,
      mockBuildInformeRemuneraciones,
    ],
  ];

  it.each(casos)(
    "%s responde 200 informativo y no construye PDF",
    async (_nombre, handler, buildInforme) => {
      const res = crearRes();

      await handler(crearReq(), res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        generado: false,
        message:
          "Todavía no hay datos cargados para este período. Cuando los cargues, vas a poder generar el informe.",
      });
      expect(buildInforme).not.toHaveBeenCalled();
    }
  );
});
