import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const MunicipioMail = sequelize.define("MunicipioMail", {
    municipio_id: {
        type: DataTypes.INTEGER,
        primaryKey: true
    },
    email: {
        type: DataTypes.STRING(255),
        primaryKey: true
    },
    nombre: {
        type: DataTypes.STRING(255),
        allowNull: false
    }
}, {
    tableName: "ovif_municipios_mails",
    timestamps: false
});

export default MunicipioMail;