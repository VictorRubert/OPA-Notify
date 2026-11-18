const DEFAULTS = {
  enabled: true,
  visualEnabled: true,
  otherTabsEnabled: true,
  systemNotificationsEnabled: true,
  colorHighlightEnabled: true,
  highlightFillMode: 'soft',
  motivoHighlightEnabled: true,
  motivoBlinkEnabled: true,
  motivoChargeEnabled: true,
  notifyOnFinished: true,
  ...OpaTagSettings.defaults, notifyClientMessages: true, messageScope: 'all',
  soundEnabled: true,
  volume: 0.8,
  soundPreset: 'classic',
  toastDuration: 6000,
  toastPosition: 'top-left',
  customSoundName: ''
};

const MAX_CUSTOM_AUDIO_BYTES = 2 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg'
]);

const elements = {};
let feedbackTimer = null;
let statusTimer = null;

window.addEventListener('DOMContentLoaded', () => {
  initialize().catch(error => showFeedback(error.message, true));
});

async function initialize() {
  cacheElements();
  bindEvents();
  await loadSettings();
  await updateStatus();
  statusTimer = setInterval(updateStatus, 3000);
}

function cacheElements() {
  for (const id of [
    'enabled', 'visualEnabled', 'otherTabsEnabled', 'systemNotificationsEnabled', 'colorHighlightEnabled', 'highlightFillMode', 'motivoHighlightEnabled', 'motivoBlinkEnabled', 'motivoChargeEnabled', 'notifyOnFinished', 'soundEnabled',
    'volume', 'volumeValue', 'soundPreset', 'toastDuration', 'toastDurationValue', 'toastPosition',
    'customSoundArea', 'customSoundFile', 'customSoundName',
    'copyDiagnostics', 'resetBaseline',
    'feedback', 'currentCount', 'statusText', 'lastCheck', 'statusDot',
    'attendanceHistory', 'historyEmpty', 'historyCount',
    'clearHighlight',
    'groupByTag', 'notifyClientMessages', 'messageScope', 'tagMode', 'groupOptions',
    'scopeArea', 'priorityArea', 'groupTags', 'priorityTags', 'groupTagForm',
    'priorityTagForm', 'groupTagName', 'priorityTagName'
  ]) {
    elements[id] = document.getElementById(id);
  }
}

function bindEvents() {
  for (const key of ['groupByTag', 'notifyClientMessages', 'messageScope', 'tagMode']) {
    elements[key].addEventListener('change', async () => {
      updateTagControls();
      await chrome.storage.local.set({ [key]: elements[key].type === 'checkbox' ? elements[key].checked : elements[key].value });
    });
  }
  bindTagList('groupTags', elements.groupTagForm, elements.groupTagName);
  bindTagList('priorityTags', elements.priorityTagForm, elements.priorityTagName);
  elements.enabled.addEventListener('change', saveSimpleSettings);
  elements.otherTabsEnabled.addEventListener('change', saveSimpleSettings);
  elements.systemNotificationsEnabled.addEventListener('change', saveSimpleSettings);
  elements.visualEnabled.addEventListener('change', saveSimpleSettings);
  elements.colorHighlightEnabled.addEventListener('change', async () => {
    updateHighlightControls();
    await saveSimpleSettings();
    await updateStatus();
  });
  elements.highlightFillMode.addEventListener('change', saveSimpleSettings);
  elements.motivoHighlightEnabled.addEventListener('change', saveSimpleSettings);
  elements.motivoBlinkEnabled.addEventListener('change', saveSimpleSettings);
  elements.motivoChargeEnabled.addEventListener('change', saveSimpleSettings);
  elements.notifyOnFinished.addEventListener('change', saveSimpleSettings);
  elements.soundEnabled.addEventListener('change', saveSimpleSettings);
  elements.soundPreset.addEventListener('change', async () => {
    updateCustomSoundVisibility();
    await saveSimpleSettings();
  });
  elements.toastDuration.addEventListener('input', updateDurationLabel);
  elements.toastDuration.addEventListener('change', saveSimpleSettings);
  elements.toastPosition.addEventListener('change', saveSimpleSettings);
  elements.volume.addEventListener('input', () => {
    elements.volumeValue.value = `${elements.volume.value}%`;
  });
  elements.volume.addEventListener('change', saveSimpleSettings);
  elements.customSoundFile.addEventListener('change', handleCustomSoundFile);
  elements.copyDiagnostics.addEventListener('click', copyDiagnostics);
  elements.clearHighlight.addEventListener('click', clearProtocolHighlight);
  elements.resetBaseline.addEventListener('click', resetBaseline);
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const settings = { ...DEFAULTS, ...stored };

  elements.groupByTag.checked = settings.groupByTag;
  elements.notifyClientMessages.checked = settings.notifyClientMessages;
  elements.messageScope.value = settings.messageScope;
  elements.tagMode.value = settings.tagMode;
  for (const key of ['groupTags', 'priorityTags']) renderTagList(key, settings[key]);
  updateTagControls();
  elements.enabled.checked = settings.enabled;
  elements.visualEnabled.checked = settings.visualEnabled;
  elements.otherTabsEnabled.checked = settings.otherTabsEnabled;
  elements.systemNotificationsEnabled.checked = settings.systemNotificationsEnabled;
  elements.colorHighlightEnabled.checked = settings.colorHighlightEnabled;
  elements.highlightFillMode.value = normalizeHighlightFillMode(settings.highlightFillMode);
  elements.motivoHighlightEnabled.checked = settings.motivoHighlightEnabled;
  elements.motivoBlinkEnabled.checked = settings.motivoBlinkEnabled;
  elements.motivoChargeEnabled.checked = settings.motivoChargeEnabled;
  elements.notifyOnFinished.checked = settings.notifyOnFinished;
  elements.soundEnabled.checked = settings.soundEnabled;
  elements.volume.value = Math.round(settings.volume * 100);
  elements.volumeValue.value = `${elements.volume.value}%`;
  elements.soundPreset.value = settings.soundPreset;
  const duration = Number(settings.toastDuration);
  elements.toastDuration.value = String(Number.isFinite(duration) ? Math.round(Math.max(5000, Math.min(30000, duration)) / 1000) * 1000 : 6000);
  updateDurationLabel();
  elements.toastPosition.value = ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(settings.toastPosition) ? settings.toastPosition : 'top-left';
  elements.customSoundName.textContent = settings.customSoundName || 'Nenhum arquivo selecionado';
  updateCustomSoundVisibility();
  updateHighlightControls();
}

async function saveSimpleSettings() {
  await chrome.storage.local.set({
    enabled: elements.enabled.checked,
    visualEnabled: elements.visualEnabled.checked,
    otherTabsEnabled: elements.otherTabsEnabled.checked,
    systemNotificationsEnabled: elements.systemNotificationsEnabled.checked,
    colorHighlightEnabled: elements.colorHighlightEnabled.checked,
    highlightFillMode: normalizeHighlightFillMode(elements.highlightFillMode.value),
    motivoHighlightEnabled: elements.motivoHighlightEnabled.checked,
    motivoBlinkEnabled: elements.motivoBlinkEnabled.checked,
    motivoChargeEnabled: elements.motivoChargeEnabled.checked,
    notifyOnFinished: elements.notifyOnFinished.checked,
    soundEnabled: elements.soundEnabled.checked,
    volume: Number(elements.volume.value) / 100,
    soundPreset: elements.soundPreset.value,
    toastDuration: Number(elements.toastDuration.value),
    toastPosition: elements.toastPosition.value
  });

  showFeedback('Configuração salva.');
}

function updateTagControls() {
  elements.groupOptions.hidden = !elements.groupByTag.checked;
  elements.scopeArea.hidden = !elements.notifyClientMessages.checked;
  elements.priorityArea.hidden = !elements.groupByTag.checked && !(elements.notifyClientMessages.checked && elements.messageScope.value === 'priority');
}

function renderTagList(key, names) {
  const list = elements[key];
  list.replaceChildren();
  for (const [index, name] of names.entries()) {
    const li = document.createElement('li');
    li.dataset.name = name;
    const label = document.createElement('span');
    label.textContent = name;
    li.append(label);
    const control = (text, action, disabled = false) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.dataset.action = action;
      b.disabled = disabled;
      b.setAttribute('aria-label', ({ up: 'Subir', down: 'Descer', remove: 'Remover' })[action] + ' ' + name);
      li.append(b);
    };
    if (key === 'priorityTags') {
      li.draggable = true;
      control('↑', 'up', index === 0);
      control('↓', 'down', index === names.length - 1);
    }
    control('×', 'remove');
    list.append(li);
  }
}

function bindTagList(key, form, input) {
  const list = elements[key];
  const names = () => [...list.children].map(li => li.dataset.name);
  const save = values => {
    renderTagList(key, values);
    chrome.storage.local.set({ [key]: values }).catch(error => showFeedback(error.message, true));
  };
  const move = (from, to) => {
    const values = names();
    if (from < 0 || to < 0 || to >= values.length) return;
    values.splice(to, 0, values.splice(from, 1)[0]);
    save(values);
  };
  form.onsubmit = event => {
    event.preventDefault();
    const name = input.value.trim();
    const values = names();
    if (name && !values.some(value => value.toLocaleLowerCase() === name.toLocaleLowerCase())) save([...values, name]);
    input.value = '';
  };
  list.onclick = event => {
    const b = event.target.closest('[data-action]');
    if (!b) return;
    const row = b.closest('li').dataset.name;
    const i = names().indexOf(row);
    if (b.dataset.action === 'remove') save(names().filter(name => name !== row));
    else move(i, i + (b.dataset.action === 'up' ? -1 : 1));
  };
  if (key === 'priorityTags') {
    let dragged;
    list.ondragstart = event => { dragged = event.target.closest('li')?.dataset.name; };
    list.ondragover = event => event.preventDefault();
    list.ondrop = event => {
      event.preventDefault();
      move(names().indexOf(dragged), names().indexOf(event.target.closest('li')?.dataset.name));
    };
    list.ondragend = () => { dragged = null; };
  }
}

function updateDurationLabel() {
  elements.toastDurationValue.value = `${Number(elements.toastDuration.value) / 1000} seg`;
  elements.toastDuration.setAttribute('aria-valuetext', `${Number(elements.toastDuration.value) / 1000} segundos`);
}

function updateCustomSoundVisibility() {
  elements.customSoundArea.hidden = elements.soundPreset.value !== 'custom';
}

function updateHighlightControls() {
  elements.highlightFillMode.disabled = !elements.colorHighlightEnabled.checked;
}

function normalizeHighlightFillMode(value) {
  return ['soft', 'full', 'tag'].includes(value) ? value : 'soft';
}

async function handleCustomSoundFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const extensionAllowed = /\.(mp3|wav|ogg)$/i.test(file.name);
  if (!ALLOWED_AUDIO_TYPES.has(file.type) && !extensionAllowed) {
    event.target.value = '';
    showFeedback('Use um arquivo MP3, WAV ou OGG.', true);
    return;
  }

  if (file.size > MAX_CUSTOM_AUDIO_BYTES) {
    event.target.value = '';
    showFeedback('O áudio deve ter no máximo 2 MB.', true);
    return;
  }

  setBusy(elements.customSoundFile, true);

  try {
    const dataUrl = await readFileAsDataUrl(file);
    await chrome.storage.local.set({
      customSoundData: dataUrl,
      customSoundName: file.name,
      soundPreset: 'custom'
    });

    elements.soundPreset.value = 'custom';
    elements.customSoundName.textContent = file.name;
    updateCustomSoundVisibility();
    showFeedback('Áudio personalizado salvo.');
  } catch (error) {
    showFeedback(`Falha ao salvar áudio: ${error.message}`, true);
  } finally {
    setBusy(elements.customSoundFile, false);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Erro de leitura do arquivo.'));
    reader.readAsDataURL(file);
  });
}

async function clearProtocolHighlight() {
  setBusy(elements.clearHighlight, true, 'Removendo...');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CLEAR_HIGHLIGHTED_ATTENDANCE'
    });

    if (!response?.success) {
      throw new Error(response?.error || 'Não foi possível remover o destaque roxo.');
    }

    const removedProtocol = String(response.removedProtocol || '').trim();
    showFeedback(
      removedProtocol
        ? `Destaque roxo de ${removedProtocol} removido.`
        : 'Nenhum atendimento estava marcado.'
    );
  } catch (error) {
    showFeedback(error.message, true);
  } finally {
    elements.clearHighlight.textContent = 'Remover marcação atual';
    await updateStatus().catch(() => {
      elements.clearHighlight.disabled = false;
    });
  }
}

async function resetBaseline() {
  const confirmed = confirm(
    'Refazer a leitura inicial? Os atendimentos atuais serão considerados conhecidos e não gerarão aviso.'
  );
  if (!confirmed) return;

  setBusy(elements.resetBaseline, true, 'Refazendo leitura...');
  try {
    const response = await chrome.runtime.sendMessage({ type: 'RESET_BASELINE' });
    if (!response?.success) throw new Error(response?.error || 'Falha ao refazer a leitura.');
    showFeedback('Leitura inicial redefinida.');
    setTimeout(updateStatus, 900);
  } catch (error) {
    showFeedback(error.message, true);
  } finally {
    setBusy(elements.resetBaseline, false, 'Refazer leitura inicial');
  }
}

async function updateStatus() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' }).catch(() => null);
  if (!response?.success) {
    elements.statusDot.className = 'status-dot off';
    elements.statusText.textContent = 'Extensão indisponível';
    return;
  }

  elements.currentCount.textContent = response.currentCount ?? '—';
  renderHistory(response.history);
  elements.clearHighlight.disabled = !response.highlightedProtocol;
  elements.clearHighlight.title = response.highlightedProtocol
    ? `Remover marcação de ${response.highlightedProtocol}`
    : 'Nenhum atendimento está marcado';

  if (!elements.enabled.checked) {
    elements.statusDot.className = 'status-dot off';
    elements.statusText.textContent = 'Monitoramento desativado';
    elements.lastCheck.textContent = response.lastCheckAt
      ? `Última leitura: ${formatTime(response.lastCheckAt)}`
      : 'Sem leitura registrada';
    return;
  }

  if (response.lastCheckAt) {
    const age = Date.now() - response.lastCheckAt;
    elements.lastCheck.textContent = `Última leitura: ${formatTime(response.lastCheckAt)}`;

    if (age < 30000) {
      elements.statusDot.className = 'status-dot online';
      elements.statusText.textContent = 'Monitorando “Meus atendimentos”';
    } else {
      elements.statusDot.className = 'status-dot';
      elements.statusText.textContent = 'Aguardando a tela do Opa';
    }
  } else {
    elements.statusDot.className = 'status-dot';
    elements.statusText.textContent = 'Aguardando a primeira leitura';
    elements.lastCheck.textContent = 'Abra “Meus atendimentos”';
  }
}

function setBusy(element, busy, busyText) {
  if ('disabled' in element) element.disabled = busy;
  if (element.tagName === 'BUTTON' && busyText) element.textContent = busyText;
}

function showFeedback(message, isError = false) {
  clearTimeout(feedbackTimer);
  elements.feedback.textContent = message;
  elements.feedback.classList.toggle('error', isError);
  feedbackTimer = setTimeout(() => {
    elements.feedback.textContent = '';
    elements.feedback.classList.remove('error');
  }, 3500);
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}


function renderHistory(history) {
  const items = Array.isArray(history) ? history.slice(0, 5) : [];
  elements.attendanceHistory.replaceChildren();
  elements.historyCount.textContent = `${items.length}/5`;

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'history-empty';
    empty.id = 'historyEmpty';
    empty.textContent = 'Os próximos atendimentos recebidos aparecerão aqui.';
    elements.attendanceHistory.appendChild(empty);
    elements.historyEmpty = empty;
    return;
  }

  items.forEach((item, index) => {
    const entry = document.createElement('article');
    entry.className = 'history-item';

    const order = document.createElement('span');
    order.className = 'history-order';
    order.textContent = String(index + 1);

    const content = document.createElement('div');
    content.className = 'history-content';

    const titleRow = document.createElement('div');
    titleRow.className = 'history-title-row';

    const company = document.createElement('strong');
    company.className = 'history-company';
    company.textContent = item.company || 'Empresa não identificada';
    titleRow.appendChild(company);

    if (index === 0) {
      const badge = document.createElement('span');
      badge.className = 'history-current';
      badge.textContent = 'Atual';
      titleRow.appendChild(badge);
    }

    const metadata = document.createElement('div');
    metadata.className = 'history-metadata';

    const protocol = document.createElement('span');
    protocol.className = 'history-protocol';
    protocol.textContent = item.protocol || 'Protocolo não identificado';

    const receivedAt = document.createElement('time');
    receivedAt.className = 'history-time';
    receivedAt.dateTime = new Date(item.receivedAt).toISOString();
    receivedAt.textContent = formatHistoryDate(item.receivedAt);

    metadata.append(protocol, receivedAt);
    content.append(titleRow, metadata);
    entry.append(order, content);
    elements.attendanceHistory.appendChild(entry);
  });
}

function formatHistoryDate(timestamp) {
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return 'Horário não identificado';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDifference = Math.round((today - itemDay) / 86400000);
  const time = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  if (dayDifference === 0) return `Hoje, ${time}`;
  if (dayDifference === 1) return `Ontem, ${time}`;

  return `${date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit'
  })}, ${time}`;
}

async function copyDiagnostics() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_DIAGNOSTICS' });
    if (!response?.success) throw new Error(response?.error || 'Falha ao obter diagnóstico.');
    await navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    showFeedback('Diagnóstico copiado, sem mensagens ou dados dos clientes.');
  } catch (error) { showFeedback(error.message, true); }
}
