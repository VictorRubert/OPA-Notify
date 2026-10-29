(() => {
  if (globalThis.__OPA_NOTIFY_CONTENT_LOADED__) return;
  globalThis.__OPA_NOTIFY_CONTENT_LOADED__ = true;

  const SCAN_INTERVAL_MS = 5000;
  const MOTIVO_CHECK_DEBOUNCE_MS = 250;
  const STABILITY_DELAY_MS = 700;
  const UNCHANGED_HEARTBEAT_MS = 15000;
  const INITIAL_EMPTY_DELAY_MS = 10000;
  const ONGOING_ATTENDANCES_SELECTOR = '.item.selected[data-id="chat"]';
  const ONGOING_ATTENDANCES_TITLE = 'atendimentos em andamento';
  const HIGHLIGHT_STYLE_ID = 'opa-notify-attendance-highlight-style';
  const HIGHLIGHT_CLASS = 'opa-notify-current-attendance';
  const HIGHLIGHT_BAR_CLASS = 'opa-notify-current-bar';
  const LEGACY_HIGHLIGHT_LABEL_CLASS = 'opa-notify-current-label';
  const NEW_TAG_CLASS = 'opa-notify-current-new-tag';
  const GENERATED_TAGS_CLASS = 'opa-notify-generated-tags';
  const MOTIVO_EMPTY_CLASS = 'opa-notify-motivo-empty';
  const MOTIVO_EMPTY_CONTAINER_CLASS = 'opa-notify-motivo-empty-container';
  const MOTIVO_BLINK_CLASS = 'opa-notify-motivo-blink';
  const MOTIVO_SWITCH_MODAL_ID = 'opa-notify-motivo-switch-modal';
  const MOTIVO_CHARGE_AFTER_MS = 5 * 60 * 1000;
  const HIGHLIGHT_MODE_CLASSES = [
    'opa-notify-current-attendance--soft',
    'opa-notify-current-attendance--full',
    'opa-notify-current-attendance--tag'
  ];

  const NEW_LIST = '[data-tutorial="customer-service-list"]';
  const NEW_CARD = `${NEW_LIST} [itemid]`;
  const CARD_SELECTOR = `.chat[data-id], ${NEW_CARD}`;
  let queuePages = new Map();
  let newQueue = null;
  let newMetadata = new Map();

  function isNewInterface() { return Boolean(document.querySelector(NEW_LIST)); }
  function isPersonalNewQueue() {
    const filter = document.querySelector('[data-tutorial="customer-service-view-selector"]');
    const tab = document.querySelector('[data-tutorial="customer-service-queue-in-progress"]');
    return normalizeInterfaceText(filter?.textContent) === 'meus atendimentos'
      && Boolean(tab && (tab.getAttribute('data-active') === 'true' || (tab.classList.contains('bg-gray-200') && tab.classList.contains('border-gray-400'))));
  }
  function cardId(card) { return card?.getAttribute('itemid') || card?.getAttribute('data-id') || ''; }
  function cardClickTarget(card) { return card?.querySelector('.corpo') || card?.querySelector(':scope > button') || card; }
  function currentNewAttendance() { return document.querySelector('[data-customer-service-id][data-protocol]'); }
  function currentCard() {
    if (!isNewInterface()) return document.querySelector('.chat.selected[data-id]');
    const id = currentNewAttendance()?.getAttribute('data-customer-service-id');
    return [...document.querySelectorAll(NEW_CARD)].find(card => cardId(card) === id) || null;
  }
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || !isSupportPage) return;
    const data = event.data;
    if (data?.source !== 'opa-notify-queue-v1') return;
    if (data.kind === 'reasons') {
      const metadata = newMetadata.get(data.id);
      if (metadata && Number.isInteger(data.reasons) && data.reasons >= 0) {
        metadata.reasons = data.reasons;
        scheduleMotivoHighlight();
      }
      return;
    }
    if (data.kind === 'reset') { queuePages.clear(); newQueue = null; return; }
    if (data.kind !== 'page' || !Array.isArray(data.items) || !Number.isInteger(data.page) || data.page < 1 || data.page > 1000 || typeof data.hasMore !== 'boolean') return;
    if (!isPersonalNewQueue() || normalizeInterfaceText(data.view) !== 'meus atendimentos') { queuePages.clear(); newQueue = null; return; }
    if (data.page === 1) { queuePages.clear(); newQueue = null; }
    const valid = data.items.every(item => item && typeof item.id === 'string' && item.id && /^OPA\d{6,}$/.test(item.protocol) && typeof item.company === 'string' && item.company);
    if (!valid) { queuePages.clear(); newQueue = null; return; }
    queuePages.set(data.page, data.items);
    if (data.hasMore) return;
    for (let page = 1; page <= data.page; page++) if (!queuePages.has(page)) return;
    const items = [...Array(data.page)].flatMap((_, index) => queuePages.get(index + 1));
    if (new Set(items.map(item => item.id)).size !== items.length || new Set(items.map(item => item.protocol)).size !== items.length) { newQueue = null; return; }
    newMetadata = new Map(items.map(item => [item.id, item]));
    newQueue = items.map(({ id, protocol, company }) => ({ id, protocol, company }));
    applyHighlightedAttendance();
    scheduleMotivoHighlight();
    scheduleScan(0);
  });

  let settings = {
    enabled: true,
    colorHighlightEnabled: true,
    highlightFillMode: 'soft',
    motivoHighlightEnabled: true,
    motivoBlinkEnabled: true,
    motivoChargeEnabled: true
  };
  let highlightedProtocol = '';
  let observer = null;
  let scanTimer = null;
  let scanDeadline = 0;
  let periodicTimer = null;
  let candidateFingerprint = null;
  let candidateSince = 0;
  let lastSentFingerprint = null;
  let lastSentAt = 0;
  let toastRoot = null;
  let toastContainer = null;
  let motivoHighlightTimer = null;
  let motivoBlinkElement = null;
  let motivoBlinkTimer = null;
  let attendanceHistoryCache = [];
  let allowAttendanceSwitchOnce = false;
  const scriptStartedAt = Date.now();

  const isSupportPage = ['https://suporte.ixcsoft.com.br', 'https://opasuiteapi.ixcsoft.com.br'].includes(location.origin);
  if (!isSupportPage) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes.enabled?.newValue === false || changes.otherTabsEnabled?.newValue === false)) {
        toastRoot?.remove();
      }
    });
  }
  if (isSupportPage) initialize().catch(error => console.error('Opa!Notify não iniciou:', error));

  async function initialize() {
    await loadSettings();
    await loadAttendanceHistory();
    ensureHighlightStyles();
    applyHighlightedAttendance();
    scheduleMotivoHighlight(600);
    watchSettings();
    installAttendanceSwitchGuard();
    observePage();
    scheduleScan(1200);
    periodicTimer = setInterval(() => scheduleScan(0), SCAN_INTERVAL_MS);
    window.postMessage({ source: 'opa-notify-content-ready-v1' }, location.origin);
  }

  async function loadSettings() {
    const stored = await chrome.storage.local.get([
      'enabled',
      'colorHighlightEnabled',
      'highlightFillMode',
      'motivoHighlightEnabled',
      'motivoBlinkEnabled',
      'motivoChargeEnabled',
      'attendanceHistory',
      'highlightedAttendanceProtocol'
    ]);
    settings.enabled = stored.enabled !== false;
    settings.colorHighlightEnabled = stored.colorHighlightEnabled !== false;
    settings.highlightFillMode = normalizeHighlightFillMode(stored.highlightFillMode);
    settings.motivoHighlightEnabled = stored.motivoHighlightEnabled !== false;
    settings.motivoBlinkEnabled = stored.motivoBlinkEnabled !== false;
    settings.motivoChargeEnabled = stored.motivoChargeEnabled !== false;
    highlightedProtocol = normalizeProtocol(stored.highlightedAttendanceProtocol);
  }

  async function loadAttendanceHistory() {
    const stored = await chrome.storage.local.get('attendanceHistory');
    attendanceHistoryCache = Array.isArray(stored.attendanceHistory) ? stored.attendanceHistory : [];
  }

  function watchSettings() {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.attendanceHistory) {
        attendanceHistoryCache = Array.isArray(changes.attendanceHistory.newValue) ? changes.attendanceHistory.newValue : [];
      }
      if (changes.enabled) settings.enabled = changes.enabled.newValue !== false;
      if (changes.colorHighlightEnabled) {
        settings.colorHighlightEnabled = changes.colorHighlightEnabled.newValue !== false;
        applyHighlightedAttendance();
      }

      if (changes.highlightFillMode) {
        settings.highlightFillMode = normalizeHighlightFillMode(changes.highlightFillMode.newValue);
        applyHighlightedAttendance();
      }

      if (changes.motivoHighlightEnabled) {
        settings.motivoHighlightEnabled = changes.motivoHighlightEnabled.newValue !== false;
        scheduleMotivoHighlight(0);
      }

      if (changes.motivoBlinkEnabled) {
        settings.motivoBlinkEnabled = changes.motivoBlinkEnabled.newValue !== false;
        scheduleMotivoHighlight(0);
      }

      if (changes.highlightedAttendanceProtocol) {
        highlightedProtocol = normalizeProtocol(
          changes.highlightedAttendanceProtocol.newValue
        );
        applyHighlightedAttendance();
      }
    });
  }

  function installAttendanceSwitchGuard() {
    document.addEventListener('click', handleAttendanceSwitchClick, true);
  }

  function handleAttendanceSwitchClick(event) {
    if (allowAttendanceSwitchOnce) {
      allowAttendanceSwitchOnce = false;
      return;
    }

    if (!isOngoingAttendancesModuleActive()) return;

    const clickedChat = event.target?.closest?.(CARD_SELECTOR);
    if (!clickedChat) return;

    const currentChat = currentCard() || currentNewAttendance();
    if (!currentChat || currentChat === clickedChat || cardId(clickedChat) === currentChat.getAttribute('data-customer-service-id')) return;

    if (!settings.motivoChargeEnabled) return;

    const motivo = findMotivoRenderedElement();
    if (!motivo || !isMotivoEmpty(motivo)) return;

    const currentProtocol = extractProtocol(currentChat);
    if (!shouldChargeMotivo(currentProtocol)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    showMotivoSwitchModal(() => {
      allowAttendanceSwitchOnce = true;
      const clickable = cardClickTarget(clickedChat);
      setTimeout(() => clickable.click(), 0);
    });
  }

  function shouldChargeMotivo(protocol) {
    if (!protocol) return true;

    // Usa somente o histórico persistido dos 5 últimos atendimentos.
    // Se o atendimento não estiver mais nele, ele é considerado antigo.
    const entry = attendanceHistoryCache.find(
      item => normalizeProtocol(item?.protocol) === protocol
    );

    if (!entry) return true;

    const receivedAt = Number(entry.receivedAt) || 0;
    if (!receivedAt) return true;

    return Date.now() - receivedAt >= MOTIVO_CHARGE_AFTER_MS;
  }

  function showMotivoSwitchModal(onContinue) {
    const existing = document.getElementById(MOTIVO_SWITCH_MODAL_ID);
    if (existing) return;

    const host = document.createElement('div');
    host.id = MOTIVO_SWITCH_MODAL_ID;
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.zIndex = '2147483646';
    host.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .backdrop {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        padding: 20px;
        background: rgba(7, 9, 14, 0.58);
        backdrop-filter: blur(2px);
        box-sizing: border-box;
      }
      .modal {
        width: min(460px, calc(100vw - 40px));
        box-sizing: border-box;
        padding: 24px;
        color: #f7f8fb;
        background: #191d2a;
        border: 1px solid rgba(255,255,255,.12);
        border-top: 4px solid #ef7d00;
        border-radius: 14px;
        box-shadow: 0 24px 70px rgba(0,0,0,.5);
        animation: enter .18s ease-out both;
      }
      .icon {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        margin-bottom: 14px;
        border-radius: 11px;
        color: #ff9a2f;
        background: rgba(239,125,0,.15);
      }
      .icon svg { width: 23px; height: 23px; fill: currentColor; }
      h2 {
        margin: 0 0 10px;
        color: #fff;
        font-size: 18px;
        line-height: 1.3;
      }
      p {
        margin: 0;
        color: #cbd0dc;
        font-size: 14px;
        line-height: 1.55;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 9px;
        margin-top: 22px;
      }
      button {
        min-height: 38px;
        padding: 0 14px;
        border: 0;
        border-radius: 8px;
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }
      .back { color: #d7dbe5; background: #2a2f3d; }
      .back:hover { background: #343a4a; }
      .continue { color: #fff; background: #ef7d00; }
      .continue:hover { background: #ff8d12; }
      @keyframes enter {
        from { opacity: 0; transform: translateY(5px) scale(.985); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `;

    const wrapper = document.createElement('div');
    wrapper.className = 'backdrop';
    wrapper.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="opa-notify-motivo-title">
        <div class="icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 2 1.8 20h20.4L12 2Zm0 5.2 6.1 10.8H5.9L12 7.2Zm-1 3v4.4h2v-4.4h-2Zm0 5.4v2h2v-2h-2Z"/></svg>
        </div>
        <h2 id="opa-notify-motivo-title">Atenção</h2>
        <p>Adicionar um motivo de atendimento é muito importante para o controle das nossas métricas do setor!</p>
        <p style="margin-top:8px;">Você ainda não informou um motivo para este atendimento.</p>
        <div class="actions">
          <button class="back" type="button">Voltar</button>
          <button class="continue" type="button">Continuar mesmo assim</button>
        </div>
      </div>
    `;

    shadow.append(style, wrapper);
    document.documentElement.appendChild(host);

    const close = () => {
      document.removeEventListener('keydown', onKeyDown, true);
      host.remove();
    };
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    wrapper.querySelector('.back').addEventListener('click', close);
    wrapper.querySelector('.continue').addEventListener('click', () => {
      close();
      onContinue();
    });
  }

  function observePage() {
    observer = new MutationObserver(mutations => {
      let shouldScanAttendances = false;
      let shouldCheckMotivo = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const changedNodes = [
            ...mutation.addedNodes,
            ...mutation.removedNodes
          ];

          const changedAttendances = changedNodes.some(node => (
            node.nodeType === Node.ELEMENT_NODE &&
            (node.matches?.('.chat[data-id], .list_dados, .filtros_atendimentos_ea, .item[data-id="chat"]') ||
             node.querySelector?.('.chat[data-id], .list_dados, .filtros_atendimentos_ea, .item[data-id="chat"]'))
          ));

          const changedMotivo = changedNodes.some(node => (
            node.nodeType === Node.ELEMENT_NODE &&
            (node.matches?.('#select2-select_motivos-container, [id^="select2-select_motivos"][id$="-container"], .select2-selection__rendered') ||
             node.querySelector?.('#select2-select_motivos-container, [id^="select2-select_motivos"][id$="-container"], .select2-selection__rendered'))
          ));

          shouldScanAttendances ||= changedAttendances;
          shouldCheckMotivo ||= changedMotivo;
          continue;
        }

        if (mutation.type === 'characterData') {
          shouldCheckMotivo ||= isMotivoRelatedNode(mutation.target);
          continue;
        }

        if (mutation.type === 'attributes') {
          shouldCheckMotivo ||= isMotivoRelatedNode(mutation.target);
        }
      }

      if (isNewInterface()) {
        shouldScanAttendances ||= mutations.some(m => m.target?.closest?.(NEW_LIST) || [...m.addedNodes || []].some(n => n.matches?.(NEW_LIST) || n.querySelector?.(NEW_LIST)));
        shouldCheckMotivo = true;
      }

      if (shouldScanAttendances) {
        applyHighlightedAttendance();
        scheduleScan(350);
      }

      if (shouldCheckMotivo) {
        scheduleMotivoHighlight();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['title', 'aria-expanded', 'aria-selected', 'data-active', 'data-customer-service-id', 'data-protocol']
    });
  }

  function scheduleScan(delay) {
    const deadline = Date.now() + delay;
    if (scanTimer !== null && scanDeadline <= deadline) return;
    clearTimeout(scanTimer);
    scanDeadline = deadline;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scanDeadline = 0;
      scanAndSend().catch(console.error);
    }, delay);
  }

  async function scanAndSend() {
    let items;
    if (isNewInterface()) {
      if (!isPersonalNewQueue()) { newQueue = null; queuePages.clear(); return; }
      if (document.querySelector(`${NEW_LIST} input:not([type=checkbox]):not([type=radio])`)?.value?.trim()) return;
      if (newQueue === null) return;
      items = newQueue;
      applyHighlightedAttendance();
      scheduleMotivoHighlight();
    } else {
      if (!isOngoingAttendancesModuleActive()) {
        candidateFingerprint = null;
        candidateSince = 0;
        return;
      }

      const selectedButton = document.querySelector(
        'button[data-id="meus_atendimentos"].selected_filtro_user_status'
      );

      if (!selectedButton) return;

      const list = selectedButton.closest('.list');
      const listRoot = list?.querySelector('.list_dados')
        || selectedButton.closest('.list_dados');

      if (!listRoot) return;

      const searchInput = list?.querySelector('.list_select_input');
      if (searchInput && searchInput.value.trim() !== '') return;

      items = readAttendances(listRoot);
      applyHighlightedAttendance(listRoot);
      scheduleMotivoHighlight();

    }

    if (items.length === 0 && Date.now() - scriptStartedAt < INITIAL_EMPTY_DELAY_MS) {
      scheduleScan(1000);
      return;
    }

    const fingerprint = items
      .map(item => `${item.protocol}:${item.id}`)
      .sort()
      .join('|');
    const now = Date.now();

    if (fingerprint !== candidateFingerprint) {
      candidateFingerprint = fingerprint;
      candidateSince = now;
      scheduleScan(STABILITY_DELAY_MS);
      return;
    }

    if (now - candidateSince < STABILITY_DELAY_MS) {
      scheduleScan(STABILITY_DELAY_MS - (now - candidateSince));
      return;
    }

    if (
      fingerprint === lastSentFingerprint &&
      now - lastSentAt < UNCHANGED_HEARTBEAT_MS
    ) return;

    const response = await chrome.runtime.sendMessage({
      type: 'ATTENDANCE_SCAN',
      items,
      pageUrl: location.href,
      scannedAt: now
    }).catch(() => null);
    if (response?.success) {
      lastSentFingerprint = fingerprint;
      lastSentAt = now;
    }
  }

  function readAttendances(root) {
    const result = new Map();
    const chats = root.querySelectorAll(CARD_SELECTOR);

    for (const chat of chats) {
      const company = chat.querySelector('.corpo > .title')?.textContent?.trim();
      const protocol = extractProtocol(chat);
      const id = chat.getAttribute('data-id')?.trim() || '';

      if (!company || !protocol) continue;
      result.set(protocol, { id, protocol, company });
    }

    return [...result.values()];
  }

  function extractProtocol(chat) {
    if (chat.hasAttribute('data-protocol')) return normalizeProtocol(chat.getAttribute('data-protocol')) || null;
    if (chat.hasAttribute('itemid')) {
      const id = cardId(chat);
      const current = currentNewAttendance();
      return normalizeProtocol(newMetadata.get(id)?.protocol || (current?.getAttribute('data-customer-service-id') === id ? current.getAttribute('data-protocol') : '')) || null;
    }
    const body = chat.querySelector('.corpo');
    if (!body) return null;

    for (const child of body.children) {
      if (child.classList.contains('title') || child.classList.contains('tags')) continue;
      const directText = child.textContent?.trim().toUpperCase() || '';
      const directMatch = directText.match(/^OPA\d{6,}$/);
      if (directMatch) return directMatch[0];
    }

    const fallbackMatch = body.textContent?.toUpperCase().match(/\bOPA\d{6,}\b/);
    return fallbackMatch?.[0] || null;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'OPA_NOTIFY_CONTENT_PING') {
      sendResponse({ success: true, ready: true });
      return false;
    }

    if (message?.type === 'SHOW_ATTENDANCE_EVENT') {
      showToast(
        message.attendance,
        message.duration,
        message.isTest === true,
        message.eventType === 'finished' ? 'finished' : 'received',
        message.sourceTabId,
        message.position
      );
      sendResponse({ success: true });
      return false;
    }

    if (!isSupportPage) return false;

    if (message?.type === 'BACKGROUND_ATTENDANCE_SCAN') {
      scanAndSend().then(() => sendResponse({ success: true })).catch(() => sendResponse({ success: false }));
      return true;
    }

    if (message?.type === 'FOCUS_ATTENDANCE') {
      focusAttendance(message.attendance).then(found => sendResponse({ success: found })).catch(() => sendResponse({ success: false }));
      return true;
    }

    if (message?.type === 'CHECK_ATTENDANCE_PROTOCOL') {
      const protocol = normalizeProtocol(message.protocol);
      const found = Boolean(protocol && findAttendanceByProtocol(protocol));
      sendResponse({ success: true, found });
      return false;
    }

    if (message?.type === 'SET_HIGHLIGHTED_ATTENDANCE') {
      highlightedProtocol = normalizeProtocol(message.protocol);
      const found = applyHighlightedAttendance();
      sendResponse({ success: true, found });
      return false;
    }

    if (message?.type === 'REQUEST_IMMEDIATE_SCAN') {
      candidateFingerprint = null;
      lastSentFingerprint = null;
      scheduleScan(150);
      sendResponse({ success: true });
      return false;
    }

    return false;
  });


  function isOngoingAttendancesModuleActive() {
    if (isNewInterface()) return isPersonalNewQueue();
    const selectedItem = document.querySelector(ONGOING_ATTENDANCES_SELECTOR);
    if (!selectedItem) return false;

    const title = normalizeInterfaceText(selectedItem.getAttribute('title'));
    const text = normalizeInterfaceText(selectedItem.textContent);

    return (
      !title ||
      title.includes(ONGOING_ATTENDANCES_TITLE) ||
      text.includes(ONGOING_ATTENDANCES_TITLE)
    );
  }

  function normalizeInterfaceText(value) {
    return String(value || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function normalizeProtocol(value) {
    const protocol = String(value || '').trim().toUpperCase();
    return /^OPA\d{6,}$/.test(protocol) ? protocol : '';
  }

  function normalizeHighlightFillMode(value) {
    return ['soft', 'full', 'tag'].includes(value) ? value : 'soft';
  }

  function findAttendanceByProtocol(protocolValue, root = document) {
    const protocol = normalizeProtocol(protocolValue);
    if (!protocol) return null;

    return [...root.querySelectorAll(CARD_SELECTOR)]
      .find(chat => extractProtocol(chat) === protocol) || null;
  }

  function ensureHighlightStyles() {
    if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = HIGHLIGHT_STYLE_ID;
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        position: relative !important;
        overflow: hidden !important;
        transition: background .18s ease, box-shadow .18s ease, filter .18s ease;
      }

      .${HIGHLIGHT_CLASS}.opa-notify-current-attendance--soft {
        background:
          linear-gradient(90deg,
            rgba(83, 55, 125, .78) 0%,
            rgba(66, 45, 99, .58) 42%,
            rgba(42, 34, 62, .36) 100%
          ) !important;
        box-shadow:
          inset 0 0 0 1px rgba(167, 139, 250, .22),
          inset 6px 0 0 rgba(124, 58, 237, .40) !important;
      }

      .${HIGHLIGHT_CLASS}.opa-notify-current-attendance--full {
        background: #3c275c !important;
        box-shadow:
          inset 0 0 0 1px rgba(167, 139, 250, .30),
          0 0 12px rgba(124, 58, 237, .18) !important;
      }

      .${HIGHLIGHT_CLASS}.opa-notify-current-attendance--tag {
        background: inherit !important;
        box-shadow: none !important;
      }

      .${HIGHLIGHT_CLASS} > [data-sidebar="menu-button"] {
        background: transparent !important;
      }

      .${HIGHLIGHT_CLASS}:hover {
        filter: brightness(1.06);
      }

      .${HIGHLIGHT_CLASS} .tags {
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        gap: 4px !important;
      }

      .${HIGHLIGHT_CLASS} .${NEW_TAG_CLASS} {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-height: 18px !important;
        margin-left: auto !important;
        padding: 2px 8px !important;
        color: #f5f3ff !important;
        background: rgba(124, 58, 237, .78) !important;
        border: 1px solid rgba(196, 181, 253, .42) !important;
        border-radius: 999px !important;
        box-shadow: 0 0 0 1px rgba(30, 24, 48, .22) !important;
        font-size: 9px !important;
        font-weight: 800 !important;
        line-height: 1.2 !important;
        letter-spacing: .05em !important;
        text-transform: uppercase !important;
        white-space: nowrap !important;
      }

      .${GENERATED_TAGS_CLASS} {
        margin-top: 4px !important;
        justify-content: flex-end !important;
      }

      .${MOTIVO_EMPTY_CONTAINER_CLASS} .select2-selection,
      .select2-selection.${MOTIVO_EMPTY_CLASS} {
        background: rgba(220, 38, 38, .92) !important;
        border-color: rgba(254, 202, 202, .95) !important;
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, .22),
          0 0 0 2px rgba(220, 38, 38, .34),
          0 0 16px rgba(239, 68, 68, .50) !important;
        transition: background .18s ease, border-color .18s ease, box-shadow .18s ease !important;
      }

      .${MOTIVO_EMPTY_CONTAINER_CLASS} .select2-selection__rendered,
      .select2-selection.${MOTIVO_EMPTY_CLASS} .select2-selection__rendered,
      .select2-selection__rendered.${MOTIVO_EMPTY_CLASS} {
        color: #ffffff !important;
        font-weight: 800 !important;
      }

      .${MOTIVO_EMPTY_CONTAINER_CLASS} .select2-selection__arrow,
      .select2-selection.${MOTIVO_EMPTY_CLASS} .select2-selection__arrow {
        color: #ffffff !important;
      }

    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function applyHighlightedAttendance(root = document) {
    ensureHighlightStyles();

    const chats = [...document.querySelectorAll(CARD_SELECTOR)];
    let found = false;

    for (const chat of chats) {
      const shouldHighlight = Boolean(
        settings.colorHighlightEnabled &&
        highlightedProtocol &&
        extractProtocol(chat) === highlightedProtocol
      );

      chat.classList.toggle(HIGHLIGHT_CLASS, shouldHighlight);
      HIGHLIGHT_MODE_CLASSES.forEach(className => chat.classList.remove(className));

      const legacyBars = [
        ...chat.querySelectorAll(`.${HIGHLIGHT_BAR_CLASS}`)
      ];
      const legacyLabels = [
        ...chat.querySelectorAll(`.${LEGACY_HIGHLIGHT_LABEL_CLASS}`)
      ];

      legacyBars.forEach(bar => bar.remove());
      legacyLabels.forEach(label => label.remove());

      if (shouldHighlight) {
        found = true;
        chat.classList.add(
          settings.highlightFillMode === 'full'
            ? 'opa-notify-current-attendance--full'
            : settings.highlightFillMode === 'tag'
              ? 'opa-notify-current-attendance--tag'
              : 'opa-notify-current-attendance--soft'
        );
        ensureNewTag(chat);
      } else {
        removeNewTag(chat);
      }
    }

    return found;
  }

  function ensureNewTag(chat) {
    const tags = getOrCreateTagsContainer(chat);
    if (!tags) return;

    const duplicatedTags = [...chat.querySelectorAll(`.${NEW_TAG_CLASS}`)];
    let tag = duplicatedTags.find(item => item.parentElement === tags) || null;

    for (const duplicated of duplicatedTags) {
      if (duplicated !== tag) duplicated.remove();
    }

    if (!tag) {
      tag = document.createElement('span');
      tag.className = NEW_TAG_CLASS;
      tag.setAttribute('data-opa-notify-tag', 'novo');
      tag.textContent = 'NOVO';
    }

    if (tag.parentElement !== tags || tag !== tags.lastElementChild) {
      tags.appendChild(tag);
    }
  }

  function removeNewTag(chat) {
    const tags = [...chat.querySelectorAll(`.${NEW_TAG_CLASS}`)];
    tags.forEach(tag => tag.remove());

    const generatedTags = [...chat.querySelectorAll(`.${GENERATED_TAGS_CLASS}`)];
    for (const container of generatedTags) {
      if (container.children.length === 0) container.remove();
    }
  }

  function getOrCreateTagsContainer(chat) {
    const body = chat.hasAttribute('itemid')
      ? chat.querySelector(':scope > button > div:last-child') || cardClickTarget(chat)
      : cardClickTarget(chat);
    let tags = body.querySelector(':scope > .tags')
      || body.querySelector('.tags')
      || chat.querySelector('.tags');

    if (!tags) {
      tags = document.createElement('div');
      tags.className = `tags ${GENERATED_TAGS_CLASS}`;
      tags.setAttribute('data-opa-notify-generated', 'true');
      body.appendChild(tags);
    }

    return tags;
  }


  function isMotivoRelatedNode(node) {
    const element = node?.nodeType === Node.ELEMENT_NODE
      ? node
      : node?.parentElement;

    if (!element) return false;

    return Boolean(
      element.matches?.('#select2-select_motivos-container, [id^="select2-select_motivos"][id$="-container"], .select2-selection__rendered') ||
      element.closest?.('#select2-select_motivos-container, [id^="select2-select_motivos"][id$="-container"], .select2-selection')
    );
  }

  function scheduleMotivoHighlight(delay = MOTIVO_CHECK_DEBOUNCE_MS) {
    clearTimeout(motivoHighlightTimer);
    motivoHighlightTimer = setTimeout(() => {
      applyMotivoHighlight();
    }, Math.max(0, delay));
  }

  function applyMotivoHighlight() {
    ensureHighlightStyles();

    const rendered = settings.motivoHighlightEnabled
      ? findMotivoRenderedElement()
      : null;
    const shouldHighlight = Boolean(rendered && isMotivoEmpty(rendered));
    const selection = shouldHighlight
      ? rendered.closest('.select2-selection') || rendered
      : null;
    const container = shouldHighlight
      ? rendered.closest('.select2-container') || selection
      : null;

    document
      .querySelectorAll(`.${MOTIVO_EMPTY_CLASS}`)
      .forEach(element => {
        if (element !== rendered && element !== selection) {
          element.classList.remove(MOTIVO_EMPTY_CLASS);
          element.classList.remove(MOTIVO_BLINK_CLASS);
        }
      });

    document
      .querySelectorAll(`.${MOTIVO_EMPTY_CONTAINER_CLASS}`)
      .forEach(element => {
        if (element !== container) {
          element.classList.remove(MOTIVO_EMPTY_CONTAINER_CLASS);
        }
      });

    if (!shouldHighlight) {
      if (rendered) {
        rendered.classList.remove(MOTIVO_EMPTY_CLASS);
        rendered.classList.remove(MOTIVO_BLINK_CLASS);
      }
      if (selection) {
        selection.classList.remove(MOTIVO_EMPTY_CLASS);
        selection.classList.remove(MOTIVO_BLINK_CLASS);
      }
      stopMotivoBlink();
      motivoBlinkElement = null;
      return false;
    }

    selection.classList.add(MOTIVO_EMPTY_CLASS);
    rendered.classList.add(MOTIVO_EMPTY_CLASS);
    container.classList.add(MOTIVO_EMPTY_CONTAINER_CLASS);

    // O vermelho estático continua existindo mesmo quando o pisca-pisca
    // está desativado. O pisca é controlado separadamente pela configuração.
    if (!settings.motivoBlinkEnabled) {
      stopMotivoBlink();
      motivoBlinkElement = null;
      selection.style.setProperty('background', 'rgba(220, 38, 38, .92)', 'important');
      selection.style.setProperty('box-shadow', 'inset 0 0 0 1px rgba(255, 255, 255, .22), 0 0 0 2px rgba(220, 38, 38, .34), 0 0 16px rgba(239, 68, 68, .50)', 'important');
      return true;
    }

    if (motivoBlinkElement !== selection || !motivoBlinkTimer) {
      stopMotivoBlink();
      motivoBlinkElement = selection;
      startMotivoBlink(selection);
    }

    return true;
  }

  function startMotivoBlink(selection) {
    stopMotivoBlink();
    if (!selection?.isConnected) return;

    let step = 0;
    const intervalMs = 280;
    const normalBackground = 'rgba(220, 38, 38, .92)';
    const brightBackground = '#ff0000';
    const normalShadow = 'inset 0 0 0 1px rgba(255, 255, 255, .22), 0 0 0 2px rgba(220, 38, 38, .34), 0 0 16px rgba(239, 68, 68, .50)';
    const brightShadow = 'inset 0 0 0 1px rgba(255, 255, 255, .50), 0 0 0 3px rgba(248, 113, 113, .85), 0 0 28px rgba(248, 113, 113, .95)';

    // O Select2 do Opa usa regras com !important. Por isso o efeito é
    // aplicado diretamente no elemento também com !important, alternando
    // a formatação real 5 vezes em vez de depender de CSS animation.
    const paint = (background, shadow) => {
      if (!selection.isConnected) return;
      selection.style.setProperty('background', background, 'important');
      selection.style.setProperty('box-shadow', shadow, 'important');
    };

    // Estado inicial: visível.
    paint(normalBackground, normalShadow);

    motivoBlinkTimer = setInterval(() => {
      if (!selection.isConnected || motivoBlinkElement !== selection) {
        stopMotivoBlink();
        return;
      }

      step += 1;
      const bright = step % 2 === 1;
      paint(
        bright ? brightBackground : normalBackground,
        bright ? brightShadow : normalShadow
      );

      // O destaque continua piscando indefinidamente enquanto o motivo
      // permanecer como "Selecione...". Quando um motivo válido for
      // selecionado, applyMotivoHighlight() chama stopMotivoBlink().
    }, intervalMs);
  }

  function stopMotivoBlink() {
    if (motivoBlinkTimer) {
      clearInterval(motivoBlinkTimer);
      motivoBlinkTimer = null;
    }

    if (motivoBlinkElement?.isConnected) {
      motivoBlinkElement.style.removeProperty('background');
      motivoBlinkElement.style.removeProperty('box-shadow');
    }
  }

  function findMotivoRenderedElement() {
    if (isNewInterface()) return document.querySelector('[data-tutorial="chat-panel-reasons"] [polaris-label="btn-reason"]');
    const direct = document.getElementById('select2-select_motivos-container')
      || document.querySelector('[id^="select2-select_motivos"][id$="-container"]');

    if (direct) return direct;

    const hiddenSelect = document.querySelector('#select_motivos, select[name*="motivo" i], select[id*="motivo" i]');
    if (hiddenSelect?.id) {
      const escapedId = cssEscape(hiddenSelect.id);
      const rendered = document.querySelector(`#select2-${escapedId}-container`);
      if (rendered) return rendered;
    }

    return [...document.querySelectorAll('.select2-selection__rendered')]
      .find(element => {
        const id = String(element.id || '').toLowerCase();
        if (id.includes('motivo')) return true;

        const title = normalizeMotivoText(element.getAttribute('title'));
        const text = normalizeMotivoText(element.textContent);
        return title === 'selecione' && text === 'selecione' && isNearMotivoLabel(element);
      }) || null;
  }

  function isNearMotivoLabel(element) {
    let current = element;
    for (let depth = 0; current && depth < 8; depth += 1) {
      const text = normalizeMotivoText(current.textContent || '');
      if (
        text.includes('informar motivo do atendimento') ||
        text.includes('motivo do atendimento')
      ) {
        return true;
      }
      current = current.parentElement;
    }

    return false;
  }

  function isMotivoEmpty(rendered) {
    if (isNewInterface()) {
      const id = currentNewAttendance()?.getAttribute('data-customer-service-id');
      return newMetadata.get(id)?.reasons === 0;
    }
    const title = normalizeMotivoText(rendered.getAttribute('title'));
    const text = normalizeMotivoText(rendered.textContent);

    if (!title && !text) return true;
    return title === 'selecione' || text === 'selecione';
  }

  function normalizeMotivoText(value) {
    return String(value || '')
      .trim()
      .replace(/\.+$/g, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function ensureToastRoot() {
    if (toastRoot?.isConnected && toastContainer) return;

    toastRoot = document.createElement('div');
    toastRoot.id = 'opa-notify-shadow-host';
    toastRoot.style.position = 'fixed';
    toastRoot.style.top = '16px';
    toastRoot.style.left = '16px';
    toastRoot.style.zIndex = '2147483647';
    toastRoot.style.pointerEvents = 'none';
    toastRoot.setAttribute('aria-live', 'polite');

    const shadow = toastRoot.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .stack {
        width: min(380px, calc(100vw - 32px));
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .toast {
        --event-color: #ef7d00;
        --event-color-light: #ff9a2f;
        --event-color-bg: rgba(239, 125, 0, 0.16);
        position: relative;
        display: grid;
        grid-template-columns: 46px 1fr 24px;
        gap: 12px;
        align-items: center;
        padding: 14px;
        color: #f7f8fb;
        background: rgba(25, 29, 42, 0.97);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-left: 5px solid var(--event-color);
        border-radius: 12px;
        box-shadow: 0 16px 45px rgba(0, 0, 0, 0.38);
        pointer-events: auto;
        cursor: pointer;
        overflow: hidden;
        animation: enter .24s ease-out both;
      }
      .toast.finished {
        --event-color: #3ecf8e;
        --event-color-light: #67e7aa;
        --event-color-bg: rgba(62, 207, 142, 0.16);
        cursor: copy;
      }
      .toast.copied {
        --event-color: #5da9ff;
        --event-color-light: #82beff;
        --event-color-bg: rgba(93, 169, 255, 0.16);
      }
      .toast.leaving { animation: leave .2s ease-in both; }
      .icon {
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        border-radius: 11px;
        background: var(--event-color-bg);
        color: var(--event-color-light);
      }
      .icon svg {
        width: 24px;
        height: 24px;
        fill: currentColor;
      }
      .heading {
        margin: 0 0 4px;
        color: var(--event-color-light);
        font-size: 13px;
        font-weight: 750;
        line-height: 1.25;
      }
      .company {
        margin: 0;
        color: #ffffff;
        font-size: 13px;
        font-weight: 650;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }
      .protocol {
        margin-top: 4px;
        color: #9ba5b7;
        font-size: 11px;
        font-weight: 550;
        letter-spacing: .02em;
      }
      .hint {
        margin-top: 5px;
        color: #748095;
        font-size: 9px;
      }
      .close {
        align-self: start;
        width: 24px;
        height: 24px;
        display: grid;
        place-items: center;
        padding: 0;
        color: #9ba5b7;
        background: transparent;
        border: 0;
        border-radius: 6px;
        cursor: pointer;
        font: 18px/1 sans-serif;
      }
      .close:hover { color: #fff; background: rgba(255,255,255,.08); }
      .progress {
        position: absolute;
        left: 0;
        bottom: 0;
        width: 100%;
        height: 3px;
        background: var(--event-color);
        transform-origin: left;
      }
      .test-badge {
        display: inline-block;
        margin-left: 6px;
        padding: 1px 5px;
        color: #c5cbd7;
        background: rgba(255,255,255,.08);
        border-radius: 999px;
        font-size: 9px;
        vertical-align: 1px;
      }
      @keyframes enter {
        from { opacity: 0; transform: translateX(-18px) scale(.98); }
        to { opacity: 1; transform: translateX(0) scale(1); }
      }
      @keyframes leave {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(-16px); }
      }
      @media (prefers-reduced-motion: reduce) {
        .toast, .toast.leaving { animation: none; }
      }
    `;

    toastContainer = document.createElement('div');
    toastContainer.className = 'stack';
    shadow.append(style, toastContainer);
    document.documentElement.appendChild(toastRoot);
  }

  function showToast(attendance, durationValue, isTest, eventType, sourceTabId, position) {
    ensureToastRoot();
    const corner = ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(position) ? position : 'top-left';
    const bottom = corner.startsWith('bottom');
    const right = corner.endsWith('right');
    toastRoot.style.top = bottom ? 'auto' : '16px';
    toastRoot.style.bottom = bottom ? '16px' : 'auto';
    toastRoot.style.left = right ? 'auto' : '16px';
    toastRoot.style.right = right ? '16px' : 'auto';
    toastContainer.style.flexDirection = bottom ? 'column-reverse' : 'column';

    const isFinished = eventType === 'finished';
    const duration = clamp(Number(durationValue) || 6000, 5000, 30000);
    const toast = document.createElement('article');
    toast.className = `toast ${isFinished ? 'finished' : 'received'}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute(
      'aria-label',
      isFinished
        ? 'Atendimento finalizado. Clique para copiar o protocolo.'
        : 'Novo atendimento recebido. Clique para abrir.'
    );

    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.innerHTML = isFinished ? copyIconSvg() : bellIconSvg();

    const content = document.createElement('div');
    const heading = document.createElement('p');
    heading.className = 'heading';
    heading.textContent = isFinished
      ? 'Atendimento Finalizado'
      : 'Novo atendimento recebido';

    if (isTest) {
      const badge = document.createElement('span');
      badge.className = 'test-badge';
      badge.textContent = 'TESTE';
      heading.appendChild(badge);
    }

    const company = document.createElement('p');
    company.className = 'company';
    company.textContent = attendance?.company || 'Empresa não identificada';

    const protocol = document.createElement('div');
    protocol.className = 'protocol';
    protocol.textContent = attendance?.protocol || 'Protocolo não identificado';

    content.append(heading, company, protocol);

    if (isFinished) {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = 'Clique no aviso para copiar o protocolo';
      content.appendChild(hint);
    }

    const closeButton = document.createElement('button');
    closeButton.className = 'close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Fechar aviso');
    closeButton.textContent = '×';

    const progress = document.createElement('div');
    progress.className = 'progress';
    const progressAnimation = progress.animate(
      [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
      { duration, easing: 'linear', fill: 'forwards' }
    );

    toast.append(icon, content, closeButton, progress);
    toastContainer.prepend(toast);

    while (toastContainer.children.length > 4) {
      toastContainer.lastElementChild?.remove();
    }

    let timeout = setTimeout(() => removeToast(toast), duration);
    let copied = false;

    closeButton.addEventListener('click', event => {
      event.stopPropagation();
      clearTimeout(timeout);
      progressAnimation.cancel();
      removeToast(toast);
    });

    toast.addEventListener('click', async () => {
      if (isFinished) {
        if (copied) return;
        copied = true;

        const copiedSuccessfully = await copyText(attendance?.protocol || '');
        clearTimeout(timeout);
        progressAnimation.cancel();

        if (copiedSuccessfully) {
          toast.classList.add('copied');
          heading.textContent = 'Protocolo copiado';
          timeout = setTimeout(() => removeToast(toast), 1600);
        } else {
          heading.textContent = 'Não foi possível copiar';
          copied = false;
          timeout = setTimeout(() => removeToast(toast), 2200);
        }
        return;
      }

      if (!isTest) {
        if (sourceTabId) {
          await chrome.runtime.sendMessage({ type: 'OPEN_SOURCE_ATTENDANCE', sourceTabId, attendance }).catch(() => undefined);
        } else focusAttendance(attendance);
      }
      clearTimeout(timeout);
      progressAnimation.cancel();
      removeToast(toast);
    });
  }

  function bellIconSvg() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 22a2.4 2.4 0 0 0 2.35-2h-4.7A2.4 2.4 0 0 0 12 22Zm7-5.2-1.7-2.1V9a5.32 5.32 0 0 0-4.1-5.17V3a1.2 1.2 0 1 0-2.4 0v.83A5.32 5.32 0 0 0 6.7 9v5.7L5 16.8V18h14v-1.2Z"/>
      </svg>`;
  }

  function copyIconSvg() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 2h9a2 2 0 0 1 2 2v11h-2V4H8V2Zm-3 4h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm0 2v12h9V8H5Z"/>
      </svg>`;
  }

  async function copyText(text) {
    const value = String(text || '').trim();
    if (!value) return false;

    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (_) {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.select();

      try {
        return document.execCommand('copy');
      } catch (_) {
        return false;
      } finally {
        textarea.remove();
      }
    }
  }

  function removeToast(toast) {
    if (!toast?.isConnected || toast.classList.contains('leaving')) return;
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 220);
  }

  async function focusAttendance(attendance) {
    let target = null;
    if (isNewInterface()) {
      target = [...document.querySelectorAll(NEW_CARD)].find(card => cardId(card) === attendance?.id || extractProtocol(card) === attendance?.protocol);
    }

    if (!target && isNewInterface() && newQueue) {
      const index = newQueue.findIndex(item => item.id === attendance?.id || item.protocol === attendance?.protocol);
      const list = document.querySelector(NEW_LIST);
      const scroller = [...list.querySelectorAll('div')].find(element => element.scrollHeight > element.clientHeight && /auto|scroll/.test(getComputedStyle(element).overflowY));
      if (index >= 0 && scroller) {
        // The list uses variable-height virtualization; estimate from the full
        // extent, then wait for React to mount the requested row.
        for (let attempt = 0; attempt < 4 && !target; attempt++) {
          scroller.scrollTop = Math.max(0, index * scroller.scrollHeight / newQueue.length - (attempt % 2) * scroller.clientHeight / 2);
          scroller.dispatchEvent(new Event('scroll'));
          await new Promise(resolve => setTimeout(resolve, 150));
          target = [...document.querySelectorAll(NEW_CARD)].find(card => cardId(card) === attendance?.id || extractProtocol(card) === attendance?.protocol);
        }
      }
    }
    if (!target && attendance?.id && !isNewInterface()) {
      target = document.querySelector(`.chat[data-id="${cssEscape(attendance.id)}"]`);
    }

    if (!target && attendance?.protocol) {
      target = [...document.querySelectorAll(CARD_SELECTOR)]
        .find(chat => extractProtocol(chat) === attendance.protocol);
    }

    if (!target) return false;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const previousOutline = target.style.outline;
    const previousOutlineOffset = target.style.outlineOffset;
    target.style.outline = '3px solid #ef7d00';
    target.style.outlineOffset = '-3px';

    setTimeout(() => {
      target.style.outline = previousOutline;
      target.style.outlineOffset = previousOutlineOffset;
    }, 2200);

    const clickable = cardClickTarget(target);
    setTimeout(() => clickable.click(), 250);
    return true;
  }

  function cssEscape(value) {
    if (globalThis.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  }
})();
