import { describe, expect, it } from "vitest";
import {
  AprobarLoteSchema,
  AprobarSolicitudSchema,
  RechazarSolicitudSchema,
} from "../src/validation/SolicitudesProrrogaSchema.validation.js";

describe("Solicitudes de prórroga — validación de tipo", () => {
  it("requiere tipo para aprobar una solicitud", () => {
    const result = AprobarSolicitudSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("acepta tipos válidos al aprobar una solicitud", () => {
    const result = AprobarSolicitudSchema.safeParse({
      tipo: "AMPLIACION_PLAZO",
      comentario_resolucion: "Aprobada",
    });

    expect(result.success).toBe(true);
  });

  it("rechaza tipos inválidos al aprobar una solicitud", () => {
    const result = AprobarSolicitudSchema.safeParse({
      tipo: "OTRO",
    });

    expect(result.success).toBe(false);
  });

  it("requiere tipo a nivel raíz para aprobar en lote", () => {
    const result = AprobarLoteSchema.safeParse({
      items: [{ solicitud_id: 1 }],
    });

    expect(result.success).toBe(false);
  });

  it("acepta tipo compartido a nivel raíz para aprobar en lote", () => {
    const result = AprobarLoteSchema.safeParse({
      tipo: "CORRECCION_DATOS",
      items: [{ solicitud_id: 1 }],
    });

    expect(result.success).toBe(true);
  });

  it("no exige tipo al rechazar una solicitud", () => {
    const result = RechazarSolicitudSchema.safeParse({
      comentario_resolucion: "No corresponde",
    });

    expect(result.success).toBe(true);
  });
});
