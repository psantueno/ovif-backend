import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Recurso = sequelize.define("Recurso", {
  recursos_ejercicio: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  recursos_mes: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  codigo_recurso: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  municipio_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  descripcion: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  codigo_fuente_financiera: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  descripcion_fuente: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  vigente: {
    type: DataTypes.DECIMAL(36, 2),
    allowNull: false
  },
  percibido: {
    type: DataTypes.DECIMAL(36, 2),
    allowNull: false
  }
}, {
  tableName: "ovif_recursos",
  timestamps: true,
  createdAt: "fecha_creacion",
  updatedAt: "fecha_actualizacion"
});

export default Recurso;
