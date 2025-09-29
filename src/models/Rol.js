// SEQUELIZE
import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Rol = sequelize.define("Rol", {
    rol_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
    },
    fecha_creacion: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    fecha_actualizacion: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: "ovif_roles",
    timestamps: true, // Habilitar la gestión automática de timestamps
    createdAt: "fecha_creacion", // Usar 'fecha_creacion' como el campo para la fecha de creación
    updatedAt: "fecha_actualizacion", // Usar 'fecha_actualizacion' como el campo para la fecha de actualización
});

export default Rol;
