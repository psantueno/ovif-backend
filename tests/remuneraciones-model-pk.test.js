import { describe, expect, it } from "vitest";
import Remuneracion from "../src/models/moduloCargaDatos/Remuneracion.js";
import RemuneracionRectificada from "../src/models/rectificaciones/RemuneracionRectificada.js";

describe("Remuneraciones — PK de modelo", () => {
  it("usa ejercicio, mes, municipio, CUIL y regimen como PK regular", () => {
    expect(Remuneracion.primaryKeyAttributes).toEqual([
      "remuneraciones_ejercicio",
      "remuneraciones_mes",
      "municipio_id",
      "cuil",
      "regimen_laboral",
    ]);
  });

  it("usa ejercicio, mes, municipio, CUIL y regimen como PK rectificada", () => {
    expect(RemuneracionRectificada.primaryKeyAttributes).toEqual([
      "remuneraciones_ejercicio",
      "remuneraciones_mes",
      "municipio_id",
      "cuil",
      "regimen_laboral",
    ]);
  });
});
