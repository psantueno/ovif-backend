/* 
========== IMPORTANTE ========== 
En este archivo se definen las relaciones entre los modelos Usuario, Rol y Municipio utilizando Sequelize.
================================= 
*/

import Usuario from './Usuario.js';
import Rol from './Rol.js';
import Municipio from './Municipio.js';
import EjercicioMesMunicipioAuditoria from './EjercicioMesMunicipioAuditoria.js';
import EjercicioMesMunicipio from './EjercicioMesMunicipio.js';
import EjercicioMes from './EjercicioMes.js';

// Relación muchos a muchos con Rol
Usuario.belongsToMany(Rol, {
  through: 'ovif_usuario_rol',
  foreignKey: 'usuario_id',
  otherKey: 'rol_id'
});

// Relación muchos a muchos con Municipio
Usuario.belongsToMany(Municipio, {
  through: 'ovif_usuario_municipio',
  foreignKey: 'usuario_id',
  otherKey: 'municipio_id'
});

// Relación muchos a muchos con Usuario
Rol.belongsToMany(Usuario, {
  through: 'ovif_usuario_rol',
  foreignKey: 'rol_id',
  otherKey: 'usuario_id'
});

// Relación muchos a muchos con Usuario
Municipio.belongsToMany(Usuario, {
  through: 'ovif_usuario_municipio',
  foreignKey: 'municipio_id',
  otherKey: 'usuario_id'
});

EjercicioMesMunicipioAuditoria.belongsTo(Usuario, {
  foreignKey: "usuario_id",
});

export {
  Usuario, 
  Rol, 
  Municipio, 
  EjercicioMesMunicipioAuditoria, 
  EjercicioMesMunicipio, 
  EjercicioMes
};
