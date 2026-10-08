import { describe, expect, it } from "vitest";
import {
  admiteHijas,
  calcularCambios,
  derivarPadre,
  esCodigoPartidaValido,
  esRepresentableEnLatin1,
  nivelPartida,
  reconstruirHistorialPartida,
  snapshotPartida,
} from "../src/utils/partidasRecursos.js";
import {
  PartidaRecursoAltaSchema,
  PartidaRecursoAperturaSchema,
  PartidaRecursoEstadoSchema,
  PartidaRecursoUpdateSchema,
} from "../src/validation/PartidasRecursosSchema.validation.js";

describe("estructura del código de partida", () => {
  it("acepta solo 8 dígitos terminados en 00", () => {
    expect(esCodigoPartidaValido(11310100)).toBe(true);
    expect(esCodigoPartidaValido(11000000)).toBe(true);
    expect(esCodigoPartidaValido(11310101)).toBe(false);
    expect(esCodigoPartidaValido(1131010)).toBe(false);
    expect(esCodigoPartidaValido(113101000)).toBe(false);
    expect(esCodigoPartidaValido(11310100.5)).toBe(false);
  });

  it("deduce el padre poniendo en cero el último campo no nulo", () => {
    expect(derivarPadre(11310100)).toBe(11310000); // subconcepto -> concepto
    expect(derivarPadre(11310000)).toBe(11300000); // concepto -> clase
    expect(derivarPadre(11300000)).toBe(11000000); // clase -> tipo
    expect(derivarPadre(11000000)).toBe(0); // tipo -> raíz
    expect(derivarPadre(17310600)).toBe(17310000);
    expect(derivarPadre(13200000)).toBe(13000000);
  });

  it("calcula el nivel y si admite hijas", () => {
    expect(nivelPartida(11000000)).toBe(1);
    expect(nivelPartida(11300000)).toBe(2);
    expect(nivelPartida(11310000)).toBe(3);
    expect(nivelPartida(11310100)).toBe(4);
    expect(admiteHijas(11310000)).toBe(true);
    expect(admiteHijas(11310100)).toBe(false);
  });
});

describe("caracteres representables en la columna latin1", () => {
  it("acepta español y los extras de cp1252", () => {
    expect(esRepresentableEnLatin1("Coparticipación Ley N° 2.148 – «Año» € ñÑ")).toBe(true);
  });

  it("rechaza caracteres fuera de cp1252", () => {
    expect(esRepresentableEnLatin1("Tasa 🚗")).toBe(false);
    expect(esRepresentableEnLatin1("Ley № 5")).toBe(false);
  });
});

describe("snapshot y diff para auditoría", () => {
  const fila = {
    partidas_recursos_codigo: 13200000,
    partidas_recursos_descripcion: "Canon",
    partidas_recursos_padre: 13000000,
    partidas_recursos_sl: 1,
    partidas_recursos_carga: 1,
    activo: 1,
  };

  it("normaliza números y booleanos", () => {
    expect(snapshotPartida(fila)).toEqual({
      codigo: 13200000,
      descripcion: "Canon",
      padre: 13000000,
      sl: true,
      carga: true,
      activo: true,
    });
  });

  it("devuelve solo los campos que cambiaron", () => {
    const antes = snapshotPartida(fila);
    const despues = { ...antes, carga: false, sl: false };
    expect(calcularCambios(antes, despues)).toEqual([
      { campo: "sl", anterior: true, nuevo: false },
      { campo: "carga", anterior: true, nuevo: false },
    ]);
    expect(calcularCambios(antes, { ...antes })).toEqual([]);
    expect(calcularCambios(null, antes)).toEqual([]);
  });
});

describe("reconstrucción del historial", () => {
  const fila = (id, partida_codigo, accion, partida_codigo_anterior = null) => ({
    id,
    partida_codigo,
    accion,
    partida_codigo_anterior,
  });
  const cargadorDesde = (filas) => async (codigo) => filas.filter((f) => f.partida_codigo === codigo);

  it("devuelve las filas de la partida, más nuevas primero", async () => {
    const filas = [fila(1, 100, "ALTA"), fila(3, 100, "MODIFICACION"), fila(2, 200, "ALTA")];
    const historial = await reconstruirHistorialPartida(100, cargadorDesde(filas));
    expect(historial.map((f) => f.id)).toEqual([3, 1]);
  });

  it("sigue un cambio de código hacia atrás", async () => {
    const filas = [
      fila(1, 100, "ALTA"),
      fila(2, 100, "MODIFICACION"),
      fila(3, 300, "MODIFICACION", 100), // 100 pasa a 300
      fila(4, 300, "BAJA"),
    ];
    const historial = await reconstruirHistorialPartida(300, cargadorDesde(filas));
    expect(historial.map((f) => f.id)).toEqual([4, 3, 2, 1]);
  });

  it("no mezcla la historia de un código liberado y reutilizado", async () => {
    const filas = [
      fila(1, 100, "ALTA"), // partida A nace con 100
      fila(2, 100, "MODIFICACION"),
      fila(3, 300, "MODIFICACION", 100), // A pasa a 300
      fila(4, 100, "ALTA"), // partida B reutiliza 100
      fila(5, 100, "MODIFICACION"),
    ];
    const historialA = await reconstruirHistorialPartida(300, cargadorDesde(filas));
    const historialB = await reconstruirHistorialPartida(100, cargadorDesde(filas));
    expect(historialA.map((f) => f.id)).toEqual([3, 2, 1]);
    expect(historialB.map((f) => f.id)).toEqual([5, 4]);
  });

  it("toma todo lo previo al corte cuando la partida es anterior al ABM (sin ALTA)", async () => {
    const filas = [
      fila(1, 100, "MODIFICACION"), // partida legacy, sin ALTA
      fila(2, 300, "MODIFICACION", 100),
      fila(3, 100, "ALTA"), // otra partida reutiliza 100 después
    ];
    const historial = await reconstruirHistorialPartida(300, cargadorDesde(filas));
    expect(historial.map((f) => f.id)).toEqual([2, 1]);
  });

  it("sigue varias renumeraciones encadenadas", async () => {
    const filas = [
      fila(1, 100, "ALTA"),
      fila(2, 200, "MODIFICACION", 100),
      fila(3, 300, "MODIFICACION", 200),
    ];
    const historial = await reconstruirHistorialPartida(300, cargadorDesde(filas));
    expect(historial.map((f) => f.id)).toEqual([3, 2, 1]);
  });
});

describe("esquemas de validación", () => {
  const alta = {
    partidas_recursos_codigo: 13210000,
    partidas_recursos_descripcion: "  Canon de concesiones  ",
    partidas_recursos_sl: true,
    partidas_recursos_carga: true,
  };
  const original = {
    partidas_recursos_descripcion: "Canon",
    partidas_recursos_sl: true,
    partidas_recursos_carga: true,
    activo: true,
  };

  it("acepta un alta válida y recorta la descripción", () => {
    const resultado = PartidaRecursoAltaSchema.safeParse(alta);
    expect(resultado.success).toBe(true);
    expect(resultado.data.partidas_recursos_descripcion).toBe("Canon de concesiones");
  });

  it("rechaza campos no declarados (padre, activo)", () => {
    expect(PartidaRecursoAltaSchema.safeParse({ ...alta, partidas_recursos_padre: 0 }).success).toBe(false);
    expect(PartidaRecursoAltaSchema.safeParse({ ...alta, activo: false }).success).toBe(false);
  });

  it("exige que sin liquidación vaya con imputable", () => {
    const resultado = PartidaRecursoAltaSchema.safeParse({ ...alta, partidas_recursos_carga: false });
    expect(resultado.success).toBe(false);
  });

  it("rechaza códigos y descripciones inválidos", () => {
    expect(PartidaRecursoAltaSchema.safeParse({ ...alta, partidas_recursos_codigo: 13210001 }).success).toBe(false);
    expect(PartidaRecursoAltaSchema.safeParse({ ...alta, partidas_recursos_codigo: "13210000" }).success).toBe(false);
    expect(PartidaRecursoAltaSchema.safeParse({ ...alta, partidas_recursos_descripcion: "   " }).success).toBe(false);
    expect(PartidaRecursoAltaSchema.safeParse({ ...alta, partidas_recursos_descripcion: "Canon 🚗" }).success).toBe(false);
  });

  it("la modificación exige los valores originales", () => {
    expect(PartidaRecursoUpdateSchema.safeParse(alta).success).toBe(false);
    expect(PartidaRecursoUpdateSchema.safeParse({ ...alta, original }).success).toBe(true);
  });

  it("el cambio de estado exige activo y valores originales", () => {
    expect(PartidaRecursoEstadoSchema.safeParse({ activo: false, original }).success).toBe(true);
    expect(PartidaRecursoEstadoSchema.safeParse({ activo: "no", original }).success).toBe(false);
  });

  it("la apertura exige hijas únicas y reasignaciones sin repetidos", () => {
    const apertura = {
      original,
      hijas: [
        { partidas_recursos_codigo: 13210000, partidas_recursos_descripcion: "Canon A", partidas_recursos_sl: true },
        { partidas_recursos_codigo: 13220000, partidas_recursos_descripcion: "Canon B", partidas_recursos_sl: true },
      ],
      reasignaciones: {
        recursos: [{ id: 1, partida_recursos_codigo: 13210000 }],
        recaudacion: [],
        conceptos_destino: null,
      },
    };
    expect(PartidaRecursoAperturaSchema.safeParse(apertura).success).toBe(true);
    expect(
      PartidaRecursoAperturaSchema.safeParse({ ...apertura, hijas: [apertura.hijas[0], apertura.hijas[0]] }).success
    ).toBe(false);
    expect(
      PartidaRecursoAperturaSchema.safeParse({
        ...apertura,
        reasignaciones: { ...apertura.reasignaciones, recursos: [{ id: 1, partida_recursos_codigo: 13210000 }, { id: 1, partida_recursos_codigo: 13220000 }] },
      }).success
    ).toBe(false);
    expect(PartidaRecursoAperturaSchema.safeParse({ ...apertura, hijas: [] }).success).toBe(false);
  });
});
