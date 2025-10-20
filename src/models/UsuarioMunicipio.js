import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

  const UsuarioMunicipio = sequelize.define('ovif_usuario_municipio', {
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    municipio_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    asignado_por: {
        type: DataTypes.INTEGER,
        allowNull: false,
    }
  }, {
        tableName: "ovif_usuario_municipio",
        timestamps: true,
        createdAt: "fecha_creacion",
        updatedAt: "fecha_actualizacion",
    });

  export default  UsuarioMunicipio;

