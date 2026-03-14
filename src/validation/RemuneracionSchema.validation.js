import { z } from 'zod';

const decimalSchema = z.preprocess((value) => {
    // si ya es número (Excel lo parseó)
    if (typeof value === "number") {
        return value;
    }

    // si es string → validar formato argentino
    if (typeof value === "string") {
        if (!/^\d+(,\d{1,2})?$/.test(value)) {
        return value; // deja que falle después
        }

        return obtenerNumeroDecimal(value);
    }

    return value;

},
z.number({ error: 'El importe debe ser un número decimal válido' }));

export const RemuneracionSchema = z.object({
    legajo: z
        .number('El legajo debe ser un número')
        .int('El legajo debe ser un número entero')
        .min(0, 'El legajo debe ser un número mayor a 0')
        .refine(n => isFinite(Number(n)) && !isNaN(n), 'El legajo debe ser un número entero mayor a 0'),
    cuil: z
        .string('El CUIL debe ser una cadena de carateres')
        .min(1, 'El CUIL es obligatorio'),
    apellido_nombre: z
        .string('El CUIL debe ser una cadena de carateres')
        .min(1, 'El CUIL es obligatorio'),
    regimen_laboral: z
        .string('El regimen laboral debe ser una cadena de carateres')
        .min(1, 'El regimen laboral es obligatorio'),
    categoria: z
        .string('La categoria debe ser una cadena de carateres')
        .min(1, 'La categoria es obligatorio'),
    sector: z
        .string('La categoria debe ser una cadena de carateres')
        .min(1, 'La categoria es obligatorio'),
    fecha_ingreso: z
        .string('La fecha de ingreso debe ser una cadena')
        .min(1, 'La fecha de ingreso es obligatoria'),
    fecha_inicio_servicio: z
        .string('La fecha de inicio de servicio debe ser una cadena')
        .min(1, 'La fecha de inicio de servicio es obligatoria'),
    fecha_fin_servicio: z
        .string('La fecha de fin de servicio debe ser una cadena de carateres')
        .nullable()
        .optional(),
    basico_cargo_salarial: decimalSchema,
    total_remunerativo: decimalSchema,
    sac: decimalSchema,
    cant_hs_extra_50: z
        .number('La cantidad de horas extra 50% debe ser un número')
        .int('La cantidad de horas extra 50% debe ser un número entero')
        .min(0, 'La cantidad de horas extra 50% debe ser un número mayor a 0')
        .refine(n => isFinite(Number(n)) && !isNaN(n), 'La cantidad de horas extra 50% debe ser un número entero mayor a 0'),
    importe_hs_extra_50: decimalSchema,
    cant_hs_extra_100: z
        .number('La cantidad de horas extra 100% debe ser un número')
        .int('La cantidad de horas extra 100% debe ser un número entero')
        .min(0, 'La cantidad de horas extra 100% debe ser un número mayor a 0')
        .refine(n => isFinite(Number(n)) && !isNaN(n), 'La cantidad de horas extra 100% debe ser un número entero mayor a 0'),
    importe_hs_extra_100: decimalSchema,
    total_no_remunerativo: decimalSchema,
    total_ropa: decimalSchema,
    total_bonos: decimalSchema,
    asignaciones_familiares: decimalSchema,
    total_descuentos: decimalSchema,
    total_issn: decimalSchema,
    art: decimalSchema,
    seguro_vida_obligatorio: decimalSchema,
    neto_a_cobrar: decimalSchema
});
