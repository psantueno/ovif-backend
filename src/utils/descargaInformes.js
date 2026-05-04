import { getModuloCierreAliases, normalizeTipoCierre, TIPOS_CIERRE_MODULO, CIERRE_MODULOS } from "./cierreModulo.js";
import { CierreModulo, EjercicioMesCerrado, Parametros } from "../models/index.js";
import { Op } from "sequelize";
import path from "path";
import fs from "fs";

export const obtenerNombreInformeCierreModulo = async (ejercicio, mes, municipioId, modulo) => {
    let cierre = null
    let filename = null

    /*if (ejercicio >= 2026) {
        const moduloAliases = getModuloCierreAliases(modulo);
        const cierres = await CierreModulo.findAll({
            where: {
                municipio_id: municipioId,
                ejercicio,
                mes,
                modulo: { [Op.in]: moduloAliases },
                informe_path: { [Op.ne]: null },
            },
            order: [["fecha_cierre", "DESC"]],
            raw: true
        });

        if (cierres.length > 1) {
            cierre =
                cierres.find(
                    (item) =>
                        normalizeTipoCierre(item.tipo_cierre) ===
                        TIPOS_CIERRE_MODULO.PRORROGA
                ) || cierres[0];
        } else cierre = cierres[0]

        filename = cierre?.informe_path
    }
    // agregar luego junto con la primer condicion || (ejercicio === 2026 && mes < 4)
    if ((ejercicio <= 2025) && (modulo === 'GASTOS' || modulo === 'RECURSOS')) {
        cierre = await EjercicioMesCerrado.findOne({
            where: {
                municipio_id: municipioId,
                ejercicio,
                mes,
                informe_recursos: { [Op.ne]: null },
                informe_gastos: { [Op.ne]: null },
            },
            raw: true
        })

        filename = cierre ? (modulo === 'GASTOS' ? cierre.informe_gastos : modulo === 'RECURSOS' ? cierre.informe_recursos : null) : null
    }*/
    const moduloAliases = getModuloCierreAliases(modulo);
    const cierres = await CierreModulo.findAll({
        where: {
            municipio_id: municipioId,
            ejercicio,
            mes,
            modulo: { [Op.in]: moduloAliases },
            informe_path: { [Op.ne]: null },
        },
        order: [["fecha_cierre", "DESC"]],
        raw: true
    });

    if (cierres.length > 1) {
        cierre =
            cierres.find(
                (item) =>
                    normalizeTipoCierre(item.tipo_cierre) ===
                    TIPOS_CIERRE_MODULO.PRORROGA
            ) || cierres[0];
    } else cierre = cierres[0]

    filename = cierre?.informe_path

    if(!filename) {
        cierre = await EjercicioMesCerrado.findOne({
            where: {
                municipio_id: municipioId,
                ejercicio,
                mes,
                informe_recursos: { [Op.ne]: null },
                informe_gastos: { [Op.ne]: null },
            },
            raw: true
        })

        filename = cierre ? (modulo === 'GASTOS' ? cierre.informe_gastos : modulo === 'RECURSOS' ? cierre.informe_recursos : null) : null
    }

    return { cierre, filename };
}

export const obtenerPathInformeCierreModulo = async (filename) => {
    // ⚠️ Seguridad básica
    if (!filename.endsWith(".pdf")) {
        throw new Error("Archivo inválido");
    }

    // Buscar directorio base en BD
    const directorioBase = await Parametros.findOne({
        where: {
            nombre: "Directorio Base",
            estado: true
        }
    });

    if (!directorioBase || !directorioBase.valor) {
        throw new Error("Directorio base no configurado");
    }

    // Obtener la ruta
    const rutaBase = directorioBase.valor

    // Armar ruta absoluta
    const filePath = path.resolve(rutaBase, filename);

    // Validar que la ruta resuelta quede dentro del directorio permitido
    const normalizedBase = path.resolve(rutaBase);
    if (!filePath.startsWith(normalizedBase + path.sep) && filePath !== normalizedBase) {
        throw new Error("Ruta de archivo inválida");
    }

    // Verificar que exista
    if (!fs.existsSync(filePath)) {
        throw new Error("Archivo no encontrado");
    }

    return filePath;
}

export const verificarExistenciaInformeCierreModulo = async (informe_path = null) => {
    if (!informe_path) {
        return false;
    }

    try {
        const path = await obtenerPathInformeCierreModulo(informe_path);
        return true;
    } catch (error) {
        return false;
    }
}

export const filtrarCierresConInforme = async (cierres) => {
    const filtered = [];
    for (const cierre of cierres) {
        if (await verificarExistenciaInformeCierreModulo(cierre.informe_path)) {
            filtered.push(cierre);
        }
    }
    return filtered;
};

export const filtrarEjerciciosMesesCerradosConInforme = async (ejerciciosMesesCerrados) => {
    const filtered = [];
    const MODULOS = [CIERRE_MODULOS.GASTOS, CIERRE_MODULOS.RECURSOS];

    for (const item of ejerciciosMesesCerrados) {
        if (await verificarExistenciaInformeCierreModulo(item.informe_gastos)) {
            const mappedEjercicioCerrado = {
                ...item,
                modulo: MODULOS[0],
            }
            filtered.push(mappedEjercicioCerrado);
        }
        if (await verificarExistenciaInformeCierreModulo(item.informe_recursos)) {
            const mappedEjercicioCerrado = {
                ...item,
                modulo: MODULOS[1],
            }
            filtered.push(mappedEjercicioCerrado);
        }
    }
    return filtered;
};