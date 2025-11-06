import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const PautaConvenio = sequelize.define(
    "PautaConvenio",
    {
        pauta_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        descripcion: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        dia_vto: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        plazo_vto: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        fecha_creacion: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        fecha_actualizacion: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        tableName: "ovif_pautas_convenios",
        timestamps: true,
        createdAt: "fecha_creacion",
        updatedAt: "fecha_actualizacion",
    }
);

export default PautaConvenio;
