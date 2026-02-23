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

export const buildInformeRecaudaciones = ({ municipioNombre, ejercicio, mes, conceptos, totalImporte, usuarioNombre, convenioNombre, esRectificacion = false, cierreId = null }) => {
    const subtitulo = esRectificacion 
        ? `Informe de Rectificación de Recaudaciones - ${mes}/${ejercicio}\n`
        : `Informe de Recaudaciones - ${mes}/${ejercicio}\n`;

    const headerContent = [
        HEADER_BASE64
        ? {
            image: `data:image/png;base64,${HEADER_BASE64}`,
            width: 595,
            }
        : null,
        {
            text: [
                { text: "OFICINA VIRTUAL DE INFORMACIÓN FISCAL\n", style: "titulo" },
                { text: subtitulo, style: "subtitulo" },
                { text: `Municipio: ${municipioNombre}`, style: "detalle" },
            ],
            alignment: "center",
            margin: [40, HEADER_BASE64 ? 15 : 40, 40, 0],
        },
    ].filter(Boolean);

    const content = [];
    if (!Array.isArray(conceptos) || conceptos.length === 0) {
        content.push(
            {
                text: "No se recibieron importes para poder generar el informe.",
                style: "noDataMessage",
                alignment: "center",
                margin: [0, 50, 0, 0],
            },
        );
    } else {
        const totalNumerico = Number(totalImporte);
        const totalFormateado = Number.isFinite(totalNumerico)
            ? currencyFormatter.format(totalNumerico)
            : currencyFormatter.format(0);

        const tableBody = [
            [
                { text: "CODIGO", style: "tableHeader", valign: "middle", minHeight: 20 },
                { text: "CONCEPTO", style: "tableHeader", valign: "middle", minHeight: 20 },
                { text: "IMPORTE RECAUDACIÓN", style: "tableHeader", alignment: "right", valign: "middle" },
            ],
            ...conceptos.map((concepto) => {
                const tieneImporte = concepto.importe_recaudacion !== null && concepto.importe_recaudacion !== undefined;
                const importeNumerico = tieneImporte ? Number(concepto.importe_recaudacion) : null;
                const importeFormateado = tieneImporte && Number.isFinite(importeNumerico)
                    ? currencyFormatter.format(importeNumerico)
                    : "------";

                return [
                    {
                        text: concepto.cod_concepto ?? "Sin código",
                        style: "itemCodigo",
                    },
                    {
                        text: concepto.descripcion ?? "Sin descripcion",
                        style: "itemDescripcion",
                    },
                    { text: importeFormateado, alignment: "right", style: "itemImporte" },
                ];
            }),
            [
                { text: "TOTAL", colSpan: 2, style: "totalLabel" },
                { text: ""},
                { text: totalFormateado, alignment: "right", style: "totalValue" },
            ],
        ];

        const totalRowIndex = tableBody.length - 1;

        content.push(
            {
                table: {
                    widths: ["auto", "*", "auto"],
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
                    const dataIndex = rowIndex - 1;
                    const concepto = conceptos[dataIndex];
                    if (concepto) {
                        return "#f5f7f9";
                    }
                    return null;
                },
                hLineColor: "#ccc",
                vLineColor: "#ccc",
                },
            },
        );
    }

    const footerText = cierreId 
        ? `Identificación del documento: ${cierreId}.`
        : `Este informe fue generado manualmente por el usuario ${usuarioNombre} y no es un comprobante válido de presentación y/o cumplimiento del envío de la información tal como lo establece el convenio ${convenioNombre}`;

    const docDefinition = {
        pageSize: "A4",
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
                fontSize: 10,
                alignment: "center",
            },
            itemCodigo: { fontSize: 10, color: "#333", alignment: "center" },
            itemImporte: { fontSize: 10, color: "#333" },
            totalLabel: { fontSize: 11, bold: true, color: "#2B3E4C", alignment: "left" },
            totalValue: { fontSize: 11, bold: true, color: "#2B3E4C" },
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
            reject(error);
        }
    });
};
