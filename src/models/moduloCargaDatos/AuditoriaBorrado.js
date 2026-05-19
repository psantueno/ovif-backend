import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const AuditoriaBorrado = sequelize.define(
  "AuditoriaBorrado",
  {
    borrado_id: {
      type: DataTypes.BIGINT,
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
      allowNull: true,
    },
    pauta_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    modulo: {
      type: DataTypes.ENUM(
        "GASTOS",
        "RECURSOS",
        "RECAUDACIONES",
        "REMUNERACIONES",
        "DETERMINACION_TRIBUTARIA"
      ),
      allowNull: false,
    },
    tipo_carga: {
      type: DataTypes.ENUM("REGULAR", "RECTIFICACION"),
      allowNull: false,
      defaultValue: "REGULAR",
    },
    registros_eliminados: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ip_origen: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    fecha_borrado: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "ovif_auditoria_borrados",
    timestamps: false,
  }
);

export default AuditoriaBorrado;
