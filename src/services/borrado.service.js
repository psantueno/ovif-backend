import { Op } from "sequelize";
import sequelize from "../config/db.js";
import {
  AuditoriaBorrado,
  CierreModulo,
  Gasto,
  Recurso,
  Recaudacion,
  RecaudacionRectificada,
  Remuneracion,
  RemuneracionRectificada,
  DeterminacionTributaria,
} from "../models/index.js";
import { resolverPeriodoRegular } from "../utils/periodosRegulares.js";

const BORRADOS_POR_HORA_MAX = 3;

/**
 * Mapea modulo + tipoCarga al modelo Sequelize y sus columnas de filtro.
 */
const resolverModeloYWhere = (modulo, tipoCarga, ejercicio, mes, municipioId) => {
  const ej = Number(ejercicio);
  const m = Number(mes);
  const muniId = Number(municipioId);

  const mapa = {
    GASTOS: {
      REGULAR: {
        modelo: Gasto,
        where: { gastos_ejercicio: ej, gastos_mes: m, municipio_id: muniId },
      },
    },
    RECURSOS: {
      REGULAR: {
        modelo: Recurso,
        where: { recursos_ejercicio: ej, recursos_mes: m, municipio_id: muniId },
      },
    },
    RECAUDACIONES: {
      REGULAR: {
        modelo: Recaudacion,
        where: { recaudaciones_ejercicio: ej, recaudaciones_mes: m, municipio_id: muniId },
      },
      RECTIFICACION: {
        modelo: RecaudacionRectificada,
        where: { recaudaciones_ejercicio: ej, recaudaciones_mes: m, municipio_id: muniId },
      },
    },
    REMUNERACIONES: {
      REGULAR: {
        modelo: Remuneracion,
        where: { remuneraciones_ejercicio: ej, remuneraciones_mes: m, municipio_id: muniId },
      },
      RECTIFICACION: {
        modelo: RemuneracionRectificada,
        where: { remuneraciones_ejercicio: ej, remuneraciones_mes: m, municipio_id: muniId },
      },
    },
    DETERMINACION_TRIBUTARIA: {
      REGULAR: {
        modelo: DeterminacionTributaria,
        where: { determinacion_ejercicio: ej, determinacion_mes: m, municipio_id: muniId },
      },
    },
  };

  return mapa[modulo]?.[tipoCarga] ?? null;
};

/**
 * Servicio central de borrado seguro por periodo.
 *
 * @param {object} params
 * @param {string} params.modulo        - "GASTOS" | "RECURSOS" | "RECAUDACIONES" | "REMUNERACIONES" | "DETERMINACION_TRIBUTARIA"
 * @param {string} params.tipoCarga     - "REGULAR" | "RECTIFICACION"
 * @param {string} params.tipoPautaCodigo - Código del tipo de pauta para resolver convenio/pauta
 * @param {number|string} params.ejercicio
 * @param {number|string} params.mes
 * @param {number|string} params.municipioId
 * @param {number} params.usuarioId
 * @param {string} [params.ip]
 * @returns {Promise<{code: string, deleted_count: number, audit_id?: number|null, message: string}>}
 */
export const ejecutarBorrado = async ({
  modulo,
  tipoCarga = "REGULAR",
  tipoPautaCodigo,
  ejercicio,
  mes,
  municipioId,
  usuarioId,
  ip = null,
}) => {
  // 1. Verificar rate limit: máx BORRADOS_POR_HORA_MAX borrados en la última hora
  const unaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
  const borradosRecientes = await AuditoriaBorrado.count({
    where: {
      usuario_id: usuarioId,
      fecha_borrado: { [Op.gte]: unaHoraAtras },
    },
  });

  if (borradosRecientes >= BORRADOS_POR_HORA_MAX) {
    console.warn(
      `⚠️ USER_RATE_LIMITED: usuario ${usuarioId} intentó ${borradosRecientes + 1} borrados en 1 hora`
    );
    return {
      code: "USER_RATE_LIMITED",
      deleted_count: 0,
      audit_id: null,
      message: `Límite de borrados alcanzado. Se permiten hasta ${BORRADOS_POR_HORA_MAX} borrados por hora.`,
    };
  }

  // 2. Resolver modelo y condición WHERE
  const target = resolverModeloYWhere(modulo, tipoCarga, ejercicio, mes, municipioId);
  if (!target) {
    throw new Error(`Combinación de módulo/tipoCarga no soportada: ${modulo}/${tipoCarga}`);
  }

  // 3. Resolver convenio_id y pauta_id para la auditoría
  let convenio_id = null;
  let pauta_id = null;
  if (tipoPautaCodigo) {
    const periodo = await resolverPeriodoRegular({
      municipioId,
      ejercicio,
      mes,
      tipoPautaCodigo,
    });
    if (periodo?.periodo) {
      convenio_id = periodo.periodo.convenio_id ?? null;
      pauta_id = periodo.periodo.pauta_id ?? null;
    }
  }

  // 4. Verificar que el módulo no esté cerrado oficialmente
  const cierre = await CierreModulo.findOne({
    where: {
      municipio_id: Number(municipioId),
      ejercicio: Number(ejercicio),
      mes: Number(mes),
      modulo,
    },
  });

  if (cierre) {
    return {
      code: "MODULE_CLOSED",
      deleted_count: 0,
      audit_id: null,
      message: "El módulo ya fue cerrado oficialmente para este periodo. No se puede borrar.",
    };
  }

  // 5. Ejecutar borrado y auditoría en una transacción
  const transaction = await sequelize.transaction();
  try {
    const affectedRows = await target.modelo.destroy({
      where: target.where,
      transaction,
    });

    if (affectedRows === 0) {
      await transaction.rollback();
      return {
        code: "NO_DATA_TO_DELETE",
        deleted_count: 0,
        audit_id: null,
        message: "No hay datos cargados para borrar en este periodo.",
      };
    }

    // Insertar registro de auditoría solo cuando hay datos reales borrados
    const auditoria = await AuditoriaBorrado.create(
      {
        ejercicio: Number(ejercicio),
        mes: Number(mes),
        municipio_id: Number(municipioId),
        convenio_id,
        pauta_id,
        modulo,
        tipo_carga: tipoCarga,
        registros_eliminados: affectedRows,
        usuario_id: usuarioId,
        ip_origen: ip,
      },
      { transaction }
    );

    await transaction.commit();

    return {
      code: "DATA_DELETED",
      deleted_count: affectedRows,
      audit_id: Number(auditoria.borrado_id),
      message: `Se eliminaron ${affectedRows} registros correctamente.`,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
