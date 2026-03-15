import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const RecaudacionRectificada = sequelize.define("RecaudacionRectificada", {
  recaudaciones_ejercicio: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  recaudaciones_mes: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  municipio_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  codigo_tributo: {
    type: DataTypes.BIGINT,
    primaryKey: true
  },
  descripcion: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  importe_recaudacion: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  },
  ente_recaudador: {
    type: DataTypes.STRING(255),
    allowNull: false,
    primaryKey: true
  }
}, {
  tableName: "ovif_recaudaciones_rectificadas",
  timestamps: true,
  createdAt: "fecha_creacion",
  updatedAt: "fecha_actualizacion"
});

export default RecaudacionRectificada;
