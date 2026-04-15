import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { CIERRE_MODULOS, TIPOS_CIERRE_MODULO } from "../../utils/cierreModulo.js";

const CierreModulo = sequelize.define("CierreModulo", {
  cierre_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  ejercicio: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  mes: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  municipio_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  convenio_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  pauta_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  modulo: {
    type: DataTypes.ENUM("GASTOS", "RECURSOS", "RECAUDACIONES", "REMUNERACIONES", "DETERMINACION_TRIBUTARIA"),
    allowNull: false,
  },
  fecha_cierre: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  informe_path: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  observacion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tipo_cierre: {
    type: DataTypes.ENUM("REGULAR", "PRORROGA"),
    allowNull: false,
    defaultValue: "REGULAR",
  },
  fecha_creacion: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
  id_documento: {
    type: DataTypes.BIGINT,
    allowNull: true,
  }
}, {
  tableName: "ovif_cierres_modulos",
  timestamps: true,
  createdAt: "fecha_creacion",
  updatedAt: false,
});

export default CierreModulo;
