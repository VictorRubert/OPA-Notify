const EXTENSION_VERSION = '1.4.1';
const BACKGROUND_SCAN_ALARM = 'opa-background-scan';
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
const SNAPSHOT_STALE_MS = 8 * 60 * 60 * 1000;
const NOTIFIED_TTL_MS = 24 * 60 * 60 * 1000;
const BASELINE_GRACE_MS = 10 * 1000;
const EMPTY_CONFIRMATION_MS = 8 * 1000;
const REMOVAL_CONFIRMATION_MS = 8 * 1000;
const MAX_ATTENDANCE_HISTORY = 5;

const DEFAULT_SETTINGS = Object.freeze({
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
  soundEnabled: true,
  volume: 0.8,
  soundPreset: 'classic',
  toastDuration: 6000,
  customSoundName: ''
});

let creatingOffscreenDocument = null;
let scanQueue = Promise.resolve();
const contentInjectionPromises = new Map();

chrome.runtime.onInstalled.addListener(() => {
  initializeMonitoring().catch(console.error);
  injectIntoOpenSupportTabs().catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  initializeMonitoring().catch(console.error);
});

// Recreate the alarm whenever the MV3 worker is started; alarms may be cleared
// by a browser restart. One minute also supports the minimum Chrome 109.
ensureBackgroundAlarm().catch(console.error);
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === BACKGROUND_SCAN_ALARM) scanOpenSupportTabs().catch(console.error);
});
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status === 'complete' && tab.url?.startsWith('https://suporte.ixcsoft.com.br/')) {
    requestBackgroundScan(tabId).catch(() => undefined);
  }
});

async function initializeMonitoring() {
  await initializeDefaults();
  await ensureBackgroundAlarm();
}

async function ensureBackgroundAlarm() {
  if (!await chrome.alarms.get(BACKGROUND_SCAN_ALARM)) {
    await chrome.alarms.create(BACKGROUND_SCAN_ALARM, { periodInMinutes: 1 });
  }
}

async function requestBackgroundScan(tabId) {
  await sendToSupportTab(tabId, { type: 'BACKGROUND_ATTENDANCE_SCAN' });
}

async function scanOpenSupportTabs() {
  const settings = await getSettings();
  if (!settings.enabled) return;
  const tabs = await chrome.tabs.query({ url: 'https://suporte.ixcsoft.com.br/*' });
  await Promise.allSettled(tabs.filter(tab => tab.id && !tab.discarded).map(tab => requestBackgroundScan(tab.id)));
}

async function initializeDefaults() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const missing = {};

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (stored[key] === undefined) missing[key] = value;
  }

  if (Object.keys(missing).length > 0) {
    await chrome.storage.local.set(missing);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.target === 'offscreen') return false;

  if (message.type === 'OPEN_SOURCE_ATTENDANCE') {
    openSourceAttendance(message.sourceTabId, message.attendance).then(() => sendResponse({ success: true })).catch(() => sendResponse({ success: false }));
    return true;
  }

  if (message.type === 'ATTENDANCE_SCAN') {
    scanQueue = scanQueue
      .then(() => processAttendanceScan(message.items, sender))
      .then(result => sendResponse(result))
      .catch(error => {
        console.error('Falha ao processar leitura da fila:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'GET_STATUS') {
    getStatus()
      .then(status => sendResponse({ success: true, ...status }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'RESET_BASELINE') {
    resetBaseline()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'TEST_SOUND') {
    getSettings()
      .then(settings => playConfiguredSound(settings))
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'TEST_RECEIVED_ALERT') {
    testAlert('received')
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'TEST_FINISHED_ALERT') {
    testAlert('finished')
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'TEST_HIGHLIGHT_PROTOCOL') {
    testHighlightProtocol(message.protocol)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'CLEAR_HIGHLIGHTED_ATTENDANCE') {
    clearHighlightedAttendance()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  return false;
});

async function processAttendanceScan(rawItems, sender) {
  const now = Date.now();
  const currentItems = normalizeAttendances(rawItems);
  const currentMap = new Map(currentItems.map(item => [item.protocol, item]));

  const stored = await chrome.storage.local.get([
    'attendanceSnapshot',
    'snapshotSavedAt',
    'recentlyNotified',
    'recentlyFinished',
    'pendingRemovals',
    'baselineGraceUntil',
    'forceBaselineUntil',
    'emptyScanFirstAt',
    'attendanceHistory'
  ]);

  const previousItems = normalizeAttendances(stored.attendanceSnapshot);
  const previousMap = new Map(previousItems.map(item => [item.protocol, item]));
  const previousProtocols = new Set(previousMap.keys());
  const previousSavedAt = Number(stored.snapshotSavedAt) || 0;
  const snapshotIsStale = previousSavedAt === 0 || now - previousSavedAt > SNAPSHOT_STALE_MS;
  const forceBaselineUntil = Number(stored.forceBaselineUntil) || 0;
  const storedGraceUntil = Number(stored.baselineGraceUntil) || 0;
  const baselineMode = snapshotIsStale || now < forceBaselineUntil || now < storedGraceUntil;

  const recentlyNotified = pruneTimestampMap(stored.recentlyNotified, now);
  const recentlyFinished = pruneTimestampMap(stored.recentlyFinished, now);
  const pendingRemovals = normalizePendingRemovals(stored.pendingRemovals);
  const pendingBeforeScan = new Set(Object.keys(pendingRemovals));

  if (!baselineMode && currentItems.length === 0 && previousItems.length > 0) {
    const firstEmptyAt = Number(stored.emptyScanFirstAt) || 0;

    if (!firstEmptyAt || now - firstEmptyAt < EMPTY_CONFIRMATION_MS) {
      await chrome.storage.local.set({
        emptyScanFirstAt: firstEmptyAt || now,
        lastCheckAt: now
      });

      return {
        success: true,
        baselineCreated: false,
        emptyPending: true,
        currentCount: previousItems.length,
        newCount: 0,
        finishedCount: 0
      };
    }
  }

  let newAttendances = [];
  let finishedAttendances = [];

  if (!baselineMode) {
    newAttendances = currentItems.filter(item => (
      !previousProtocols.has(item.protocol) &&
      !pendingBeforeScan.has(item.protocol) &&
      !recentlyNotified[item.protocol]
    ));

    for (const protocol of Object.keys(pendingRemovals)) {
      if (currentMap.has(protocol)) delete pendingRemovals[protocol];
    }

    for (const previous of previousItems) {
      if (currentMap.has(previous.protocol)) continue;
      if (!pendingRemovals[previous.protocol]) {
        pendingRemovals[previous.protocol] = {
          attendance: previous,
          firstMissingAt: now
        };
      }
    }

    for (const [protocol, pending] of Object.entries(pendingRemovals)) {
      if (currentMap.has(protocol)) {
        delete pendingRemovals[protocol];
        continue;
      }

      if (
        now - pending.firstMissingAt >= REMOVAL_CONFIRMATION_MS &&
        !recentlyFinished[protocol]
      ) {
        finishedAttendances.push(pending.attendance);
        recentlyFinished[protocol] = now;
        delete pendingRemovals[protocol];
      }
    }
  } else {
    for (const protocol of Object.keys(pendingRemovals)) {
      delete pendingRemovals[protocol];
    }
  }

  for (const item of newAttendances) {
    recentlyNotified[item.protocol] = now;
  }

  const baselineGraceUntil = snapshotIsStale || now < forceBaselineUntil
    ? Math.max(storedGraceUntil, now + BASELINE_GRACE_MS)
    : storedGraceUntil;

  const attendanceHistory = mergeAttendanceHistory(
    stored.attendanceHistory,
    newAttendances,
    now
  );
  const newestAttendance = newAttendances.length > 0
    ? newAttendances[newAttendances.length - 1]
    : null;

  await chrome.storage.local.set({
    attendanceSnapshot: currentItems,
    snapshotSavedAt: now,
    recentlyNotified,
    recentlyFinished,
    pendingRemovals,
    baselineGraceUntil,
    forceBaselineUntil: now < forceBaselineUntil ? forceBaselineUntil : 0,
    emptyScanFirstAt: currentItems.length === 0 ? Number(stored.emptyScanFirstAt) || now : 0,
    lastCheckAt: now,
    lastDetectedCount: currentItems.length,
    attendanceHistory
  });

  if (baselineMode) {
    return {
      success: true,
      baselineCreated: true,
      currentCount: currentItems.length,
      newCount: 0,
      finishedCount: 0
    };
  }

  const settings = await getSettings();

  if (settings.enabled && newestAttendance) {
    await setHighlightedAttendance(newestAttendance.protocol, 'received');
  }

  if (settings.enabled) {
    for (const attendance of newAttendances) {
      await announceAttendance(attendance, sender, settings, 'received');
    }

    if (settings.notifyOnFinished) {
      for (const attendance of finishedAttendances) {
        await announceAttendance(attendance, sender, settings, 'finished');
      }
    }
  }

  return {
    success: true,
    baselineCreated: false,
    currentCount: currentItems.length,
    newCount: newAttendances.length,
    finishedCount: finishedAttendances.length
  };
}

function normalizeAttendances(items) {
  if (!Array.isArray(items)) return [];

  const unique = new Map();

  for (const raw of items) {
    const protocol = String(raw?.protocol || '').trim().toUpperCase();
    const company = String(raw?.company || '').trim();
    const id = String(raw?.id || '').trim();

    if (!/^OPA\d{6,}$/.test(protocol)) continue;
    if (!company) continue;

    unique.set(protocol, {
      id,
      protocol,
      company: company.slice(0, 250)
    });
  }

  return [...unique.values()].sort((a, b) => a.protocol.localeCompare(b.protocol));
}


function normalizeAttendanceHistory(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map(raw => {
      const attendance = normalizeAttendances([raw])[0];
      const receivedAt = Number(raw?.receivedAt) || 0;

      if (!attendance || !receivedAt) return null;
      return { ...attendance, receivedAt };
    })
    .filter(Boolean)
    .sort((a, b) => b.receivedAt - a.receivedAt)
    .slice(0, MAX_ATTENDANCE_HISTORY);
}

function mergeAttendanceHistory(currentHistory, newAttendances, receivedAt) {
  const history = normalizeAttendanceHistory(currentHistory);
  if (!Array.isArray(newAttendances) || newAttendances.length === 0) return history;

  const newProtocols = new Set(newAttendances.map(item => item.protocol));
  const additions = [...newAttendances].reverse().map(attendance => ({
    ...attendance,
    receivedAt
  }));

  return [
    ...additions,
    ...history.filter(item => !newProtocols.has(item.protocol))
  ].slice(0, MAX_ATTENDANCE_HISTORY);
}

function pruneTimestampMap(value, now) {
  const result = {};
  const source = value && typeof value === 'object' ? value : {};

  for (const [protocol, timestamp] of Object.entries(source)) {
    const numericTimestamp = Number(timestamp);
    if (numericTimestamp && now - numericTimestamp < NOTIFIED_TTL_MS) {
      result[protocol] = numericTimestamp;
    }
  }

  return result;
}

function normalizePendingRemovals(value) {
  const result = {};
  const source = value && typeof value === 'object' ? value : {};

  for (const [protocol, raw] of Object.entries(source)) {
    const attendance = normalizeAttendances([raw?.attendance])[0];
    const firstMissingAt = Number(raw?.firstMissingAt) || 0;

    if (!attendance || attendance.protocol !== protocol || !firstMissingAt) continue;
    result[protocol] = { attendance, firstMissingAt };
  }

  return result;
}

async function announceAttendance(attendance, sender, settings, eventType, isTest = false) {
  if (settings.visualEnabled && sender.tab?.id) {
    await sendToSupportTab(sender.tab.id, {
      type: 'SHOW_ATTENDANCE_EVENT',
      isTest,
      eventType,
      attendance,
      duration: settings.toastDuration
    }).catch(() => undefined);
  }

  if (settings.otherTabsEnabled && sender.tab?.id) {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }).catch(() => []);
    await Promise.allSettled(tabs.filter(tab => tab.id && tab.id !== sender.tab.id && !tab.url?.startsWith('https://suporte.ixcsoft.com.br/')).map(async tab => {
      await ensureContentScript(tab.id);
      await chrome.tabs.sendMessage(tab.id, {
        type: 'SHOW_ATTENDANCE_EVENT', eventType, attendance, isTest,
        duration: settings.toastDuration, sourceTabId: sender.tab.id
      });
    }));
  }

  if (settings.systemNotificationsEnabled) {
    await showSystemNotification(attendance, sender.tab?.id, eventType).catch(error => console.warn('Notificação do sistema indisponível:', error));
  }

  if (settings.soundEnabled) {
    await playConfiguredSound(settings).catch(error => {
      console.warn('Não foi possível tocar o som:', error);
    });
  }
}

async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...stored };
}

async function getStatus() {
  const stored = await chrome.storage.local.get([
    'attendanceSnapshot',
    'snapshotSavedAt',
    'lastCheckAt',
    'lastDetectedCount',
    'attendanceHistory',
    'highlightedAttendanceProtocol'
  ]);

  const snapshot = normalizeAttendances(stored.attendanceSnapshot);

  return {
    extension: 'Opa!Notify',
    version: EXTENSION_VERSION,
    currentCount: Number.isFinite(stored.lastDetectedCount)
      ? stored.lastDetectedCount
      : snapshot.length,
    lastCheckAt: Number(stored.lastCheckAt) || 0,
    snapshotSavedAt: Number(stored.snapshotSavedAt) || 0,
    history: normalizeAttendanceHistory(stored.attendanceHistory),
    highlightedProtocol: normalizeProtocol(stored.highlightedAttendanceProtocol)
  };
}

async function resetBaseline() {
  const now = Date.now();
  await chrome.storage.local.remove([
    'attendanceSnapshot',
    'snapshotSavedAt',
    'recentlyNotified',
    'recentlyFinished',
    'pendingRemovals',
    'lastCheckAt',
    'lastDetectedCount',
    'emptyScanFirstAt'
  ]);
  await chrome.storage.local.set({
    forceBaselineUntil: now + 5000,
    baselineGraceUntil: now + BASELINE_GRACE_MS
  });

  const tabs = await chrome.tabs.query({ url: 'https://suporte.ixcsoft.com.br/*' });
  for (const tab of tabs) {
    if (!tab.id) continue;
    await sendToSupportTab(tab.id, { type: 'REQUEST_IMMEDIATE_SCAN' }).catch(() => undefined);
  }
}

async function injectIntoOpenSupportTabs() {
  const tabs = await chrome.tabs.query({ url: 'https://suporte.ixcsoft.com.br/*' });
  for (const tab of tabs) {
    if (!tab.id) continue;
    await ensureContentScript(tab.id).catch(() => undefined);
  }
}

async function ensureContentScript(tabId) {
  if (!tabId) throw new Error('Aba do Opa não identificada.');

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'OPA_NOTIFY_CONTENT_PING'
    });
    if (response?.ready) return;
  } catch (_) {
    // A página já estava aberta quando a extensão foi instalada ou recarregada.
  }

  if (contentInjectionPromises.has(tabId)) {
    await contentInjectionPromises.get(tabId);
    return;
  }

  const injection = (async () => {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/content.js']
    });

    await delay(150);

    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'OPA_NOTIFY_CONTENT_PING'
    });

    if (!response?.ready) {
      throw new Error('O monitor não respondeu após ser carregado na página.');
    }
  })();

  contentInjectionPromises.set(tabId, injection);

  try {
    await injection;
  } finally {
    contentInjectionPromises.delete(tabId);
  }
}

async function sendToSupportTab(tabId, message) {
  await ensureContentScript(tabId);
  return chrome.tabs.sendMessage(tabId, message);
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function testAlert(eventType) {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
    url: 'https://suporte.ixcsoft.com.br/*'
  });

  const tab = tabs[0];
  if (!tab?.id) {
    return {
      success: false,
      error: 'Abra o Opa! Suite em uma aba para testar o aviso visual.'
    };
  }

  const settings = await getSettings();
  const sample = {
    id: '',
    protocol: 'OPA20260000000',
    company: 'EMPRESA DE TESTE'
  };

  await announceAttendance(sample, { tab }, settings, eventType, true);

  return { success: true };
}


function normalizeProtocol(value) {
  const protocol = String(value || '').trim().toUpperCase();
  return /^OPA\d{6,}$/.test(protocol) ? protocol : '';
}

async function setHighlightedAttendance(protocolValue, source) {
  const protocol = normalizeProtocol(protocolValue);
  if (!protocol) throw new Error('Protocolo inválido para marcação.');

  await chrome.storage.local.set({
    highlightedAttendanceProtocol: protocol,
    highlightedAttendanceSource: source === 'test' ? 'test' : 'received',
    highlightedAttendanceUpdatedAt: Date.now()
  });

  const tabs = await chrome.tabs.query({ url: 'https://suporte.ixcsoft.com.br/*' });
  for (const tab of tabs) {
    if (!tab.id) continue;
    await sendToSupportTab(tab.id, {
      type: 'SET_HIGHLIGHTED_ATTENDANCE',
      protocol
    }).catch(() => undefined);
  }

  return protocol;
}

async function clearHighlightedAttendance() {
  const stored = await chrome.storage.local.get('highlightedAttendanceProtocol');
  const previousProtocol = normalizeProtocol(stored.highlightedAttendanceProtocol);

  await chrome.storage.local.remove([
    'highlightedAttendanceProtocol',
    'highlightedAttendanceSource',
    'highlightedAttendanceUpdatedAt'
  ]);

  const tabs = await chrome.tabs.query({ url: 'https://suporte.ixcsoft.com.br/*' });
  for (const tab of tabs) {
    if (!tab.id) continue;
    await sendToSupportTab(tab.id, {
      type: 'SET_HIGHLIGHTED_ATTENDANCE',
      protocol: ''
    }).catch(() => undefined);
  }

  return {
    success: true,
    removedProtocol: previousProtocol
  };
}

async function testHighlightProtocol(protocolValue) {
  const protocol = normalizeProtocol(protocolValue);
  if (!protocol) {
    return {
      success: false,
      error: 'Informe um protocolo válido, por exemplo OPA20260012345.'
    };
  }

  const tabs = await chrome.tabs.query({ url: 'https://suporte.ixcsoft.com.br/*' });
  if (tabs.length === 0) {
    return {
      success: false,
      error: 'Abra o Opa! Suite e deixe “Meus atendimentos” visível para testar.'
    };
  }

  let found = false;

  for (const tab of tabs) {
    if (!tab.id) continue;

    const response = await sendToSupportTab(tab.id, {
      type: 'CHECK_ATTENDANCE_PROTOCOL',
      protocol
    }).catch(() => null);

    if (response?.found) {
      found = true;
      break;
    }
  }

  if (!found) {
    return {
      success: false,
      error: `O protocolo ${protocol} não foi encontrado nos atendimentos visíveis.`
    };
  }

  await setHighlightedAttendance(protocol, 'test');

  return {
    success: true,
    protocol
  };
}

async function playConfiguredSound(settings) {
  await setupOffscreenDocument();

  let customSoundData = '';
  if (settings.soundPreset === 'custom') {
    const stored = await chrome.storage.local.get('customSoundData');
    customSoundData = String(stored.customSoundData || '');
  }

  await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'PLAY_SOUND',
    soundPreset: settings.soundPreset,
    volume: clamp(Number(settings.volume), 0, 1),
    customSoundData
  });
}

async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  let exists = false;

  if ('getContexts' in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl]
    });
    exists = contexts.length > 0;
  } else {
    const matchedClients = await clients.matchAll();
    exists = matchedClients.some(client => client.url === offscreenUrl);
  }

  if (exists) return;

  if (creatingOffscreenDocument) {
    await creatingOffscreenDocument;
    return;
  }

  creatingOffscreenDocument = chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Reproduzir o aviso sonoro de eventos de atendimento.'
  });

  try {
    await creatingOffscreenDocument;
  } finally {
    creatingOffscreenDocument = null;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

async function openSourceAttendance(tabId, attendance) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url?.startsWith('https://suporte.ixcsoft.com.br/')) throw new Error('Aba do Opa indisponível.');
  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  await sendToSupportTab(tabId, { type: 'FOCUS_ATTENDANCE', attendance });
}

async function showSystemNotification(attendance, sourceTabId, eventType) {
  const id = `opa:${eventType}:${attendance.protocol}`;
  const key = `notification:${id}`;
  await chrome.storage.session.set({ [key]: { sourceTabId, attendance } });
  try {
    await chrome.notifications.create(id, {
      type: 'basic', iconUrl: 'icons/icon128.png',
      title: eventType === 'finished' ? 'Um atendimento acabou de sair da sua fila!' : 'Um atendimento novo foi recebido!',
      message: `${attendance.protocol} - ${attendance.company}`,
      silent: true
    });
  } catch (error) {
    await chrome.storage.session.remove(key);
    throw error;
  }
}

chrome.notifications.onClicked.addListener(async id => {
  const key = `notification:${id}`;
  const stored = await chrome.storage.session.get(key);
  if (stored[key]) await openSourceAttendance(stored[key].sourceTabId, stored[key].attendance).catch(console.warn);
  await chrome.notifications.clear(id);
  await chrome.storage.session.remove(key);
});
chrome.notifications.onClosed.addListener(id => {
  chrome.storage.session.remove(`notification:${id}`).catch(console.warn);
});
