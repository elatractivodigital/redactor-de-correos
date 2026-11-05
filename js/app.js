/**
 * Orquestador Principal de la Interfaz (`js/app.js`)
 * Mini App: Asistente de Redacción Docente
 * 100% Stateless / Sin bases de datos ni autenticación
 */

(function () {
  'use strict';

const {
  validateDocumentFile,
  extractTextFromFile,
  generateTeacherEmail,
  generateTeacherEmailAsync,
  DOCUMENT_MODES,
  PROMPT_DOCUMENT_MODES,
  copyEmailToClipboard,
  exportToDocx,
  exportToPdf,
} = window.TeacherMailApp || {};

// ============================================================================
// 1. ESTADO DE LA SESIÓN ACTIVA (EN MEMORIA)
// ============================================================================

const MIN_IDEA_CHARS = 15;

const state = {
  currentStep: 1,
  senderName: '',
  subject: '',
  recipientName: '',
  colloquialIdea: '',
  documentData: null,
  documentMode: null, // 'tone' | 'content' | 'admin' | null
  hasGenerated: false,
};

const MODE_LABELS = {
  [DOCUMENT_MODES.TONE]: `${PROMPT_DOCUMENT_MODES.TONE} · Clonar Tono y Estilo Personal`,
  [DOCUMENT_MODES.CONTENT]: `${PROMPT_DOCUMENT_MODES.CONTENT} · Base Directa de Contenido`,
  [DOCUMENT_MODES.ADMIN]: `${PROMPT_DOCUMENT_MODES.ADMIN} · Gestión Administrativa / Compleja`,
};

// ============================================================================
// 2. REFERENCIAS AL DOM
// ============================================================================

const dom = {
  // Cabecera
  btnThemeToggle: document.getElementById('btn-theme-toggle'),
  themeIconMoon: document.getElementById('theme-icon-moon'),
  themeIconSun: document.getElementById('theme-icon-sun'),
  themeToggleLabel: document.getElementById('theme-toggle-label'),
  btnDemoFill: document.getElementById('btn-demo-fill'),
  btnResetAll: document.getElementById('btn-reset-all'),

  // Stepper
  stepIndicators: Array.from(document.querySelectorAll('[data-step-indicator]')),
  progressBar: document.getElementById('wizard-progress-bar'),
  stepPanels: {
    1: document.getElementById('step-1'),
    2: document.getElementById('step-2'),
    3: document.getElementById('step-3'),
    4: document.getElementById('step-4'),
  },

  // Paso 1
  inputSender: document.getElementById('input-sender'),
  inputSubject: document.getElementById('input-subject'),
  inputRecipient: document.getElementById('input-recipient'),
  errSender: document.getElementById('err-sender'),
  errSubject: document.getElementById('err-subject'),
  errRecipient: document.getElementById('err-recipient'),
  btnNext1: document.getElementById('btn-next-1'),

  // Paso 2
  inputIdea: document.getElementById('input-idea'),
  ideaCharCount: document.getElementById('idea-char-count'),
  errIdea: document.getElementById('err-idea'),
  presetPills: Array.from(document.querySelectorAll('.preset-pill')),
  btnPrev2: document.getElementById('btn-prev-2'),
  btnNext2: document.getElementById('btn-next-2'),

  // Paso 3
  dropzoneArea: document.getElementById('dropzone-area'),
  inputFile: document.getElementById('input-file'),
  fileLoadedBadge: document.getElementById('file-loaded-badge'),
  fileNameLabel: document.getElementById('file-name-label'),
  fileMetaLabel: document.getElementById('file-meta-label'),
  btnRemoveFile: document.getElementById('btn-remove-file'),
  docModeSection: document.getElementById('doc-mode-section'),
  modeCards: Array.from(document.querySelectorAll('.mode-card')),
  modeRadios: Array.from(document.querySelectorAll('input[name="doc-mode"]')),
  btnPrev3: document.getElementById('btn-prev-3'),
  btnNext3: document.getElementById('btn-next-3'),

  // Paso 4
  summarySender: document.getElementById('summary-sender'),
  summaryRecipient: document.getElementById('summary-recipient'),
  summarySubject: document.getElementById('summary-subject'),
  summaryIdea: document.getElementById('summary-idea'),
  summaryDoc: document.getElementById('summary-doc'),
  btnPrev4: document.getElementById('btn-prev-4'),
  btnGenerateEmail: document.getElementById('btn-generate-email'),

  // Panel de Edición y Exportación
  editorPanel: document.querySelector('.editor-panel'),
  editorStatusBadge: document.getElementById('editor-status-badge'),
  btnCopyEmail: document.getElementById('btn-copy-email'),
  btnExportDocx: document.getElementById('btn-export-docx'),
  btnExportPdf: document.getElementById('btn-export-pdf'),
  editorEmptyState: document.getElementById('editor-empty-state'),
  editorWorkspace: document.getElementById('editor-workspace'),
  previewRecipient: document.getElementById('preview-recipient'),
  previewSender: document.getElementById('preview-sender'),
  previewModePill: document.getElementById('preview-mode-pill'),
  editorSubject: document.getElementById('editor-subject'),
  emailLiveEditor: document.getElementById('email-live-editor'),
  editorWordCount: document.getElementById('editor-word-count'),

  // Toasts
  toastContainer: document.getElementById('toast-container'),
};

// ============================================================================
// 3. SISTEMA DE NOTIFICACIONES VISUALES (TOASTS REDONDEADOS)
// ============================================================================

/**
 * Muestra una notificación flotante con bordes redondeados.
 * @param {string} message
 * @param {'info'|'success'|'error'} [type='info']
 */
function showToast(message, type = 'info') {
  if (!dom.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  toast.appendChild(textSpan);

  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    toast.style.transition = 'opacity 180ms ease, transform 180ms ease';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 200);
  }, 3800);
}

// ============================================================================
// 4. VALIDACIONES DE CADA PASO
// ============================================================================

function setFieldError(inputEl, errorEl, message) {
  if (!inputEl || !errorEl) return;
  if (message) {
    inputEl.classList.add('input-error');
    inputEl.setAttribute('aria-invalid', 'true');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  } else {
    inputEl.classList.remove('input-error');
    inputEl.removeAttribute('aria-invalid');
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }
}

function syncStateFromInputs() {
  state.senderName = (dom.inputSender?.value || '').trim();
  state.subject = (dom.inputSubject?.value || '').trim();
  state.recipientName = (dom.inputRecipient?.value || '').trim();
  state.colloquialIdea = (dom.inputIdea?.value || '').trim();
}

/**
 * Valida el Paso 1 (Remitente, Asunto, Destinatario).
 * @param {boolean} [showErrors=true]
 * @returns {boolean}
 */
function validateStep1(showErrors = true) {
  syncStateFromInputs();
  let isValid = true;

  if (state.senderName.length < 2) {
    isValid = false;
    if (showErrors) {
      setFieldError(
        dom.inputSender,
        dom.errSender,
        'Por favor, indica tu nombre y apellido como remitente.'
      );
    }
  } else {
    setFieldError(dom.inputSender, dom.errSender, '');
  }

  if (state.subject.length < 3) {
    isValid = false;
    if (showErrors) {
      setFieldError(
        dom.inputSubject,
        dom.errSubject,
        'Escribe un asunto breve para identificar el tema del correo.'
      );
    }
  } else {
    setFieldError(dom.inputSubject, dom.errSubject, '');
  }

  if (state.recipientName.length < 2) {
    isValid = false;
    if (showErrors) {
      setFieldError(
        dom.inputRecipient,
        dom.errRecipient,
        'Indica el nombre o cargo de la persona destinataria.'
      );
    }
  } else {
    setFieldError(dom.inputRecipient, dom.errRecipient, '');
  }

  if (!isValid && showErrors) {
    showToast('Completa los tres datos obligatorios del Paso 1 para continuar.', 'error');
  }

  return isValid;
}

/**
 * Valida el Paso 2 (Idea en lenguaje coloquial).
 * @param {boolean} [showErrors=true]
 * @returns {boolean}
 */
function validateStep2(showErrors = true) {
  syncStateFromInputs();
  const len = state.colloquialIdea.length;

  if (len < MIN_IDEA_CHARS) {
    if (showErrors) {
      setFieldError(
        dom.inputIdea,
        dom.errIdea,
        `Escribe al menos ${MIN_IDEA_CHARS} caracteres contando tu idea con tus propias palabras (actualmente: ${len}).`
      );
      showToast('Cuéntanos un poco más sobre tu idea antes de pasar al siguiente paso.', 'error');
    }
    return false;
  }

  setFieldError(dom.inputIdea, dom.errIdea, '');
  return true;
}

/**
 * Valida el Paso 3 (Documento opcional, pero si hay archivo requiere una de las 3 opciones).
 * @param {boolean} [showErrors=true]
 * @returns {boolean}
 */
function validateStep3(showErrors = true) {
  if (!state.documentData) {
    return true;
  }

  const validModes = [DOCUMENT_MODES.TONE, DOCUMENT_MODES.CONTENT, DOCUMENT_MODES.ADMIN];
  if (!validModes.includes(state.documentMode)) {
    if (showErrors) {
      showToast(
        'Has subido un documento. Por favor, elige una de las 3 opciones (A, B o C) para continuar.',
        'error'
      );
    }
    return false;
  }

  return true;
}

// ============================================================================
// 5. NAVEGACIÓN DEL WIZARD DE 4 PASOS
// ============================================================================

function populateStep4Summary() {
  syncStateFromInputs();
  if (dom.summarySender) dom.summarySender.textContent = state.senderName || '—';
  if (dom.summaryRecipient) dom.summaryRecipient.textContent = state.recipientName || '—';
  if (dom.summarySubject) dom.summarySubject.textContent = state.subject || '—';
  if (dom.summaryIdea) dom.summaryIdea.textContent = state.colloquialIdea || '—';

  if (dom.summaryDoc) {
    if (state.documentData && state.documentMode) {
      const modeName = MODE_LABELS[state.documentMode] || 'Documento adjunto';
      dom.summaryDoc.textContent = `${state.documentData.fileName} (${modeName})`;
    } else {
      dom.summaryDoc.textContent = 'Sin documento adjunto (redacción estándar)';
    }
  }
}

function goToStep(targetStep) {
  const stepNum = Number(targetStep);
  if (stepNum < 1 || stepNum > 4) return;

  // Validar pasos previos si intenta avanzar hacia adelante
  if (stepNum > 1 && !validateStep1(true)) {
    renderStepView(1);
    return;
  }
  if (stepNum > 2 && !validateStep2(true)) {
    renderStepView(2);
    return;
  }
  if (stepNum > 3 && !validateStep3(true)) {
    renderStepView(3);
    return;
  }

  if (stepNum === 4) {
    populateStep4Summary();
  }

  renderStepView(stepNum);
}

function renderStepView(stepNum) {
  state.currentStep = stepNum;

  // Mostrar/ocultar paneles
  Object.entries(dom.stepPanels).forEach(([num, panel]) => {
    if (!panel) return;
    if (Number(num) === stepNum) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  });

  // Actualizar indicadores (completado con ✓, activo en ámbar, pendiente en salvia) y barra de progreso
  dom.stepIndicators.forEach((btn) => {
    const indNum = Number(btn.getAttribute('data-step-indicator'));
    const pill = btn.querySelector('.step-number-pill');
    btn.classList.remove('active', 'completed');
    btn.removeAttribute('aria-current');

    if (indNum === stepNum) {
      btn.classList.add('active');
      btn.setAttribute('aria-current', 'step');
      if (pill) pill.textContent = String(indNum);
    } else if (indNum < stepNum) {
      btn.classList.add('completed');
      if (pill) pill.textContent = '✓';
    } else {
      if (pill) pill.textContent = String(indNum);
    }
  });

  if (dom.progressBar) {
    dom.progressBar.style.width = `${stepNum * 25}%`;
    dom.progressBar.classList.toggle('has-completed-steps', stepNum > 1);
  }
}

// ============================================================================
// 6. GESTIÓN DEL PASO 2 (CONTADOR Y SUGERENCIAS RÁPIDAS)
// ============================================================================

function updateIdeaCounter() {
  const text = (dom.inputIdea?.value || '').trim();
  const len = text.length;

  if (dom.ideaCharCount) {
    dom.ideaCharCount.textContent = `${len} ${len === 1 ? 'carácter' : 'caracteres'}`;
    if (len >= MIN_IDEA_CHARS) {
      dom.ideaCharCount.classList.add('valid');
    } else {
      dom.ideaCharCount.classList.remove('valid');
    }
  }

  if (len >= MIN_IDEA_CHARS) {
    setFieldError(dom.inputIdea, dom.errIdea, '');
  }
}

// ============================================================================
// 7. GESTIÓN DEL PASO 3 (CARGA DE DOCUMENTO .PDF / .DOCX Y 3 RADIO CARDS)
// ============================================================================

function selectDocumentMode(modeValue) {
  state.documentMode = modeValue;

  dom.modeCards.forEach((card) => {
    const cardMode = card.getAttribute('data-mode');
    const radio = card.querySelector('input[type="radio"]');
    const isSelected = cardMode === modeValue;

    card.classList.toggle('selected', isSelected);
    if (radio) {
      radio.checked = isSelected;
    }
  });
}

async function handleFileSelection(file) {
  if (!file) return;

  const validation = validateDocumentFile(file);
  if (!validation.valid) {
    showToast(validation.error, 'error');
    if (dom.inputFile) dom.inputFile.value = '';
    return;
  }

  try {
    if (dom.fileNameLabel) dom.fileNameLabel.textContent = file.name;
    if (dom.fileMetaLabel) dom.fileMetaLabel.textContent = 'Extrayendo texto en memoria...';
    dom.fileLoadedBadge?.classList.remove('hidden');

    const extracted = await extractTextFromFile(file);
    state.documentData = extracted;

    if (dom.fileNameLabel) {
      dom.fileNameLabel.textContent = extracted.fileName;
    }
    if (dom.fileMetaLabel) {
      dom.fileMetaLabel.textContent = `${extracted.extension} · ${extracted.fileSizeFormatted} · ${extracted.wordCount} palabras leídas`;
    }

    // Desplegar dinámicamente las 3 Radio Cards excluyentes
    dom.docModeSection?.classList.remove('hidden');

    // Si aún no había modo elegido, seleccionar por defecto la Opción A ('tone')
    const currentChecked =
      dom.modeRadios.find((r) => r.checked)?.value || DOCUMENT_MODES.TONE;
    selectDocumentMode(currentChecked);

    showToast(`Archivo «${extracted.fileName}» cargado. Elige cómo deseas utilizarlo.`, 'success');
  } catch (err) {
    console.error('Error al procesar el documento:', err);
    clearLoadedDocument();
    showToast(
      err?.message || 'No se pudo leer el archivo seleccionado. Verifica que sea un .PDF o .DOCX válido.',
      'error'
    );
  }
}

function clearLoadedDocument() {
  state.documentData = null;
  state.documentMode = null;

  if (dom.inputFile) {
    dom.inputFile.value = '';
  }
  dom.fileLoadedBadge?.classList.add('hidden');
  dom.docModeSection?.classList.add('hidden');
}

// ============================================================================
// 8. GENERACIÓN DEL CORREO Y EDICIÓN EN VIVO
// ============================================================================

function escapeHtmlSafe(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function serializeElementWithStrong(el) {
  let out = '';
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.nodeValue || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      if (tag === 'br') {
        out += '\n';
      } else if (tag === 'strong' || tag === 'b') {
        out += `**${serializeElementWithStrong(node)}**`;
      } else {
        out += serializeElementWithStrong(node);
      }
    }
  });
  return out;
}

/**
 * Obtiene el texto estructurado actual del editor en vivo conservando saltos de párrafo y negritas `**...**`.
 * @returns {string}
 */
function getLiveEditorPlainText() {
  if (!dom.emailLiveEditor) return '';

  const paragraphs = Array.from(dom.emailLiveEditor.querySelectorAll('p'));
  if (paragraphs.length > 0) {
    return paragraphs
      .map((p) => serializeElementWithStrong(p).trim())
      .filter((line, idx, arr) => line !== '' || (idx > 0 && arr[idx - 1] !== ''))
      .join('\n\n')
      .trim();
  }

  return (dom.emailLiveEditor.innerText || dom.emailLiveEditor.textContent || '').trim();
}

/**
 * Rellena el editor en vivo con párrafos HTML editables renderizando `**negritas**`
 * y resaltando marcadores entre corchetes como `[indicar fecha/hora]`.
 * @param {string} bodyText
 */
function renderBodyIntoLiveEditor(bodyText) {
  if (!dom.emailLiveEditor) return;

  dom.emailLiveEditor.innerHTML = '';
  const blocks = String(bodyText || '')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  blocks.forEach((blockText) => {
    const p = document.createElement('p');
    let formattedHtml = escapeHtmlSafe(blockText)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(\[indicar[^\]]*\])/gi, '<span class="bracket-placeholder">$1</span>')
      .replace(/\n/g, '<br/>');
    p.innerHTML = formattedHtml;
    dom.emailLiveEditor.appendChild(p);
  });

  updateEditorWordCount();
}

function updateEditorWordCount() {
  const text = getLiveEditorPlainText().replace(/\*\*/g, '');
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;

  if (dom.editorWordCount) {
    dom.editorWordCount.textContent = `${words} ${words === 1 ? 'palabra' : 'palabras'}`;
  }

  // Sincronizar si el usuario editó la primera línea `Asunto: ...` dentro del cuadro editable
  const firstLine = text.split('\n')[0] || '';
  const subjMatch = firstLine.match(/^Asunto:\s*(.+)$/i);
  if (subjMatch && dom.editorSubject && document.activeElement !== dom.editorSubject) {
    dom.editorSubject.value = subjMatch[1].trim();
  }

  const hasContent = words > 0;
  if (dom.btnCopyEmail) dom.btnCopyEmail.disabled = !hasContent;
  if (dom.btnExportDocx) dom.btnExportDocx.disabled = !hasContent;
  if (dom.btnExportPdf) dom.btnExportPdf.disabled = !hasContent;
}

async function handleGenerateEmail() {
  if (!validateStep1(true) || !validateStep2(true) || !validateStep3(true)) {
    return;
  }

  syncStateFromInputs();

  const result = await generateTeacherEmailAsync({
    senderName: state.senderName,
    recipientName: state.recipientName,
    subject: state.subject,
    colloquialIdea: state.colloquialIdea,
    documentData: state.documentData,
    documentMode: state.documentData ? state.documentMode : null,
  });

  state.hasGenerated = true;

  // Mostrar el espacio de trabajo del editor (borde continuo sólido) y ocultar el estado vacío (borde punteado)
  dom.editorEmptyState?.classList.add('hidden');
  dom.editorWorkspace?.classList.remove('hidden');
  dom.editorPanel?.classList.add('is-ready');

  if (dom.editorStatusBadge) {
    dom.editorStatusBadge.textContent = 'Listo para editar';
    dom.editorStatusBadge.classList.add('status-ready');
  }

  if (dom.previewRecipient) dom.previewRecipient.textContent = state.recipientName;
  if (dom.previewSender) dom.previewSender.textContent = state.senderName;
  if (dom.previewModePill) dom.previewModePill.textContent = result.modeLabel;
  if (dom.editorSubject) dom.editorSubject.value = result.subject;

  renderBodyIntoLiveEditor(result.body);

  showToast('¡Mensaje creado! Puedes editar cualquier palabra directamente en el borrador.', 'success');

  // En pantallas móviles/tablets, desplazar suavemente hacia el borrador generado
  if (window.innerWidth <= 1080) {
    dom.editorWorkspace?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ============================================================================
// 9. ACCIONES DE SALIDA (COPIAR, .DOCX, .PDF)
// ============================================================================

async function handleCopyEmail() {
  const subject = (dom.editorSubject?.value || state.subject || '').trim();
  const body = getLiveEditorPlainText();

  if (!body) {
    showToast('No hay texto en el borrador para copiar.', 'error');
    return;
  }

  try {
    await copyEmailToClipboard({ subject, body, includeSubject: true });
    showToast('Correo copiado al portapapeles listo para pegar.', 'success');
  } catch (err) {
    console.error('Error al copiar:', err);
    showToast('No se pudo copiar automáticamente al portapapeles.', 'error');
  }
}

function handleExportDocx() {
  const subject = (dom.editorSubject?.value || state.subject || '').trim();
  const body = getLiveEditorPlainText();

  if (!body) {
    showToast('Genera o escribe un correo antes de descargar en .DOCX.', 'error');
    return;
  }

  try {
    const res = exportToDocx({
      senderName: state.senderName,
      recipientName: state.recipientName,
      subject,
      body,
    });
    showToast(`Documento Word «${res.filename}» descargado.`, 'success');
  } catch (err) {
    console.error('Error al exportar .DOCX:', err);
    showToast('Ocurrió un problema al generar el archivo .DOCX.', 'error');
  }
}

function handleExportPdf() {
  const subject = (dom.editorSubject?.value || state.subject || '').trim();
  const body = getLiveEditorPlainText();

  if (!body) {
    showToast('Genera o escribe un correo antes de descargar en .PDF.', 'error');
    return;
  }

  try {
    const res = exportToPdf({
      senderName: state.senderName,
      recipientName: state.recipientName,
      subject,
      body,
    });
    showToast(`Documento PDF «${res.filename}» descargado.`, 'success');
  } catch (err) {
    console.error('Error al exportar .PDF:', err);
    showToast(err?.message || 'Ocurrió un problema al generar el archivo .PDF.', 'error');
  }
}

// ============================================================================
// 10. MODO DEMOSTRACIÓN (PRUEBA RÁPIDA) Y REINICIO
// ============================================================================

function loadQuickDemo() {
  if (dom.inputSender) {
    dom.inputSender.value = 'Prof. Laura Gómez — Tutora de 5.º Primaria';
  }
  if (dom.inputSubject) {
    dom.inputSubject.value = 'Solicitud de permiso por consulta médica y organización de aula';
  }
  if (dom.inputRecipient) {
    dom.inputRecipient.value = 'Sra. Directora Carmen Valdivia';
  }
  if (dom.inputIdea) {
    dom.inputIdea.value =
      'Necesito avisar a la directora que este viernes a primera hora tengo consulta con el especialista en el hospital y llegaré al centro sobre las 10:30. Ya hablé con el profesor Javier para cubrir la primera sesión y dejé las fichas de lectura preparadas sobre la mesa.';
  }

  setFieldError(dom.inputSender, dom.errSender, '');
  setFieldError(dom.inputSubject, dom.errSubject, '');
  setFieldError(dom.inputRecipient, dom.errRecipient, '');
  setFieldError(dom.inputIdea, dom.errIdea, '');
  updateIdeaCounter();

  // Simular un documento de referencia cargado para que pueda ver también la lógica condicional
  state.documentData = {
    fileName: 'Protocolo_Permisos_Docentes_Centro.pdf',
    fileSizeFormatted: '148 KB',
    extension: 'PDF',
    wordCount: 84,
    charCount: 540,
    text: `Estimado equipo directivo: Según el protocolo interno de organización pedagógica del centro, toda ausencia puntual por asistencia médica justificada deberá comunicarse con antelación indicando la franja horaria prevista y el material didáctico dispuesto para la guardia de aula. Asimismo, se dejará constancia del justificante facultativo en jefatura de estudios a la reincorporación del docente. Quedo a su entera disposición para cualquier aclaración. Un cordial saludo.`,
    excerpt:
      'Según el protocolo interno de organización pedagógica del centro, toda ausencia puntual por asistencia médica justificada deberá comunicarse...',
  };

  if (dom.fileNameLabel) {
    dom.fileNameLabel.textContent = state.documentData.fileName;
  }
  if (dom.fileMetaLabel) {
    dom.fileMetaLabel.textContent = `${state.documentData.extension} · ${state.documentData.fileSizeFormatted} · ${state.documentData.wordCount} palabras leídas`;
  }
  dom.fileLoadedBadge?.classList.remove('hidden');
  dom.docModeSection?.classList.remove('hidden');

  selectDocumentMode(DOCUMENT_MODES.CONTENT);

  // Ir al Paso 4 con el resumen y generar el borrador automáticamente
  populateStep4Summary();
  renderStepView(4);
  handleGenerateEmail();
}

function resetAllWizard() {
  state.currentStep = 1;
  state.senderName = '';
  state.subject = '';
  state.recipientName = '';
  state.colloquialIdea = '';
  state.hasGenerated = false;

  if (dom.inputSender) dom.inputSender.value = '';
  if (dom.inputSubject) dom.inputSubject.value = '';
  if (dom.inputRecipient) dom.inputRecipient.value = '';
  if (dom.inputIdea) dom.inputIdea.value = '';

  setFieldError(dom.inputSender, dom.errSender, '');
  setFieldError(dom.inputSubject, dom.errSubject, '');
  setFieldError(dom.inputRecipient, dom.errRecipient, '');
  setFieldError(dom.inputIdea, dom.errIdea, '');

  updateIdeaCounter();
  clearLoadedDocument();

  // Resetear el panel de edición derecho
  dom.editorWorkspace?.classList.add('hidden');
  dom.editorEmptyState?.classList.remove('hidden');
  dom.editorPanel?.classList.remove('is-ready', 'is-editing');
  if (dom.emailLiveEditor) dom.emailLiveEditor.innerHTML = '';
  if (dom.editorSubject) dom.editorSubject.value = '';

  if (dom.editorStatusBadge) {
    dom.editorStatusBadge.textContent = 'Esperando datos';
    dom.editorStatusBadge.classList.remove('status-ready');
  }

  updateEditorWordCount();
  renderStepView(1);
  showToast('Asistente reiniciado. Puedes comenzar un nuevo correo.', 'info');
}

// ============================================================================
// 11. REGISTRO DE EVENTOS E INICIALIZACIÓN
// ============================================================================

function initEventListeners() {
  // Validación en vivo Paso 1
  dom.inputSender?.addEventListener('input', () => {
    if (dom.inputSender.value.trim().length >= 2) {
      setFieldError(dom.inputSender, dom.errSender, '');
    }
  });
  dom.inputSubject?.addEventListener('input', () => {
    if (dom.inputSubject.value.trim().length >= 3) {
      setFieldError(dom.inputSubject, dom.errSubject, '');
    }
  });
  dom.inputRecipient?.addEventListener('input', () => {
    if (dom.inputRecipient.value.trim().length >= 2) {
      setFieldError(dom.inputRecipient, dom.errRecipient, '');
    }
  });

  // Paso 2: contador y píldoras de ejemplo
  dom.inputIdea?.addEventListener('input', updateIdeaCounter);

  dom.presetPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const ideaText = pill.getAttribute('data-idea') || '';
      if (dom.inputIdea && ideaText) {
        dom.inputIdea.value = ideaText;
        updateIdeaCounter();
        dom.inputIdea.focus();
        showToast('Idea de ejemplo insertada. Puedes adaptarla a tu caso.', 'info');
      }
    });
  });

  // Paso 3: Drag & Drop y selector de archivo
  dom.dropzoneArea?.addEventListener('click', (e) => {
    if (e.target === dom.inputFile) return;
    dom.inputFile?.click();
  });

  dom.dropzoneArea?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dom.inputFile?.click();
    }
  });

  dom.inputFile?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  });

  ['dragenter', 'dragover'].forEach((evtName) => {
    dom.dropzoneArea?.addEventListener(evtName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dom.dropzoneArea.classList.add('drag-over');
    });
  });

  ['dragleave', 'dragend'].forEach((evtName) => {
    dom.dropzoneArea?.addEventListener(evtName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dom.dropzoneArea.classList.remove('drag-over');
    });
  });

  dom.dropzoneArea?.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dom.dropzoneArea.classList.remove('drag-over');

    const file = e.dataTransfer?.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  });

  dom.btnRemoveFile?.addEventListener('click', () => {
    clearLoadedDocument();
    showToast('Archivo eliminado. Puedes avanzar al Paso 4 sin documento.', 'info');
  });

  // Selección de las 3 Radio Cards excluyentes
  dom.modeCards.forEach((card) => {
    card.addEventListener('click', () => {
      const modeVal = card.getAttribute('data-mode');
      if (modeVal) {
        selectDocumentMode(modeVal);
      }
    });
  });

  dom.modeRadios.forEach((radio) => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectDocumentMode(e.target.value);
      }
    });
  });

  // Botones de navegación entre pasos
  dom.btnNext1?.addEventListener('click', () => goToStep(2));
  dom.btnPrev2?.addEventListener('click', () => goToStep(1));
  dom.btnNext2?.addEventListener('click', () => goToStep(3));
  dom.btnPrev3?.addEventListener('click', () => goToStep(2));
  dom.btnNext3?.addEventListener('click', () => goToStep(4));
  dom.btnPrev4?.addEventListener('click', () => goToStep(3));

  // Clic directo en los indicadores superiores del Stepper
  dom.stepIndicators.forEach((indicator) => {
    indicator.addEventListener('click', () => {
      const stepTarget = Number(indicator.getAttribute('data-step-indicator'));
      goToStep(stepTarget);
    });
  });

  // Botón principal del Paso 4: "Crear Mensaje"
  dom.btnGenerateEmail?.addEventListener('click', handleGenerateEmail);

  // Edición en vivo en el panel derecho (iluminación de la tarjeta al enfocar el borrador)
  dom.emailLiveEditor?.addEventListener('input', updateEditorWordCount);
  dom.emailLiveEditor?.addEventListener('focus', () => {
    dom.editorPanel?.classList.add('is-editing');
  });
  dom.emailLiveEditor?.addEventListener('blur', () => {
    dom.editorPanel?.classList.remove('is-editing');
  });
  dom.editorSubject?.addEventListener('focus', () => {
    dom.editorPanel?.classList.add('is-editing');
  });
  dom.editorSubject?.addEventListener('blur', () => {
    dom.editorPanel?.classList.remove('is-editing');
  });
  dom.editorSubject?.addEventListener('input', () => {
    const newSubj = dom.editorSubject.value.trim();
    const firstP = dom.emailLiveEditor?.querySelector('p');
    if (firstP && /^Asunto:/i.test(firstP.textContent || '')) {
      firstP.innerHTML = `<strong>Asunto:</strong> ${escapeHtmlSafe(newSubj)}`;
    }
  });

  // Botones de exportación y portapapeles
  dom.btnCopyEmail?.addEventListener('click', handleCopyEmail);
  dom.btnExportDocx?.addEventListener('click', handleExportDocx);
  dom.btnExportPdf?.addEventListener('click', handleExportPdf);

  // Botones de cabecera: Tema claro/oscuro, Prueba rápida y Reinicio
  dom.btnThemeToggle?.addEventListener('click', toggleColorTheme);
  dom.btnDemoFill?.addEventListener('click', loadQuickDemo);
  dom.btnResetAll?.addEventListener('click', resetAllWizard);
}

function applyColorTheme(theme) {
  const isDark = theme === 'dark';
  if (isDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  dom.themeIconMoon?.classList.toggle('hidden', isDark);
  dom.themeIconSun?.classList.toggle('hidden', !isDark);
  if (dom.themeToggleLabel) {
    dom.themeToggleLabel.textContent = isDark ? 'Modo claro' : 'Modo oscuro';
  }
}

function toggleColorTheme() {
  const isCurrentlyDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const nextTheme = isCurrentlyDark ? 'light' : 'dark';
  applyColorTheme(nextTheme);
  showToast(
    nextTheme === 'dark'
      ? 'Modo oscuro activado (cero fatiga visual).'
      : 'Modo claro activado (calma y enfoque).',
    'info'
  );
}

// Inicializar aplicación al cargar el DOM
initEventListeners();
updateIdeaCounter();
renderStepView(1);
})();
