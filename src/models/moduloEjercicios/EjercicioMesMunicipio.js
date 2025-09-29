import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const EjercicioMesMunicipio = sequelize.define("EjercicioMesMunicipio", {
  ejercicio: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
  },
  mes: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
  },
  municipio_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
  },
  fecha_inicio: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  fecha_fin: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: "ovif_ejercicio_mes_municipio",
  timestamps: false,
});

export default EjercicioMesMunicipio;
