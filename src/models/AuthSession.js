import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const AuthSession = sequelize.define("AuthSession", {
  session_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  family_id: {
    type: DataTypes.STRING(36),
    allowNull: false,
    comment: "UUID que agrupa la cadena de rotación de un mismo dispositivo/sesión",
  },
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  refresh_token_hash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    comment: "SHA-256 hex del refresh token opaco",
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  revoked_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  rotated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: "Momento en que este token fue reemplazado por uno nuevo",
  },
  replaced_by_session_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "ID de la sesión que reemplazó a esta",
  },
  created_ip: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  last_ip: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  user_agent: {
    type: DataTypes.STRING(512),
    allowNull: true,
  },
}, {
  tableName: "ovif_auth_sessions",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
  indexes: [
    { fields: ["refresh_token_hash"], unique: true },
    { fields: ["usuario_id"] },
    { fields: ["family_id"] },
    { fields: ["expires_at"] },
  ],
});

export default AuthSession;
