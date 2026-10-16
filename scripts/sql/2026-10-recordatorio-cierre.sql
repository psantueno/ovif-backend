-- =============================================================================
-- Recordatorio automático de cierre de módulos — OVIF
-- Fecha: 2026-10
-- Motor: MariaDB 10.11
--
-- Contenido:
--   1) ovif_parametros: parámetros de configuración del recordatorio
--   2) Verificación posterior
--   3) Vuelta atrás (comentado)
--
-- Idempotente: puede ejecutarse más de una vez sin romper (INSERT IGNORE sobre
-- el índice único uq_ovif_parametros_nombre; no pisa valores ya cargados).
--
-- Contexto funcional:
--   - El cron src/cron/recordatorioCierre.js envía un mail por pauta a los
--     contactos de ovif_municipios_mails cuando faltan N días o menos para el
--     cierre (fecha efectiva, considerando prórroga del municipio).
--   - Se crean INACTIVOS (estado = 0): el recordatorio sólo funciona cuando
--     AMBOS parámetros están activos y con valores válidos. Activarlos desde
--     Admin > Parámetros.
--   - Los nombres son de sistema: el backend impide renombrarlos y valida sus
--     valores (días: entero 1 a 30; horario: HH:mm 24 hs, hora Argentina).
-- =============================================================================

-- 1) Parámetros
INSERT IGNORE INTO `ovif_parametros` (`nombre`, `valor`, `descripcion`, `estado`)
VALUES
  (
    'Recordatorio de cierre - Días previos',
    '3',
    'Cantidad de días previos al cierre (entero de 1 a 30) en que se envía el recordatorio de vencimiento a los municipios.',
    0
  ),
  (
    'Recordatorio de cierre - Horario',
    '09:00',
    'Hora de envío del recordatorio de vencimiento, formato 24 hs HH:mm (hora Argentina).',
    0
  );

-- 2) Verificación
SELECT `parametro_id`, `nombre`, `valor`, `estado`
FROM `ovif_parametros`
WHERE `nombre` IN ('Recordatorio de cierre - Días previos', 'Recordatorio de cierre - Horario');

-- 3) Vuelta atrás
-- DELETE FROM `ovif_parametros`
-- WHERE `nombre` IN ('Recordatorio de cierre - Días previos', 'Recordatorio de cierre - Horario');
