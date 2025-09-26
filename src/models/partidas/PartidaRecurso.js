/*
Es un catálogo de partidas presupuestarias de recursos.
Cada recurso debe clasificarse en una partida presupuestaria
*/

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const RecursoEconomico = sequelize.define("RecursoEconomico", {
  cod_partida_recurso: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
  cod_economico: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
}, {
  tableName: "ovif_recursos_economico",
  timestamps: false,
});

export default RecursoEconomico;
