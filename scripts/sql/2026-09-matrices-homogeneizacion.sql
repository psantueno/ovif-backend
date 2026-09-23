-- =============================================================================
-- Matrices de homogeneización — OVIF Etapa 1 (Recursos y Recaudación)
-- Fecha: 2026-09
-- Motor: MariaDB 10.11 (verificado en ambiente de test)
--
-- Contenido:
--   1) mtz_recursos_partida            + historial
--   2) mtz_recaudacion_partida         + historial
--   3) ALTER de ovif_recaudaciones y ovif_recaudaciones_rectificadas para
--      agregar descripcion_normalizada (columna generada, indexada)
--
-- Idempotente: puede ejecutarse más de una vez sin romper (usa
-- IF NOT EXISTS / chequeos de existencia de columna). Pensado para aplicarse
-- primero en el ambiente de test y luego en producción.
--
-- Rollback: ver bloque comentado al final del archivo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Verificación previa (informativa, no bloqueante)
-- -----------------------------------------------------------------------------
-- Antes de aplicar este script, confirmar que la versión de MariaDB soporta
-- REGEXP_REPLACE() dentro de una columna generada PERSISTENT. Verificado en
-- test con MariaDB 10.11.18. Si la versión de producción no lo soporta,
-- reemplazar las columnas generadas por triggers BEFORE INSERT/UPDATE con la
-- misma expresión (ver notas al final).
SELECT VERSION() AS version_mariadb;

-- -----------------------------------------------------------------------------
-- 1) mtz_recursos_partida
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mtz_recursos_partida (
  id                       INT NOT NULL AUTO_INCREMENT,
  municipio_id             INT NOT NULL,
  codigo_recurso           INT NOT NULL,
  partida_recursos_codigo  INT NOT NULL,
  observaciones            VARCHAR(500) NULL,
  usuario_alta_id          INT NULL,
  usuario_modificacion_id  INT NULL,
  fecha_creacion           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_mtz_rec (municipio_id, codigo_recurso),
  KEY idx_mtz_rec_partida (partida_recursos_codigo),
  CONSTRAINT fk_mtz_rec_municipio FOREIGN KEY (municipio_id)
    REFERENCES ovif_municipios (municipio_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_mtz_rec_partida FOREIGN KEY (partida_recursos_codigo)
    REFERENCES ovif_partidas_recursos (partidas_recursos_codigo) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_mtz_rec_usuario_alta FOREIGN KEY (usuario_alta_id)
    REFERENCES ovif_usuarios (usuario_id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_mtz_rec_usuario_mod FOREIGN KEY (usuario_modificacion_id)
    REFERENCES ovif_usuarios (usuario_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Homogeneiza codigo_recurso municipal -> partida provincial (mtz_recursos_partida)';

CREATE TABLE IF NOT EXISTS mtz_recursos_partida_historial (
  id                INT NOT NULL AUTO_INCREMENT,
  matriz_id         INT NOT NULL COMMENT 'id de mtz_recursos_partida en el momento del cambio; sin FK, sobrevive a la baja',
  municipio_id      INT NOT NULL,
  codigo_recurso    INT NOT NULL,
  accion            ENUM('ALTA','MODIFICACION','BAJA') NOT NULL,
  partida_anterior  INT NULL,
  partida_nueva     INT NULL,
  observaciones     VARCHAR(500) NULL,
  usuario_id        INT NULL,
  fecha             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mtz_rec_hist_matriz (matriz_id),
  KEY idx_mtz_rec_hist_municipio (municipio_id, codigo_recurso),
  CONSTRAINT fk_mtz_rec_hist_usuario FOREIGN KEY (usuario_id)
    REFERENCES ovif_usuarios (usuario_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Historial de altas/modificaciones/bajas de mtz_recursos_partida';

-- -----------------------------------------------------------------------------
-- 2) mtz_recaudacion_partida
-- -----------------------------------------------------------------------------
-- Clave de correspondencia: (municipio_id, codigo_tributo, descripcion_normalizada).
-- Se eligió esta clave (en lugar de solo municipio+codigo) porque en varios
-- municipios reales (ver informes de producción de Centenario 03-08/2026) el
-- codigo_tributo es un correlativo que cambia de significado entre períodos,
-- mientras que la descripción es estable. Ver docs del prompt / minutas.
CREATE TABLE IF NOT EXISTS mtz_recaudacion_partida (
  id                       INT NOT NULL AUTO_INCREMENT,
  municipio_id             INT NOT NULL,
  codigo_tributo            INT NOT NULL,
  descripcion_tributo       VARCHAR(255) NOT NULL COMMENT 'Texto original representativo del tributo (ya reparado de eventuales problemas de encoding)',
  descripcion_normalizada   VARCHAR(255)
    AS (UPPER(TRIM(TRAILING '.' FROM TRIM(REGEXP_REPLACE(REPLACE(descripcion_tributo, '°', 'º'), '[[:space:]]+', ' ')))))
    PERSISTENT
    COMMENT 'Normalización: mayúsculas, º/° unificados, espacios colapsados, sin punto final. Misma expresión que en ovif_recaudaciones(_rectificadas).',
  partida_recursos_codigo  INT NOT NULL,
  observaciones            VARCHAR(500) NULL,
  usuario_alta_id          INT NULL,
  usuario_modificacion_id  INT NULL,
  fecha_creacion           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_mtz_rdc (municipio_id, codigo_tributo, descripcion_normalizada),
  KEY idx_mtz_rdc_partida (partida_recursos_codigo),
  KEY idx_mtz_rdc_norm (municipio_id, descripcion_normalizada),
  CONSTRAINT fk_mtz_rdc_municipio FOREIGN KEY (municipio_id)
    REFERENCES ovif_municipios (municipio_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_mtz_rdc_partida FOREIGN KEY (partida_recursos_codigo)
    REFERENCES ovif_partidas_recursos (partidas_recursos_codigo) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_mtz_rdc_usuario_alta FOREIGN KEY (usuario_alta_id)
    REFERENCES ovif_usuarios (usuario_id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_mtz_rdc_usuario_mod FOREIGN KEY (usuario_modificacion_id)
    REFERENCES ovif_usuarios (usuario_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Homogeneiza (codigo_tributo, descripcion) municipal -> partida provincial (mtz_recaudacion_partida)';

CREATE TABLE IF NOT EXISTS mtz_recaudacion_partida_historial (
  id                   INT NOT NULL AUTO_INCREMENT,
  matriz_id            INT NOT NULL COMMENT 'id de mtz_recaudacion_partida en el momento del cambio; sin FK, sobrevive a la baja',
  municipio_id         INT NOT NULL,
  codigo_tributo       INT NOT NULL,
  descripcion_tributo  VARCHAR(255) NOT NULL,
  accion               ENUM('ALTA','MODIFICACION','BAJA') NOT NULL,
  partida_anterior     INT NULL,
  partida_nueva        INT NULL,
  observaciones        VARCHAR(500) NULL,
  usuario_id           INT NULL,
  fecha                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mtz_rdc_hist_matriz (matriz_id),
  KEY idx_mtz_rdc_hist_municipio (municipio_id, codigo_tributo),
  CONSTRAINT fk_mtz_rdc_hist_usuario FOREIGN KEY (usuario_id)
    REFERENCES ovif_usuarios (usuario_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Historial de altas/modificaciones/bajas de mtz_recaudacion_partida';

-- -----------------------------------------------------------------------------
-- 3) ovif_recaudaciones / ovif_recaudaciones_rectificadas:
--    agregar descripcion_normalizada (misma expresión, indexada)
-- -----------------------------------------------------------------------------
-- No se modifica el dato original (descripcion). No se declara en los modelos
-- Sequelize: es de solo lectura para la aplicación, la calcula MariaDB.

-- ovif_recaudaciones
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'ovif_recaudaciones' AND column_name = 'descripcion_normalizada'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE ovif_recaudaciones
     ADD COLUMN descripcion_normalizada VARCHAR(255)
       AS (UPPER(TRIM(TRAILING ''.'' FROM TRIM(REGEXP_REPLACE(REPLACE(descripcion, ''°'', ''º''), ''[[:space:]]+'', '' '')))))
       PERSISTENT
       COMMENT ''Normalización de descripcion, misma expresión que mtz_recaudacion_partida.descripcion_normalizada'',
     ADD INDEX idx_rec_norm (municipio_id, codigo_tributo, descripcion_normalizada)',
  'SELECT ''ovif_recaudaciones.descripcion_normalizada ya existe, se omite'' AS aviso'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ovif_recaudaciones_rectificadas
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'ovif_recaudaciones_rectificadas' AND column_name = 'descripcion_normalizada'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE ovif_recaudaciones_rectificadas
     ADD COLUMN descripcion_normalizada VARCHAR(255)
       AS (UPPER(TRIM(TRAILING ''.'' FROM TRIM(REGEXP_REPLACE(REPLACE(descripcion, ''°'', ''º''), ''[[:space:]]+'', '' '')))))
       PERSISTENT
       COMMENT ''Normalización de descripcion, misma expresión que mtz_recaudacion_partida.descripcion_normalizada'',
     ADD INDEX idx_recrect_norm (municipio_id, codigo_tributo, descripcion_normalizada)',
  'SELECT ''ovif_recaudaciones_rectificadas.descripcion_normalizada ya existe, se omite'' AS aviso'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================================================
-- Verificación posterior sugerida (solo lectura):
--   SHOW CREATE TABLE mtz_recursos_partida\G
--   SHOW CREATE TABLE mtz_recaudacion_partida\G
--   SHOW CREATE TABLE ovif_recaudaciones\G
--   SELECT descripcion, descripcion_normalizada FROM ovif_recaudaciones LIMIT 20;
-- =============================================================================

-- =============================================================================
-- ROLLBACK (comentado — ejecutar a mano, en orden, solo si hay que revertir)
-- =============================================================================
-- ALTER TABLE ovif_recaudaciones_rectificadas DROP INDEX idx_recrect_norm, DROP COLUMN descripcion_normalizada;
-- ALTER TABLE ovif_recaudaciones DROP INDEX idx_rec_norm, DROP COLUMN descripcion_normalizada;
-- DROP TABLE IF EXISTS mtz_recaudacion_partida_historial;
-- DROP TABLE IF EXISTS mtz_recaudacion_partida;
-- DROP TABLE IF EXISTS mtz_recursos_partida_historial;
-- DROP TABLE IF EXISTS mtz_recursos_partida;

-- =============================================================================
-- Plan B si REGEXP_REPLACE no está disponible en columnas generadas en el
-- motor de producción: reemplazar las 4 columnas generadas por una columna
-- normal (no generada) + triggers BEFORE INSERT/UPDATE que calculen el mismo
-- valor con la misma expresión (sin REGEXP_REPLACE se puede aproximar con
-- REPLACE encadenados para los espacios dobles/triples más comunes, aunque
-- es menos robusto). Verificado innecesario en MariaDB 10.11.18 (test).
-- =============================================================================
