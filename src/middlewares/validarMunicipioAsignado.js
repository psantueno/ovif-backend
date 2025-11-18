import { UsuarioMunicipio } from "../models/index.js";

// Verifica que el usuario autenticado tenga asignado el municipio solicitado
export const validarMunicipioAsignado = async (req, res, next) => {
  const { municipioId } = req.params;
  const usuarioId = req.user?.usuario_id;

  if (!usuarioId) {
    return res.status(401).json({ error: "Usuario no autenticado" });
  }

  if (!municipioId) {
    return res.status(400).json({ error: "municipioId es requerido" });
  }

  try {
    const acceso = await UsuarioMunicipio.findOne({
      where: {
        usuario_id: usuarioId,
        municipio_id: municipioId,
      },
    });

    if (!acceso) {
      return res.status(403).json({ error: "No posee autorización para operar este municipio" });
    }

    next();
  } catch (error) {
    console.error("❌ Error validando municipio asignado:", error);
    return res.status(500).json({ error: "Error validando municipio asignado" });
  }
};
