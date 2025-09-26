/*
Relaciona cada recurso con su clasificación económica 
(ej: tributario, no tributario).
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
