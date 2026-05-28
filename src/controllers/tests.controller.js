import {
  Municipio,
  EjercicioMes,
  PautaConvenio,
  TipoPauta,
  Convenio,
  MunicipioMail,
  CierreModulo,
  EnvioCorreo,
} from "../models/index.js";
import { TIPOS_CIERRE_MODULO, getModuloCierreLabel } from "../utils/cierreModulo.js";
import { zodErrorsToArray } from "../utils/zodErrorMessages.js";
import { SimularCierreModulosSchema } from "../validation/TestsCierreModulosSchema.validation.js";
import {
  obtenerModulosPorTipoPauta,
  obtenerNombreConvenioSeguro,
  generarNumero,
} from "../services/cierreService.js";
import { renderizarCorreoHtml } from "../services/plantillasCorreo.js";
import { encolarMailTestCierre, procesarMailsPendientes } from "../services/emailService.js";

const MESES = {
  1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
  5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
  9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
};
const obtenerNombreMes = (mesNumero) => MESES[mesNumero] || "Sin especificar";

export const simularCierreModulos = async (req, res) => {
  const result = SimularCierreModulosSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: zodErrorsToArray(result.error.issues).join(", ") });
  }

  const { ejercicio, mes, municipio_id, modulos, enviar_mail } = result.data;

  try {
    const municipio = await Municipio.findByPk(municipio_id, {
      attributes: ["municipio_id", "municipio_nombre"],
    });
    if (!municipio) {
      return res.status(404).json({ error: "Municipio no encontrado" });
    }

    const ejerciciosMeses = await EjercicioMes.findAll({ where: { ejercicio, mes } });

    const simulacion = [];

    for (const ej of ejerciciosMeses) {
      const { convenio_id, pauta_id } = ej;

      const pauta = await PautaConvenio.findByPk(pauta_id, {
        include: [{ model: TipoPauta, as: "TipoPauta", attributes: ["codigo", "nombre"] }],
      });
      const tipoCodigo = pauta?.TipoPauta?.codigo ?? null;
      const modulosDeLaPauta = obtenerModulosPorTipoPauta(tipoCodigo);
      const modulosASimular = modulosDeLaPauta.filter((m) => modulos.includes(m));

      if (!modulosASimular.length) continue;

      const convenio = await Convenio.findByPk(convenio_id);
      const convenioNombre = obtenerNombreConvenioSeguro(convenio, convenio_id);

      for (const modulo of modulosASimular) {
        const cierreExistente = await CierreModulo.findOne({
          where: {
            ejercicio,
            mes,
            municipio_id,
            convenio_id,
            pauta_id,
            modulo,
            tipo_cierre: TIPOS_CIERRE_MODULO.REGULAR,
          },
        });

        const idDocumento = generarNumero(12);

        simulacion.push({
          cierre_modulo: {
            ejercicio,
            mes,
            municipio_id,
            convenio_id,
            convenio_nombre: convenioNombre,
            pauta_id,
            modulo,
            tipo_cierre: TIPOS_CIERRE_MODULO.REGULAR,
            observacion: `Cierre del módulo para el municipio ${municipio.municipio_nombre} exitoso`,
            id_documento: idDocumento,
            cierre_existente: !!cierreExistente,
          },
          cron_log: {
            nombre_tarea: "Resumen Municipio",
            ejercicio,
            mes,
            municipio_id,
            estado: "OK",
            mensaje: `Cierre del módulo (${modulo} / ${ejercicio}-${mes}) para el municipio ${municipio.municipio_nombre} exitoso`,
          },
        });
      }
    }

    // Agrupar módulos simulados por par de pauta (convenio_id + pauta_id)
    const gruposMailMap = new Map();
    for (const s of simulacion) {
      const key = `${s.cierre_modulo.convenio_id}-${s.cierre_modulo.pauta_id}`;
      if (!gruposMailMap.has(key)) {
        gruposMailMap.set(key, { modulos: [] });
      }
      gruposMailMap.get(key).modulos.push(s.cierre_modulo.modulo);
    }

    const municipioMails = await MunicipioMail.findAll({ where: { municipio_id } });
    const nombreMes = obtenerNombreMes(mes);

    // Simular envíos: un correo por par de pauta × contacto del municipio
    const envioCorreos = [];
    for (const grupo of gruposMailMap.values()) {
      const modulosOrdenados = [...grupo.modulos].sort();
      for (const mm of municipioMails) {
        envioCorreos.push({
          grupo_modulos: modulosOrdenados,
          destinatario: mm.email,
          nombre_destinatario: mm.nombre,
          asunto: `[OVIF - APP] Cierre de módulos ${modulosOrdenados.map(getModuloCierreLabel).join(", ")} - ${ejercicio} - ${nombreMes}`,
          payload: {
            nombre: mm.nombre,
            ejercicio,
            mes,
            modulos: modulosOrdenados,
            esProrroga: false,
          },
        });
      }
    }

    // Construir mail_test: HTML por grupo, encolar y enviar si se solicitó
    const emailTest = process.env.EMAIL_TEST;
    const puedeEnviar = enviar_mail && !!emailTest;
    const nombreParaHtml = municipioMails[0]?.nombre ?? municipio.municipio_nombre;

    let mailTestError = null;
    if (enviar_mail && !emailTest) {
      mailTestError = "EMAIL_TEST no configurado en el servidor";
    }

    const gruposResultado = [];
    const idsParaProcesar = [];

    for (const grupo of gruposMailMap.values()) {
      const modulosOrdenados = [...grupo.modulos].sort();
      const mailData = renderizarCorreoHtml("CIERRE_MODULOS_TEST", {
        nombre: nombreParaHtml,
        ejercicio,
        mes,
        modulos: modulosOrdenados,
        esProrroga: false,
      });

      const grupoEntry = { modulos: modulosOrdenados, html: mailData.html };

      if (puedeEnviar) {
        try {
          const { correo } = await encolarMailTestCierre({
            destinatario: emailTest,
            nombre: nombreParaHtml,
            ejercicio,
            mes,
            modulos: modulosOrdenados,
            esProrroga: false,
          });
          idsParaProcesar.push(Number(correo.id));
          grupoEntry.id_envio_correo = Number(correo.id);
          grupoEntry.enviado = null;
          grupoEntry.error = null;
        } catch (err) {
          grupoEntry.id_envio_correo = null;
          grupoEntry.enviado = false;
          grupoEntry.error = err.message;
        }
      }

      gruposResultado.push(grupoEntry);
    }

    // Procesar todos los correos encolados y actualizar estado por grupo
    let resumenEnvio = null;
    if (puedeEnviar && idsParaProcesar.length > 0) {
      resumenEnvio = await procesarMailsPendientes({ ids: idsParaProcesar, maxAttemptsPerRun: 3 });

      const correosFinales = await EnvioCorreo.findAll({
        where: { id: idsParaProcesar },
        attributes: ["id", "estado", "ultimo_error"],
      });
      const estadoPorId = new Map(correosFinales.map((c) => [Number(c.id), c]));

      for (const entry of gruposResultado) {
        if (entry.id_envio_correo != null) {
          const correo = estadoPorId.get(entry.id_envio_correo);
          entry.enviado = correo?.estado === "ENVIADO";
          entry.error = correo?.estado !== "ENVIADO" ? (correo?.ultimo_error ?? "Error desconocido") : null;
        }
      }
    }

    const mailTest = {
      destinatario_test: puedeEnviar ? emailTest : null,
      grupos: gruposResultado,
      ...(resumenEnvio !== null ? { resumen_envio: resumenEnvio } : {}),
      ...(mailTestError ? { error: mailTestError } : {}),
    };

    return res.json({
      municipio: {
        municipio_id: municipio.municipio_id,
        municipio_nombre: municipio.municipio_nombre,
      },
      simulacion,
      envio_correos: envioCorreos,
      mail_test: mailTest,
    });
  } catch (error) {
    console.error("❌ Error en simulación de cierre de módulos:", error);
    return res.status(500).json({ error: "Error interno al simular el cierre de módulos" });
  }
};
