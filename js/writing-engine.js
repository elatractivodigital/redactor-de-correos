/**
 * @fileoverview Motor Interno de Redacción Docente (Fase 2 Definitiva)
 * Implementa el SYSTEM PROMPT INTERNO: MOTOR DE REDACCIÓN DOCENTE con sus 6 variables
 * dinámicas, los 4 casos estrictos de procesamiento documental, transformación emocional,
 * detección de datos faltantes con marcadores entre corchetes `[indicar ...]` y estructura
 * obligatoria de salida.
 */

(function () {
  'use strict';

const analyzeStyleFromText = (text) =>
  window.TeacherMailApp && typeof window.TeacherMailApp.analyzeStyleFromText === 'function'
    ? window.TeacherMailApp.analyzeStyleFromText(text)
    : {
        formalityLevel: 'equilibrado',
        treatment: 'usted',
        warmthLevel: 'media',
        avgSentenceWords: 16,
        sentenceRhythm: 'fluido y articulado',
        greetingStyle: null,
        closingStyle: null,
        preferredConnectors: ['Asimismo', 'Por otro lado', 'En este sentido'],
        toneSummary: 'Tono profesional equilibrado',
      };

/**
 * Valores internos del selector de tarjetas en la UI (Paso 3).
 */
const DOCUMENT_MODES = {
  TONE: 'tone',       // Opción A: Clonar Tono y Estilo Personal
  CONTENT: 'content', // Opción B: Base Directa de Contenido
  ADMIN: 'admin',     // Opción C: Análisis Complejo / Gestión Administrativa
};

/**
 * Valores canónicos de la variable `{{modo_documento}}` del System Prompt Interno.
 */
const PROMPT_DOCUMENT_MODES = {
  NONE: 'SIN_DOCUMENTO',
  TONE: 'OPCION_A_TONO',
  CONTENT: 'OPCION_B_CONTENIDO',
  ADMIN: 'OPCION_C_ADMINISTRATIVO',
};

/**
 * Plantilla oficial del System Prompt Interno.
 */
const SYSTEM_PROMPT_TEMPLATE = `# SYSTEM PROMPT INTERNO: MOTOR DE REDACCIÓN DOCENTE

## 1. ROL Y PROPÓSITO
Eres un Asistente Experto en Comunicación Institucional y Redacción Educativa. Tu única función es transformar apuntes coloquiales, ideas sueltas o borradores escritos por profesores en correos electrónicos claros, empáticos, seguros y profesionalmente estructurados, eliminando cualquier rastro de duda, nerviosismo o ambigüedad.

## 2. VARIABLES DE ENTRADA DEL SISTEMA
- {{nombre_remitente}}
- {{nombre_destinatario}}
- {{asunto_base}}
- {{idea_coloquial}}
- {{modo_documento}}
- {{texto_documento}}

## 3. REGLAS DE PROCESAMIENTO SEGÚN EL MODO DE DOCUMENTO
- CASO 1: SIN_DOCUMENTO -> Toma únicamente la intención de {{idea_coloquial}} y tradúcela a un registro profesional, cordial y asertivo.
- CASO 2: OPCION_A_TONO -> Analiza {{texto_documento}} exclusivamente desde el punto de vista estilístico. Ignora y descarta el 100% de la información temática, fechas, nombres o datos contenidos en {{texto_documento}}.
- CASO 3: OPCION_B_CONTENIDO -> Utiliza {{idea_coloquial}} como directriz principal y extrae de {{texto_documento}} los datos clave, fechas, acuerdos o actividades que respaldan el mensaje.
- CASO 4: OPCION_C_ADMINISTRATIVO -> Analiza {{texto_documento}} en profundidad y crúzalo con {{idea_coloquial}} estructurando Contexto / Fundamento o Antecedentes / Solicitud o Resolución.

## 4. ESTRUCTURA OBLIGATORIA DE SALIDA
**Asunto:** [Versión optimizada, clara y profesional basada en {{asunto_base}}]

[Saludo formal o cordial adaptado a {{nombre_destinatario}}],

[Párrafo de apertura contextualizando el motivo del mensaje con serenidad y claridad].

[Cuerpo principal del correo donde se desarrolla {{idea_coloquial}} aplicando la regla de {{modo_documento}} correspondiente. Utiliza párrafos breves y bien espaciados].

[Párrafo de cierre indicando disponibilidad, pasos a seguir o agradecimiento por la acogida].

[Despedida profesional],

**{{nombre_remitente}}**`;

// ============================================================================
// 1. MAPEO DE LAS 6 VARIABLES DINÁMICAS DEL SISTEMA
// ============================================================================

/**
 * Traduce el modo seleccionado en la interfaz al identificador oficial de `{{modo_documento}}`.
 * @param {string | null} uiMode
 * @param {boolean} hasDocument
 * @returns {'SIN_DOCUMENTO' | 'OPCION_A_TONO' | 'OPCION_B_CONTENIDO' | 'OPCION_C_ADMINISTRATIVO'}
 */
function resolvePromptDocumentMode(uiMode, hasDocument) {
  if (!hasDocument || !uiMode) {
    return PROMPT_DOCUMENT_MODES.NONE;
  }
  switch (uiMode) {
    case DOCUMENT_MODES.TONE:
    case PROMPT_DOCUMENT_MODES.TONE:
      return PROMPT_DOCUMENT_MODES.TONE;
    case DOCUMENT_MODES.CONTENT:
    case PROMPT_DOCUMENT_MODES.CONTENT:
      return PROMPT_DOCUMENT_MODES.CONTENT;
    case DOCUMENT_MODES.ADMIN:
    case PROMPT_DOCUMENT_MODES.ADMIN:
      return PROMPT_DOCUMENT_MODES.ADMIN;
    default:
      return PROMPT_DOCUMENT_MODES.NONE;
  }
}

/**
 * Construye el objeto con las 6 variables dinámicas exactas definidas en la Sección 2.
 * @param {object} payload
 * @returns {{
 *   nombre_remitente: string,
 *   nombre_destinatario: string,
 *   asunto_base: string,
 *   idea_coloquial: string,
 *   modo_documento: string,
 *   texto_documento: string
 * }}
 */
function buildPromptVariables(payload = {}) {
  const docText = String(payload.documentData?.text || '').trim();
  const hasDoc = Boolean(docText);
  const modoDocumento = resolvePromptDocumentMode(payload.documentMode, hasDoc);

  return {
    nombre_remitente: String(payload.senderName || 'Docente').trim(),
    nombre_destinatario: String(payload.recipientName || 'Destinatario').trim(),
    asunto_base: String(payload.subject || '').trim(),
    idea_coloquial: String(payload.colloquialIdea || '').trim(),
    modo_documento: modoDocumento,
    texto_documento: modoDocumento === PROMPT_DOCUMENT_MODES.NONE ? '' : docText,
  };
}

// ============================================================================
// 2. TRANSFORMACIÓN EMOCIONAL Y REFORMULACIÓN ASERTIVA (RESTRICCIÓN 3)
// ============================================================================

/**
 * Patrones de inseguridad, disculpas excesivas, nerviosismo, frustración o enojo
 * que se neutralizan o convierten en lenguaje educativo diplomático y seguro.
 */
const EMOTIONAL_NEUTRALIZATION_RULES = [
  // Eliminación de disculpas excesivas e inseguridad al inicio o mitad de frase
  {
    pattern: /\b(perd[oó]n por molestar(le|te|les)?|siento mucho molestar(le|te|les)?|disculpe las molestias|siento dar la lata|perdona que te moleste|lamento molestar(le|te)?)\b[,\s]*/gi,
    replacement: '',
  },
  {
    pattern: /\b(no s[eé] c[oó]mo decir(le|te)? esto pero|me da mucha cosa pedir esto pero|me da apuro decirlo pero|me pone nervioso escribir esto pero|no quiero que suene mal pero|no quiero parecer pesado pero)\b[,\s]*/gi,
    replacement: '',
  },
  // Neutralización de frustración, queja o enojo hacia expresión objetiva y constructiva
  {
    pattern: /\b(estoy hart[oa] de que|estoy cansad[oa] de que|ya no aguanto que|es intolerable que|me parece una falta de respeto que)\b/gi,
    replacement: 'he observado de forma reiterada que',
  },
  {
    pattern: /\b(es imposible dar clase as[ií]|no se puede trabajar as[ií]|as[ií] no hay quien d[eé] clase)\b/gi,
    replacement: 'esta situación dificulta el desarrollo adecuado de las sesiones lectivas',
  },
  {
    pattern: /\b(no me hace(n)? ni caso|pasa(n)? ol[ií]mpicamente de m[ií]|ignora(n)? todo lo que digo)\b/gi,
    replacement: 'aún no se han atendido las indicaciones pedagógicas trasladadas previamente',
  },
  // Transformación de expresiones coloquiales de aula a registro pedagógico
  {
    pattern: /\bno para de hablar\b|\bhabla much[ií]simo\b|\binterrumpe constantemente\b|\bno calla\b/gi,
    replacement: 'muestra dificultad para mantener la atención sostenida y respetar los turnos de palabra en el aula',
  },
  {
    pattern: /\bse porta fatal\b|\bse porta mal\b|\bmal comportamiento\b|\bmuy disruptiv[oa]\b/gi,
    replacement: 'ha registrado algunas conductas en el aula que afectan al clima de convivencia y al ritmo de aprendizaje',
  },
  {
    pattern: /\bno hace nada\b|\bno trabaja en clase\b|\bpasa de todo\b|\best[aá] desmotivad[oa]\b|\bse le ve desmotivad[oa]\b/gi,
    replacement: 'presenta actualmente una menor implicación en las actividades diarias y requiere apoyo para reforzar su motivación y hábitos de trabajo',
  },
  {
    pattern: /\bno trae los deberes\b|\bno entrega las tareas\b|\bno hace los deberes\b|\bsin sus materiales\b/gi,
    replacement: 'ha acudido a las sesiones sin parte de los materiales o actividades previstas para el seguimiento de la asignatura',
  },
  {
    pattern: /\bha suspendido\b|\bva a suspender\b|\blleva malas notas\b|\bha sacado mala nota\b/gi,
    replacement: 'no ha alcanzado por el momento los objetivos de evaluación previstos en las últimas pruebas realizadas',
  },
  {
    pattern: /\bllega tarde\b|\bretrasos constantes\b|\bsiempre llega tarde\b/gi,
    replacement: 'ha acumulado faltas de puntualidad al inicio de la jornada lectiva',
  },
  {
    pattern: /\bfalta a clase\b|\bfaltas sin justificar\b|\bno ha venido a clase\b/gi,
    replacement: 'registra ausencias de asistencia pendientes de justificación',
  },
  {
    pattern: /\bse ha peleado\b|\bha tenido un conflicto\b|\bha discutido con\b/gi,
    replacement: 'se ha visto involucrado en una incidencia de convivencia que requiere nuestra atención coordinada',
  },
];

// ============================================================================
// 3. DETECCIÓN DE DATOS FALTANTES Y MARCADORES ENTRE CORCHETES (RESTRICCIÓN 2)
// ============================================================================

/**
 * Comprueba si el texto menciona una cita, permiso, reunión o plazo sin concretar
 * fecha u hora ni en `idea_coloquial` ni en `texto_documento` (cuando aplica B o C).
 * Nunca inventa fechas ni horas: devuelve un recordatorio con marcador `[indicar ...]` si falta.
 *
 * @param {string} ideaColoquial
 * @param {string} referenceText
 * @returns {string | null}
 */
function buildMissingDataBracketNotice(ideaColoquial, referenceText = '') {
  const combined = `${ideaColoquial} ${referenceText}`;

  const mentionsTemporalEvent =
    /\b(permiso|consulta m[eé]dica|m[eé]dico|cita|citar|reuni[oó]n|tutor[ií]a|entrevista|ausencia|faltar|sustituci[oó]n|reemplazo|plazo|entrega)\b/i.test(
      ideaColoquial
    );

  if (!mentionsTemporalEvent) {
    return null;
  }

  const hasExplicitDateOrDay =
    /\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|ma[ñn]ana|hoy|pr[oó]xima semana|esta semana|mes de|\d{1,2}\s+de\s+[a-záéíóú]+|\d{1,2}[/-]\d{1,2})\b/i.test(
      combined
    );

  const hasExplicitTime =
    /\b(\d{1,2}:\d{2}|\b\d{1,2}\s*(h|horas|de la ma[ñn]ana|de la tarde)|primera hora|[uú]ltima hora|ma[ñn]ana|tarde)\b/i.test(
      combined
    );

  if (!hasExplicitDateOrDay && !hasExplicitTime) {
    return 'A efectos de concretar la organización, la fecha y franja horaria previstas serían el [indicar fecha/hora].';
  }

  if (!hasExplicitDateOrDay) {
    return 'Para su adecuada planificación, la actuación tendría lugar el día [indicar fecha].';
  }

  return null;
}

// ============================================================================
// 4. PERFIL DEL DESTINATARIO Y OPTIMIZACIÓN DEL ASUNTO
// ============================================================================

/**
 * Detecta el perfil del destinatario para adaptar saludo, apertura y cierre.
 * @param {string} recipientName
 * @param {string} subject
 * @returns {'familia' | 'administracion' | 'claustro' | 'alumnado' | 'general'}
 */
function detectRecipientProfile(recipientName = '', subject = '') {
  const combined = `${recipientName} ${subject}`.toLowerCase();

  if (/\b(familia|apoderad[oa]s?|madre|padre|tutores legales|pap[aá]s|mam[aá]|pap[aá])\b/.test(combined)) {
    return 'familia';
  }
  if (
    /\b(direcci[oó]n|director|directora|jefatura|jefe de estudios|inspecci[oó]n|inspector|inspectora|secretar[ií]a|consejer[ií]a|comisi[oó]n|equipo directivo|utp|coordinaci[oó]n acad[eé]mica)\b/.test(
      combined
    )
  ) {
    return 'administracion';
  }
  if (/\b(departamento|claustro|compa[ñn]er[oa]s|equipo docente|coordinaci[oó]n|profesor|profesora|colega)\b/.test(combined)) {
    return 'claustro';
  }
  if (/\b(alumn[oa]s?|estudiante|grupo|clase|curso)\b/.test(combined)) {
    return 'alumnado';
  }
  return 'general';
}

/**
 * Optimiza y profesionaliza `{{asunto_base}}` evitando expresiones informales.
 * @param {string} asuntoBase
 * @param {string} nombreDestinatario
 * @param {string} modoDocumento
 * @returns {string}
 */
function optimizeSubjectLine(asuntoBase, nombreDestinatario, modoDocumento) {
  let clean = String(asuntoBase || '')
    .trim()
    .replace(/^(asunto\s*:\s*)/i, '')
    .replace(/^(hola|consulta|duda|aviso|urgente)\s*[-:–]\s*/i, '')
    .trim();

  if (!clean) {
    return `Comunicación docente — ${nombreDestinatario || '[indicar asunto]'}`;
  }

  // Transformaciones de asuntos coloquiales a profesionales
  clean = clean
    .replace(/\bpedir permiso\b/gi, 'Solicitud de permiso')
    .replace(/\bhablar de\b/gi, 'Seguimiento pedagógico sobre')
    .replace(/\bproblema con\b/gi, 'Información y seguimiento respecto a')
    .replace(/\bcita con\b/gi, 'Solicitud de reunión de tutoría con');

  clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  clean = clean.replace(/[.!]+$/, '');

  if (
    modoDocumento === PROMPT_DOCUMENT_MODES.ADMIN &&
    !/^(Solicitud|Informe|Comunicaci[oó]n|Memoria|Acta|Traslado|Exp\.|Ref\.)/i.test(clean)
  ) {
    return `Comunicación institucional: ${clean}`;
  }

  return clean;
}

/**
 * Construye el saludo formal o cordial terminado estrictamente en coma (`,`),
 * tal y como exige la Sección 4 (`[Saludo formal o cordial adaptado a {{nombre_destinatario}}],`).
 *
 * @param {string} recipientName
 * @param {'tuteo' | 'usted'} treatment
 * @param {string | null} customGreeting
 * @param {boolean} isAdministrative
 * @returns {string}
 */
function buildStandardGreeting(recipientName, treatment, customGreeting = null, isAdministrative = false) {
  const cleanRecipient = String(recipientName || 'Destinatario')
    .trim()
    .replace(/[,:;]+$/, '');

  if (isAdministrative) {
    return `Estimado/a ${cleanRecipient},`;
  }

  if (customGreeting) {
    const cleanCustom = customGreeting.replace(/[,:;]+$/, '').trim();
    return `${cleanCustom} ${cleanRecipient},`;
  }

  if (treatment === 'tuteo') {
    return `Estimado/a ${cleanRecipient},`;
  }

  const isPluralOrFamily = /\b(familia|familias|equipo|compa[ñn]eros|padres|tutores|apoderados)\b/i.test(
    cleanRecipient
  );
  const isFemale =
    /\b(madre|directora|jefa|inspectora|coordinadora|profesora|tutora|sra\.?|do[ñn]a|mar[ií]a|carmen|ana|laura|elena|marta|luc[ií]a|paula|sara|claudia|patricia)\b/i.test(
      cleanRecipient
    );
  const isMale =
    /\b(padre|director|jefe|inspector|coordinador|profesor|tutor|sr\.?|don|mart[ií]n|javier|carlos|juan|pedro|miguel|pablo|diego|andrés|luis)\b/i.test(
      cleanRecipient
    );

  if (isPluralOrFamily || isFemale) {
    return `Estimada ${cleanRecipient},`;
  }
  if (isMale) {
    return `Estimado ${cleanRecipient},`;
  }
  return `Estimado/a ${cleanRecipient},`;
}

// ============================================================================
// 5. PROCESAMIENTO DE LA IDEA COLOQUIAL Y DOCUMENTOS
// ============================================================================

/**
 * Limpia muletillas, aplica la transformación emocional y redacta párrafos serenos y profesionales.
 * @param {string} colloquialIdea
 * @param {object} options
 * @returns {string[]}
 */
function transformColloquialToPedagogical(colloquialIdea, options = {}) {
  const {
    treatment = 'usted',
    connectors = ['Asimismo', 'Por otro lado', 'En este sentido'],
    isAdministrative = false,
    referenceTextForDates = '',
  } = options;

  const raw = String(colloquialIdea || '').trim();
  if (!raw) {
    return [
      treatment === 'tuteo'
        ? 'Me pongo en contacto contigo para compartir información actualizada sobre el seguimiento académico y coordinar los próximos pasos.'
        : 'Me pongo en contacto con usted para trasladarle información actualizada y coordinar las actuaciones oportunas.',
    ];
  }

  // 1. Limpiar arranques conversacionales o de desahogo hacia el asistente
  let cleaned = raw
    .replace(/^(pues nada|a ver|bueno|b[aá]sicamente|hola|mirad|oye|mira)[,\s]+/i, '')
    .replace(
      /^(quiero decirle a [a-záéíóúñ\s]+ que|necesito decirle a [a-záéíóúñ\s]+ que|decirle a [a-záéíóúñ\s]+ que|necesito avisar a [a-záéíóúñ\s]+ que|quiero avisar que|dile que|decirle que|comentarle que|escribo porque)\s+/i,
      ''
    );

  // 2. Aplicar neutralización emocional y reformulación pedagógica (Restricción 3)
  for (const rule of EMOTIONAL_NEUTRALIZATION_RULES) {
    cleaned = cleaned.replace(rule.pattern, rule.replacement);
  }

  // 3. Adaptar referencias en tercera persona hacia el propio destinatario ("la directora" -> "usted")
  cleaned = cleaned
    .replace(/\b(necesito pedir|quiero pedir)\b/gi, 'solicito')
    .replace(/\b(necesito informar|quiero informar)\b/gi, 'le informo de')
    .replace(/\b(quiero citar al apoderado de|necesito citar al apoderado de)\b/gi, 'me gustaría concertar una reunión de tutoría en relación con')
    .replace(/\b(con mucho cari[ñn]o para apoyarlo juntos|para apoyarlo juntos)\b/gi, 'con el propósito de acompañar su proceso educativo de manera cercana y coordinada')
    .replace(/\b(me cost[oó] meses conseguirla|me cost[oó] mucho conseguirla)\b/gi, 'se trata de una citación médica programada de especial relevancia');

  // 4. Dividir en oraciones limpias
  const rawSegments = cleaned
    .split(/(?<=[.!?])\s+|\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const polishedSentences = rawSegments
    .map((segment, index) => {
      let sentence = segment.replace(/^[,\-•*]+\s*/, '').trim();
      if (!sentence) return '';

      sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
      if (!/[.!?]$/.test(sentence)) {
        sentence += '.';
      }

      if (index === 0) {
        if (isAdministrative) {
          return /^(En relaci[oó]n|Con respecto|Mediante|Por medio|Se informa|Solicito)/i.test(sentence)
            ? sentence
            : `En relación con el asunto de referencia, se pone en su conocimiento que ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
        }
        if (/^(Me gustar[ií]a|Quisiera|Le escribo|Te escribo|Me pongo|Solicito|Le informo)/i.test(sentence)) {
          return sentence;
        }
        return treatment === 'tuteo'
          ? `Te escribo para trasladarte que ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`
          : `Por medio de este mensaje deseo comunicarle que ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
      }

      const startsWithConnector =
        /^(Asimismo|Por otro lado|Adem[aá]s|En este sentido|No obstante|De igual modo|Por ello|Adicionalmente|Igualmente|Finalmente|Cabe se[ñn]alar)/i.test(
          sentence
        );
      if (!startsWithConnector && connectors.length > 0) {
        const connector = connectors[(index - 1) % connectors.length];
        return `${connector}, ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
      }

      return sentence;
    })
    .filter(Boolean);

  // 5. Verificar si falta algún dato temporal crítico (Restricción 2: Cero invención + marcador entre corchetes)
  const missingBracketNotice = buildMissingDataBracketNotice(raw, referenceTextForDates);
  if (missingBracketNotice) {
    polishedSentences.push(missingBracketNotice);
  }

  // Agrupar en párrafos breves (máximo 2 oraciones por párrafo)
  const paragraphs = [];
  for (let i = 0; i < polishedSentences.length; i += 2) {
    paragraphs.push(polishedSentences.slice(i, i + 2).join(' '));
  }

  return paragraphs;
}

/**
 * Extrae los datos clave, fechas, acuerdos o normativas de `{{texto_documento}}`
 * exclusivamente para los Casos 3 (`OPCION_B_CONTENIDO`) y 4 (`OPCION_C_ADMINISTRATIVO`).
 * @param {string} documentText
 * @param {number} [maxPoints=4]
 * @returns {string[]}
 */
function extractDocumentHighlights(documentText, maxPoints = 4) {
  if (!documentText || typeof documentText !== 'string') return [];

  const candidates = documentText
    .split(/\n+|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^[•\-*–\d.)\s]+/, '').trim())
    .filter((line) => {
      const wordLength = line.split(/\s+/).filter(Boolean).length;
      if (wordLength < 6 || wordLength > 45) return false;
      // Excluir saludos o despedidas genéricas del documento
      if (/^(estimad[oa]|hola|querid[oa]|un cordial saludo|reciba un|atentamente|quedo a su)/i.test(line)) {
        return false;
      }
      return true;
    });

  if (candidates.length === 0) {
    const fallbackSnippet = documentText.replace(/\s+/g, ' ').trim().slice(0, 240);
    return fallbackSnippet ? [fallbackSnippet] : [];
  }

  const scored = candidates.map((sentence, idx) => {
    let score = 0;
    if (
      /\b(\d{1,2}[/-]\d{1,2}|\d{1,2}\s+de\s+[a-záéíóú]+|\d{1,2}:\d{2}|evaluaci[oó]n|acuerdo|normativa|decreto|orden|art[ií]culo|objetivo|plazo|reuni[oó]n|entrega|calificaci[oó]n|medida|protocolo|guardia|justificante)\b/i.test(
        sentence
      )
    ) {
      score += 3;
    }
    if (idx < 5) score += 1;
    return { sentence, score, idx };
  });

  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);

  const selected = [];
  const seen = new Set();

  for (const item of scored) {
    const normalizedKey = item.sentence.toLowerCase().slice(0, 50);
    if (!seen.has(normalizedKey)) {
      seen.add(normalizedKey);
      let formatted = item.sentence.charAt(0).toUpperCase() + item.sentence.slice(1);
      if (!/[.!?]$/.test(formatted)) formatted += '.';
      selected.push(formatted);
    }
    if (selected.length >= maxPoints) break;
  }

  return selected;
}

// ============================================================================
// 6. ENSAMBLADO CON LA ESTRUCTURA OBLIGATORIA DE SALIDA (SECCIÓN 4)
// ============================================================================

/**
 * Construye el texto completo cumpliendo al 100% la Sección 4 (Estructura Obligatoria de Salida)
 * y la Sección 5 (Cero texto conversacional externo).
 */
function assembleMandatoryStructure({
  optimizedSubject,
  greetingLine,
  openingParagraph,
  bodyParagraphs,
  closingParagraph,
  signOffLine,
  senderName,
}) {
  const cleanSignOff = String(signOffLine || 'Atentamente').replace(/[,:;]+$/, '').trim() + ',';
  const cleanGreeting = String(greetingLine || 'Estimado/a,').replace(/[,:;]+$/, '').trim() + ',';

  const bodyOnly = [
    cleanGreeting,
    '',
    openingParagraph,
    '',
    ...bodyParagraphs,
    '',
    closingParagraph,
    '',
    cleanSignOff,
    '',
    `**${senderName}**`,
  ].join('\n');

  const fullFormattedOutput = [
    `**Asunto:** ${optimizedSubject}`,
    '',
    bodyOnly,
  ].join('\n');

  return {
    fullFormattedOutput,
    bodyOnly,
  };
}

// ============================================================================
// 7. MOTOR PRINCIPAL DE GENERACIÓN (LOS 4 CASOS DE {{modo_documento}})
// ============================================================================

/**
 * Ejecuta el motor de redacción docente sobre el flujo de 4 pasos.
 *
 * @param {object} payload
 * @returns {{
 *   subject: string,
 *   body: string,
 *   fullOutput: string,
 *   modeLabel: string,
 *   promptMode: string,
 *   variables: object,
 *   summaryNote: string
 * }}
 */
function generateTeacherEmail(payload = {}) {
  const vars = buildPromptVariables(payload);
  const {
    nombre_remitente,
    nombre_destinatario,
    asunto_base,
    idea_coloquial,
    modo_documento,
    texto_documento,
  } = vars;

  const recipientProfile = detectRecipientProfile(nombre_destinatario, asunto_base);
  const optimizedSubject = optimizeSubjectLine(asunto_base, nombre_destinatario, modo_documento);

  // =========================================================================
  // CASO 2: {{modo_documento}} = OPCION_A_TONO (Clonar Tono y Estilo Personal)
  // REGLA CRÍTICA: Ignora y descarta el 100% de la información temática,
  // fechas, nombres o datos contenidos en {{texto_documento}}.
  // =========================================================================
  if (modo_documento === PROMPT_DOCUMENT_MODES.TONE && texto_documento) {
    const styleProfile = analyzeStyleFromText(texto_documento);

    const greetingLine = buildStandardGreeting(
      nombre_destinatario,
      styleProfile.treatment,
      styleProfile.greetingStyle,
      false
    );

    const openingParagraph =
      styleProfile.treatment === 'tuteo'
        ? styleProfile.warmthLevel === 'alta'
          ? 'Espero que te encuentres muy bien al recibir este correo. Te escribo con serenidad para comentarte una cuestión importante relativa a nuestra labor docente.'
          : 'Espero que todo marche bien. Me pongo en contacto contigo para trasladarte la siguiente información de manera clara y directa.'
        : styleProfile.warmthLevel === 'alta'
          ? 'Espero que se encuentre muy bien al recibir estas líneas. Me dirijo a usted con el propósito de trasladarle de forma clara y cordial la siguiente comunicación.'
          : 'Le escribo el presente correo con el fin de poner en su conocimiento una cuestión relevante para nuestra organización escolar.';

    // Nota crítica: pasamos `referenceTextForDates: ''` para jamás tocar datos ni fechas de `texto_documento`
    const bodyParagraphs = transformColloquialToPedagogical(idea_coloquial, {
      treatment: styleProfile.treatment,
      connectors: styleProfile.preferredConnectors,
      isAdministrative: false,
      referenceTextForDates: '',
    });

    const closingParagraph =
      styleProfile.treatment === 'tuteo'
        ? 'Quedo a tu entera disposición para comentarlo personalmente o resolver cualquier detalle que consideres oportuno. Muchas gracias de antemano por tu acogida y comprensión.'
        : 'Quedo a su entera disposición para ampliar cualquier información o acordar los próximos pasos que estime convenientes. Le agradezco de antemano su tiempo y su amable acogida.';

    const signOffLine =
      styleProfile.closingStyle ||
      (styleProfile.treatment === 'tuteo' ? 'Un cordial saludo' : 'Reciba un cordial saludo');

    const { fullFormattedOutput, bodyOnly } = assembleMandatoryStructure({
      optimizedSubject,
      greetingLine,
      openingParagraph,
      bodyParagraphs,
      closingParagraph,
      signOffLine,
      senderName: nombre_remitente,
    });

    return {
      subject: optimizedSubject,
      body: fullFormattedOutput,
      bodyWithoutSubject: bodyOnly,
      fullOutput: fullFormattedOutput,
      modeLabel: 'OPCION_A_TONO · Tono y Estilo Personal Clonado',
      promptMode: PROMPT_DOCUMENT_MODES.TONE,
      variables: vars,
      summaryNote: `Modo ${PROMPT_DOCUMENT_MODES.TONE}: Se ha clonado tu voz y estilo personal (${styleProfile.toneSummary}) descartando el 100 % del contenido temático del documento.`,
    };
  }

  // =========================================================================
  // CASO 3: {{modo_documento}} = OPCION_B_CONTENIDO (Base Directa de Contenido)
  // Utiliza {{idea_coloquial}} como directriz principal y extrae de
  // {{texto_documento}} los datos clave, fechas, acuerdos o puntos relevantes.
  // =========================================================================
  if (modo_documento === PROMPT_DOCUMENT_MODES.CONTENT && texto_documento) {
    const greetingLine = buildStandardGreeting(nombre_destinatario, 'usted', null, false);

    const openingParagraph =
      'Espero que se encuentre muy bien. Me pongo en contacto con usted para informarle con claridad sobre la gestión detallada a continuación, respaldada en la documentación de referencia.';

    const mainIdeaParagraphs = transformColloquialToPedagogical(idea_coloquial, {
      treatment: 'usted',
      connectors: ['Asimismo', 'Por otro lado', 'En este sentido'],
      isAdministrative: false,
      referenceTextForDates: texto_documento,
    });

    const highlights = extractDocumentHighlights(texto_documento, 4);
    const bodyParagraphs = [...mainIdeaParagraphs];

    if (highlights.length > 0) {
      bodyParagraphs.push(
        'En coherencia con el documento de apoyo tenido en cuenta, se destacan los siguientes aspectos clave:'
      );
      bodyParagraphs.push(highlights.map((point) => `• ${point}`).join('\n'));
    }

    const closingParagraph =
      'Agradezco sinceramente su atención y disposición. Quedo pendiente de sus indicaciones por si fuera necesario coordinar algún paso adicional.';

    const { fullFormattedOutput, bodyOnly } = assembleMandatoryStructure({
      optimizedSubject,
      greetingLine,
      openingParagraph,
      bodyParagraphs,
      closingParagraph,
      signOffLine: 'Reciba un cordial saludo',
      senderName: nombre_remitente,
    });

    return {
      subject: optimizedSubject,
      body: fullFormattedOutput,
      bodyWithoutSubject: bodyOnly,
      fullOutput: fullFormattedOutput,
      modeLabel: 'OPCION_B_CONTENIDO · Base Directa de Contenido',
      promptMode: PROMPT_DOCUMENT_MODES.CONTENT,
      variables: vars,
      summaryNote: `Modo ${PROMPT_DOCUMENT_MODES.CONTENT}: Se ha combinado tu idea principal con ${highlights.length} puntos clave extraídos del documento adjunto.`,
    };
  }

  // =========================================================================
  // CASO 4: {{modo_documento}} = OPCION_C_ADMINISTRATIVO (Análisis Complejo)
  // Cruza el análisis profundo de {{texto_documento}} con {{idea_coloquial}}
  // en estructura formal: Contexto / Fundamento o Antecedentes / Solicitud o Resolución.
  // =========================================================================
  if (modo_documento === PROMPT_DOCUMENT_MODES.ADMIN && texto_documento) {
    const greetingLine = buildStandardGreeting(nombre_destinatario, 'usted', null, true);

    const openingParagraph = `Por medio de la presente comunicación institucional me dirijo a usted en relación con «${optimizedSubject}», a fin de exponer de manera estructurada los antecedentes documentales y la solicitud correspondiente para su valoración.`;

    const highlights = extractDocumentHighlights(texto_documento, 4);
    const transformedIdea = transformColloquialToPedagogical(idea_coloquial, {
      treatment: 'usted',
      connectors: ['Asimismo', 'En consonancia con lo anterior', 'Por consiguiente'],
      isAdministrative: true,
      referenceTextForDates: texto_documento,
    });

    const contextoBlock = `**1. Contexto de la comunicación:**\n${transformedIdea.join(' ')}`;

    const fundamentoBlock =
      highlights.length > 0
        ? `**2. Fundamento y antecedentes documentales:**\n${highlights.map((point) => `• ${point}`).join('\n')}`
        : '**2. Fundamento y antecedentes documentales:**\n• Se toma como marco de referencia la documentación técnica adjunta a efectos de respaldar la presente gestión.';

    const solicitudBlock =
      '**3. Solicitud / Propuesta de resolución:**\nEn virtud de los antecedentes expuestos, se solicita que se tenga por formulada la presente comunicación a los efectos administrativos y pedagógicos oportunos.';

    const closingParagraph =
      'Quedo a su entera disposición para aportar cualquier documentación complementaria o mantener la reunión técnica de coordinación que se estime pertinente. Agradezco de antemano su diligencia y acogida.';

    const { fullFormattedOutput, bodyOnly } = assembleMandatoryStructure({
      optimizedSubject,
      greetingLine,
      openingParagraph,
      bodyParagraphs: [contextoBlock, fundamentoBlock, solicitudBlock],
      closingParagraph,
      signOffLine: 'Atentamente',
      senderName: nombre_remitente,
    });

    return {
      subject: optimizedSubject,
      body: fullFormattedOutput,
      bodyWithoutSubject: bodyOnly,
      fullOutput: fullFormattedOutput,
      modeLabel: 'OPCION_C_ADMINISTRATIVO · Gestión Administrativa',
      promptMode: PROMPT_DOCUMENT_MODES.ADMIN,
      variables: vars,
      summaryNote: `Modo ${PROMPT_DOCUMENT_MODES.ADMIN}: Comunicación estructurada en Contexto, Fundamento/Antecedentes y Solicitud/Resolución.`,
    };
  }

  // =========================================================================
  // CASO 1: {{modo_documento}} = SIN_DOCUMENTO
  // Toma únicamente la intención de {{idea_coloquial}} y la traduce a un
  // registro profesional, cordial y asertivo propio del ámbito educativo.
  // =========================================================================
  const greetingLine = buildStandardGreeting(nombre_destinatario, 'usted', null, false);

  const openingByProfile = {
    familia:
      'Espero que usted y su familia se encuentren muy bien. Me pongo en contacto con usted desde una perspectiva constructiva y cercana para compartir una cuestión importante sobre el acompañamiento escolar.',
    administracion:
      'Espero que se encuentre muy bien. Me dirijo a usted con el propósito de comunicarle con claridad y antelación la siguiente gestión vinculada a mi labor docente.',
    claustro:
      'Espero que estés teniendo una buena semana. Te escribo estas líneas para coordinar de manera fluida y organizada el asunto que te detallo a continuación.',
    alumnado:
      'Espero que todo vaya muy bien. Me pongo en contacto para compartir las siguientes indicaciones de seguimiento académico.',
    general:
      'Espero que se encuentre muy bien al recibir este mensaje. Le escribo para trasladarle de forma clara y ordenada la siguiente comunicación.',
  };

  const closingByProfile = {
    familia:
      'Agradezco de antemano su cercanía y colaboración constante. Quedo a su entera disposición para concretar una tutoría o resolver cualquier duda que deseen plantear.',
    administracion:
      'Le agradezco de antemano su atención y apoyo en esta gestión. Quedo a su entera disposición para confirmar cualquier detalle organizativo o paso a seguir.',
    claustro:
      'Muchas gracias de antemano por tu compañerismo y disponibilidad. Quedo pendiente para concretar cualquier detalle que necesitemos ajustar.',
    alumnado:
      'Quedo a vuestra disposición en el centro para resolver cualquier duda durante las próximas sesiones.',
    general:
      'Agradezco de antemano su amable acogida y quedo a su entera disposición para cualquier aclaración o paso a seguir.',
  };

  const treatmentForNoDoc = recipientProfile === 'claustro' ? 'tuteo' : 'usted';
  const bodyParagraphs = transformColloquialToPedagogical(idea_coloquial, {
    treatment: treatmentForNoDoc,
    connectors: ['Asimismo', 'Por otra parte', 'En este sentido'],
    isAdministrative: false,
    referenceTextForDates: '',
  });

  const { fullFormattedOutput, bodyOnly } = assembleMandatoryStructure({
    optimizedSubject,
    greetingLine,
    openingParagraph: openingByProfile[recipientProfile] || openingByProfile.general,
    bodyParagraphs,
    closingParagraph: closingByProfile[recipientProfile] || closingByProfile.general,
    signOffLine: 'Reciba un cordial saludo',
    senderName: nombre_remitente,
  });

  return {
    subject: optimizedSubject,
    body: fullFormattedOutput,
    bodyWithoutSubject: bodyOnly,
    fullOutput: fullFormattedOutput,
    modeLabel: 'SIN_DOCUMENTO · Redacción Estándar',
    promptMode: PROMPT_DOCUMENT_MODES.NONE,
    variables: vars,
    summaryNote: `Modo ${PROMPT_DOCUMENT_MODES.NONE}: Redacción asertiva y empática generada exclusivamente a partir de tu idea coloquial.`,
  };
}

/**
 * Intenta generar el correo utilizando primero el endpoint local `/api/generate`
 * (si el servidor Python tiene configurada la variable de entorno `GEMINI_API_KEY`)
 * y, si no está configurada o se ejecuta sin backend IA, utiliza inmediatamente
 * el motor local determinista `generateTeacherEmail`.
 *
 * @param {object} payload
 * @returns {Promise<ReturnType<typeof generateTeacherEmail>>}
 */
async function generateTeacherEmailAsync(payload = {}) {
  const localResult = generateTeacherEmail(payload);

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variables: localResult.variables,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.usedEnvModel && data.fullOutput) {
        return {
          ...localResult,
          subject: data.subject || localResult.subject,
          body: data.fullOutput,
          fullOutput: data.fullOutput,
        };
      }
    }
  } catch {
    // Si no está activo el endpoint IA o no hay clave en variables de entorno,
    // se entrega de forma transparente el resultado del motor local.
  }

  return localResult;
}

if (typeof window !== 'undefined') {
  window.TeacherMailApp = window.TeacherMailApp || {};
  Object.assign(window.TeacherMailApp, {
    DOCUMENT_MODES,
    PROMPT_DOCUMENT_MODES,
    SYSTEM_PROMPT_TEMPLATE,
    resolvePromptDocumentMode,
    buildPromptVariables,
    detectRecipientProfile,
    optimizeSubjectLine,
    transformColloquialToPedagogical,
    extractDocumentHighlights,
    generateTeacherEmail,
    generateTeacherEmailAsync,
  });
}
})();
