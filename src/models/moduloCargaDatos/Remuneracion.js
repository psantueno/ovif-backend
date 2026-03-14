import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Remuneracion = sequelize.define("Remuneracion", {
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
  legajo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  apellido_nombre: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  fecha_ingreso: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  categoria: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  sector: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  fecha_inicio_servicio: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  fecha_fin_servicio: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    defaultValue: null
  },
  total_remuneracion_neta: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: true
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
  total_ropa: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: true,
    defaultValue: null
  },
  total_bonos: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: true,
    defaultValue: null
  },
  asignaciones_familiares: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: true,
    defaultValue: null
  },
  total_descuentos: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  },
  total_issn: {
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
  seguro_vida_obligatorio: {
    type: DataTypes.DECIMAL(20,2),
    allowNull: false
  }
}, {
  tableName: "ovif_remuneraciones",
  timestamps: true,
  createdAt: "fecha_creacion",
  updatedAt: "fecha_actualizacion"
});

export default Remuneracion;
