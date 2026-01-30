import { z } from 'zod';

export const RemuneracionSchema = z.object({
    cuil: z.number({ message: "El CUIL debe ser un número entero" }).int({ message: "El CUIL debe ser un número entero" }),
    remuneracion_neta: z.number({ message: "La remuneración neta debe ser un número" }).refine((value) => 
        {
            const str = value.toString();
            return /^\d{1,10}(\.\d{1,2})?$/.test(str);
        },
        {
            message: "La remuneración neta debe tener hasta 10 dígitos enteros y hasta 2 decimales",
        }
    ),
    bonificacion: z.number({ message: "La bonificación debe ser un número" }).refine((value) => 
        {
            const str = value.toString();
            return /^\d{1,10}(\.\d{1,2})?$/.test(str);
        },
        {
            message: "La bonificación debe tener hasta 10 dígitos enteros y hasta 2 decimales",
        }
    ).optional().nullable(),
    cant_hs_extra_50: z.number({ message: "La cantidad de horas extra 50 debe ser un número entero" }).int({ message: "La cantidad de horas extra 50 ser un número entero" }).optional().nullable(),
    importe_hs_extra_50: z.number({ message: "El importe de horas extra 50 debe ser un número" }).refine((value) => 
        {
            const str = value.toString();
            return /^\d{1,10}(\.\d{1,2})?$/.test(str);
        },
        {
            message: "El importe de horas extra 50 debe tener hasta 10 dígitos enteros y hasta 2 decimales",
        }
    ).optional().nullable(),
    cant_hs_extra_100: z.number({ message: "La cantidad de horas extra 100 debe ser un número entero" }).int({ message: "La cantidad de horas extra 100 debe ser un número entero" }).optional().nullable(),
    importe_hs_extra_50: z.number({ message: "El importe de horas extra 100 debe ser un número" }).refine((value) => 
        {
            const str = value.toString();
            return /^\d{1,10}(\.\d{1,2})?$/.test(str);
        },
        {
            message: "El importe de horas extra 100 debe tener hasta 10 dígitos enteros y hasta 2 decimales",
        }
    ).optional().nullable(),
    art: z.number({ message: "El importe de ART debe ser un número" }).refine((value) => 
        {
            const str = value.toString();
            return /^\d{1,10}(\.\d{1,2})?$/.test(str);
        },
        {
            message: "El importe de ART debe tener hasta 10 dígitos enteros y hasta 2 decimales",
        }
    ).optional().nullable(),
    seguro_vida: z.number({ message: "El importe de seguro de visa debe ser un número" }).refine((value) => 
        {
            const str = value.toString();
            return /^\d{1,10}(\.\d{1,2})?$/.test(str);
        },
        {
            message: "El importe de seguro de visa debe tener hasta 10 dígitos enteros y hasta 2 decimales",
        }
    ).optional().nullable(),
    otros_conceptos: z.number({ message: "El importe de otros conceptos debe ser un número" }).refine((value) => 
        {
            const str = value.toString();
            return /^\d{1,10}(\.\d{1,2})?$/.test(str);
        },
        {
            message: "El importe de otros conceptos debe tener hasta 10 dígitos enteros y hasta 2 decimales",
        }
    ).optional().nullable(),
});
