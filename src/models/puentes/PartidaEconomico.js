/*
Es un puente que vincula una partida (sea de gastos o recursos) con su 
clasificación económica. La clasificación económica agrupa las partidas en 
niveles (ejemplo: Corrientes vs Capital, Ingresos Tributarios vs No Tributarios).
*/

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const PartidaEconomico = sequelize.define("PartidaEconomico", {
  cod_partida_gasto: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
  cod_economico: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
}, {
  tableName: "ovif_partidas_economico",
  timestamps: false,
});

export default PartidaEconomico;
