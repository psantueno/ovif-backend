import { describe, it, expect } from "vitest";
import { renderizarCorreoHtml } from "../src/services/plantillasCorreo.js";

describe("plantillasCorreo — renderizarCorreoHtml", () => {
  it("debería lanzar error para tipo no soportado", () => {
    expect(() => renderizarCorreoHtml("TIPO_INVALIDO", {})).toThrow(
      "Tipo de correo no soportado: TIPO_INVALIDO"
    );
  });

  it("debería renderizar HTML de cierre con módulos y período regular", () => {
    const html = renderizarCorreoHtml("CIERRE_MODULOS", {
      nombre: "Juan Pérez",
      ejercicio: 2026,
      mes: 3,
      modulos: ["GASTOS", "RECURSOS"],
      esProrroga: false,
    });

    expect(html).toContain("Hola Juan Pérez");
    expect(html).toContain("Gastos");
    expect(html).toContain("Recursos");
    expect(html).toContain("Marzo 2026");
    expect(html).toContain("correspondientes al período");
    expect(html).not.toContain("prorroga");
    expect(html).toContain("OVIF");
    expect(html).toContain("Grilla de ejercicios históricos");
  });

  it("debería renderizar HTML de cierre con prórroga", () => {
    const html = renderizarCorreoHtml("CIERRE_MODULOS", {
      nombre: "María López",
      ejercicio: 2025,
      mes: 12,
      modulos: ["RECAUDACIONES"],
      esProrroga: true,
    });

    expect(html).toContain("Hola María López");
    expect(html).toContain("Recaudaciones");
    expect(html).toContain("Diciembre 2025");
    expect(html).toContain("correspondientes a la prorroga");
    expect(html).toContain("el módulo"); // singular
    expect(html).not.toContain("los módulos");
  });

  it("debería usar plural cuando hay múltiples módulos", () => {
    const html = renderizarCorreoHtml("CIERRE_MODULOS", {
      nombre: "Admin",
      ejercicio: 2026,
      mes: 1,
      modulos: ["GASTOS", "RECURSOS", "REMUNERACIONES"],
      esProrroga: false,
    });

    expect(html).toContain("los módulos");
    expect(html).not.toContain("el módulo ");
  });

  it("debería usar fallback si ejercicio/mes son inválidos", () => {
    const html = renderizarCorreoHtml("CIERRE_MODULOS", {
      nombre: "Test",
      ejercicio: null,
      mes: null,
      modulos: [],
      esProrroga: false,
    });

    expect(html).toContain("se cerró el plazo de entrega de información");
    expect(html).not.toContain("correspondientes al período");
  });

  it("debería manejar nombre vacío/null", () => {
    const html = renderizarCorreoHtml("CIERRE_MODULOS", {
      nombre: null,
      ejercicio: 2026,
      mes: 6,
      modulos: ["GASTOS"],
      esProrroga: false,
    });

    expect(html).toContain("Hola ");
    expect(html).not.toContain("null");
  });
});

describe("plantillasCorreo — RESET_PASSWORD", () => {
  it("debería renderizar HTML de restablecimiento de contraseña", () => {
    const html = renderizarCorreoHtml("RESET_PASSWORD", {
      nombre: "Carlos Gómez",
      resetLink: "https://ovif.example.com/reset?token=abc123",
    });

    expect(html).toContain("Hola Carlos Gómez");
    expect(html).toContain("Restablecer contraseña");
    expect(html).toContain("https://ovif.example.com/reset?token=abc123");
    expect(html).toContain("válido por 1 hora");
    expect(html).toContain("OVIF");
  });

  it("debería manejar nombre vacío/null en reset password", () => {
    const html = renderizarCorreoHtml("RESET_PASSWORD", {
      nombre: null,
      resetLink: "https://ovif.example.com/reset?token=xyz",
    });

    expect(html).toContain("Hola ");
    expect(html).not.toContain("null");
    expect(html).toContain("https://ovif.example.com/reset?token=xyz");
  });
});
