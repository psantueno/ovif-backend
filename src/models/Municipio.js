// SEQUELIZE
import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";


export const MUNICIPIO_CATEGORIAS = ['primera', 'segunda', 'tercera', 'comunidad_fomento'];

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
  },
  municipio_categoria: {
    type: DataTypes.ENUM(...MUNICIPIO_CATEGORIAS),
    allowNull: true
  }
}, {
  tableName: 'ovif_municipios',
  timestamps: false
});

export default Municipio;
