import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { textoCarga } from "../src/validation/textoCargaSchema.js";
import { RecaudacionSchema } from "../src/validation/RecaudacionSchema.validation.js";

// Mismo fixture que tests/textoCodificacion.test.js: casos reales de
// producción, cargados desde archivo para no depender de escribir
// caracteres corruptos a mano (la codificación de argv/heredoc del shell
// puede alterarlos).
const CASOS_REALES = JSON.parse(
  readFileSync(new URL("./fixtures/mojibake-casos-reales.json", import.meta.url), "utf8")
);

describe("textoCarga (helper zod)", () => {
  it("repara texto con mojibake y lo deja utilizable", () => {
    const schema = textoCarga("requerido", 255);
    for (const { original, esperado } of CASOS_REALES) {
      const resultado = schema.safeParse(original);
      expect(resultado.success, `original: ${original}`).toBe(true);
      expect(resultado.data).toBe(esperado);
    }
  });

  it("bloquea texto con mojibake irreparable", () => {
    const schema = textoCarga("requerido", 255);
    const resultado = schema.safeParse("Nº 7 Ãrea especial");
    expect(resultado.success).toBe(false);
  });

  it("deja pasar texto limpio sin tocarlo", () => {
    const schema = textoCarga("requerido", 255);
    const resultado = schema.safeParse("  AUTOMOTOR  ");
    expect(resultado.success).toBe(true);
    expect(resultado.data).toBe("AUTOMOTOR");
  });

  it("respeta requerido=false", () => {
    const schema = textoCarga("requerido", 255, false);
    expect(schema.safeParse("").success).toBe(true);
  });
});

describe("RecaudacionSchema — integración con la reparación de encoding", () => {
  it("repara descripcion y ente_recaudador con mojibake real", () => {
    const caso = CASOS_REALES[0];
    const resultado = RecaudacionSchema.safeParse({
      codigo_tributo: 5,
      descripcion: caso.original,
      importe_recaudacion: 1234.56,
      ente_recaudador: "CAJA INTERNA",
    });
    expect(resultado.success).toBe(true);
    expect(resultado.data.descripcion).toBe(caso.esperado);
  });

  it("bloquea la fila si la descripción no puede repararse", () => {
    const resultado = RecaudacionSchema.safeParse({
      codigo_tributo: 5,
      descripcion: "Nº 7 Ãrea especial",
      importe_recaudacion: 1234.56,
      ente_recaudador: "CAJA INTERNA",
    });
    expect(resultado.success).toBe(false);
  });
});
