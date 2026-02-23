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


const formatearFecha = (fecha) => {
    if (!fecha) return 'Sin especificar';
    
    const fechaStr = fecha.toString();
    const [anio, mes, dia] = fechaStr.split('-');
    
    if (!dia || !mes || !anio) return 'Sin especificar';
    
    return `${dia}/${mes}/${anio}`;
} 

const truncarNombre = (apellidoNombre) => {
    let truncado = apellidoNombre
    if(apellidoNombre.length > 9){
        truncado = apellidoNombre.slice(0,9);
        truncado = truncado + '...';
    }
    return truncado;
}

export const buildInformeRemuneraciones = ({ municipioNombre, ejercicio, mes, remuneraciones, regimenes, usuarioNombre, convenioNombre, esRectificacion = false, cierreId = null }) => {
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

    const regimenesList = Array.isArray(regimenes) ? regimenes : [];

    if (regimenesList.length === 0 || remuneraciones.length === 0) {
        content.push(
            { 
                text: 'No se recibieron importes para poder generar el informe.', 
                style: "noDataMessage",
                alignment: "center",
                margin: [0, 50, 0, 0],
            }
        );
    } else {
        for (const regimenObj of regimenesList) {
            const regimenNombre = regimenObj && regimenObj.nombre ? regimenObj.nombre : 'Sin nombre de régimen';

            content.push({ text: regimenNombre, style: 'subtitulo', margin: [0, 10, 0, 6] });

            const items = remuneraciones.filter(r => r && r.regimen === regimenNombre);

            if (!items || items.length === 0) {
                content.push({ text: `No existen remuneraciones para el régimen: ${regimenNombre}`, style: 'detalle', margin: [0, 0, 0, 6] });
                continue;
            }

            const headerRow = [
                { text: "CUIL", style: "tableHeader", valign: "middle", minHeight: 20 },
                { text: "NOMBRE", style: "tableHeader", valign: "middle", minHeight: 20 },
                { text: "LEGAJO", style: "tableHeader", valign: "middle", minHeight: 20 },
                { text: "SIT. DE REV.", style: "tableHeader", valign: "middle", minHeight: 20 },
                { text: "FECHA ALTA", style: "tableHeader", valign: "middle", minHeight: 20 },
                { text: "TIPO LIQ.", style: "tableHeader", valign: "middle", minHeight: 20 },
                { text: "REM. NETA", style: "tableHeader", alignment: "center", valign: "middle" },
                { text: "BON.", style: "tableHeader", alignment: "center", valign: "middle" },
                { text: "CANT. HS. 50%", style: "tableHeader", alignment: "center", valign: "middle" },
                { text: "IMP. HS. 50%", style: "tableHeader", alignment: "center", valign: "middle" },
                { text: "CANT. HS. 100%", style: "tableHeader", alignment: "center", valign: "middle" },
                { text: "IMP. HS. 100%", style: "tableHeader", alignment: "center", valign: "middle" },
                { text: "ART", style: "tableHeader", alignment: "center", valign: "middle" },
                { text: "SEG. DE VIDA", style: "tableHeader", alignment: "center", valign: "middle" },
                { text: "OTROS CON.", style: "tableHeader", alignment: "center", valign: "middle" },
            ];

            const rows = items.map((remuneracion) => {
                const tieneImporte = remuneracion.remuneracion_neta !== null && remuneracion.remuneracion_neta !== undefined;
                const importeNumerico = tieneImporte ? Number(remuneracion.remuneracion_neta) : 0;
                const importeFormateado = tieneImporte && Number.isFinite(importeNumerico)
                    ? currencyFormatter.format(importeNumerico)
                    : "------";

                const tieneBonificacion = remuneracion.bonificacion !== null && remuneracion.bonificacion !== undefined;
                const bonificacionNumerico = tieneBonificacion ? Number(remuneracion.bonificacion) : 0;
                const bonificacionFormateado = tieneBonificacion && Number.isFinite(bonificacionNumerico)
                    ? currencyFormatter.format(bonificacionNumerico)
                    : "------";

                const tieneArt = remuneracion.art !== null && remuneracion.art !== undefined;
                const artNumerico = tieneArt ? Number(remuneracion.art) : 0;
                const artFormateado = tieneArt && Number.isFinite(artNumerico)
                    ? currencyFormatter.format(artNumerico)
                    : "------";

                const tieneSeguroVida = remuneracion.seguro_vida !== null && remuneracion.seguro_vida !== undefined;
                const seguroVidaNumerico = tieneSeguroVida ? Number(remuneracion.seguro_vida) : 0;
                const seguroVidaFormateado = tieneSeguroVida && Number.isFinite(seguroVidaNumerico)
                    ? currencyFormatter.format(seguroVidaNumerico)
                    : "------";

                const tieneOtrosConceptos = remuneracion.otros_conceptos !== null && remuneracion.otros_conceptos !== undefined;
                const otrosConceptosNumerico = tieneOtrosConceptos ? Number(remuneracion.otros_conceptos) : 0;
                const otrosConceptosFormateado = tieneOtrosConceptos && Number.isFinite(otrosConceptosNumerico)
                    ? currencyFormatter.format(otrosConceptosNumerico)
                    : "------";

                const tieneCantCincuenta = remuneracion.cant_hs_extra_50 !== null && remuneracion.cant_hs_extra_50 !== undefined;
                const cantCincuentaNumerico = tieneCantCincuenta ? Number(remuneracion.cant_hs_extra_50) : 0;
                const cantCincuentaFormateado = tieneCantCincuenta && Number.isFinite(cantCincuentaNumerico)
                    ? cantCincuentaNumerico
                    : "------";

                const tieneImporteCincuenta = remuneracion.importe_hs_extra_50 !== null && remuneracion.importe_hs_extra_50 !== undefined;
                const importeCincuentaNumerico = tieneImporteCincuenta ? Number(remuneracion.importe_hs_extra_50) : 0;
                const importeCincuentaFormateado = tieneImporteCincuenta && Number.isFinite(importeCincuentaNumerico)
                    ? currencyFormatter.format(importeCincuentaNumerico)
                    : "------";

                const tieneCantCien = remuneracion.cant_hs_extra_100 !== null && remuneracion.cant_hs_extra_100 !== undefined;
                const cantCienNumerico = tieneCantCien ? Number(remuneracion.cant_hs_extra_100) : 0;
                const cantCienFormateado = tieneCantCien && Number.isFinite(cantCienNumerico)
                    ? cantCienNumerico
                    : "------";

                const tieneImporteCien = remuneracion.importe_hs_extra_100 !== null && remuneracion.importe_hs_extra_100 !== undefined;
                const importeCienNumerico = tieneImporteCien ? Number(remuneracion.importe_hs_extra_100) : 0;
                const importeCienFormateado = tieneImporteCien && Number.isFinite(importeCienNumerico)
                    ? currencyFormatter.format(importeCienNumerico)
                    : "------";

                const tieneApellidoNombre = remuneracion.apellido_nombre != null && remuneracion.apellido_nombre != undefined;
                const apellidoNombreFormateado = tieneApellidoNombre ? truncarNombre(remuneracion.apellido_nombre) : "------";

                return [
                    { text: remuneracion.cuil ?? "Sin especificar", style: "itemDescripcion" },
                    { text: apellidoNombreFormateado, style: "itemDescripcion" },
                    { text: remuneracion.legajo ?? "Sin especificar", style: "itemDescripcion" },
                    { text: remuneracion.situacion_revista ?? 'Sin especificar', style: "itemDescripcion" },
                    { text: formatearFecha(remuneracion.fecha_alta), style: "itemDescripcion" },
                    { text: remuneracion.tipo_liquidacion ?? 'Sin especificar', style: "itemDescripcion" },
                    { text: importeFormateado, alignment: "right", style: "itemImporte" },
                    { text: bonificacionFormateado, alignment: "right", style: "itemImporte" },
                    { text: cantCincuentaFormateado, alignment: "right", style: "itemImporte" },
                    { text: importeCincuentaFormateado, alignment: "right", style: "itemImporte" },
                    { text: cantCienFormateado, alignment: "right", style: "itemImporte" },
                    { text: importeCienFormateado, alignment: "right", style: "itemImporte" },
                    { text: artFormateado, alignment: "right", style: "itemImporte" },
                    { text: seguroVidaFormateado, alignment: "right", style: "itemImporte" },
                    { text: otrosConceptosFormateado, alignment: "right", style: "itemImporte" },
                ];
            });

            const totalRemuneracion = items.reduce((acc, it) => {
                const val = it.remuneracion_neta !== null && it.remuneracion_neta !== undefined ? Number(it.remuneracion_neta) : 0;
                return acc + (Number.isFinite(val) ? val : 0);
            }, 0);

            const totalBonificacion = items.reduce((acc, it) => {
                const val = it.bonificacion !== null && it.bonificacion !== undefined ? Number(it.bonificacion) : 0;
                return acc + (Number.isFinite(val) ? val : 0);
            }, 0);

            const totalCantCincuenta = items.reduce((acc, it) => {
                const val = it.cant_hs_extra_50 !== null && it.cant_hs_extra_50 !== undefined ? Number(it.cant_hs_extra_50) : 0;
                return acc + (Number.isFinite(val) ? val : 0);
            }, 0);

            const totalImporteCincuenta = items.reduce((acc, it) => {
                const val = it.importe_hs_extra_50 !== null && it.importe_hs_extra_50 !== undefined ? Number(it.importe_hs_extra_50) : 0;
                return acc + (Number.isFinite(val) ? val : 0);
            }, 0);

            const totalCantCien = items.reduce((acc, it) => {
                const val = it.cant_hs_extra_100 !== null && it.cant_hs_extra_100 !== undefined ? Number(it.cant_hs_extra_100) : 0;
                return acc + (Number.isFinite(val) ? val : 0);
            }, 0);

            const totalImporteCien = items.reduce((acc, it) => {
                const val = it.importe_hs_extra_100 !== null && it.importe_hs_extra_100 !== undefined ? Number(it.importe_hs_extra_100) : 0;
                return acc + (Number.isFinite(val) ? val : 0);
            }, 0);

            const totalArt = items.reduce((acc, it) => {
                const val = it.art !== null && it.art !== undefined ? Number(it.art) : 0;
                return acc + (Number.isFinite(val) ? val : 0);
            }, 0);

            const totalSeguroVida = items.reduce((acc, it) => {
                const val = it.seguro_vida !== null && it.seguro_vida !== undefined ? Number(it.seguro_vida) : 0;
                return acc + (Number.isFinite(val) ? val : 0);
            }, 0);

            const totalOtrosConceptos = items.reduce((acc, it) => {
                const val = it.otros_conceptos !== null && it.otros_conceptos !== undefined ? Number(it.otros_conceptos) : 0;
                return acc + (Number.isFinite(val) ? val : 0);
            }, 0);

            const totalRow = [
                { text: "TOTAL", colSpan: 5, style: "totalLabel" },
                { },
                { },
                { },
                { },
                { },
                { text: currencyFormatter.format(totalRemuneracion || 0), style: "totalValue" },
                { text: currencyFormatter.format(totalBonificacion || 0), style: "totalValue" },
                { text: totalCantCincuenta, style: "totalValue" },
                { text: currencyFormatter.format(totalImporteCincuenta || 0), style: "totalValue" },
                { text: totalCantCien, style: "totalValue" },
                { text: currencyFormatter.format(totalImporteCien || 0), style: "totalValue" },
                { text: currencyFormatter.format(totalArt || 0), style: "totalValue" },
                { text: currencyFormatter.format(totalSeguroVida || 0), style: "totalValue" },
                { text: currencyFormatter.format(totalOtrosConceptos || 0), style: "totalValue" },
            ];

            const tableBody = [headerRow, ...rows, totalRow];

            const totalRowIndex = tableBody.length - 1;

            content.push({
                table: {
                    widths: [50, 45, 45, 45, 45, 45, 55, 50, 45, 40, 45, 45, 45, 45, 45],
                    headerRows: 1,
                    body: tableBody,
                },
                layout: {
                    fillColor: (rowIndex) => {
                        if (rowIndex === 0) return "#2B3E4C";
                        if (rowIndex === totalRowIndex) return "#e9eef2";
                        return (rowIndex % 2 === 0) ? "#f5f7f9" : null;
                    },
                    hLineColor: "#ccc",
                    vLineColor: "#ccc",
                },
                margin: [0, 0, 0, 6],
            });
        }
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
            }
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
            }
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
