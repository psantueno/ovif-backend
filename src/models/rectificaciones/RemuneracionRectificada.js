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
  legajo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  fecha_ingreso: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  cargo_salarial: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  sector: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  fecha_alta_regimen_laboral: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  fecha_baja_regimen_laboral: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  total_remuneracion_neta: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  },
  basico_cargo_salarial: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  },
  total_remunerativo: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  },
  sac: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: true,
    defaultValue: null
  },
  total_no_remunerativo: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  },
  ropa: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: true,
    defaultValue: null
  },
  bonos: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: true,
    defaultValue: null
  },
  asignaciones_familiares: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  },
  total_descuentos: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  },
  total_issn: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  },
  bonificacion: {
  type: DataTypes.DECIMAL(20,2),
  allowNull: true,
  defaultValue: null
},
  cant_hs_extra_50: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
  },
  importe_hs_extra_50: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: true,
    defaultValue: null
  },
  cant_hs_extra_100: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
  },
  importe_hs_extra_100: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: true,
    defaultValue: null
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
  }
}, {
  tableName: "ovif_remuneraciones_rectificadas",
  timestamps: true,
  createdAt: "fecha_creacion",
  updatedAt: "fecha_actualizacion"
});

export default RemuneracionRectificada;
