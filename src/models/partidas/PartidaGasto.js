/*
Es un catálogo de partidas presupuestarias de gastos.
Cada gasto que carga un municipio debe clasificarse en una partida
*/

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const PartidaGasto = sequelize.define("PartidaGasto", {
  partidas_gastos_codigo: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
  partidas_gastos_descripcion: { type: DataTypes.TEXT, allowNull: false },
  partidas_gastos_padre: { type: DataTypes.INTEGER, allowNull: false },
  partidas_gastos_carga: { type: DataTypes.BOOLEAN, allowNull: false }
}, {
  tableName: "ovif_partidas_gastos",
  timestamps: false,
});

export default PartidaGasto;
