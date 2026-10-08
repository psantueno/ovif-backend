-- =============================================================================
-- ABM de partidas presupuestarias de recursos — OVIF
-- Fecha: 2026-10
-- Motor: MariaDB 10.11 (verificado en ambiente de test)
--
-- Contenido:
--   0) Controles previos (solo lectura)
--   1) ovif_partidas_recursos: columna activo (baja lógica)
--   2) ovif_partidas_recursos_auditoria (solo inserción) + triggers que
--      impiden UPDATE/DELETE sobre la auditoría
--   3) Verificación posterior
--   4) Vuelta atrás (comentado)
--
-- Idempotente: puede ejecutarse más de una vez sin romper.
--
-- ANTES DE EJECUTAR: hacer el backup descripto en el bloque 0.
--
-- Contexto funcional:
--   - El código de partida tiene 8 dígitos: tipo (2) + clase (1) +
--     concepto (1) + subconcepto (2) + "00" (Manual de Clasificaciones
--     Presupuestarias de Neuquén). El padre se deduce del código.
--   - partidas_recursos_carga = partida imputable.
--   - partidas_recursos_sl    = "sin liquidación" (con sl=0 la carga legacy
--     pedía además cantidad de contribuyentes y cantidad que pagaron).
--   - La baja es lógica: nunca se borran partidas (las referencian matrices,
--     conceptos y datos legacy).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0) Controles previos (solo lectura)
-- -----------------------------------------------------------------------------
-- Backup sugerido antes de ejecutar (fuera de este script):
--   mariadb-dump --single-transaction ovif_v2 > ovif_v2_antes_abm_partidas_YYYYMMDD.sql
--   mariadb-dump --single-transaction ovif_v2 ovif_partidas_recursos \
--     > ovif_partidas_recursos_antes_abm_YYYYMMDD.sql
-- Anotar el resultado de estas dos consultas para comparar si se vuelve atrás:
SELECT VERSION() AS version_mariadb;
SELECT COUNT(*) AS partidas_antes FROM ovif_partidas_recursos;
CHECKSUM TABLE ovif_partidas_recursos;


-- -----------------------------------------------------------------------------
-- 1) ovif_partidas_recursos.activo
-- -----------------------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'ovif_partidas_recursos'
     AND column_name = 'activo'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE ovif_partidas_recursos
     ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1
       COMMENT ''Baja lógica: 0 = inactiva (no se ofrece en matrices ni conceptos)''
       AFTER partidas_recursos_carga',
  'SELECT ''ovif_partidas_recursos.activo ya existe, se omite'' AS aviso'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- -----------------------------------------------------------------------------
-- 2) ovif_partidas_recursos_auditoria
-- -----------------------------------------------------------------------------
-- Sin FK a ovif_partidas_recursos ni a ovif_usuarios a propósito: la
-- auditoría tiene que sobrevivir a cambios de código, y la autoría se guarda
-- también como texto (usuario_descripcion) para no perderla si el usuario se
-- borra.
--
-- Cambio de código: se registra una MODIFICACION bajo el código nuevo con
-- partida_codigo_anterior cargado. El historial de una partida se arma
-- siguiendo esa cadena hacia atrás por id, sin modificar filas existentes.
CREATE TABLE IF NOT EXISTS ovif_partidas_recursos_auditoria (
  id                       INT NOT NULL AUTO_INCREMENT,
  partida_codigo           INT NOT NULL COMMENT 'Código de la partida luego del cambio',
  partida_codigo_anterior  INT NULL COMMENT 'Solo en cambios de código: código previo',
  accion                   ENUM('ALTA','MODIFICACION','BAJA','REACTIVACION') NOT NULL,
  operacion_id             CHAR(36) NULL COMMENT 'Agrupa las filas de una operación compuesta (ej. apertura de partida)',
  datos_anteriores         JSON NULL COMMENT 'Fila completa antes del cambio (NULL en ALTA)',
  datos_nuevos             JSON NULL COMMENT 'Fila completa después del cambio',
  observaciones            VARCHAR(500) NULL,
  usuario_id               INT NULL,
  usuario_descripcion      VARCHAR(255) NULL COMMENT 'Nombre y apellido al momento del cambio',
  fecha                    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pr_aud_codigo (partida_codigo, id),
  KEY idx_pr_aud_codigo_anterior (partida_codigo_anterior),
  KEY idx_pr_aud_operacion (operacion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Auditoría (solo inserción) del ABM de ovif_partidas_recursos';

-- Solo inserción también a nivel base: cualquier UPDATE o DELETE falla.
-- (Un usuario con privilegios puede borrar los triggers; esto evita
-- modificaciones accidentales, no a un administrador decidido.)
CREATE TRIGGER IF NOT EXISTS trg_pr_auditoria_bu
  BEFORE UPDATE ON ovif_partidas_recursos_auditoria
  FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ovif_partidas_recursos_auditoria es de solo inserción';

CREATE TRIGGER IF NOT EXISTS trg_pr_auditoria_bd
  BEFORE DELETE ON ovif_partidas_recursos_auditoria
  FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ovif_partidas_recursos_auditoria es de solo inserción';


-- -----------------------------------------------------------------------------
-- 3) Verificación posterior (solo lectura)
-- -----------------------------------------------------------------------------
-- Esperado: mismo total que antes y todas activas.
SELECT COUNT(*) AS partidas_despues, SUM(activo = 1) AS activas
  FROM ovif_partidas_recursos;

-- Esperado: 0 filas (todo código respeta la estructura de 8 dígitos y su
-- padre coincide con el que se deduce del código).
SELECT partidas_recursos_codigo, partidas_recursos_padre
  FROM ovif_partidas_recursos
 WHERE partidas_recursos_codigo NOT BETWEEN 10000000 AND 99999999
    OR MOD(partidas_recursos_codigo, 100) <> 0
    OR partidas_recursos_padre <> CASE
         WHEN MOD(partidas_recursos_codigo, 10000) <> 0 THEN partidas_recursos_codigo - MOD(partidas_recursos_codigo, 10000)
         WHEN MOD(partidas_recursos_codigo, 100000) <> 0 THEN partidas_recursos_codigo - MOD(partidas_recursos_codigo, 100000)
         WHEN MOD(partidas_recursos_codigo, 1000000) <> 0 THEN partidas_recursos_codigo - MOD(partidas_recursos_codigo, 1000000)
         ELSE 0
       END;

-- SHOW CREATE TABLE ovif_partidas_recursos\G
-- SHOW CREATE TABLE ovif_partidas_recursos_auditoria\G
-- SHOW TRIGGERS LIKE 'ovif_partidas_recursos_auditoria';


-- =============================================================================
-- 4) VUELTA ATRÁS (comentado — ejecutar a mano, en orden)
-- =============================================================================
-- Paso previo: desplegar el código anterior a esta funcionalidad. El código
-- nuevo necesita la columna activo; el anterior funciona con o sin ella.
--
-- 4.a) Partidas creadas por el ABM que hoy están referenciadas. Si devuelve
--      filas, resolver esas correspondencias/conceptos antes de restaurar,
--      porque la restauración las dejaría apuntando a códigos inexistentes.
--      Reemplazar (<codigos del dump>) por la lista de códigos del backup.
-- SELECT 'mtz_recursos_partida' AS origen, partida_recursos_codigo AS codigo, COUNT(*) AS cantidad
--   FROM mtz_recursos_partida
--  WHERE partida_recursos_codigo NOT IN (<codigos del dump>) GROUP BY partida_recursos_codigo
-- UNION ALL
-- SELECT 'mtz_recaudacion_partida', partida_recursos_codigo, COUNT(*)
--   FROM mtz_recaudacion_partida
--  WHERE partida_recursos_codigo NOT IN (<codigos del dump>) GROUP BY partida_recursos_codigo
-- UNION ALL
-- SELECT 'ovif_conceptos_recaudacion', cod_recurso, COUNT(*)
--   FROM ovif_conceptos_recaudacion
--  WHERE cod_recurso NOT IN (<codigos del dump>) GROUP BY cod_recurso;
--
-- 4.b) Restaurar solo la tabla de partidas desde el dump puntual
--      (no el dump completo: pisaría datos de otros módulos cargados después):
--   mariadb ovif_v2 < ovif_partidas_recursos_antes_abm_YYYYMMDD.sql
--   (el dump trae CREATE TABLE sin la columna activo, así que no hace falta
--   borrarla aparte)
--
-- 4.c) Eliminar la auditoría y sus triggers:
-- DROP TRIGGER IF EXISTS trg_pr_auditoria_bu;
-- DROP TRIGGER IF EXISTS trg_pr_auditoria_bd;
-- DROP TABLE IF EXISTS ovif_partidas_recursos_auditoria;
--
-- 4.d) Comparar contra lo anotado en el bloque 0:
-- SELECT COUNT(*) FROM ovif_partidas_recursos;
-- CHECKSUM TABLE ovif_partidas_recursos;
--
-- Alternativa si no hubo cambios de datos en las partidas y solo se quiere
-- quitar la estructura nueva:
-- ALTER TABLE ovif_partidas_recursos DROP COLUMN activo;
-- (más 4.c)
-- =============================================================================
