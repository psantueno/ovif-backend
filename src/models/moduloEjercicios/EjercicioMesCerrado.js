/*
La tabla ovif_ejercicios_meses_cerrados se usa como como el registro final cuando el municipio 
efectivamente terminó de cargar todos los módulos de datos (recursos, gastos, personal).
*/

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const EjercicioMesCerrado = sequelize.define("EjercicioMesCerrado", {
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
  fecha: {
    type: DataTypes.STRING, // en db anterior está como varchar(255)
    allowNull: false,
  },
  informe_recursos: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  informe_gastos: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  informe_personal: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: "ovif_ejercicios_meses_cerrados",
  timestamps: false,
});

export default EjercicioMesCerrado;
