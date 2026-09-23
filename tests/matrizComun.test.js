import { describe, expect, it } from "vitest";
import { resolverPaginacion, escaparLike, LIMITE_PAGINA_DEFAULT, LIMITE_PAGINA_MAX } from "../src/services/matrices/matrizComun.js";

describe("matrizComun — resolverPaginacion", () => {
  it("usa los valores por defecto sin query", () => {
    expect(resolverPaginacion()).toEqual({ pagina: 1, limite: LIMITE_PAGINA_DEFAULT, offset: 0 });
  });

  it("calcula el offset correctamente", () => {
    expect(resolverPaginacion({ pagina: "3", limite: "20" })).toEqual({ pagina: 3, limite: 20, offset: 40 });
  });

  it("ignora valores inválidos y usa el default", () => {
    expect(resolverPaginacion({ pagina: "abc", limite: "-5" })).toEqual({ pagina: 1, limite: LIMITE_PAGINA_DEFAULT, offset: 0 });
  });

  it("respeta el tope máximo de la página", () => {
    const { limite } = resolverPaginacion({ limite: "9999" });
    expect(limite).toBe(LIMITE_PAGINA_MAX);
  });
});

describe("matrizComun — escaparLike", () => {
  it("escapa % y _ para uso seguro en LIKE", () => {
    expect(escaparLike("100%_test")).toBe("100\\%\\_test");
  });

  it("no modifica texto sin comodines", () => {
    expect(escaparLike("AUTOMOTOR")).toBe("AUTOMOTOR");
  });

  it("es seguro con valores no-string", () => {
    expect(escaparLike(null)).toBe("");
    expect(escaparLike(undefined)).toBe("");
    expect(escaparLike(123)).toBe("123");
  });
});
