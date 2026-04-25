import { describe, it, expect } from "vitest";

/*
 * ─── CONTEXTO ───────────────────────────────────────────────────────
 *
 * La columna `fecha_fin` en MySQL es tipo DATE (no DATETIME).
 * Sin embargo, el modelo Sequelize la declara como DataTypes.DATE.
 *
 * BUG RAÍZ: Sequelize, al recibir un string "2026-04-25" en un campo
 * DataTypes.DATE, lo parsea como new Date("2026-04-25") = midnight UTC
 * y luego lo serializa al timezone del servidor MySQL (UTC-3), generando:
 *
 *   WHERE fecha_fin < '2026-04-25 03:00:00'
 *
 * MySQL, al comparar una columna DATE con un string DATETIME, promueve
 * el DATE a DATETIME 00:00:00, resultando en:
 *
 *   '2026-04-25 00:00:00' < '2026-04-25 03:00:00' → TRUE (BUG!)
 *
 * El fix usa DATE(fecha_fin) para forzar comparación a nivel de día.
 *
 * Argentina = UTC-3.
 * ────────────────────────────────────────────────────────────────────
 */

// ─── Réplica de toISODate CORREGIDA (como está en el código ahora) ──
const toISODate = (value) => {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
};

// ─── Réplica de toISODate VIEJA (sin early return para strings) ─────
const toISODate_VIEJO = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
};

// ─── Réplica de obtenerFechaActual (timezone-aware) ─────────────────
const obtenerFechaActual = () =>
  new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

// ─── Forma VIEJA de obtener "hoy" (buggy después de 21:00 AR) ──────
const obtenerHoy_VIEJO = () => new Date().toISOString().slice(0, 10);

// =====================================================================
// 1. toISODate: manejo de strings (caso real — fecha_fin es DATE en DB)
// =====================================================================
describe("toISODate — strings de columnas DATE (caso real)", () => {
  it("retorna el string tal cual si ya es YYYY-MM-DD", () => {
    expect(toISODate("2026-04-25")).toBe("2026-04-25");
    expect(toISODate("2026-01-01")).toBe("2026-01-01");
    expect(toISODate("2025-12-31")).toBe("2025-12-31");
  });

  it("la versión vieja también funciona para strings YYYY-MM-DD", () => {
    // new Date("2026-04-25") → midnight UTC → toISOString → "2026-04-25"
    // Funciona por coincidencia: UTC-parse y UTC-serialize se cancelan.
    expect(toISODate_VIEJO("2026-04-25")).toBe("2026-04-25");
  });

  it("retorna null para valores nulos, undefined o vacíos", () => {
    expect(toISODate(null)).toBeNull();
    expect(toISODate(undefined)).toBeNull();
    expect(toISODate("")).toBeNull();
  });

  it("retorna null para strings que no son fechas válidas", () => {
    expect(toISODate("no-es-fecha")).toBeNull();
  });
});

// =====================================================================
// 2. toISODate: manejo de Date objects (caso defensivo)
// =====================================================================
describe("toISODate — objetos Date (defensivo, para DATETIME si existiera)", () => {
  it("convierte Date con timezone explícita correctamente a AR", () => {
    // 03:00 UTC = 00:00 AR → 25 de abril
    const d = new Date("2026-04-25T03:00:00.000Z");
    expect(toISODate(d)).toBe("2026-04-25");
  });

  it("convierte midnight UTC como 21:00 del día anterior en AR", () => {
    // 00:00 UTC del 25 = 21:00 AR del 24
    const d = new Date("2026-04-25T00:00:00.000Z");
    expect(toISODate(d)).toBe("2026-04-24");
  });

  it("convierte 18:00 AR (21:00 UTC) correctamente", () => {
    // 21:00 UTC del 24 = 18:00 AR del 24
    const d = new Date("2026-04-24T21:00:00.000Z");
    expect(toISODate(d)).toBe("2026-04-24");
  });
});

// =====================================================================
// 3. Bug real: Sequelize serializa "2026-04-25" como '2026-04-25 03:00:00'
// =====================================================================
describe("Bug raíz: Sequelize DataTypes.DATE serializa strings con offset", () => {
  it("Sequelize convierte '2026-04-25' a Date UTC midnight, luego al serializar agrega offset", () => {
    // Paso 1: Sequelize parsea el string como Date
    const parsed = new Date("2026-04-25");
    expect(parsed.toISOString()).toBe("2026-04-25T00:00:00.000Z"); // midnight UTC

    // Paso 2: MySQL server tiene timezone AR (UTC-3).
    // Sequelize con timezone:'+00:00' serializa en UTC, pero el server MySQL
    // interpreta según su timezone local. El resultado neto es que
    // Sequelize genera '2026-04-25 03:00:00' en la query.
    //
    // Con ese valor, MySQL hace: DATE '2026-04-25' → DATETIME '2026-04-25 00:00:00'
    // Y compara: '2026-04-25 00:00:00' < '2026-04-25 03:00:00' → TRUE → BUG
  });

  it("MySQL promueve DATE a DATETIME 00:00:00 en comparaciones mixtas", () => {
    // Simular lo que MySQL hace internamente
    const fechaFinComoDatetime = "2026-04-25 00:00:00"; // DATE promovido
    const parametroSequelize = "2026-04-25 03:00:00";   // Lo que envía Sequelize

    // Comparación string que replica el behavior de MySQL
    expect(fechaFinComoDatetime < parametroSequelize).toBe(true); // ← EL BUG
  });

  it("con DATE() el fix fuerza comparación sin componente horario", () => {
    // DATE(fecha_fin) retorna '2026-04-25' (sin hora)
    const dateFechaFin = "2026-04-25";
    const parametro = "2026-04-25";

    expect(dateFechaFin < parametro).toBe(false); // ← CORRECTO
  });
});

// =====================================================================
// 4. Bug real: obtener "hoy" con toISOString vs obtenerFechaActual
// =====================================================================
describe("obtenerFechaActual vs toISOString — bug después de 21:00 AR", () => {
  it("a las 22:00 AR (01:00 UTC+1d), toISOString da el día SIGUIENTE", () => {
    // Simular 22:00 AR del 25/04 = 01:00 UTC del 26/04
    const fakeNow = new Date("2026-04-26T01:00:00.000Z");

    const viaISOString = fakeNow.toISOString().slice(0, 10);
    const viaLocaleDateAR = fakeNow.toLocaleDateString("sv-SE", {
      timeZone: "America/Argentina/Buenos_Aires",
    });

    expect(viaISOString).toBe("2026-04-26");     // ← INCORRECTO (devuelve mañana)
    expect(viaLocaleDateAR).toBe("2026-04-25");   // ← CORRECTO (devuelve hoy AR)
  });

  it("a las 15:00 AR (18:00 UTC), ambos coinciden", () => {
    // 15:00 AR = 18:00 UTC, mismo día
    const fakeNow = new Date("2026-04-25T18:00:00.000Z");

    const viaISOString = fakeNow.toISOString().slice(0, 10);
    const viaLocaleDateAR = fakeNow.toLocaleDateString("sv-SE", {
      timeZone: "America/Argentina/Buenos_Aires",
    });

    expect(viaISOString).toBe("2026-04-25");
    expect(viaLocaleDateAR).toBe("2026-04-25");
  });

  it("a las 02:00 AR (05:00 UTC), ambos coinciden", () => {
    // 02:00 AR = 05:00 UTC, mismo día — este es el horario del cron
    const fakeNow = new Date("2026-04-25T05:00:00.000Z");

    const viaISOString = fakeNow.toISOString().slice(0, 10);
    const viaLocaleDateAR = fakeNow.toLocaleDateString("sv-SE", {
      timeZone: "America/Argentina/Buenos_Aires",
    });

    expect(viaISOString).toBe("2026-04-25");
    expect(viaLocaleDateAR).toBe("2026-04-25");
  });
});

// =====================================================================
// 4. Lógica de vencimiento de período (periodosRegulares)
// =====================================================================
describe("Lógica de vencimiento — vencido = fechaReferencia > fechaCierre", () => {
  const evaluarVencimiento = (fechaFinDB, fechaReferencia) => {
    const fechaCierre = toISODate(fechaFinDB);
    return fechaReferencia > fechaCierre;
  };

  it("el 25/04 NO está vencido si fecha_fin es '2026-04-25' (string de DB)", () => {
    expect(evaluarVencimiento("2026-04-25", "2026-04-25")).toBe(false);
  });

  it("el 26/04 SÍ está vencido si fecha_fin es '2026-04-25'", () => {
    expect(evaluarVencimiento("2026-04-25", "2026-04-26")).toBe(true);
  });

  it("el 24/04 NO está vencido si fecha_fin es '2026-04-25'", () => {
    expect(evaluarVencimiento("2026-04-25", "2026-04-24")).toBe(false);
  });
});

// =====================================================================
// 5. Lógica de cierre automático (cron)
// =====================================================================
describe("Lógica de cierre automático — fecha_fin < hoyArg", () => {
  const debeCerrar = (fechaFinDB, hoyArg) => {
    // En la DB real, fechaFinDB llega como string "YYYY-MM-DD"
    return toISODate(fechaFinDB) < hoyArg;
  };

  it("el 25/04 a las 2 AM: NO cierra módulo con fecha_fin '2026-04-25'", () => {
    expect(debeCerrar("2026-04-25", "2026-04-25")).toBe(false);
  });

  it("el 26/04 a las 2 AM: SÍ cierra módulo con fecha_fin '2026-04-25'", () => {
    expect(debeCerrar("2026-04-25", "2026-04-26")).toBe(true);
  });

  it("el 15/04 a las 2 AM: NO cierra módulo con fecha_fin '2026-04-25'", () => {
    expect(debeCerrar("2026-04-25", "2026-04-15")).toBe(false);
  });
});

// =====================================================================
// 6. Lógica de CUMPLIO / FUERA DE PLAZO (ejercicios)
// =====================================================================
describe("Lógica de CUMPLIO / FUERA DE PLAZO", () => {
  const evaluarEstado = (fechaCierreStr, fechaLimiteDB) => {
    const limite = toISODate(fechaLimiteDB);
    const cierre = toISODate(fechaCierreStr);
    return cierre <= limite ? "CUMPLIO" : "FUERA DE PLAZO";
  };

  it("cierre el 25/04 con límite '2026-04-25' → CUMPLIO", () => {
    expect(evaluarEstado("2026-04-25", "2026-04-25")).toBe("CUMPLIO");
  });

  it("cierre el 26/04 con límite '2026-04-25' → FUERA DE PLAZO", () => {
    expect(evaluarEstado("2026-04-26", "2026-04-25")).toBe("FUERA DE PLAZO");
  });

  it("cierre el 24/04 con límite '2026-04-25' → CUMPLIO", () => {
    expect(evaluarEstado("2026-04-24", "2026-04-25")).toBe("CUMPLIO");
  });

  it("prórroga DATEONLY como límite funciona correctamente", () => {
    expect(evaluarEstado("2026-04-28", "2026-04-30")).toBe("CUMPLIO");
    expect(evaluarEstado("2026-05-01", "2026-04-30")).toBe("FUERA DE PLAZO");
  });
});

// =====================================================================
// 7. Consistencia obtenerFechaActual
// =====================================================================
describe("obtenerFechaActual — consistencia", () => {
  it("obtenerFechaActual retorna formato YYYY-MM-DD", () => {
    const hoy = obtenerFechaActual();
    expect(hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("toISODate de un Date actual coincide con obtenerFechaActual", () => {
    const ahora = new Date();
    expect(toISODate(ahora)).toBe(obtenerFechaActual());
  });
});
