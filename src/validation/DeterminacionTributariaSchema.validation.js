import { z } from "zod";
import { textoCarga } from "./textoCargaSchema.js";

const buildIntegerField = (label) =>
  z
    .number({ message: `El campo ${label} debe ser un numero entero` })
    .int({ message: `El campo ${label} debe ser un numero entero` })
    .nonnegative({
      message: `El campo ${label} debe ser un numero entero mayor o igual a 0`,
    });

const buildDecimalField = (label) =>
  z
    .number({ message: `El campo ${label} debe ser un numero` })
    .nonnegative({ message: `El campo ${label} debe ser mayor o igual a 0` })
    .refine((value) => /^\d{1,34}(\.\d{1,2})?$/.test(value.toString()), {
      message: `El campo ${label} debe tener hasta 34 digitos enteros y hasta 2 decimales`,
    });

export const DeterminacionTributariaSchema = z.object({
  cod_impuesto: buildIntegerField("cod_impuesto"),
  descripcion: textoCarga("La descripcion es obligatoria", 255),
  anio: buildIntegerField("anio"),
  cuota: buildIntegerField("cuota"),
  liquidadas: buildIntegerField("liquidadas"),
  importe_liquidadas: buildDecimalField("importe_liquidadas"),
  impagas: buildIntegerField("impagas"),
  importe_impagas: buildDecimalField("importe_impagas"),
  pagadas: buildIntegerField("pagadas"),
  importe_pagadas: buildDecimalField("importe_pagadas"),
  altas_periodo: buildIntegerField("altas_periodo"),
  bajas_periodo: buildIntegerField("bajas_periodo"),
});
