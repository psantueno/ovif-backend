/*
Matriz de homogeneización: relaciona, por municipio, el par
(codigo_tributo, descripcion_tributo) informado por el municipio con la
partida provincial de recursos.

Clave de correspondencia: (municipio_id, codigo_tributo, descripcion_normalizada).
Se usa esta clave -y no solo municipio+codigo- porque en municipios reales
(ver informes de producción de Centenario) el codigo_tributo puede ser un
correlativo que cambia de significado entre períodos; la descripción es el
dato estable. Ver docs/sql/2026-09-matrices-homogeneizacion.sql.

descripcion_normalizada es una columna GENERATED (STORED) en la base: la
calcula MariaDB a partir de descripcion_tributo y es de solo lectura para
la aplicación. Se declara como columna normal (para que Sequelize la lea
en los SELECT), pero un hook la excluye de cualquier INSERT/UPDATE por si
algún código la asignara por error.
*/

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const MtzRecaudacionPartida = sequelize.define("MtzRecaudacionPartida", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  municipio_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  codigo_tributo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  descripcion_tributo: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  // Columna generada (STORED) por la base — solo lectura, ver comentario arriba.
  descripcion_normalizada: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  partida_recursos_codigo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  observaciones: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  usuario_alta_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  usuario_modificacion_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: "mtz_recaudacion_partida",
  timestamps: true,
  createdAt: "fecha_creacion",
  updatedAt: "fecha_actualizacion",
  hooks: {
    beforeSave: (instance) => {
      // Defensa en profundidad: aunque algún código la hubiera seteado por
      // error, nunca se envía en el INSERT/UPDATE (la calcula la base).
      instance.changed("descripcion_normalizada", false);
    }
  }
});

export default MtzRecaudacionPartida;
