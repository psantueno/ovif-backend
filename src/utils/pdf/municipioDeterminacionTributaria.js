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
  throw new Error(`No se encontro la fuente requerida (${label}). Verificar la carpeta /fonts.`);
};

const loadImageAsBase64 = (candidates, label) => {
  for (const candidate of candidates) {
    const absolute = path.resolve(candidate);
    if (fs.existsSync(absolute)) {
      const buffer = fs.readFileSync(absolute);
      return buffer.toString("base64");
    }
  }
  console.warn(`Advertencia: imagen opcional no encontrada (${label}). Se omitira en el informe.`);
  return null;
};

const HEADER_BASE64 = loadImageAsBase64(
  ["assets/pdf/encabezado.png", "src/assets/pdf/encabezado.png"],
  "encabezado.png"
);

const MANROPE_REGULAR = resolveExistingPath(
  ["fonts/Manrope-Regular.ttf", "src/fonts/Manrope-Regular.ttf"],
  "Manrope-Regular.ttf"
);

const MANROPE_MEDIUM = resolveExistingPath(
  ["fonts/Manrope-Medium.ttf", "src/fonts/Manrope-Medium.ttf"],
  "Manrope-Medium.ttf"
);

const MANROPE_BOLD = resolveExistingPath(
  ["fonts/Manrope-Bold.ttf", "src/fonts/Manrope-Bold.ttf"],
  "Manrope-Bold.ttf"
);

const printer = new PdfPrinter({
  Manrope: {
    normal: MANROPE_REGULAR,
    bold: MANROPE_BOLD,
    italics: MANROPE_REGULAR,
    bolditalics: MANROPE_MEDIUM,
  },
});

const integerFormatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatInteger = (value) => integerFormatter.format(Number(value) || 0);
const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0);
const BADGE_HEIGHT = 22;
const BADGE_RADIUS = BADGE_HEIGHT / 2;
const buildBadgeWidth = (text) =>
  Math.max(170, Math.ceil(String(text ?? "").length * 5.2) + 24);

const buildBadge = (text) => {
  const width = buildBadgeWidth(text);

  return {
    width,
    stack: [
      {
        canvas: [
          {
            type: "ellipse",
            x: BADGE_RADIUS,
            y: BADGE_RADIUS,
            r1: BADGE_RADIUS,
            r2: BADGE_RADIUS,
            color: "#2B3E4C",
          },
          {
            type: "rect",
            x: BADGE_RADIUS,
            y: 0,
            w: width - BADGE_HEIGHT,
            h: BADGE_HEIGHT,
            color: "#2B3E4C",
          },
          {
            type: "ellipse",
            x: width - BADGE_RADIUS,
            y: BADGE_RADIUS,
            r1: BADGE_RADIUS,
            r2: BADGE_RADIUS,
            color: "#2B3E4C",
          },
        ],
        margin: [0, 0, 0, -BADGE_HEIGHT],
      },
      {
        text,
        color: "#ffffff",
        bold: true,
        fontSize: 8,
        alignment: "center",
        noWrap: true,
        margin: [0, 6, 0, 0],
      },
    ],
  };
};

const THICK_LINE_COLOR = "#b8c7d2";
const THICK_LINE_WIDTH = 1.2;

const sectionDivider = {
  canvas: [
    {
      type: "line",
      x1: 0,
      y1: 0,
      x2: 780,
      y2: 0,
      lineWidth: THICK_LINE_WIDTH,
      lineColor: THICK_LINE_COLOR,
    },
  ],
};

const summaryTableLayout = {
  hLineColor: () => THICK_LINE_COLOR,
  vLineColor: () => "#ffffff",
  hLineWidth: () => THICK_LINE_WIDTH,
  vLineWidth: () => 0,
  paddingLeft: () => 0,
  paddingRight: () => 0,
  paddingTop: () => 6,
  paddingBottom: () => 6,
};

const detailTableLayout = {
  fillColor: (rowIndex) => (rowIndex === 0 ? "#2B3E4C" : "#f5f7f9"),
  hLineColor: () => THICK_LINE_COLOR,
  vLineColor: () => THICK_LINE_COLOR,
  hLineWidth: () => THICK_LINE_WIDTH,
  vLineWidth: (columnIndex) => (columnIndex === 0 ? 0 : 0.7),
  paddingLeft: () => 4,
  paddingRight: () => 4,
  paddingTop: () => 5,
  paddingBottom: () => 5,
};

export const buildInformeDeterminacionTributaria = ({
  municipioNombre,
  ejercicio,
  mes,
  determinaciones = [],
  resumen = {},
  usuarioNombre,
  convenioNombre,
  cierreId = null,
}) => {
  const headerContent = [
    HEADER_BASE64
      ? {
          image: `data:image/png;base64,${HEADER_BASE64}`,
          width: 842,
        }
      : null,
    {
      text: [
        { text: "OFICINA VIRTUAL DE INFORMACION FISCAL\n", style: "titulo" },
        {
          text: `Informe de Determinacion Tributaria - Periodo ${mes}/${ejercicio}\n`,
          style: "subtitulo",
        },
        { text: `Municipio: ${municipioNombre}`, style: "detalle" },
      ],
      alignment: "center",
      margin: [0, HEADER_BASE64 ? 15 : 40, 0, 0],
    },
  ].filter(Boolean);

  const content = [];
  if (!Array.isArray(determinaciones) || determinaciones.length === 0) {
    content.push({
      text: "No se recibieron datos para poder generar el informe.",
      style: "noDataMessage",
      alignment: "center",
      margin: [0, 50, 0, 0],
    });
  } else {
    content.push(
      {
        columns: [
          {
            width: "*",
            text: "Resumen general",
            style: "sectionTitle",
            margin: [0, 0, 0, 6],
          },
          {
            width: "auto",
            ...buildBadge(
              `IMPUESTOS / TASAS INFORMADAS: ${formatInteger(resumen.totalRegistros)}`
            ),
            margin: [0, 0, 0, 6],
          },
        ],
      },
      sectionDivider,
      {
        columns: [
          {
            width: "*",
            table: {
              widths: ["*", "*"],
              body: [
                ["Liquidadas", formatInteger(resumen.totalLiquidadas)],
                ["Impagas", formatInteger(resumen.totalImpagas)],
                ["Pagadas", formatInteger(resumen.totalPagadas)],
                ["Altas del periodo", formatInteger(resumen.totalAltasPeriodo)],
                ["Bajas del periodo", formatInteger(resumen.totalBajasPeriodo)],
              ],
            },
            layout: summaryTableLayout,
          },
          {
            width: 18,
            text: "",
          },
          {
            width: "*",
            table: {
              widths: ["*", "*"],
              body: [
                ["Importe liquidadas", formatCurrency(resumen.totalImporteLiquidadas)],
                ["Importe impagas", formatCurrency(resumen.totalImporteImpagas)],
                ["Importe pagadas", formatCurrency(resumen.totalImportePagadas)],
              ],
            },
            layout: summaryTableLayout,
          },
        ],
        columnGap: 10,
        margin: [0, 8, 0, 14],
      },
      {
        text: "Detalle informado",
        style: "sectionTitle",
        margin: [0, 0, 0, 6],
      },
      sectionDivider,
      {
        table: {
          headerRows: 1,
          widths: [28, 140, 32, 38, 44, 76, 42, 76, 46, 76, 34, 34],
          body: [
            [
              { text: "COD.", style: "tableHeader", alignment: "center", noWrap: true },
              { text: "DESCRIPCIÓN", style: "tableHeader", alignment: "center", noWrap: true },
              { text: "AÑO", style: "tableHeader", alignment: "center", noWrap: true },
              { text: "CUOTA", style: "tableHeader", alignment: "center", noWrap: true },
              { text: "LIQUIDADAS", style: "tableHeader", alignment: "center", noWrap: true },
              { text: "IMP. LIQ.", style: "tableHeader", alignment: "center", noWrap: true },
              { text: "IMPAGAS", style: "tableHeader", alignment: "center", noWrap: true },
              { text: "IMP. IMPAGAS", style: "tableHeader", alignment: "center", noWrap: true },
              { text: "PAGADAS", style: "tableHeader", alignment: "center", noWrap: true },
              { text: "IMP. PAGADAS", style: "tableHeader", alignment: "center", noWrap: true },
              { text: "ALTAS", style: "tableHeader", alignment: "center", noWrap: true },
              { text: "BAJAS", style: "tableHeader", alignment: "center", noWrap: true },
            ],
            ...determinaciones.map((item) => [
              { text: item.cod_impuesto ?? "-", style: "itemCell", alignment: "center" },
              { text: item.descripcion ?? "-", style: "itemCell", alignment: "center" },
              { text: item.anio ?? "-", style: "itemCell", alignment: "center" },
              { text: item.cuota ?? "-", style: "itemCell", alignment: "center" },
              { text: formatInteger(item.liquidadas), style: "itemCell", alignment: "center" },
              { text: formatCurrency(item.importe_liquidadas), style: "itemCell", alignment: "center" },
              { text: formatInteger(item.impagas), style: "itemCell", alignment: "center" },
              { text: formatCurrency(item.importe_impagas), style: "itemCell", alignment: "center" },
              { text: formatInteger(item.pagadas), style: "itemCell", alignment: "center" },
              { text: formatCurrency(item.importe_pagadas), style: "itemCell", alignment: "center" },
              { text: formatInteger(item.altas_periodo), style: "itemCell", alignment: "center" },
              { text: formatInteger(item.bajas_periodo), style: "itemCell", alignment: "center" },
            ]),
          ],
        },
        layout: detailTableLayout,
      }
    );
  }

  const footerText = cierreId 
    ? `Identificación del documento: ${cierreId}.`
    : `Este informe fue generado manualmente por el usuario ${usuarioNombre} y no es un comprobante válido de presentación y/o cumplimiento del envío de la información tal como lo establece el convenio ${convenioNombre}`;

    
  const docDefinition = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [20, HEADER_BASE64 ? 170 : 100, 20, 70],
    header: () => headerContent,
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
        margin: [30, 10, 30, 10],
      },
    ],
    footer: (currentPage, pageCount) => ({
      margin: [20, 15, 20, 20],
      stack: [
        {
          ...sectionDivider,
        },
        {
          columns: [
            {
              width: "*",
              text: [
                { text: "Generado por: ", style: "footerLabel" },
                { text: usuarioNombre || "Sin usuario", style: "footerValue" },
                { text: " | Convenio: ", style: "footerLabel" },
                { text: convenioNombre || "Sin convenio", style: "footerValue" },
                cierreId
                  ? { text: " | Cierre ID: ", style: "footerLabel" }
                  : "",
                cierreId ? { text: String(cierreId), style: "footerValue" } : "",
              ],
            },
            {
              width: "auto",
              text: `Pagina ${currentPage} de ${pageCount}`,
              style: "footerValue",
              alignment: "right",
            },
          ],
          margin: [0, 8, 0, 0],
        },
      ],
    }),
    defaultStyle: {
      font: "Manrope",
      fontSize: 9,
      color: "#243746",
    },
    styles: {
      titulo: {
        fontSize: 16,
        bold: true,
        color: "#243746",
      },
      subtitulo: {
        fontSize: 12,
        bold: true,
        color: "#3b5568",
      },
      detalle: {
        fontSize: 10,
        color: "#516979",
      },
      sectionTitle: {
        fontSize: 11,
        bold: true,
        color: "#243746",
      },
      tableHeader: {
        color: "#ffffff",
        bold: true,
        fontSize: 7.2,
        margin: [0, 2, 0, 2],
      },
      itemCell: {
        fontSize: 7.6,
        margin: [0, 1, 0, 1],
      },
      noDataMessage: {
        fontSize: 12,
        color: "#607080",
      },
      disclaimer: {
        fontSize: 8,
        color: "#666",
        italics: true,
        alignment: "justify",
      },
      footerLabel: {
        fontSize: 8,
        bold: true,
        color: "#607080",
      },
      footerValue: {
        fontSize: 8,
        color: "#607080",
      },
    },
  };

  return new Promise((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
};
