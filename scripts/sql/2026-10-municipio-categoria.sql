-- =============================================================================
-- Categoría de municipio — OVIF
-- Fecha: 2026-10
-- Motor: MariaDB 10.11
--
-- Contenido:
--   1) ovif_municipios: columna municipio_categoria
--   2) Verificación posterior
--   3) Vuelta atrás (comentado)
--
-- Idempotente: puede ejecutarse más de una vez sin romper.
--
-- La columna es NULL porque los municipios existentes no tienen categoría;
-- la obligatoriedad se exige desde la API al crear/editar.
-- =============================================================================

-- 1) Columna
ALTER TABLE `ovif_municipios`
  ADD COLUMN IF NOT EXISTS `municipio_categoria`
    ENUM('primera','segunda','tercera','comunidad_fomento') NULL
    AFTER `municipio_poblacion`;

-- 2) Verificación
SHOW COLUMNS FROM `ovif_municipios` LIKE 'municipio_categoria';

-- 3) Vuelta atrás
-- ALTER TABLE `ovif_municipios` DROP COLUMN IF EXISTS `municipio_categoria`;
