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
        convenio_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
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
        tipo_pauta: {
            type: DataTypes.INTEGER, // en db esta como enum('gastos_recursos', 'recaudaciones_personal') 	utf8mb4_unicode_ci 	
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
        indexes: [
            {
                name: "idx_pautas_convenios_convenio_id",
                fields: ["convenio_id"],
            },
        ],
    }
);

export default PautaConvenio;
