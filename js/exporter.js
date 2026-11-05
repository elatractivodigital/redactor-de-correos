/**
 * Módulo de Exportación y Portapapeles (`js/exporter.js`)
 * Genera archivos .docx (OpenXML ZIP nativo sin dependencias externas) y .pdf (vía jsPDF),
 * además de gestionar el copiado rápido al portapapeles con soporte para file://.
 */

// ============================================================================
// 1. UTILIDADES DE FORMATO Y NOMBRES DE ARCHIVO
// ============================================================================

/**
 * Escapa caracteres especiales para insertar texto seguro dentro de nodos XML (OpenXML).
 * @param {string} str
 * @returns {string}
 */
(function () {
  'use strict';

function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Genera una fecha legible en español de España si no se proporciona una.
 * @param {string} [dateStr]
 * @returns {string}
 */
function resolveDateString(dateStr) {
  if (dateStr && String(dateStr).trim()) {
    return String(dateStr).trim();
  }
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toLocaleDateString('es-ES');
  }
}

/**
 * Convierte el asunto del correo en un nombre de archivo limpio y seguro.
 * Ejemplo: "Solicitud de permiso" -> "Correo_Solicitud_de_permiso.docx"
 * @param {string} subject
 * @param {string} extension - Ej. 'docx' o 'pdf'
 * @returns {string}
 */
function sanitizeFilename(subject, extension) {
  const cleanExt = String(extension || 'txt').replace(/^\.+/, '').toLowerCase();
  const rawSubject = String(subject || 'Sin_asunto').trim();

  // Normalizar tildes y eñes para máxima compatibilidad en sistemas de archivos
  const normalized = rawSubject
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 55)
    .replace(/^_+|_+$/g, '');

  const baseName = normalized ? `Correo_${normalized}` : 'Correo_Redaccion';
  return `${baseName}.${cleanExt}`;
}

/**
 * Dispara la descarga en el navegador de un objeto Blob.
 * @param {Blob} blob
 * @param {string} filename
 */
function triggerBrowserDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 1500);
}

// ============================================================================
// 2. COPIADO AL PORTAPAPELES
// ============================================================================

/**
 * Normaliza un cuerpo de correo que incluya la estructura obligatoria:
 * `**Asunto:** [Asunto]` en la primera línea y posibles marcas `**negrita**`.
 *
 * @param {string} subject
 * @param {string} body
 * @returns {{ effectiveSubject: string, cleanBodyWithoutSubjectLine: string, fullPlainText: string }}
 */
function parseStructuredEmailBody(subject = '', body = '') {
  const normalizedBody = String(body || '').replace(/\r\n/g, '\n').trim();
  const lines = normalizedBody.split('\n');

  let extractedSubject = '';
  let bodyLines = lines;

  if (lines.length > 0) {
    const firstLineMatch = lines[0].trim().match(/^(?:\*\*Asunto:\*\*|Asunto:)\s*(.+)$/i);
    if (firstLineMatch) {
      extractedSubject = firstLineMatch[1].replace(/\*\*/g, '').trim();
      bodyLines = lines.slice(1);
      while (bodyLines.length > 0 && !bodyLines[0].trim()) {
        bodyLines.shift();
      }
    }
  }

  const effectiveSubject = String(subject || extractedSubject || 'Sin asunto')
    .replace(/\*\*/g, '')
    .trim();

  const cleanBodyWithoutSubjectLine = bodyLines.join('\n').trim();
  const bodyPlainNoAsterisks = cleanBodyWithoutSubjectLine.replace(/\*\*(.+?)\*\*/g, '$1');

  const fullPlainText = effectiveSubject
    ? `Asunto: ${effectiveSubject}\n\n${bodyPlainNoAsterisks}`
    : bodyPlainNoAsterisks;

  return {
    effectiveSubject,
    cleanBodyWithoutSubjectLine,
    bodyPlainNoAsterisks,
    fullPlainText,
  };
}

/**
 * Copia el correo (asunto y cuerpo) al portapapeles listo para pegar en Gmail, Outlook, etc.
 * Incluye fallback con `document.execCommand('copy')` para entornos locales (`file://`).
 *
 * @param {Object} params
 * @param {string} [params.subject=''] - Asunto del correo
 * @param {string} [params.body=''] - Cuerpo del correo
 * @param {boolean} [params.includeSubject=true] - Si se antepone la línea "Asunto: ..."
 * @returns {Promise<{ success: boolean, text: string }>}
 */
async function copyEmailToClipboard({
  subject = '',
  body = '',
  includeSubject = true,
} = {}) {
  const parsed = parseStructuredEmailBody(subject, body);

  const formattedText = includeSubject
    ? parsed.fullPlainText
    : parsed.bodyPlainNoAsterisks;

  // Intento 1: API moderna del portapapeles (contextos seguros HTTPS / localhost)
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(formattedText);
      return { success: true, text: formattedText };
    } catch {
      // Continuar al fallback clásico si falla por permisos o protocolo file://
    }
  }

  // Intento 2: Fallback clásico mediante textarea temporal y document.execCommand('copy')
  return new Promise((resolve, reject) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = formattedText;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);

      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (copied) {
        resolve({ success: true, text: formattedText });
      } else {
        reject(new Error('No se pudo copiar el texto al portapapeles.'));
      }
    } catch (error) {
      reject(error);
    }
  });
}

// ============================================================================
// 3. EMPAQUETADOR ZIP LIGERO EN JAVASCRIPT PURO (PARA .DOCX OPENXML)
// ============================================================================

/**
 * Tabla precalculada de CRC-32 (polinomio estándar IEEE 802.3: 0xEDB88320).
 */
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

/**
 * Calcula el CRC-32 de un Uint8Array.
 * @param {Uint8Array} bytes
 * @returns {number} Entero sin signo de 32 bits
 */
function computeCrc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Obtiene la fecha y hora actual codificada en formato MS-DOS para cabeceras ZIP.
 * @param {Date} [date]
 * @returns {{ dosTime: number, dosDate: number }}
 */
function getDosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

/**
 * Construye un archivo contenedor ZIP estándar (PK\x03\x04, método STORE = 0 sin compresión)
 * a partir de una lista de archivos de texto/XML.
 *
 * @param {Array<{ name: string, content: string }>} files
 * @returns {Blob}
 */
function createZipBlob(files) {
  const encoder = new TextEncoder();
  const { dosTime, dosDate } = getDosDateTime(new Date());

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const crc = computeCrc32(dataBytes);
    const size = dataBytes.length;

    // 1. Local File Header (30 bytes + longitud del nombre)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true); // Firma PK\x03\x04
    localView.setUint16(4, 20, true); // Versión requerida (2.0)
    localView.setUint16(6, 0x0800, true); // Bit 11 = UTF-8
    localView.setUint16(8, 0, true); // Método 0 = STORE (sin compresión)
    localView.setUint16(10, dosTime, true); // Hora MS-DOS
    localView.setUint16(12, dosDate, true); // Fecha MS-DOS
    localView.setUint32(14, crc, true); // CRC-32
    localView.setUint32(18, size, true); // Tamaño comprimido
    localView.setUint32(22, size, true); // Tamaño sin comprimir
    localView.setUint16(26, nameBytes.length, true); // Longitud del nombre
    localView.setUint16(28, 0, true); // Longitud campo extra
    localHeader.set(nameBytes, 30);

    // 2. Central Directory File Header (46 bytes + longitud del nombre)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);

    centralView.setUint32(0, 0x02014b50, true); // Firma PK\x01\x02
    centralView.setUint16(4, 20, true); // Versión creada por (2.0)
    centralView.setUint16(6, 20, true); // Versión requerida (2.0)
    centralView.setUint16(8, 0x0800, true); // Bit 11 = UTF-8
    centralView.setUint16(10, 0, true); // Método 0 = STORE
    centralView.setUint16(12, dosTime, true); // Hora MS-DOS
    centralView.setUint16(14, dosDate, true); // Fecha MS-DOS
    centralView.setUint32(16, crc, true); // CRC-32
    centralView.setUint32(20, size, true); // Tamaño comprimido
    centralView.setUint32(24, size, true); // Tamaño sin comprimir
    centralView.setUint16(28, nameBytes.length, true); // Longitud del nombre
    centralView.setUint16(30, 0, true); // Longitud campo extra
    centralView.setUint16(32, 0, true); // Longitud comentario
    centralView.setUint16(34, 0, true); // Número de disco
    centralView.setUint16(36, 0, true); // Atributos internos
    centralView.setUint32(38, 0, true); // Atributos externos
    centralView.setUint32(42, offset, true); // Offset relativo a la cabecera local
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, dataBytes);
    centralParts.push(centralHeader);

    offset += localHeader.length + dataBytes.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const part of centralParts) {
    centralDirSize += part.length;
  }

  // 3. End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // Firma PK\x05\x06
  eocdView.setUint16(4, 0, true); // Número de este disco
  eocdView.setUint16(6, 0, true); // Disco de inicio del directorio central
  eocdView.setUint16(8, files.length, true); // Entradas en este disco
  eocdView.setUint16(10, files.length, true); // Total de entradas
  eocdView.setUint32(12, centralDirSize, true); // Tamaño del directorio central
  eocdView.setUint32(16, centralDirOffset, true); // Offset de inicio del directorio central
  eocdView.setUint16(20, 0, true); // Longitud del comentario ZIP

  return new Blob([...localParts, ...centralParts, eocd], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

// ============================================================================
// 4. GENERACIÓN Y DESCARGA DE ARCHIVOS WORD (.DOCX OPENXML)
// ============================================================================

/**
 * Construye los archivos XML del paquete OpenXML para el correo electrónico.
 *
 * @param {Object} data
 * @param {string} data.senderName
 * @param {string} data.recipientName
 * @param {string} data.subject
 * @param {string} data.body
 * @param {string} data.dateStr
 * @returns {Array<{ name: string, content: string }>}
 */
function buildDocxOpenXmlFiles({ senderName, recipientName, subject, body, dateStr }) {
  const parsed = parseStructuredEmailBody(subject, body);
  const safeSender = escapeXml(senderName || 'Remitente no especificado');
  const safeRecipient = escapeXml(recipientName || 'Destinatario no especificado');
  const safeSubject = escapeXml(parsed.effectiveSubject || 'Sin asunto');
  const safeDate = escapeXml(resolveDateString(dateStr));

  // 1. [Content_Types].xml
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  // 2. _rels/.rels
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  // 3. word/_rels/document.xml.rels
  const documentRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // 4. word/styles.xml (Tipografía limpia Calibri/Arial y color #26261F del sistema de diseño)
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Arial" w:eastAsia="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:color w:val="26261F"/>
        <w:lang w:val="es-ES" w:eastAsia="es-ES" w:bidi="ar-SA"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="160" w:line="300" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="EmailSubject">
    <w:name w:val="Email Subject"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:spacing w:before="0" w:after="180" w:line="280" w:lineRule="auto"/>
      <w:pBdr>
        <w:bottom w:val="single" w:sz="18" w:space="8" w:color="E9BB3C"/>
      </w:pBdr>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="32"/>
      <w:szCs w:val="32"/>
      <w:color w:val="26261F"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="EmailMeta">
    <w:name w:val="Email Meta"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:spacing w:before="40" w:after="40" w:line="260" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr>
      <w:sz w:val="20"/>
      <w:szCs w:val="20"/>
      <w:color w:val="26261F"/>
    </w:rPr>
  </w:style>
</w:styles>`;

  // Procesar párrafos del cuerpo del correo (soportando **negrita** como <w:b/>)
  const normalizedBody = parsed.cleanBodyWithoutSubjectLine;
  const rawParagraphs = normalizedBody.split(/\n{2,}/);

  const bodyParagraphsXml = rawParagraphs
    .map((block) => {
      const lines = block.split('\n');
      const runsXml = lines
        .map((line, idx) => {
          const brTag = idx > 0 ? '<w:br/>' : '';
          const segments = line.split(/(\*\*.*?\*\*)/g).filter(Boolean);
          if (segments.length === 0) {
            return `<w:r>${brTag}<w:t xml:space="preserve"></w:t></w:r>`;
          }
          return segments
            .map((seg, segIdx) => {
              const firstBr = segIdx === 0 ? brTag : '';
              if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
                const boldText = escapeXml(seg.slice(2, -2));
                return `<w:r>${firstBr}<w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${boldText}</w:t></w:r>`;
              }
              return `<w:r>${firstBr}<w:t xml:space="preserve">${escapeXml(seg)}</w:t></w:r>`;
            })
            .join('');
        })
        .join('');

      return `    <w:p>
      <w:pPr>
        <w:spacing w:after="200" w:line="310" w:lineRule="auto"/>
      </w:pPr>
      ${runsXml}
    </w:p>`;
    })
    .join('\n');

  // 5. word/document.xml
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="EmailSubject"/>
      </w:pPr>
      <w:r>
        <w:t xml:space="preserve">${safeSubject}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="EmailMeta"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:b/><w:color w:val="6B6A65"/></w:rPr>
        <w:t xml:space="preserve">Para: </w:t>
      </w:r>
      <w:r>
        <w:t xml:space="preserve">${safeRecipient}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="EmailMeta"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:b/><w:color w:val="6B6A65"/></w:rPr>
        <w:t xml:space="preserve">De: </w:t>
      </w:r>
      <w:r>
        <w:t xml:space="preserve">${safeSender}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="EmailMeta"/>
        <w:spacing w:before="40" w:after="280"/>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="6" w:space="12" w:color="E2DFD7"/>
        </w:pBdr>
      </w:pPr>
      <w:r>
        <w:rPr><w:b/><w:color w:val="6B6A65"/></w:rPr>
        <w:t xml:space="preserve">Fecha: </w:t>
      </w:r>
      <w:r>
        <w:t xml:space="preserve">${safeDate}</w:t>
      </w:r>
    </w:p>
${bodyParagraphsXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  return [
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: rootRelsXml },
    { name: 'word/_rels/document.xml.rels', content: documentRelsXml },
    { name: 'word/styles.xml', content: stylesXml },
    { name: 'word/document.xml', content: documentXml },
  ];
}

/**
 * Genera y descarga un archivo `.docx` real (OpenXML ZIP) 100% compatible con
 * Microsoft Word, LibreOffice y Google Docs.
 *
 * @param {Object} params
 * @param {string} [params.senderName] - Nombre del remitente
 * @param {string} [params.recipientName] - Nombre del destinatario
 * @param {string} [params.subject] - Asunto del correo
 * @param {string} [params.body] - Cuerpo del correo
 * @param {string} [params.dateStr] - Fecha formateada opcional
 * @returns {{ success: boolean, filename: string }}
 */
function exportToDocx({
  senderName = '',
  recipientName = '',
  subject = '',
  body = '',
  dateStr = '',
} = {}) {
  const parsed = parseStructuredEmailBody(subject, body);
  const xmlFiles = buildDocxOpenXmlFiles({
    senderName,
    recipientName,
    subject: parsed.effectiveSubject,
    body,
    dateStr,
  });

  const zipBlob = createZipBlob(xmlFiles);
  const filename = sanitizeFilename(parsed.effectiveSubject, 'docx');
  triggerBrowserDownload(zipBlob, filename);

  return { success: true, filename };
}

// ============================================================================
// 5. GENERACIÓN Y DESCARGA DE ARCHIVOS PDF (VÍA JSPDF)
// ============================================================================

/**
 * Genera y descarga un documento `.pdf` en formato A4 vertical con maquetación
 * editorial acorde al sistema de diseño (`#26261f` y acento `#e9bb3c`).
 *
 * @param {Object} params
 * @param {string} [params.senderName] - Nombre del remitente
 * @param {string} [params.recipientName] - Nombre del destinatario
 * @param {string} [params.subject] - Asunto del correo
 * @param {string} [params.body] - Cuerpo del correo
 * @param {string} [params.dateStr] - Fecha formateada opcional
 * @returns {{ success: boolean, filename: string }}
 */
function exportToPdf({
  senderName = '',
  recipientName = '',
  subject = '',
  body = '',
  dateStr = '',
} = {}) {
  const JsPdfConstructor =
    (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) ||
    (typeof window !== 'undefined' && window.jsPDF);

  if (!JsPdfConstructor) {
    throw new Error(
      'La librería jsPDF no está disponible en la página. Verifica que el script CDN de jsPDF se haya cargado.'
    );
  }

  const doc = new JsPdfConstructor({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const marginX = 22;
  const marginTop = 24;
  const marginBottom = 24;
  const contentWidth = pageWidth - marginX * 2;

  const parsed = parseStructuredEmailBody(subject, body);
  const cleanSubject = parsed.effectiveSubject;
  const cleanRecipient = String(recipientName || 'Destinatario no especificado').trim();
  const cleanSender = String(senderName || 'Remitente no especificado').trim();
  const cleanDate = resolveDateString(dateStr);
  const cleanBody = parsed.bodyPlainNoAsterisks;

  let cursorY = marginTop;

  // 1. Detalle superior de marca en color mostaza (#e9bb3c)
  doc.setFillColor(233, 187, 60);
  doc.rect(marginX, cursorY - 6, 26, 2.2, 'F');

  // 2. Asunto principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(38, 38, 31); // #26261f

  const subjectLines = doc.splitTextToSize(cleanSubject, contentWidth);
  doc.text(subjectLines, marginX, cursorY + 3);
  cursorY += subjectLines.length * 7 + 4;

  // 3. Caja formal de metadatos (Para, De, Fecha)
  const metaStartY = cursorY;
  const metaRows = [
    { label: 'Para:', value: cleanRecipient },
    { label: 'De:', value: cleanSender },
    { label: 'Fecha:', value: cleanDate },
  ];

  // Calcular altura dinámica de los metadatos
  const labelWidth = 18;
  const metaValueWidth = contentWidth - labelWidth - 8;
  let totalMetaHeight = 8;

  const preparedMetaRows = metaRows.map((row) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const wrappedValue = doc.splitTextToSize(row.value, metaValueWidth);
    const rowHeight = Math.max(wrappedValue.length * 4.6, 5.5);
    totalMetaHeight += rowHeight;
    return { ...row, wrappedValue, rowHeight };
  });

  // Fondo verde salvia suave (#EFF5F2 -> RGB 239, 245, 242) para el bloque de cabecera con borde izquierdo ámbar (#B45309 -> RGB 180, 83, 9)
  doc.setFillColor(239, 245, 242);
  doc.roundedRect(marginX, metaStartY, contentWidth, totalMetaHeight, 2, 2, 'F');
  doc.setFillColor(180, 83, 9);
  doc.rect(marginX, metaStartY, 1.4, totalMetaHeight, 'F');

  let metaCursorY = metaStartY + 6;
  for (const row of preparedMetaRows) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(107, 106, 101); // Gris cálido
    doc.text(row.label, marginX + 5, metaCursorY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(38, 38, 31); // #26261f
    doc.text(row.wrappedValue, marginX + 5 + labelWidth, metaCursorY);

    metaCursorY += row.rowHeight;
  }

  cursorY = metaStartY + totalMetaHeight + 6;

  // 4. Línea divisoria elegante
  doc.setDrawColor(226, 223, 215);
  doc.setLineWidth(0.35);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
  cursorY += 10;

  // 5. Cuerpo del correo con paginación automática
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(38, 38, 31);

  const lineHeight = 5.8;
  const paragraphGap = 4.2;
  const maxBodyY = pageHeight - marginBottom;

  const paragraphs = cleanBody.split('\n');

  for (const paragraph of paragraphs) {
    // Línea en blanco (salto de párrafo)
    if (!paragraph.trim()) {
      cursorY += paragraphGap;
      if (cursorY > maxBodyY) {
        doc.addPage();
        cursorY = marginTop;
      }
      continue;
    }

    const wrappedLines = doc.splitTextToSize(paragraph, contentWidth);

    for (const line of wrappedLines) {
      if (cursorY + lineHeight > maxBodyY) {
        doc.addPage();
        cursorY = marginTop;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(38, 38, 31);
      }
      doc.text(line, marginX, cursorY);
      cursorY += lineHeight;
    }

    cursorY += paragraphGap * 0.5;
  }

  // 6. Pie de página discreto con numeración en todas las páginas
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);

    const footerLineY = pageHeight - 16;
    doc.setDrawColor(235, 232, 224);
    doc.setLineWidth(0.25);
    doc.line(marginX, footerLineY, pageWidth - marginX, footerLineY);

    // Punto de acento mostaza en el pie
    doc.setFillColor(233, 187, 60);
    doc.circle(marginX + 1.2, footerLineY + 5, 1, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(135, 133, 126);
    doc.text('Correo formal exportado', marginX + 4, footerLineY + 5.8);

    const pageLabel = `Página ${pageNum} de ${totalPages}`;
    doc.text(pageLabel, pageWidth - marginX, footerLineY + 5.8, { align: 'right' });
  }

  const filename = sanitizeFilename(cleanSubject, 'pdf');
  doc.save(filename);

  return { success: true, filename };
}

if (typeof window !== 'undefined') {
  window.TeacherMailApp = window.TeacherMailApp || {};
  Object.assign(window.TeacherMailApp, {
    sanitizeFilename,
    copyEmailToClipboard,
    exportToDocx,
    exportToPdf,
  });
}
})();
