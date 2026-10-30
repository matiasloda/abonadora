/**
 * Abonadora Pro - Lógica Principal de la Aplicación
 */

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Instanciar Parser de Voz
  const voiceParser = new window.AgroVoiceParser();

  // Estado de la Aplicación
  const STORAGE_KEY = 'abonadora_pro_session_v1';
  let state = loadState() || getInitialState();

  // Elementos DOM principales
  const sessionDatePicker = document.getElementById('sessionDatePicker');
  const logSectionDatePicker = document.getElementById('logSectionDatePicker');
  const btnTopInitialLoad = document.getElementById('btnTopInitialLoad');
  const currentInitialLoadDisplay = document.getElementById('currentInitialLoadDisplay');
  const currentTolvaKgEl = document.getElementById('currentTolvaKg');
  const currentFertilizerNameEl = document.getElementById('currentFertilizerName');
  const totalHaTodayEl = document.getElementById('totalHaToday');
  const totalKgSpentTodayEl = document.getElementById('totalKgSpentToday');
  const avgDoseTodayEl = document.getElementById('avgDoseToday');
  const eventsLogContainer = document.getElementById('eventsLogContainer');
  const emptyLogState = document.getElementById('emptyLogState');
  const logCountBadge = document.getElementById('logCountBadge');

  // Botón de Voz
  const btnVoiceRecord = document.getElementById('btnVoiceRecord');
  const voicePulseRing = document.getElementById('voicePulseRing');
  const voiceMicIcon = document.getElementById('voiceMicIcon');
  const voiceStatusText = document.getElementById('voiceStatusText');

  // Modales
  const modalVoiceConfirm = document.getElementById('modalVoiceConfirm');
  const modalField = document.getElementById('modalField');
  const modalRefill = document.getElementById('modalRefill');
  const modalFertilizer = document.getElementById('modalFertilizer');

  // Formularios
  const formVoiceConfirm = document.getElementById('formVoiceConfirm');
  const formField = document.getElementById('formField');
  const formRefill = document.getElementById('formRefill');
  const formFertilizer = document.getElementById('formFertilizer');

  // Botones de acción
  const btnNewDay = document.getElementById('btnNewDay');
  const btnOpenFieldModal = document.getElementById('btnOpenFieldModal');
  const btnOpenRefillModal = document.getElementById('btnOpenRefillModal');
  const btnExportPDF = document.getElementById('btnExportPDF');
  const btnShareWhatsApp = document.getElementById('btnShareWhatsApp');

  // Conectar botón de Carga Inicial arriba de todo
  if (btnTopInitialLoad) {
    btnTopInitialLoad.addEventListener('click', openFertilizerModal);
  }

  // Sincronizar selectores de fecha
  initDatePickers();

  // Renderizar estado inicial
  renderDashboard();
  renderLog();

  // Si no hay fertilizante configurado al abrir por primera vez, sugerir configurarlo
  if (!state.fertilizerName || state.fertilizerName === 'Sin Definir') {
    setTimeout(() => {
      openFertilizerModal();
    }, 400);
  }

  // =========================================================================
  // GESTIÓN DE ESTADO (PERSISTENCIA LOCAL)
  // =========================================================================

  function getInitialState() {
    const today = new Date().toISOString().split('T')[0];
    return {
      date: today,
      fertilizerName: 'Urea',
      initialLoadKg: 0,
      currentTolvaKg: 0,
      events: [] // Array cronológico de eventos
    };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error al cargar estado:', e);
      return null;
    }
  }

  function initDatePickers() {
    // Si no tiene fecha guardada, usar hoy
    if (!state.date) {
      state.date = new Date().toISOString().split('T')[0];
    }

    if (sessionDatePicker) {
      sessionDatePicker.value = state.date;
      sessionDatePicker.addEventListener('change', (e) => {
        handleDateChange(e.target.value);
      });
    }

    if (logSectionDatePicker) {
      logSectionDatePicker.value = state.date;
      logSectionDatePicker.addEventListener('change', (e) => {
        handleDateChange(e.target.value);
      });
    }
  }

  function handleDateChange(newDate) {
    if (!newDate) return;
    state.date = newDate;
    if (sessionDatePicker) sessionDatePicker.value = newDate;
    if (logSectionDatePicker) logSectionDatePicker.value = newDate;
    saveState();
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const formatted = dateObj.toLocaleDateString('es-ES', options);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  // Recalcular toda la cadena de tolva desde el inicio hasta el último evento
  function recalculateChain() {
    let runningTolva = state.initialLoadKg || 0;

    state.events.forEach((ev) => {
      if (ev.type === 'init') {
        runningTolva = ev.refillKg || 0;
        ev.initialTolvaKg = 0;
        ev.newTolvaKg = runningTolva;
      } else if (ev.type === 'refill') {
        ev.initialTolvaKg = runningTolva;
        runningTolva += (ev.refillKg || 0);
        ev.newTolvaKg = runningTolva;
      } else if (ev.type === 'field') {
        ev.initialTolvaKg = runningTolva;
        ev.spentKg = Math.max(0, runningTolva - ev.remainingKg);
        if (ev.hectares > 0) {
          ev.doseKgHa = Math.round(ev.spentKg / ev.hectares);
        } else {
          ev.doseKgHa = 0;
        }
        runningTolva = ev.remainingKg;
        ev.newTolvaKg = runningTolva;
      }
    });

    state.currentTolvaKg = runningTolva;
    saveState();
  }

  // =========================================================================
  // RENDERIZADO DE INTERFAZ
  // =========================================================================

  function renderDashboard() {
    currentTolvaKgEl.textContent = state.currentTolvaKg.toLocaleString('es-ES');
    currentFertilizerNameEl.textContent = state.fertilizerName || 'Sin Definir';
    if (currentInitialLoadDisplay) {
      currentInitialLoadDisplay.textContent = (state.initialLoadKg || 0).toLocaleString('es-ES');
    }

    // Métricas acumuladas del día
    let totalHa = 0;
    let totalSpentKg = 0;

    state.events.forEach(ev => {
      if (ev.type === 'field') {
        totalHa += (ev.hectares || 0);
        totalSpentKg += (ev.spentKg || 0);
      }
    });

    totalHaTodayEl.textContent = totalHa.toFixed(1);
    totalKgSpentTodayEl.textContent = totalSpentKg.toLocaleString('es-ES');

    const avgDose = totalHa > 0 ? Math.round(totalSpentKg / totalHa) : 0;
    avgDoseTodayEl.textContent = avgDose.toLocaleString('es-ES');
  }

  function renderLog() {
    // Limpiar contenedor excepto el emptyState
    eventsLogContainer.innerHTML = '';

    if (state.events.length === 0) {
      eventsLogContainer.appendChild(emptyLogState);
      emptyLogState.classList.remove('hidden');
      logCountBadge.textContent = '0 eventos';
      return;
    }

    emptyLogState.classList.add('hidden');
    logCountBadge.textContent = `${state.events.length} evento${state.events.length > 1 ? 's' : ''}`;

    // Renderizar cada evento en orden cronológico inverso (el más nuevo arriba)
    const reversedEvents = [...state.events].reverse();

    reversedEvents.forEach((ev) => {
      const card = createEventCard(ev);
      eventsLogContainer.appendChild(card);
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function createEventCard(ev) {
    const card = document.createElement('div');
    card.className = 'bg-slate-800/90 border border-slate-700/80 rounded-xl p-3.5 shadow-md transition hover:border-slate-600 relative';

    let iconHtml = '';
    let badgeHtml = '';
    let contentHtml = '';

    if (ev.type === 'init') {
      iconHtml = '<i data-lucide="play-circle" class="w-4 h-4 text-agro-400"></i>';
      badgeHtml = '<span class="text-[10px] px-2 py-0.5 rounded font-bold bg-agro-500/20 text-agro-300 border border-agro-500/30">Carga Inicial</span>';
      contentHtml = `
        <div class="mt-2 text-xs text-slate-300 flex justify-between items-center">
          <div>
            <span class="text-slate-400 block text-[11px]">Fertilizante:</span>
            <strong class="text-white text-sm">${state.fertilizerName}</strong>
          </div>
          <div class="text-right">
            <span class="text-slate-400 block text-[11px]">Carga:</span>
            <strong class="text-white text-sm">${ev.refillKg.toLocaleString('es-ES')} kg</strong>
          </div>
        </div>
      `;
    } else if (ev.type === 'refill') {
      iconHtml = '<i data-lucide="plus-circle" class="w-4 h-4 text-blue-400"></i>';
      badgeHtml = '<span class="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">Recarga</span>';
      contentHtml = `
        <div class="mt-2 grid grid-cols-2 gap-2 text-xs bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
          <div>
            <span class="text-slate-400 text-[11px] block">Kilos cargados:</span>
            <span class="text-blue-400 font-extrabold text-sm">+${ev.refillKg.toLocaleString('es-ES')} kg</span>
            ${ev.note ? `<span class="text-[10px] text-slate-400 italic block mt-0.5 truncate">${ev.note}</span>` : ''}
          </div>
          <div class="text-right">
            <span class="text-slate-400 text-[11px] block">Tolva resultante:</span>
            <span class="text-white font-bold text-sm">${ev.newTolvaKg.toLocaleString('es-ES')} kg</span>
          </div>
        </div>
      `;
    } else if (ev.type === 'field') {
      iconHtml = '<i data-lucide="map-pin" class="w-4 h-4 text-amber-400"></i>';
      badgeHtml = '<span class="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Campo / Lote</span>';
      contentHtml = `
        <div class="mt-1.5 mb-2 font-bold text-sm text-white flex items-center justify-between">
          <span class="truncate pr-2">${ev.fieldName}</span>
          <span class="text-xs font-semibold px-2 py-0.5 bg-slate-700/60 text-slate-200 rounded shrink-0">${ev.hectares} ha</span>
        </div>

        <div class="grid grid-cols-3 gap-2 text-xs bg-slate-900/50 p-2.5 rounded-lg border border-slate-800 text-center">
          <div>
            <span class="text-[10px] text-slate-400 block">Gastado</span>
            <strong class="text-amber-400 font-bold">${ev.spentKg.toLocaleString('es-ES')} kg</strong>
          </div>
          <div>
            <span class="text-[10px] text-slate-400 block">Dosis real</span>
            <strong class="text-agro-400 font-bold">${ev.doseKgHa} kg/ha</strong>
          </div>
          <div>
            <span class="text-[10px] text-slate-400 block">Quedó Tolva</span>
            <strong class="text-white font-bold">${ev.remainingKg.toLocaleString('es-ES')} kg</strong>
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="flex items-center justify-between pb-1 border-b border-slate-700/40">
        <div class="flex items-center gap-1.5">
          ${iconHtml}
          ${badgeHtml}
        </div>
        <button class="btn-delete-event text-slate-500 hover:text-red-400 p-1 rounded transition" data-id="${ev.id}" title="Eliminar registro">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
      ${contentHtml}
    `;

    // Handler de eliminación
    card.querySelector('.btn-delete-event').addEventListener('click', (e) => {
      e.stopPropagation();
      const id = ev.id;
      if (confirm(`¿Deseas eliminar este registro de "${ev.fieldName || ev.type}"?`)) {
        deleteEvent(id);
      }
    });

    return card;
  }

  function deleteEvent(id) {
    state.events = state.events.filter(e => e.id !== id);
    recalculateChain();
    renderDashboard();
    renderLog();
  }

  // =========================================================================
  // RECONOCIMIENTO DE VOZ E INTELIGENCIA ARTIFICIAL
  // =========================================================================

  let activeRecognition = null;
  let isListening = false;
  let accumulatedFinalText = '';
  let latestInterimText = '';
  const voiceLiveTranscript = document.getElementById('voiceLiveTranscript');

  btnVoiceRecord.addEventListener('click', () => {
    if (!voiceParser.isSpeechSupported()) {
      alert('Tu navegador no soporta reconocimiento de voz por botón. Puedes usar el cuadro de texto abajo para dictar directamente con el micrófono de tu teclado.');
      return;
    }

    if (!isListening) {
      startVoiceListening();
    } else {
      stopVoiceListening();
    }
  });

  function startVoiceListening() {
    // Si había una sesión previa, forzar limpieza
    if (activeRecognition) {
      try { activeRecognition.abort(); } catch (e) {}
      activeRecognition = null;
    }

    accumulatedFinalText = '';
    latestInterimText = '';
    if (voiceLiveTranscript) voiceLiveTranscript.textContent = '';

    // Crear instancia nueva y limpia en CADA intento (evita error "aborted" o "already started")
    activeRecognition = voiceParser.createRecognition();
    if (!activeRecognition) {
      alert('No se pudo inicializar el micrófono en este navegador.');
      return;
    }

    activeRecognition.onstart = () => {
      isListening = true;
      voicePulseRing.classList.remove('hidden');
      btnVoiceRecord.classList.add('recording-pulse');
      voiceStatusText.textContent = '🎙️ Escuchando... Di tu reporte (Toca para finalizar)';
      voiceStatusText.classList.add('text-red-400');
    };

    activeRecognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex || 0; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          accumulatedFinalText += ' ' + item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }
      latestInterimText = interim;
      const currentFull = (accumulatedFinalText + ' ' + interim).trim();
      if (voiceLiveTranscript && currentFull) {
        voiceLiveTranscript.textContent = `"${currentFull}"`;
      }
    };

    activeRecognition.onerror = (event) => {
      console.warn('SpeechRecognition error:', event.error);
      const err = event.error;

      if (err === 'not-allowed' || err === 'service-not-allowed') {
        alert('El micrófono está bloqueado en tu navegador. Toca el ícono del candado o permisos en tu navegador para permitir el micrófono, o usa el campo de texto de abajo.');
      } else if (err === 'no-speech') {
        voiceStatusText.textContent = 'No se escuchó voz. Toca e intenta de nuevo';
      }
      // Si es 'aborted', simplemente reseteamos la UI sin molestar al usuario
      resetVoiceUI();
    };

    activeRecognition.onend = () => {
      const fullSpoken = (accumulatedFinalText + ' ' + latestInterimText).trim();
      resetVoiceUI();

      if (fullSpoken.length > 0) {
        if (voiceLiveTranscript) voiceLiveTranscript.textContent = '';
        processSpokenText(fullSpoken);
      }
    };

    try {
      activeRecognition.start();
    } catch (e) {
      console.warn('Error al iniciar activeRecognition:', e);
      resetVoiceUI();
    }
  }

  function stopVoiceListening() {
    if (activeRecognition) {
      try {
        activeRecognition.stop(); // Deja que termine y procese lo dicho en onend
      } catch (e) {
        resetVoiceUI();
      }
    } else {
      resetVoiceUI();
    }
  }

  function resetVoiceUI() {
    isListening = false;
    activeRecognition = null;
    voicePulseRing.classList.add('hidden');
    btnVoiceRecord.classList.remove('recording-pulse');
    voiceStatusText.textContent = 'Tocar para empezar a hablar';
    voiceStatusText.classList.remove('text-red-400');
  }

  // Formulario de dictado o escritura directa por teclado (Plan B permanente)
  const formDirectVoice = document.getElementById('formDirectVoice');
  const inputDirectVoiceText = document.getElementById('inputDirectVoiceText');
  if (formDirectVoice) {
    formDirectVoice.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = inputDirectVoiceText.value.trim();
      if (text) {
        inputDirectVoiceText.value = '';
        processSpokenText(text);
      }
    });
  }

  // Botones de ejemplo rápido en la UI para probar sin micrófono
  document.querySelectorAll('.voice-example-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.innerText.replace(/"/g, '').trim();
      processSpokenText(text);
    });
  });

  function processSpokenText(text) {
    // Pasar por el parser inteligente adaptado al campo
    const parsed = voiceParser.parseInput(text, state.currentTolvaKg);

    // Abrir modal de confirmación con los datos parseados
    openVoiceConfirmModal(parsed);
  }

  function openVoiceConfirmModal(parsed) {
    document.getElementById('voiceTranscriptText').textContent = `"${parsed.rawText}"`;
    document.getElementById('voiceFieldType').value = parsed.type;

    const groupFieldName = document.getElementById('voiceGroupFieldName');
    const groupHaDose = document.getElementById('voiceGroupHaDose');
    const groupRemainingKg = document.getElementById('voiceGroupRemainingKg');
    const groupRefillKg = document.getElementById('voiceGroupRefillKg');
    const groupFertilizer = document.getElementById('voiceGroupFertilizer');

    const inputFieldName = document.getElementById('voiceInputFieldName');
    const inputHa = document.getElementById('voiceInputHa');
    const inputDose = document.getElementById('voiceInputDose');
    const inputRemainingKg = document.getElementById('voiceInputRemainingKg');
    const inputRefillKg = document.getElementById('voiceInputRefillKg');
    const inputFertilizer = document.getElementById('voiceInputFertilizer');

    inputFieldName.value = parsed.fieldName || '';
    inputHa.value = parsed.hectares !== null ? parsed.hectares : '';
    inputDose.value = parsed.dose || parsed.calculatedDose || '';
    inputRemainingKg.value = parsed.remainingKg !== null ? parsed.remainingKg : '';
    inputRefillKg.value = parsed.refillKg !== null ? parsed.refillKg : '';
    inputFertilizer.value = parsed.fertilizer || state.fertilizerName;

    // Toggle de visibilidad según tipo
    function updateFieldVisibility() {
      const type = document.getElementById('voiceFieldType').value;
      if (type === 'field') {
        groupFieldName.classList.remove('hidden');
        groupHaDose.classList.remove('hidden');
        groupRemainingKg.classList.remove('hidden');
        groupRefillKg.classList.add('hidden');
        groupFertilizer.classList.add('hidden');
        document.getElementById('voiceCalculationPreview').classList.remove('hidden');
      } else if (type === 'refill') {
        groupFieldName.classList.add('hidden');
        groupHaDose.classList.add('hidden');
        groupRemainingKg.classList.add('hidden');
        groupRefillKg.classList.remove('hidden');
        groupFertilizer.classList.add('hidden');
        document.getElementById('voiceCalculationPreview').classList.add('hidden');
      } else if (type === 'init') {
        groupFieldName.classList.add('hidden');
        groupHaDose.classList.add('hidden');
        groupRemainingKg.classList.add('hidden');
        groupRefillKg.classList.remove('hidden');
        groupFertilizer.classList.remove('hidden');
        document.getElementById('voiceCalculationPreview').classList.add('hidden');
      }
      updateVoicePreviewCalcs();
    }

    document.getElementById('voiceFieldType').onchange = updateFieldVisibility;
    inputRemainingKg.oninput = () => updateVoicePreviewCalcs();
    inputHa.oninput = () => {
      const rem = parseFloat(inputRemainingKg.value) || 0;
      const spent = Math.max(0, state.currentTolvaKg - rem);
      const ha = parseFloat(inputHa.value) || 0;
      if (spent > 0 && ha > 0) {
        inputDose.value = Math.round(spent / ha);
      }
      updateVoicePreviewCalcs();
    };
    inputDose.oninput = () => {
      const rem = parseFloat(inputRemainingKg.value) || 0;
      const spent = Math.max(0, state.currentTolvaKg - rem);
      const dose = parseFloat(inputDose.value) || 0;
      if (spent > 0 && dose > 0) {
        inputHa.value = (spent / dose).toFixed(2);
      }
      updateVoicePreviewCalcs();
    };

    function updateVoicePreviewCalcs() {
      const rem = parseFloat(inputRemainingKg.value) || 0;
      const ha = parseFloat(inputHa.value) || 0;
      const doseVal = parseFloat(inputDose.value) || 0;
      const prev = state.currentTolvaKg;
      const spent = Math.max(0, prev - rem);
      const dose = doseVal > 0 ? Math.round(doseVal) : (ha > 0 ? Math.round(spent / ha) : 0);

      document.getElementById('prevPreviewKg').textContent = `${prev.toLocaleString('es-ES')} kg`;
      document.getElementById('spentPreviewKg').textContent = `${spent.toLocaleString('es-ES')} kg`;
      document.getElementById('dosePreviewKg').textContent = `${dose.toLocaleString('es-ES')} kg/ha (${ha > 0 ? ha.toFixed(2) : '-'} ha)`;
    }

    updateFieldVisibility();
    modalVoiceConfirm.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  document.getElementById('btnCloseVoiceConfirm').addEventListener('click', () => modalVoiceConfirm.classList.add('hidden'));
  document.getElementById('btnCancelVoiceConfirm').addEventListener('click', () => modalVoiceConfirm.classList.add('hidden'));

  formVoiceConfirm.addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('voiceFieldType').value;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (type === 'field') {
      const fieldName = document.getElementById('voiceInputFieldName').value.trim() || 'Campo sin nombre';
      let hectares = parseFloat(document.getElementById('voiceInputHa').value);
      let dose = parseFloat(document.getElementById('voiceInputDose').value);
      const remainingKg = parseFloat(document.getElementById('voiceInputRemainingKg').value) || 0;

      const spentKg = Math.max(0, state.currentTolvaKg - remainingKg);

      if ((isNaN(hectares) || hectares <= 0) && (isNaN(dose) || dose <= 0)) {
        alert('Debes indicar las Hectáreas realizadas O la Dosis deseada.');
        return;
      }

      if ((isNaN(hectares) || hectares <= 0) && dose > 0) {
        hectares = parseFloat((spentKg / dose).toFixed(2));
      }

      const doseKgHa = (!isNaN(dose) && dose > 0) ? Math.round(dose) : (hectares > 0 ? Math.round(spentKg / hectares) : 0);

      state.events.push({
        id: Date.now().toString(),
        type: 'field',
        time: nowTime,
        fieldName,
        hectares,
        initialTolvaKg: state.currentTolvaKg,
        remainingKg,
        spentKg,
        doseKgHa,
        newTolvaKg: remainingKg
      });
    } else if (type === 'refill') {
      const refillKg = parseFloat(document.getElementById('voiceInputRefillKg').value) || 0;
      state.events.push({
        id: Date.now().toString(),
        type: 'refill',
        time: nowTime,
        refillKg,
        initialTolvaKg: state.currentTolvaKg,
        newTolvaKg: state.currentTolvaKg + refillKg,
        note: 'Recarga dictada por voz'
      });
    } else if (type === 'init') {
      const refillKg = parseFloat(document.getElementById('voiceInputRefillKg').value) || 0;
      const fert = document.getElementById('voiceInputFertilizer').value.trim();
      if (fert) state.fertilizerName = fert;
      state.initialLoadKg = refillKg;
      state.events.push({
        id: Date.now().toString(),
        type: 'init',
        time: nowTime,
        refillKg,
        initialTolvaKg: 0,
        newTolvaKg: refillKg
      });
    }

    recalculateChain();
    renderDashboard();
    renderLog();
    modalVoiceConfirm.classList.add('hidden');
  });

  // =========================================================================
  // MODAL: REGISTRO MANUAL DE CAMPO
  // =========================================================================

  const inputFieldRemainingKg = document.getElementById('inputFieldRemainingKg');
  const inputFieldHa = document.getElementById('inputFieldHa');
  const inputFieldDose = document.getElementById('inputFieldDose');
  const fieldLiveSpentKg = document.getElementById('fieldLiveSpentKg');
  const fieldLiveHa = document.getElementById('fieldLiveHa');
  const fieldLiveDose = document.getElementById('fieldLiveDose');

  btnOpenFieldModal.addEventListener('click', () => {
    document.getElementById('fieldCurrentStockDisplay').textContent = state.currentTolvaKg.toLocaleString('es-ES');
    document.getElementById('inputFieldName').value = '';
    inputFieldHa.value = '';
    inputFieldDose.value = '';
    inputFieldRemainingKg.value = '';
    fieldLiveSpentKg.textContent = '-';
    fieldLiveHa.textContent = '-';
    fieldLiveDose.textContent = '-';
    modalField.classList.remove('hidden');
    document.getElementById('inputFieldName').focus();
    if (window.lucide) window.lucide.createIcons();
  });

  document.getElementById('btnCloseFieldModal').addEventListener('click', () => modalField.classList.add('hidden'));
  document.getElementById('btnCancelFieldModal').addEventListener('click', () => modalField.classList.add('hidden'));

  // Cálculo en vivo cruzado mientras tipea
  function updateFieldLiveCalcs(origin) {
    const rem = parseFloat(inputFieldRemainingKg.value);
    if (!isNaN(rem)) {
      const spent = Math.max(0, state.currentTolvaKg - rem);
      fieldLiveSpentKg.textContent = `${spent.toLocaleString('es-ES')} kg`;

      if (origin === 'ha') {
        const ha = parseFloat(inputFieldHa.value);
        if (!isNaN(ha) && ha > 0 && spent > 0) {
          const dose = Math.round(spent / ha);
          inputFieldDose.value = dose;
          fieldLiveDose.textContent = `${dose.toLocaleString('es-ES')} kg/ha`;
          fieldLiveHa.textContent = `${ha.toFixed(2)} ha`;
        } else {
          fieldLiveDose.textContent = '-';
        }
      } else if (origin === 'dose') {
        const dose = parseFloat(inputFieldDose.value);
        if (!isNaN(dose) && dose > 0 && spent > 0) {
          const ha = parseFloat((spent / dose).toFixed(2));
          inputFieldHa.value = ha;
          fieldLiveHa.textContent = `${ha.toFixed(2)} ha`;
          fieldLiveDose.textContent = `${Math.round(dose).toLocaleString('es-ES')} kg/ha`;
        } else {
          fieldLiveHa.textContent = '-';
        }
      } else if (origin === 'remaining') {
        const ha = parseFloat(inputFieldHa.value);
        const dose = parseFloat(inputFieldDose.value);
        if (!isNaN(ha) && ha > 0) {
          const newDose = Math.round(spent / ha);
          inputFieldDose.value = newDose;
          fieldLiveDose.textContent = `${newDose.toLocaleString('es-ES')} kg/ha`;
          fieldLiveHa.textContent = `${ha.toFixed(2)} ha`;
        } else if (!isNaN(dose) && dose > 0) {
          const newHa = parseFloat((spent / dose).toFixed(2));
          inputFieldHa.value = newHa;
          fieldLiveHa.textContent = `${newHa.toFixed(2)} ha`;
          fieldLiveDose.textContent = `${Math.round(dose).toLocaleString('es-ES')} kg/ha`;
        }
      }
    } else {
      fieldLiveSpentKg.textContent = '-';
      fieldLiveHa.textContent = '-';
      fieldLiveDose.textContent = '-';
    }
  }

  inputFieldRemainingKg.addEventListener('input', () => updateFieldLiveCalcs('remaining'));
  inputFieldHa.addEventListener('input', () => updateFieldLiveCalcs('ha'));
  inputFieldDose.addEventListener('input', () => updateFieldLiveCalcs('dose'));

  formField.addEventListener('submit', (e) => {
    e.preventDefault();
    const fieldName = document.getElementById('inputFieldName').value.trim();
    let hectares = parseFloat(inputFieldHa.value);
    let dose = parseFloat(inputFieldDose.value);
    const remainingKg = parseFloat(inputFieldRemainingKg.value);

    if (isNaN(remainingKg)) {
      alert('Debes ingresar cuántos kg te quedaron en la tolva.');
      return;
    }

    if ((isNaN(hectares) || hectares <= 0) && (isNaN(dose) || dose <= 0)) {
      alert('Debes ingresar las Hectáreas realizadas O la Dosis deseada para poder calcular el campo.');
      return;
    }

    if (remainingKg > state.currentTolvaKg) {
      if (!confirm(`Indicaste que te quedan ${remainingKg} kg, pero en la tolva figuraban ${state.currentTolvaKg} kg. ¿Deseas guardarlo de todas formas?`)) {
        return;
      }
    }

    const spentKg = Math.max(0, state.currentTolvaKg - remainingKg);

    // Si solo puso dosis, calculamos las ha
    if ((isNaN(hectares) || hectares <= 0) && dose > 0) {
      hectares = parseFloat((spentKg / dose).toFixed(2));
    }

    // Dosis final
    const doseKgHa = (!isNaN(dose) && dose > 0) ? Math.round(dose) : (hectares > 0 ? Math.round(spentKg / hectares) : 0);
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    state.events.push({
      id: Date.now().toString(),
      type: 'field',
      time: nowTime,
      fieldName,
      hectares,
      initialTolvaKg: state.currentTolvaKg,
      remainingKg,
      spentKg,
      doseKgHa,
      newTolvaKg: remainingKg
    });

    recalculateChain();
    renderDashboard();
    renderLog();
    modalField.classList.add('hidden');
  });

  // =========================================================================
  // MODAL: RECARGA DE TOLVA
  // =========================================================================

  btnOpenRefillModal.addEventListener('click', () => {
    document.getElementById('refillCurrentStockDisplay').textContent = state.currentTolvaKg.toLocaleString('es-ES');
    document.getElementById('inputRefillKg').value = '';
    document.getElementById('inputRefillNote').value = '';
    document.getElementById('refillNewTotalDisplay').textContent = `${state.currentTolvaKg.toLocaleString('es-ES')} kg`;
    modalRefill.classList.remove('hidden');
    document.getElementById('inputRefillKg').focus();
    if (window.lucide) window.lucide.createIcons();
  });

  document.getElementById('btnCloseRefillModal').addEventListener('click', () => modalRefill.classList.add('hidden'));
  document.getElementById('btnCancelRefillModal').addEventListener('click', () => modalRefill.classList.add('hidden'));

  document.getElementById('inputRefillKg').addEventListener('input', (e) => {
    const add = parseFloat(e.target.value) || 0;
    const total = state.currentTolvaKg + add;
    document.getElementById('refillNewTotalDisplay').textContent = `${total.toLocaleString('es-ES')} kg`;
  });

  formRefill.addEventListener('submit', (e) => {
    e.preventDefault();
    const refillKg = parseFloat(document.getElementById('inputRefillKg').value);
    const note = document.getElementById('inputRefillNote').value.trim();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    state.events.push({
      id: Date.now().toString(),
      type: 'refill',
      time: nowTime,
      refillKg,
      initialTolvaKg: state.currentTolvaKg,
      newTolvaKg: state.currentTolvaKg + refillKg,
      note
    });

    recalculateChain();
    renderDashboard();
    renderLog();
    modalRefill.classList.add('hidden');
  });

  // =========================================================================
  // MODAL: CONFIGURACIÓN DE FERTILIZANTE & CARGA INICIAL
  // =========================================================================

  function openFertilizerModal() {
    document.getElementById('inputFertilizerName').value = state.fertilizerName !== 'Sin Definir' ? state.fertilizerName : '';
    document.getElementById('inputInitialLoadKg').value = state.initialLoadKg || '';
    modalFertilizer.classList.remove('hidden');
    document.getElementById('inputFertilizerName').focus();
    if (window.lucide) window.lucide.createIcons();
  }

  window.openFertilizerModal = openFertilizerModal;

  document.getElementById('btnCloseFertilizerModal').addEventListener('click', () => modalFertilizer.classList.add('hidden'));
  document.getElementById('btnCancelFertilizerModal').addEventListener('click', () => modalFertilizer.classList.add('hidden'));

  formFertilizer.addEventListener('submit', (e) => {
    e.preventDefault();
    const fertName = document.getElementById('inputFertilizerName').value.trim();
    const initKg = parseFloat(document.getElementById('inputInitialLoadKg').value) || 0;

    state.fertilizerName = fertName;

    // Si cambió la carga inicial y no había eventos de init, o actualizamos el primero
    const initEventIndex = state.events.findIndex(e => e.type === 'init');
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (initEventIndex >= 0) {
      state.events[initEventIndex].refillKg = initKg;
    } else if (initKg > 0) {
      state.events.unshift({
        id: Date.now().toString(),
        type: 'init',
        time: nowTime,
        refillKg: initKg,
        initialTolvaKg: 0,
        newTolvaKg: initKg
      });
    }

    state.initialLoadKg = initKg;
    recalculateChain();
    renderDashboard();
    renderLog();
    modalFertilizer.classList.add('hidden');
  });

  // =========================================================================
  // NUEVA JORNADA
  // =========================================================================

  btnNewDay.addEventListener('click', () => {
    if (state.events.length === 0) {
      alert('La jornada ya está limpia.');
      return;
    }

    if (confirm('¿Deseas iniciar una NUEVA JORNADA? Se reiniciarán los registros del día. Asegúrate de haber descargado el PDF si lo necesitas.')) {
      state = getInitialState();
      saveState();
      renderDashboard();
      renderLog();
      openFertilizerModal();
    }
  });

  // =========================================================================
  // EXPORTACIÓN A PDF (jsPDF + autoTable)
  // =========================================================================

  btnExportPDF.addEventListener('click', () => {
    generatePDF();
  });

  function generatePDF() {
    if (typeof window.jspdf === 'undefined') {
      alert('La librería PDF no se ha cargado. Verifica la conexión.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [22, 101, 52]; // Verde agro #166534
    const darkGray = [30, 41, 59];
    const lightBg = [248, 250, 252];

    // Encabezado
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 20, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('REPORTE DE FERTILIZACIÓN', 14, 13);

    // Caja de Metadatos
    doc.setFillColor(...lightBg);
    doc.roundedRect(14, 26, 182, 24, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, 26, 182, 24, 2, 2, 'S');

    doc.setTextColor(...darkGray);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);

    const formattedDate = formatDisplayDate(state.date) || new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Fecha: ${formattedDate}`, 18, 33);
    doc.text(`Fertilizante: ${state.fertilizerName || 'No especificado'}`, 18, 40);
    doc.text(`Carga Inicial: ${(state.initialLoadKg || 0).toLocaleString('es-ES')} kg`, 18, 46);

    // Métricas en la caja derecha
    let totalHa = 0;
    let totalSpent = 0;
    let totalRefill = 0;

    state.events.forEach(e => {
      if (e.type === 'field') {
        totalHa += (e.hectares || 0);
        totalSpent += (e.spentKg || 0);
      } else if (e.type === 'refill') {
        totalRefill += (e.refillKg || 0);
      }
    });

    doc.text(`Total Superficie: ${totalHa.toFixed(1)} ha`, 120, 33);
    doc.text(`Total Fertilizante Aplicado: ${totalSpent.toLocaleString('es-ES')} kg`, 120, 40);
    doc.text(`Saldo Final en Tolva: ${state.currentTolvaKg.toLocaleString('es-ES')} kg`, 120, 46);

    // Preparar filas de la tabla (sin horas)
    const tableRows = [];

    state.events.forEach((ev) => {
      if (ev.type === 'init') {
        tableRows.push([
          'INICIO DE JORNADA - CARGA INICIAL',
          '-',
          '-',
          '-',
          `+${ev.refillKg.toLocaleString('es-ES')} kg`,
          `${ev.newTolvaKg.toLocaleString('es-ES')} kg`
        ]);
      } else if (ev.type === 'refill') {
        tableRows.push([
          `RECARGA TOLVA ${ev.note ? `(${ev.note})` : ''}`,
          '-',
          '-',
          '-',
          `+${ev.refillKg.toLocaleString('es-ES')} kg`,
          `${ev.newTolvaKg.toLocaleString('es-ES')} kg`
        ]);
      } else if (ev.type === 'field') {
        tableRows.push([
          ev.fieldName,
          `${ev.hectares} ha`,
          `${ev.doseKgHa} kg/ha`,
          `${ev.spentKg.toLocaleString('es-ES')} kg`,
          '-',
          `${ev.remainingKg.toLocaleString('es-ES')} kg`
        ]);
      }
    });

    if (tableRows.length === 0) {
      tableRows.push(['Sin registros ingresados en la jornada', '-', '-', '-', '-', '-']);
    }

    // AutoTable
    doc.autoTable({
      startY: 56,
      head: [['Campo / Detalle de Evento', 'Sup (ha)', 'Dosis Real', 'Kg Gastados', 'Kg Recarga', 'Tolva Queda']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 24, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 22, halign: 'right' }
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [30, 41, 59]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      didParseCell: function(data) {
        // Resaltar filas de recarga o inicio
        if (data.section === 'body') {
          const rowText = data.row.raw[0] || '';
          if (rowText.includes('RECARGA')) {
            data.cell.styles.fillColor = [239, 246, 255]; // Azul suave
            data.cell.styles.fontStyle = 'bold';
          } else if (rowText.includes('INICIO')) {
            data.cell.styles.fillColor = [240, 253, 244]; // Verde suave
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    // Cuadro de Totales al final
    const finalY = doc.lastAutoTable.finalY + 8;
    const avgDoseGlobal = totalHa > 0 ? Math.round(totalSpent / totalHa) : 0;

    doc.setFillColor(...lightBg);
    doc.roundedRect(14, finalY, 182, 22, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, finalY, 182, 22, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);
    doc.text('TOTALES ACUMULADOS:', 18, finalY + 7);

    doc.setFont('helvetica', 'normal');
    doc.text(`• Hectáreas Totales: ${totalHa.toFixed(2)} ha`, 18, finalY + 14);
    doc.text(`• Dosis Media: ${avgDoseGlobal} kg/ha`, 18, finalY + 19);

    doc.text(`• Fertilizante Gastado: ${totalSpent.toLocaleString('es-ES')} kg`, 105, finalY + 14);
    doc.text(`• Saldo Disponible en Tolva: ${state.currentTolvaKg.toLocaleString('es-ES')} kg`, 105, finalY + 19);

    // Firma / Nota al pie
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Firma Operador / Responsable: ________________________________', 14, finalY + 36);

    const fileName = `Reporte_Abonadora_${state.date || 'hoy'}.pdf`;
    doc.save(fileName);
  }

  // =========================================================================
  // COMPARTIR POR WHATSAPP
  // =========================================================================

  btnShareWhatsApp.addEventListener('click', () => {
    shareViaWhatsApp();
  });

  function shareViaWhatsApp() {
    let totalHa = 0;
    let totalSpent = 0;
    let fieldsText = '';

    state.events.forEach((ev) => {
      if (ev.type === 'init') {
        fieldsText += `🚀 *Carga Inicial:* ${ev.refillKg.toLocaleString('es-ES')} kg (${state.fertilizerName})\n`;
      } else if (ev.type === 'refill') {
        fieldsText += `➕ *Recarga:* +${ev.refillKg.toLocaleString('es-ES')} kg ${ev.note ? `(${ev.note})` : ''} ➜ Tolva: ${ev.newTolvaKg.toLocaleString('es-ES')} kg\n`;
      } else if (ev.type === 'field') {
        totalHa += (ev.hectares || 0);
        totalSpent += (ev.spentKg || 0);
        fieldsText += `🌾 *${ev.fieldName}* (${ev.hectares} ha)\n   - Gastado: ${ev.spentKg.toLocaleString('es-ES')} kg (${ev.doseKgHa} kg/ha)\n   - Quedó en tolva: ${ev.remainingKg.toLocaleString('es-ES')} kg\n`;
      }
    });

    const avgDose = totalHa > 0 ? Math.round(totalSpent / totalHa) : 0;

    const dateHeaderFormatted = formatDisplayDate(state.date) || new Date().toLocaleDateString('es-ES');

    const message = 
`📋 *REPORTE DE ABONADORA - ${dateHeaderFormatted}*
🌱 *Fertilizante:* ${state.fertilizerName}
⚖️ *Carga Inicial:* ${(state.initialLoadKg || 0).toLocaleString('es-ES')} kg

*DETALLE DE CAMPOS Y RECARGAS:*
${fieldsText || 'Sin eventos registrados'}

📊 *RESUMEN DE LA JORNADA:*
• *Superficie:* ${totalHa.toFixed(1)} ha
• *Fertilizante Aplicado:* ${totalSpent.toLocaleString('es-ES')} kg
• *Dosis Promedio:* ${avgDose} kg/ha
• *Saldo Actual en Tolva:* ${state.currentTolvaKg.toLocaleString('es-ES')} kg`;

    const encoded = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(whatsappUrl, '_blank');
  }

});
