// SEQUELIZE
import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";


const Municipio = sequelize.define('Municipio', {
  municipio_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  municipio_nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  municipio_usuario: {
    type: DataTypes.STRING,
    allowNull: false
  },
  municipio_password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  municipio_spar: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  municipio_ubge: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  municipio_subir_archivos: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  municipio_poblacion: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'ovif_municipios',
  timestamps: false
});

export default Municipio;
