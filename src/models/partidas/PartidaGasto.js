/*
Es un catálogo de partidas presupuestarias de gastos.
Cada gasto que carga un municipio debe clasificarse en una partida
*/

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const PartidaGasto = sequelize.define("PartidaGasto", {
  cod_partida_gasto: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
  descripcion: { type: DataTypes.STRING(100), allowNull: false },
}, {
  tableName: "ovif_partidas_gastos",
  timestamps: false,
});

export default PartidaGasto;
