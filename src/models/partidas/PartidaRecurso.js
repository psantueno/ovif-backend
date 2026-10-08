/*
Es un catálogo de partidas presupuestarias de recursos.
Cada recurso debe clasificarse en una partida presupuestaria.

- partidas_recursos_carga: la partida es imputable (se puede cargar/asignar).
- partidas_recursos_sl: "sin liquidación". Con sl=0 la carga legacy pedía
  además cantidad de contribuyentes y cantidad que pagaron.
- activo: baja lógica (ver scripts/sql/2026-10-partidas-recursos-abm.sql).
*/

import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const PartidaRecurso = sequelize.define("PartidaRecurso", {
  partidas_recursos_codigo: { type: DataTypes.INTEGER, primaryKey: true },
  partidas_recursos_descripcion: { type: DataTypes.TEXT, allowNull: false },
  partidas_recursos_padre: { type: DataTypes.INTEGER, allowNull: false },
  partidas_recursos_sl: { type: DataTypes.BOOLEAN, allowNull: false },
  partidas_recursos_carga: { type: DataTypes.BOOLEAN, allowNull: false },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, {
  tableName: "ovif_partidas_recursos",
  timestamps: false
});

export default PartidaRecurso;
