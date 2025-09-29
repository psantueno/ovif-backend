/*
Relaciona cada recurso con su clasificación económica 
(ej: tributario, no tributario).
*/

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const RecursoEconomico = sequelize.define("RecursoEconomico", {
  cod_recurso:  { type: DataTypes.INTEGER, primaryKey: true, allowNull: false }, // FK → PartidaRecurso.partidas_recursos_codigo
  cod_economico:{ type: DataTypes.INTEGER, allowNull: false }                    // FK → EconomicoRecurso.cod_economico
}, {
  tableName: "ovif_recursos_economico",
  timestamps: false
});

export default RecursoEconomico;

