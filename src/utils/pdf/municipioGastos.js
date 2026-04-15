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

export const buildInformeGastos = ({ municipioNombre, ejercicio, mes, gastos, totales, usuarioNombre, convenioNombre, cierreId }) => {
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
        { text: `Informe de Gastos - ${mes}/${ejercicio}\n`, style: "subtitulo" },
        { text: `Municipio: ${municipioNombre}`, style: "detalle" },
      ],
      alignment: "center",
      margin: [40, HEADER_BASE64 ? 15 : 40, 40, 0],
    },
  ].filter(Boolean);

  const content = [];

  if (!Array.isArray(gastos) || gastos.length === 0) {
    content.push(
      {
        text: "No se recibieron importes para poder generar el informe.",
        style: "noDataMessage",
        alignment: "center",
        margin: [0, 50, 0, 0],
      }
    );
  } else {
    const formatCurrency = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? currencyFormatter.format(num) : "------";
    };

    const tableBody = [
      [
        { text: "CÓDIGO", style: "tableHeader", alignment: "center" },
        { text: "PARTIDA", style: "tableHeader" },
        { text: "FUENTE", style: "tableHeader" },
        { text: "FORMULADO", style: "tableHeader", alignment: "right" },
        { text: "MODIFICADO", style: "tableHeader", alignment: "right" },
        { text: "VIGENTE", style: "tableHeader", alignment: "right" },
        { text: "DEVENGADO", style: "tableHeader", alignment: "right" },
      ],
      ...gastos.map((gasto) => [
        { text: gasto.codigo_partida ?? "-", style: "itemCodigo", alignment: "center" },
        { text: gasto.descripcion ?? "Sin descripción", style: "itemDescripcion" },
        { text: gasto.descripcion_fuente ?? "-", style: "itemDescripcion" },
        { text: formatCurrency(gasto.formulado), alignment: "right", style: "itemImporte" },
        { text: formatCurrency(gasto.modificado), alignment: "right", style: "itemImporte" },
        { text: formatCurrency(gasto.vigente), alignment: "right", style: "itemImporte" },
        { text: formatCurrency(gasto.devengado), alignment: "right", style: "itemImporte" },
      ]),
      [
        { text: "TOTAL", colSpan: 3, style: "totalLabel" },
        {},
        {},
        { text: formatCurrency(totales.formulado), alignment: "right", style: "totalValue" },
        { text: formatCurrency(totales.modificado), alignment: "right", style: "totalValue" },
        { text: formatCurrency(totales.vigente), alignment: "right", style: "totalValue" },
        { text: formatCurrency(totales.devengado), alignment: "right", style: "totalValue" },
      ],
    ];

    const totalRowIndex = tableBody.length - 1;

    content.push(
      {
        table: {
          widths: ["auto", "*", "auto", "auto", "auto", "auto", "auto"],
          headerRows: 1,
          body: tableBody,
        },
        layout: {
          fillColor: (rowIndex) => {
            if (rowIndex === 0) {
              return "#2B3E4C";
            }
            if (rowIndex === totalRowIndex) {
              return "#e9eef2";
            }
            return null;
          },
          hLineColor: "#ccc",
          vLineColor: "#ccc",
        },
      }
    )
  }

  const footerText = cierreId
    ? `Identificación del documento: ${cierreId}.`
    : `Este informe fue generado manualmente por el usuario ${usuarioNombre} y no es un comprobante válido de presentación y/o cumplimiento del envío de la información tal como lo establece el convenio ${convenioNombre}`;

  const docDefinition = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [40, HEADER_BASE64 ? 170 : 100, 40, 60],
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
      itemDescripcion: { fontSize: 8, color: "#333" },
      itemImporte: { fontSize: 8, color: "#333" },
      totalLabel: { fontSize: 9, bold: true, color: "#2B3E4C", alignment: "left" },
      totalValue: { fontSize: 9, bold: true, color: "#2B3E4C" },
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
      fontSize: 10,
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
      console.error(error.message)
      reject(error);
    }
  });
};
