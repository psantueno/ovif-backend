// SEQUELIZE
import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

// MODELOS
import Usuario from "./Usuario.js";

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
    timestamps: false,
});

export default Rol;
