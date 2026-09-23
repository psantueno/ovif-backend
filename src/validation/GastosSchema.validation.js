import { z } from 'zod';
import { textoCarga } from './textoCargaSchema.js';

const decimalField = (label) =>
    z.number({ message: `${label} debe ser un número` }).refine((value) => {
        const str = value.toString();
        return /^-?\d{1,36}(\.\d{1,2})?$/.test(str);
    }, {
        message: `${label} debe tener hasta 36 dígitos enteros y hasta 2 decimales`,
    });

export const GastosSchema = z.object({
    codigo_partida: z.number({ message: "El código de la partida debe ser un número entero" }).int({ message: "El código de la partida debe ser un número entero" }),
    descripcion: textoCarga("La descripción es requerida", 255),
    codigo_fuente_financiera: z.number({ message: "El código de fuente financiera debe ser un número entero" }).int({ message: "El código de fuente financiera debe ser un número entero" }),
    descripcion_fuente: textoCarga("La descripción de fuente es requerida", 255),
    formulado: decimalField("Formulado"),
    modificado: decimalField("Modificado"),
    vigente: decimalField("Vigente"),
    devengado: decimalField("Devengado"),
});
