import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectarMojibake, repararMojibake } from "../src/utils/textoCodificacion.js";

// Casos reales relevados en producción (Centenario, ovif_recaudaciones
// 2026/05 - ver docs/sql/2026-09-matrices-homogeneizacion.sql y el informe
// final). Cada "esperado" fue verificado a mano y con una reparación
// equivalente en SQL (CONVERT(CAST(CONVERT(x USING latin1) AS BINARY) USING
// utf8mb4)) antes de fijarse en el fixture, para no depender solo de la
// función bajo test.
const fixturePath = fileURLToPath(new URL("./fixtures/mojibake-casos-reales.json", import.meta.url));
const CASOS_REALES = JSON.parse(readFileSync(fixturePath, "utf8"));

describe("textoCodificacion — detectarMojibake", () => {
  it("detecta el patrón en los casos reales", () => {
    for (const { original } of CASOS_REALES) {
      expect(detectarMojibake(original)).toBe(true);
    }
  });

  it("no detecta nada en texto limpio", () => {
    expect(detectarMojibake("AUTOMOTOR")).toBe(false);
    expect(detectarMojibake("TASA MUNICIPAL DE MOVILIDAD VIAL")).toBe(false);
    expect(detectarMojibake("Migración")).toBe(false);
  });

  it("es seguro con valores no-string", () => {
    expect(detectarMojibake(null)).toBe(false);
    expect(detectarMojibake(undefined)).toBe(false);
    expect(detectarMojibake("")).toBe(false);
    expect(detectarMojibake(123)).toBe(false);
  });
});

describe("textoCodificacion — repararMojibake", () => {
  it("repara todos los casos reales de producción", () => {
    for (const { original, esperado } of CASOS_REALES) {
      const resultado = repararMojibake(original);
      expect(resultado.reparado, `original: ${original}`).toBe(true);
      expect(resultado.irreparable, `original: ${original}`).toBe(false);
      expect(resultado.valor).toBe(esperado);
    }
  });

  it("no modifica texto limpio", () => {
    const resultado = repararMojibake("TASA MUNICIPAL DE MOVILIDAD VIAL");
    expect(resultado.reparado).toBe(false);
    expect(resultado.irreparable).toBe(false);
    expect(resultado.valor).toBe("TASA MUNICIPAL DE MOVILIDAD VIAL");
  });

  it("no modifica texto ya correctamente acentuado", () => {
    const resultado = repararMojibake("AUTOMÓVILES CON PATENTE");
    expect(resultado.reparado).toBe(false);
    expect(resultado.valor).toBe("AUTOMÓVILES CON PATENTE");
  });

  it("marca como irreparable un patrón detectado que no puede decodificarse limpio", () => {
    // "Ã" seguido de una letra ASCII no forma una secuencia UTF-8 válida.
    const resultado = repararMojibake("Nº 7 Ãrea especial");
    expect(resultado.irreparable).toBe(true);
    expect(resultado.reparado).toBe(false);
    expect(resultado.valor).toBe("Nº 7 Ãrea especial");
  });

  it("es seguro con valores vacíos o no-string", () => {
    expect(repararMojibake("")).toEqual({ valor: "", reparado: false, irreparable: false });
    expect(repararMojibake(null)).toEqual({ valor: null, reparado: false, irreparable: false });
    expect(repararMojibake(undefined)).toEqual({ valor: undefined, reparado: false, irreparable: false });
  });
});
