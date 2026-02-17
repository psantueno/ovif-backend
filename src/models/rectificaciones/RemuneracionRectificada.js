import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const RemuneracionRectificada = sequelize.define("RemuneracionRectificada", {
  remuneraciones_ejercicio: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  remuneraciones_mes: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  municipio_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  cuil: {
    type: DataTypes.STRING(20),
    primaryKey: true
  },
  apellido_nombre: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  regimen_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  situacion_revista_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  fecha_alta: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  tipo_liquidacion: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  remuneracion_neta: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  },
  bonificacion: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  },
  cant_hs_extra_50: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  importe_hs_extra_50: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  },
  cant_hs_extra_100: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  importe_hs_extra_100: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  },
  art: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  },
  seguro_vida: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  },
  otros_conceptos: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  },
  legajo: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: "ovif_remuneraciones_rectificadas",
  timestamps: true,
  createdAt: "fecha_creacion",
  updatedAt: "fecha_actualizacion"
});

export default RemuneracionRectificada;
