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
      seguro_vida: 0,
      art: 0,
      issn: 0,
      desc_personales: 0,
      neto_a_cobrar: 0,
    };

    categoriaSummary.total_personas += 1;
    categoriaSummary.seguro_vida += toNumber(item?.seguro_vida);
    categoriaSummary.art += toNumber(item?.art);
    categoriaSummary.issn += toNumber(item?.issn);
    categoriaSummary.desc_personales += toNumber(item?.desc_personales);
    categoriaSummary.neto_a_cobrar += toNumber(item?.neto_a_cobrar);

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
    const totalesPorRegimen = [];

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
        { text: "SEGURO DE VIDA", style: "tableHeader", alignment: "right", valign: "middle" },
        { text: "ART", style: "tableHeader", alignment: "right", valign: "middle" },
        { text: "ISSN", style: "tableHeader", alignment: "right", valign: "middle" },
        { text: "DESC. PERSONALES", style: "tableHeader", alignment: "right", valign: "middle" },
        { text: "NETO A COBRAR", style: "tableHeader", alignment: "right", valign: "middle" },
      ];

      const rows = categorySummary.map((item) => [
        { text: item.categoria, style: "itemDescripcion" },
        { text: String(item.total_personas), alignment: "right", style: "itemImporte" },
        { text: currencyFormatter.format(item.seguro_vida), alignment: "right", style: "itemImporte" },
        { text: currencyFormatter.format(item.art), alignment: "right", style: "itemImporte" },
        { text: currencyFormatter.format(item.issn), alignment: "right", style: "itemImporte" },
        { text: currencyFormatter.format(item.desc_personales), alignment: "right", style: "itemImporte" },
        { text: currencyFormatter.format(item.neto_a_cobrar), alignment: "right", style: "itemImporte" },
      ]);

      const totalPersonas = categorySummary.reduce((acc, item) => acc + toNumber(item.total_personas), 0);
      const totalSeguroVida = categorySummary.reduce((acc, item) => acc + toNumber(item.seguro_vida), 0);
      const totalArt = categorySummary.reduce((acc, item) => acc + toNumber(item.art), 0);
      const totalIssn = categorySummary.reduce((acc, item) => acc + toNumber(item.issn), 0);
      const totalDescPersonales = categorySummary.reduce((acc, item) => acc + toNumber(item.desc_personales), 0);
      const totalNeto = categorySummary.reduce((acc, item) => acc + toNumber(item.neto_a_cobrar), 0);

      totalesPorRegimen.push({ regimen: regimenNombre, totalPersonas, totalSeguroVida, totalArt, totalIssn, totalDescPersonales, totalNeto });

      const totalRow = [
        { text: "TOTAL", style: "totalLabel" },
        { text: String(totalPersonas), style: "totalValue" },
        { text: currencyFormatter.format(totalSeguroVida), style: "totalValue" },
        { text: currencyFormatter.format(totalArt), style: "totalValue" },
        { text: currencyFormatter.format(totalIssn), style: "totalValue" },
        { text: currencyFormatter.format(totalDescPersonales), style: "totalValue" },
        { text: currencyFormatter.format(totalNeto), style: "totalValue" },
      ];

      const tableBody = [headerRow, ...rows, totalRow];
      const totalRowIndex = tableBody.length - 1;

      content.push({
        table: {
          widths: [150, 70, 100, 70, 80, 100, 95],
          headerRows: 1,
          keepWithHeaderRows: 1,
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

    if (totalesPorRegimen.length > 0) {
      const grandTotalPersonas = totalesPorRegimen.reduce((acc, r) => acc + r.totalPersonas, 0);
      const grandTotalSeguroVida = totalesPorRegimen.reduce((acc, r) => acc + r.totalSeguroVida, 0);
      const grandTotalArt = totalesPorRegimen.reduce((acc, r) => acc + r.totalArt, 0);
      const grandTotalIssn = totalesPorRegimen.reduce((acc, r) => acc + r.totalIssn, 0);
      const grandTotalDescPersonales = totalesPorRegimen.reduce((acc, r) => acc + r.totalDescPersonales, 0);
      const grandTotalNeto = totalesPorRegimen.reduce((acc, r) => acc + r.totalNeto, 0);

      const grandHeaderRow = [
        { text: "RÉGIMEN", style: "tableHeader", valign: "middle" },
        { text: "TOTAL PERSONAS", style: "tableHeader", alignment: "right", valign: "middle" },
        { text: "SEGURO DE VIDA", style: "tableHeader", alignment: "right", valign: "middle" },
        { text: "ART", style: "tableHeader", alignment: "right", valign: "middle" },
        { text: "ISSN", style: "tableHeader", alignment: "right", valign: "middle" },
        { text: "DESC. PERSONALES", style: "tableHeader", alignment: "right", valign: "middle" },
        { text: "NETO A COBRAR", style: "tableHeader", alignment: "right", valign: "middle" },
      ];

      const grandRows = totalesPorRegimen.map((r) => [
        { text: r.regimen, style: "itemDescripcion" },
        { text: String(r.totalPersonas), alignment: "right", style: "itemImporte" },
        { text: currencyFormatter.format(r.totalSeguroVida), alignment: "right", style: "itemImporte" },
        { text: currencyFormatter.format(r.totalArt), alignment: "right", style: "itemImporte" },
        { text: currencyFormatter.format(r.totalIssn), alignment: "right", style: "itemImporte" },
        { text: currencyFormatter.format(r.totalDescPersonales), alignment: "right", style: "itemImporte" },
        { text: currencyFormatter.format(r.totalNeto), alignment: "right", style: "itemImporte" },
      ]);

      const grandTotalRow = [
        { text: "TOTAL GENERAL", style: "totalLabel" },
        { text: String(grandTotalPersonas), style: "totalValue" },
        { text: currencyFormatter.format(grandTotalSeguroVida), style: "totalValue" },
        { text: currencyFormatter.format(grandTotalArt), style: "totalValue" },
        { text: currencyFormatter.format(grandTotalIssn), style: "totalValue" },
        { text: currencyFormatter.format(grandTotalDescPersonales), style: "totalValue" },
        { text: currencyFormatter.format(grandTotalNeto), style: "totalValue" },
      ];

      const grandTableBody = [grandHeaderRow, ...grandRows, grandTotalRow];
      const grandTotalRowIndex = grandTableBody.length - 1;

      content.push({ text: "TOTAL GENERAL POR RÉGIMEN", style: "subtitulo", margin: [0, 16, 0, 6] });
      content.push({
        table: {
          widths: [150, 70, 100, 70, 80, 100, 95],
          headerRows: 1,
          keepWithHeaderRows: 1,
          body: grandTableBody,
        },
        layout: {
          fillColor: (rowIndex) => {
            if (rowIndex === 0) return "#2B3E4C";
            if (rowIndex === grandTotalRowIndex) return "#e9eef2";
            return rowIndex % 2 === 0 ? "#f5f7f9" : null;
          },
          hLineColor: "#ccc",
          vLineColor: "#ccc",
        },
        margin: [0, 0, 0, 6],
      });
    }
  }

  const _now = new Date();
  const _tz = { timeZone: "America/Argentina/Buenos_Aires" };
  const footerText = cierreId
    ? `Identificación del documento: ${cierreId}.`
    : `Documento de control emitido por ${usuarioNombre}, el ${_now.toLocaleDateString("es-AR", _tz)} ${_now.toLocaleTimeString("es-AR", { ..._tz, hour12: false })}`;

  const docDefinition = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [8, HEADER_BASE64 ? 190 : 100, 8, 40],
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
