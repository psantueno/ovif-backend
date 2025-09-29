/*
Esta tabla almacena los tokens JWT que han sido invalidados (blacklist).
Esto es útil para manejar el logout de usuarios y asegurar que los tokens
no puedan ser reutilizados después de que un usuario haya cerrado sesión.
*/

import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const TokenBlacklist = sequelize.define("TokenBlacklist", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  token: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  fecha_expiracion: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  fecha_creacion: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "ovif_tokens_blacklist",
  timestamps: true,
  createdAt: "fecha_creacion",
  updatedAt: false,
});

export default TokenBlacklist;
