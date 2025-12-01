import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const ConceptoRecaudacion = sequelize.define("ConceptoRecaudacion", {
  cod_concepto: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  descripcion: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  cod_recurso: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: "ovif_conceptos_recaudacion",
  timestamps: false
});

export default ConceptoRecaudacion;
