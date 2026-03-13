-- Migracion: separar codigo tecnico y nombre visible en ovif_tipos_pauta
-- Ejecutar sobre la base objetivo con usuario que tenga permisos ALTER.

ALTER TABLE ovif_tipos_pauta
  ADD COLUMN IF NOT EXISTS codigo VARCHAR(100) NULL AFTER tipo_pauta_id;

-- Backfill base: si codigo viene vacio, copiar valor actual de nombre.
UPDATE ovif_tipos_pauta
SET codigo = nombre
WHERE codigo IS NULL OR TRIM(codigo) = '';

-- Backfill de nombres visibles para los codigos existentes.
UPDATE ovif_tipos_pauta
SET nombre = 'Gastos y Recursos'
WHERE codigo = 'gastos_recursos';

UPDATE ovif_tipos_pauta
SET nombre = 'Recaudaciones y Remuneraciones'
WHERE codigo = 'recaudaciones_remuneraciones';

ALTER TABLE ovif_tipos_pauta
  MODIFY COLUMN codigo VARCHAR(100) NOT NULL;

ALTER TABLE ovif_tipos_pauta
  ADD UNIQUE INDEX uq_ovif_tipos_pauta_codigo (codigo);

-- Eliminar UNIQUE en nombre heredada del modelo viejo (si existe).
SET @idx_nombre := (
  SELECT s.index_name
  FROM information_schema.statistics s
  WHERE s.table_schema = DATABASE()
    AND s.table_name = 'ovif_tipos_pauta'
    AND s.column_name = 'nombre'
    AND s.non_unique = 0
  LIMIT 1
);

SET @drop_sql := IF(
  @idx_nombre IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE ovif_tipos_pauta DROP INDEX ', @idx_nombre)
);

PREPARE stmt FROM @drop_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verificacion rapida
SELECT tipo_pauta_id, codigo, nombre, descripcion, requiere_periodo_rectificar
FROM ovif_tipos_pauta
ORDER BY tipo_pauta_id;
