import PdfPrinter from "pdfmake";
import fs from "fs";
import path from "path";

const resolveExistingPath = (candidates, label) => {
  for (const candidate of candidates) {
    const absolute = path.resolve(candidate);
    if (fs.existsSync(absolute)) {
      return absolute;
    }
  }
  throw new Error(`No se encontró la fuente requerida (${label}). Verificar la carpeta /fonts.`);
};

const loadImageAsBase64 = (candidates, label) => {
  for (const candidate of candidates) {
    const absolute = path.resolve(candidate);
    if (fs.existsSync(absolute)) {
      const buffer = fs.readFileSync(absolute);
      return buffer.toString("base64");
    }
  }
  console.warn(`Advertencia: imagen opcional no encontrada (${label}). Se omitirá en el informe.`);
  return null;
};

const HEADER_BASE64 = loadImageAsBase64(
  [
    "assets/pdf/encabezado.png",
    "src/assets/pdf/encabezado.png",
  ],
  "encabezado.png"
);

const MANROPE_REGULAR = resolveExistingPath([
  "fonts/Manrope-Regular.ttf",
  "src/fonts/Manrope-Regular.ttf",
], "Manrope-Regular.ttf");

const MANROPE_MEDIUM = resolveExistingPath([
  "fonts/Manrope-Medium.ttf",
  "src/fonts/Manrope-Medium.ttf",
], "Manrope-Medium.ttf");

const MANROPE_BOLD = resolveExistingPath([
  "fonts/Manrope-Bold.ttf",
  "src/fonts/Manrope-Bold.ttf",
], "Manrope-Bold.ttf");

const printer = new PdfPrinter({
  Manrope: {
    normal: MANROPE_REGULAR,
    bold: MANROPE_BOLD,
    italics: MANROPE_REGULAR,
    bolditalics: MANROPE_MEDIUM,
  },
});

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value, fallback = "Sin especificar") => {
  if (value === null || value === undefined) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized.length ? normalized : fallback;
};

const buildSummaryByRegimen = (remuneraciones = []) => {
  const regimenesMap = new Map();

  remuneraciones.forEach((item) => {
    const regimen = normalizeText(item?.regimen_laboral ?? item?.regimen);
    const categoria = normalizeText(item?.categoria ?? item?.cargo_salarial);

    if (!regimenesMap.has(regimen)) {
      regimenesMap.set(regimen, new Map());
    }

    const categoriasMap = regimenesMap.get(regimen);
    const categoriaSummary = categoriasMap.get(categoria) ?? {
      categoria,
      total_personas: 0,
      total_remunerativo: 0,
      total_no_remunerativo: 0,
      total_descuentos: 0,
      neto_a_cobrar: 0,
    };

    categoriaSummary.total_personas += 1;
    categoriaSummary.total_remunerativo += toNumber(item?.total_remunerativo);
    categoriaSummary.total_no_remunerativo += toNumber(item?.total_no_remunerativo);
    categoriaSummary.total_descuentos += toNumber(item?.total_descuentos);
    categoriaSummary.neto_a_cobrar += toNumber(item?.neto_a_cobrar ?? item?.total_remuneracion_neta ?? item?.remuneracion_neta);

    categoriasMap.set(categoria, categoriaSummary);
  });

  return regimenesMap;
};

const getRegimenOrder = (summaryByRegimen, regimenes = []) => {
  const ordered = [];

  if (Array.isArray(regimenes)) {
    regimenes.forEach((regimenObj) => {
      const regimenNombre = normalizeText(regimenObj?.nombre);
      if (summaryByRegimen.has(regimenNombre) && !ordered.includes(regimenNombre)) {
        ordered.push(regimenNombre);
      }
    });
  }

  Array.from(summaryByRegimen.keys())
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
    .forEach((regimenNombre) => {
      if (!ordered.includes(regimenNombre)) {
        ordered.push(regimenNombre);
      }
    });

  return ordered;
};

export const buildInformeRemuneraciones = ({
  municipioNombre,
  ejercicio,
  mes,
  remuneraciones,
  regimenes,
  usuarioNombre,
  convenioNombre,
  esRectificacion = false,
  cierreId = null,
}) => {
  const subtitulo = esRectificacion
    ? `Informe de Rectificación de Remuneraciones - ${mes}/${ejercicio}\n`
    : `Informe de Remuneraciones - ${mes}/${ejercicio}\n`;

  const headerContent = [
    HEADER_BASE64
      ? {
          image: `data:image/png;base64,${HEADER_BASE64}`,
          width: 842,
        }
      : null,
    {
      text: [
        { text: "OFICINA VIRTUAL DE INFORMACIÓN FISCAL\n", style: "titulo" },
        { text: subtitulo, style: "subtitulo" },
        { text: `Municipio: ${municipioNombre}`, style: "detalle" },
      ],
      alignment: "center",
      margin: [0, HEADER_BASE64 ? 15 : 40, 0, 0],
    },
  ].filter(Boolean);

  const content = [];

  const summaryByRegimen = buildSummaryByRegimen(remuneraciones);
  const regimenOrder = getRegimenOrder(summaryByRegimen, regimenes);

  if (!Array.isArray(remuneraciones) || remuneraciones.length === 0 || regimenOrder.length === 0) {
    content.push({
      text: "No se recibieron importes para poder generar el informe.",
      style: "noDataMessage",
      alignment: "center",
      margin: [0, 50, 0, 0],
    });
  } else {
    regimenOrder.forEach((regimenNombre) => {
      const categorySummary = Array.from((summaryByRegimen.get(regimenNombre) ?? new Map()).values())
        .sort((a, b) => a.categoria.localeCompare(b.categoria, "es", { sensitivity: "base" }));

      content.push({ text: regimenNombre, style: "subtitulo", margin: [0, 10, 0, 6] });

      if (!categorySummary.length) {
        content.push({
          text: `No existen remuneraciones para el régimen: ${regimenNombre}`,
          style: "detalle",
          margin: [0, 0, 0, 6],
        });
        return;
      }

      const headerRow = [
        { text: "CATEGORÍA", style: "tableHeader", valign: "middle" },
        { text: "TOTAL PERSONAS", style: "tableHeader", alignment: "right", valign: "middle" },
        { text: "TOTAL REMUNERATIVO", style: "tableHeader", alignment: "right", valign: "middle" },
        { text: "TOTAL NO REMUNERATIVO", style: "tableHeader", alignment: "right", valign: "middle" },
        { text: "TOTAL DESCUENTOS", style: "tableHeader", alignment: "right", valign: "middle" },
        { text: "NETO A COBRAR", style: "tableHeader", alignment: "right", valign: "middle" },
      ];

      const rows = categorySummary.map((item) => [
        { text: item.categoria, style: "itemDescripcion" },
        { text: String(item.total_personas), alignment: "right", style: "itemImporte" },
        { text: currencyFormatter.format(item.total_remunerativo), alignment: "right", style: "itemImporte" },
        { text: currencyFormatter.format(item.total_no_remunerativo), alignment: "right", style: "itemImporte" },
        { text: currencyFormatter.format(item.total_descuentos), alignment: "right", style: "itemImporte" },
        { text: currencyFormatter.format(item.neto_a_cobrar), alignment: "right", style: "itemImporte" },
      ]);

      const totalPersonas = categorySummary.reduce((acc, item) => acc + toNumber(item.total_personas), 0);
      const totalRemunerativo = categorySummary.reduce((acc, item) => acc + toNumber(item.total_remunerativo), 0);
      const totalNoRemunerativo = categorySummary.reduce((acc, item) => acc + toNumber(item.total_no_remunerativo), 0);
      const totalDescuentos = categorySummary.reduce((acc, item) => acc + toNumber(item.total_descuentos), 0);
      const totalNeto = categorySummary.reduce((acc, item) => acc + toNumber(item.neto_a_cobrar), 0);

      const totalRow = [
        { text: "TOTAL", style: "totalLabel" },
        { text: String(totalPersonas), style: "totalValue" },
        { text: currencyFormatter.format(totalRemunerativo), style: "totalValue" },
        { text: currencyFormatter.format(totalNoRemunerativo), style: "totalValue" },
        { text: currencyFormatter.format(totalDescuentos), style: "totalValue" },
        { text: currencyFormatter.format(totalNeto), style: "totalValue" },
      ];

      const tableBody = [headerRow, ...rows, totalRow];
      const totalRowIndex = tableBody.length - 1;

      content.push({
        table: {
          widths: [180, 90, 105, 115, 95, 95],
          headerRows: 1,
          body: tableBody,
        },
        layout: {
          fillColor: (rowIndex) => {
            if (rowIndex === 0) return "#2B3E4C";
            if (rowIndex === totalRowIndex) return "#e9eef2";
            return rowIndex % 2 === 0 ? "#f5f7f9" : null;
          },
          hLineColor: "#ccc",
          vLineColor: "#ccc",
        },
        margin: [0, 0, 0, 6],
      });
    });
  }

  const footerText = cierreId
    ? `Identificación del documento: ${cierreId}.`
    : `Este informe fue generado manualmente por el usuario ${usuarioNombre} y no es un comprobante válido de presentación y/o cumplimiento del envío de la información tal como lo establece el convenio ${convenioNombre}`;

  const docDefinition = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [8, HEADER_BASE64 ? 170 : 100, 8, 40],
    header: headerContent,
    footer: (currentPage, pageCount) => ({
      columns: [
        {
          text: `Generado el ${new Date().toLocaleDateString("es-AR")}`,
          alignment: "left",
          fontSize: 8,
        },
        {
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: "right",
          fontSize: 8,
        },
      ],
      margin: [40, 10],
    }),
    content: [
      ...content,
      {
        text: "",
        margin: [0, 15, 0, 0],
      },
      {
        text: footerText,
        style: "disclaimer",
        alignment: "center",
        margin: [20, 10, 20, 10],
      },
    ],
    styles: {
      titulo: { fontSize: 14, bold: true, color: "#2B3E4C" },
      subtitulo: { fontSize: 11, color: "#555" },
      detalle: { fontSize: 10, color: "#777" },
      sectionTitle: { fontSize: 12, bold: true, color: "#2B3E4C" },
      tableHeader: {
        bold: true,
        color: "#fff",
        fillColor: "#2B3E4C",
        fontSize: 8,
        alignment: "center",
      },
      itemCodigo: { fontSize: 8, color: "#333", alignment: "center" },
      itemImporte: { fontSize: 8, color: "#333", alignment: "left" },
      itemDescripcion: { fontSize: 8, color: "#333", alignment: "left" },
      totalLabel: { fontSize: 9, bold: true, color: "#2B3E4C", alignment: "left" },
      totalValue: { fontSize: 9, bold: true, color: "#2B3E4C", alignment: "right" },
      noDataMessage: { fontSize: 12, color: "#666", italics: true },
      disclaimer: {
        fontSize: 8,
        color: "#666",
        italics: true,
        alignment: "justify",
        border: [1, 1, 1, 1],
        borderColor: "#ccc",
        fillColor: "#f9f9f9",
      },
    },
    defaultStyle: {
      font: "Manrope",
      fontSize: 8,
    },
  };

  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks = [];

      pdfDoc.on("data", (chunk) => chunks.push(chunk));
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", (error) => reject(error));

      pdfDoc.end();
    } catch (error) {
      reject(error);
    }
  });
};
