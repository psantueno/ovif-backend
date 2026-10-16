import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockParametrosFindAll = vi.fn();
const mockMunicipioMailFindAll = vi.fn();
const mockMunicipioFindAll = vi.fn();
const mockCronLogCreate = vi.fn();
const mockObtenerPeriodosRegulares = vi.fn();
const mockEncolarRecordatorioCierre = vi.fn();
const mockProcesarMailsPendientes = vi.fn();

vi.mock("../src/models/index.js", () => ({
  Parametros: { findAll: (...args) => mockParametrosFindAll(...args) },
  MunicipioMail: { findAll: (...args) => mockMunicipioMailFindAll(...args) },
  Municipio: { findAll: (...args) => mockMunicipioFindAll(...args) },
  CronLog: { create: (...args) => mockCronLogCreate(...args) },
}));

vi.mock("../src/utils/periodosRegulares.js", () => ({
  obtenerPeriodosRegulares: (...args) => mockObtenerPeriodosRegulares(...args),
}));

vi.mock("../src/services/emailService.js", () => ({
  encolarRecordatorioCierre: (...args) => mockEncolarRecordatorioCierre(...args),
  procesarMailsPendientes: (...args) => mockProcesarMailsPendientes(...args),
}));

vi.mock("../src/services/cierreService.js", () => ({
  obtenerModulosPorTipoPauta: (codigo) =>
    ({
      gastos_recursos: ["RECURSOS", "GASTOS"],
      recaudaciones_remuneraciones: ["RECAUDACIONES", "REMUNERACIONES"],
      determinacion_tributaria: ["DETERMINACION_TRIBUTARIA"],
    })[codigo] ?? [],
}));

const {
  calcularDiasRestantes,
  periodoEnVentanaRecordatorio,
  obtenerRecordatorios,
  ejecutarRecordatorioCierre,
} = await import("../src/services/recordatorioCierreService.js");

const {
  PARAMETROS_SISTEMA,
  esParametroSistema,
  validarValorParametroSistema,
  obtenerConfigRecordatorioCierre,
} = await import("../src/utils/parametrosSistema.js");

const periodoBase = (overrides = {}) => ({
  ejercicio: 2026,
  mes: 9,
  convenio_id: 1,
  pauta_id: 10,
  fecha_cierre: "2026-10-20",
  tiene_prorroga: false,
  tipo_pauta_codigo: "gastos_recursos",
  iniciado: true,
  vencido: false,
  ...overrides,
});

// ─── calcularDiasRestantes ───────────────────────────────────────────────────

describe("recordatorioCierre — calcularDiasRestantes", () => {
  it("calcula días dentro del mismo mes", () => {
    expect(calcularDiasRestantes("2026-10-17", "2026-10-20")).toBe(3);
    expect(calcularDiasRestantes("2026-10-20", "2026-10-20")).toBe(0);
  });

  it("calcula días con cambio de mes y de año", () => {
    expect(calcularDiasRestantes("2026-10-30", "2026-11-02")).toBe(3);
    expect(calcularDiasRestantes("2026-12-30", "2027-01-02")).toBe(3);
    expect(calcularDiasRestantes("2028-02-28", "2028-03-01")).toBe(2); // bisiesto
  });

  it("devuelve negativo si el cierre ya pasó y null ante fechas inválidas", () => {
    expect(calcularDiasRestantes("2026-10-21", "2026-10-20")).toBe(-1);
    expect(calcularDiasRestantes("2026-10-21", null)).toBeNull();
    expect(calcularDiasRestantes("21/10/2026", "2026-10-20")).toBeNull();
  });
});

// ─── periodoEnVentanaRecordatorio ────────────────────────────────────────────

describe("recordatorioCierre — periodoEnVentanaRecordatorio", () => {
  it("incluye períodos con 0 a N días restantes", () => {
    expect(periodoEnVentanaRecordatorio(periodoBase(), "2026-10-17", 3)).toEqual({ enVentana: true, diasRestantes: 3 });
    expect(periodoEnVentanaRecordatorio(periodoBase(), "2026-10-19", 3)).toEqual({ enVentana: true, diasRestantes: 1 });
    expect(periodoEnVentanaRecordatorio(periodoBase(), "2026-10-20", 3)).toEqual({ enVentana: true, diasRestantes: 0 });
  });

  it("excluye períodos fuera de la ventana, vencidos o no iniciados", () => {
    expect(periodoEnVentanaRecordatorio(periodoBase(), "2026-10-16", 3).enVentana).toBe(false);
    expect(periodoEnVentanaRecordatorio(periodoBase({ vencido: true }), "2026-10-19", 3).enVentana).toBe(false);
    expect(periodoEnVentanaRecordatorio(periodoBase({ iniciado: false }), "2026-10-19", 3).enVentana).toBe(false);
    expect(periodoEnVentanaRecordatorio(periodoBase({ fecha_cierre: null }), "2026-10-19", 3).enVentana).toBe(false);
  });
});

// ─── obtenerRecordatorios ────────────────────────────────────────────────────

describe("recordatorioCierre — obtenerRecordatorios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("arma un ítem por municipio y pauta, sin emails repetidos", async () => {
    mockMunicipioMailFindAll.mockResolvedValue([
      { municipio_id: 1, email: "contacto@muni.gob.ar", nombre: "Contacto" },
      { municipio_id: 1, email: "CONTACTO@muni.gob.ar", nombre: "Duplicado" },
      { municipio_id: 1, email: "otro@muni.gob.ar", nombre: "Otro" },
    ]);
    mockMunicipioFindAll.mockResolvedValue([{ municipio_id: 1, municipio_nombre: "Zapala" }]);
    mockObtenerPeriodosRegulares.mockResolvedValue([
      periodoBase({ pauta_id: 10, tipo_pauta_codigo: "gastos_recursos" }),
      periodoBase({ pauta_id: 11, tipo_pauta_codigo: "recaudaciones_remuneraciones" }),
      periodoBase({ pauta_id: 12, tipo_pauta_codigo: "determinacion_tributaria", fecha_cierre: "2026-11-30" }),
      periodoBase({ pauta_id: 13, tipo_pauta_codigo: "sin_mapear" }),
    ]);

    const items = await obtenerRecordatorios({ fechaReferencia: "2026-10-17", diasPrevios: 3 });

    expect(items).toHaveLength(2);
    expect(items[0].modulos).toEqual(["GASTOS", "RECURSOS"]);
    expect(items[1].modulos).toEqual(["RECAUDACIONES", "REMUNERACIONES"]);
    expect(items[0].destinatarios).toEqual([
      { email: "contacto@muni.gob.ar", nombre: "Contacto" },
      { email: "otro@muni.gob.ar", nombre: "Otro" },
    ]);
    expect(mockObtenerPeriodosRegulares).toHaveBeenCalledWith({ municipioId: 1, fechaReferencia: "2026-10-17" });
  });

  it("usa la fecha efectiva con prórroga del municipio", async () => {
    mockMunicipioMailFindAll.mockResolvedValue([{ municipio_id: 1, email: "a@muni.gob.ar", nombre: "A" }]);
    mockMunicipioFindAll.mockResolvedValue([{ municipio_id: 1, municipio_nombre: "Zapala" }]);
    // fecha oficial 20/10 ya fuera de interés: la prórroga lleva el cierre al 30/10
    mockObtenerPeriodosRegulares.mockResolvedValue([
      periodoBase({ fecha_cierre: "2026-10-30", fecha_fin_oficial: "2026-10-20", tiene_prorroga: true }),
    ]);

    const enOficial = await obtenerRecordatorios({ fechaReferencia: "2026-10-18", diasPrevios: 3 });
    expect(enOficial).toHaveLength(0);

    const enProrroga = await obtenerRecordatorios({ fechaReferencia: "2026-10-28", diasPrevios: 3 });
    expect(enProrroga).toHaveLength(1);
    expect(enProrroga[0].dias_restantes).toBe(2);
  });

  it("no consulta municipios si no hay mails cargados", async () => {
    mockMunicipioMailFindAll.mockResolvedValue([]);

    const items = await obtenerRecordatorios({ fechaReferencia: "2026-10-17", diasPrevios: 3 });

    expect(items).toEqual([]);
    expect(mockMunicipioFindAll).not.toHaveBeenCalled();
  });
});

// ─── ejecutarRecordatorioCierre ──────────────────────────────────────────────

describe("recordatorioCierre — ejecutarRecordatorioCierre", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMunicipioMailFindAll.mockResolvedValue([
      { municipio_id: 1, email: "a@muni.gob.ar", nombre: "A" },
      { municipio_id: 1, email: "b@muni.gob.ar", nombre: "B" },
    ]);
    mockMunicipioFindAll.mockResolvedValue([{ municipio_id: 1, municipio_nombre: "Zapala" }]);
    mockObtenerPeriodosRegulares.mockResolvedValue([periodoBase()]);
    mockProcesarMailsPendientes.mockResolvedValue({ total: 1, sent: 1, failed: 0, skipped: 0 });
  });

  it("procesa sólo correos nuevos o reintentables y registra el resumen", async () => {
    mockEncolarRecordatorioCierre
      .mockResolvedValueOnce({ correo: { id: 1, estado: "PENDIENTE", intentos: 0, max_intentos: 5 }, created: true })
      .mockResolvedValueOnce({ correo: { id: 2, estado: "ENVIADO", intentos: 1, max_intentos: 5 }, created: false });

    const resumen = await ejecutarRecordatorioCierre({ fechaReferencia: "2026-10-17", diasPrevios: 3 });

    expect(resumen).toMatchObject({ evaluados: 2, nuevos: 1, existentes: 1, erroresEncolando: 0 });
    expect(mockProcesarMailsPendientes).toHaveBeenCalledWith({ ids: [1], maxAttemptsPerRun: 3 });
    expect(mockCronLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ nombre_tarea: "Resumen Recordatorio cierre", estado: "OK" })
    );
  });

  it("un error al encolar no corta el lote y se registra en CronLog", async () => {
    mockEncolarRecordatorioCierre
      .mockRejectedValueOnce(new Error("DB caída"))
      .mockResolvedValueOnce({ correo: { id: 2, estado: "ERROR", intentos: 1, max_intentos: 5 }, created: false });

    const resumen = await ejecutarRecordatorioCierre({ fechaReferencia: "2026-10-17", diasPrevios: 3 });

    expect(resumen.erroresEncolando).toBe(1);
    expect(mockProcesarMailsPendientes).toHaveBeenCalledWith({ ids: [2], maxAttemptsPerRun: 3 });
    expect(mockCronLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ nombre_tarea: "Recordatorio cierre", estado: "ERROR", municipio_id: 1 })
    );
    expect(mockCronLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ nombre_tarea: "Resumen Recordatorio cierre", estado: "ERROR" })
    );
  });
});

// ─── Parámetros de sistema ───────────────────────────────────────────────────

describe("parametrosSistema — validarValorParametroSistema", () => {
  it("reconoce los parámetros de sistema", () => {
    expect(esParametroSistema("Directorio Base")).toBe(true);
    expect(esParametroSistema(" Recordatorio de cierre - Horario ")).toBe(true);
    expect(esParametroSistema("Otro parámetro")).toBe(false);
  });

  it("valida días previos entre 1 y 30", () => {
    const nombre = PARAMETROS_SISTEMA.RECORDATORIO_DIAS_PREVIOS;
    expect(validarValorParametroSistema(nombre, "3")).toEqual({ ok: true, valor: "3" });
    expect(validarValorParametroSistema(nombre, " 30 ")).toEqual({ ok: true, valor: "30" });
    expect(validarValorParametroSistema(nombre, "05")).toEqual({ ok: true, valor: "5" });
    for (const invalido of ["0", "31", "abc", "2.5", "-1", ""]) {
      expect(validarValorParametroSistema(nombre, invalido).ok).toBe(false);
    }
  });

  it("valida horario HH:mm en 24 hs", () => {
    const nombre = PARAMETROS_SISTEMA.RECORDATORIO_HORARIO;
    expect(validarValorParametroSistema(nombre, "09:00").ok).toBe(true);
    expect(validarValorParametroSistema(nombre, "23:59").ok).toBe(true);
    for (const invalido of ["9:00", "24:00", "12:60", "09.00", "0900", "abc"]) {
      expect(validarValorParametroSistema(nombre, invalido).ok).toBe(false);
    }
  });

  it("no valida el formato de parámetros sin validador", () => {
    expect(validarValorParametroSistema("Directorio Base", " /home/x ")).toEqual({ ok: true, valor: "/home/x" });
    expect(validarValorParametroSistema("Cualquiera", "valor")).toEqual({ ok: true, valor: "valor" });
  });
});

describe("parametrosSistema — obtenerConfigRecordatorioCierre", () => {
  const parametro = (nombre, valor, estado = true) => ({ nombre, valor, estado });
  const DIAS = PARAMETROS_SISTEMA.RECORDATORIO_DIAS_PREVIOS;
  const HORA = PARAMETROS_SISTEMA.RECORDATORIO_HORARIO;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("habilita con ambos parámetros activos y válidos", async () => {
    mockParametrosFindAll.mockResolvedValue([parametro(DIAS, "3"), parametro(HORA, "09:00")]);
    await expect(obtenerConfigRecordatorioCierre()).resolves.toEqual({
      habilitado: true,
      diasPrevios: 3,
      horario: "09:00",
      motivo: null,
      invalido: false,
    });
  });

  it("deshabilita sin marcar inválido si falta o está inactivo", async () => {
    mockParametrosFindAll.mockResolvedValue([parametro(DIAS, "3")]);
    let config = await obtenerConfigRecordatorioCierre();
    expect(config).toMatchObject({ habilitado: false, invalido: false });
    expect(config.motivo).toContain("Falta");

    mockParametrosFindAll.mockResolvedValue([parametro(DIAS, "3", false), parametro(HORA, "09:00")]);
    config = await obtenerConfigRecordatorioCierre();
    expect(config).toMatchObject({ habilitado: false, invalido: false, diasPrevios: 3 });
    expect(config.motivo).toContain("inactivo");
  });

  it("deshabilita y marca inválido ante valores fuera de formato", async () => {
    for (const [dias, hora] of [["0", "09:00"], ["31", "09:00"], ["abc", "09:00"], ["3", "9:00"], ["3", "24:00"]]) {
      mockParametrosFindAll.mockResolvedValue([parametro(DIAS, dias), parametro(HORA, hora)]);
      const config = await obtenerConfigRecordatorioCierre();
      expect(config).toMatchObject({ habilitado: false, invalido: true });
    }
  });
});
