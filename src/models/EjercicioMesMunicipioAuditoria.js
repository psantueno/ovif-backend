import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import Usuario from "./Usuario.js";
import EjercicioMesMunicipio from "./EjercicioMesMunicipio.js";

const EjercicioMesMunicipioAuditoria = sequelize.define("EjercicioMesMunicipioAuditoria", {
  auditoria_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  ejercicio: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  mes: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  municipio_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  fecha_cierre_old: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  fecha_cierre_new: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  fecha_cambio: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  comentario: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: "ovif_ejercicio_mes_municipio_auditoria",
  timestamps: false,
});

export default EjercicioMesMunicipioAuditoria;
