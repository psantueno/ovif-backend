import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const UsuarioRol = sequelize.define('ovif_usuario_rol', {
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    rol_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    asignado_por: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: 'ovif_usuario_rol',
    timestamps: true,                
    createdAt: 'fecha_creacion',    
    updatedAt: 'fecha_actualizacion'
  });

  export default UsuarioRol;