(() => {
  if (globalThis.__OPA_NOTIFY_CONTENT_LOADED__) return;
  globalThis.__OPA_NOTIFY_CONTENT_LOADED__ = true;

  const SCAN_INTERVAL_MS = 5000;
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
  const INACTIVITY_ROW_CLASS = 'opa-notify-inactivity-row';
  const INACTIVITY_TAG_CLASS = 'opa-notify-inactivity-tag';
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
  let lastCompleteQueueAt = 0;
  let queueRefreshState = null;
  let confirmationRefreshPending = false;
  let confirmationSnapshotReady = false;
  let initialSnapshotPending = true;
  const queueDiagnostics = [];
  let newMetadata = new Map();
  const cursors = new Map();
  const visibleCandidates = new Map();
  const visibleBaseline = new Set();
  let viewInitialized = false;
  let scanBusy = false;
  let groups;
  const featureDefaults = {
    ...OpaTagSettings.defaults, notifyClientMessages: true, messageScope: 'all',
  };

  function isNewInterface() { return Boolean(document.querySelector(NEW_LIST)); }
  function isPersonalNewQueue() {
    const filter = document.querySelector('[data-tutorial="customer-service-view-selector"]');
    const tab = document.querySelector('[data-tutorial="customer-service-queue-in-progress"]');
    return normalizeInterfaceText(filter?.textContent) === 'meus atendimentos'
      && Boolean(tab && (tab.getAttribute('data-active') === 'true' || (tab.classList.contains('bg-gray-200') && tab.classList.contains('border-gray-400'))));
  }
  function cardId(card) { return card?.getAttribute('itemid') || card?.getAttribute('data-id') || ''; }
  function cardClickTarget(card) { return card?.querySelector('.corpo') || card?.querySelector(':scope > button') || card; }
  function openAttendance() {
    if (isNewInterface()) {
      const current = currentNewAttendance();
      return { id: current?.getAttribute('data-customer-service-id') || '', protocol: normalizeProtocol(current?.getAttribute('data-protocol')) };
    }
    const current = document.querySelector('.chat.selected[data-id]');
    return { id: cardId(current), protocol: current ? extractProtocol(current) || '' : '' };
  }
  function isOpenAttendance(attendance) {
    const open = openAttendance();
    return Boolean((attendance.id && attendance.id === open.id) || (attendance.protocol && attendance.protocol === open.protocol));
  }
  function currentNewAttendance() { return document.querySelector('[data-customer-service-id][data-protocol]'); }
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || !isSupportPage) return;
    const data = event.data;
    if (data?.source !== 'opa-notify-queue-v1') return;
    if (data.kind === 'refresh-status') {
      const states = ['inactive-view', 'waiting-for-complete-query', 'socket-not-open', 'rate-limited', 'search-active', 'missing-query', 'missing-page-query', 'sent', 'send-failed'];
      if (states.includes(data.state)) queueRefreshState = { state: data.state, queryCaptured: data.queryCaptured === true, lastRequestAt: Number.isFinite(data.lastRequestAt) ? data.lastRequestAt : null, intervalMs: 15000 };
      return;
    }
    if (data.kind === 'diagnostic') {
      if (typeof data.event !== 'string' || !(data.event.startsWith('customer-services-ui:customer-service-queues:in-progress:') || data.event === 'socket-close')) return;
      queueDiagnostics.push({
        at: Date.now(), automatic: data.automatic === true, event: data.event.slice(0, 180), direction: data.direction === 'sent' ? 'sent' : 'received',
        count: Number.isInteger(data.count) ? data.count : null,
        page: Number.isInteger(data.page) ? data.page : null,
        hasMore: typeof data.hasMore === 'boolean' ? data.hasMore : null
      });
      if (queueDiagnostics.length > 40) queueDiagnostics.shift();
      return;
    }
    if (data.kind === 'message') {
      const item = newMetadata.get(data.id);
      if (item && data.cursor && personalListAvailable() && viewInitialized) {
        observeMessage(item, data.cursor);
        item.cursor = data.cursor;
        item.activity = data.activity || null;
        if (data.cursor.incoming && data.unread !== null) item.unread = data.unread === true;
        updateQueueFeatures();
      }
      return;
    }
    if (data.kind === 'reset') { queuePages.clear(); newQueue = null; return; }
    if (data.kind !== 'page' || !Array.isArray(data.items) || !Number.isInteger(data.page) || data.page < 1 || data.page > 1000 || typeof data.hasMore !== 'boolean') return;
    if (!personalListAvailable() || normalizeInterfaceText(data.view) !== 'meus atendimentos') { queuePages.clear(); newQueue = null; return; }
    if (data.page === 1) { queuePages.clear(); newQueue = null; }
    const valid = data.items.every(item => item && typeof item.id === 'string' && item.id && /^OPA\d{6,}$/.test(item.protocol) && typeof item.company === 'string' && item.company);
    if (!valid) { queuePages.clear(); newQueue = null; return; }
    queuePages.set(data.page, data.items.map(item => ({
      ...item, tags: Array.isArray(item.tags) ? item.tags.filter(tag => typeof tag === 'string') : []
    })));
    if (data.hasMore) return;
    for (let page = 1; page <= data.page; page++) if (!queuePages.has(page)) return;
    const items = [...Array(data.page)].flatMap((_, index) => queuePages.get(index + 1));
    if (new Set(items.map(item => item.id)).size !== items.length || new Set(items.map(item => item.protocol)).size !== items.length) { newQueue = null; return; }
    lastCompleteQueueAt = Date.now();
    if (!viewInitialized || initialSnapshotPending) cursors.clear();
    for (const item of items) observeMessage(item, item.cursor);

    newMetadata = new Map(items.map(item => [item.id, item]));
    for (const id of cursors.keys()) if (!newMetadata.has(id)) cursors.delete(id);
    newQueue = items.map(({ id, protocol, company, tags }) => ({ id, protocol, company, silent: OpaTagSettings.isAssumedOnly(tags) }));
    if (!viewInitialized && personalListAvailable()) {
      for (const card of document.querySelectorAll(NEW_CARD)) visibleBaseline.add(cardId(card));
      viewInitialized = true;
    }
    updateQueueFeatures();
    applyHighlightedAttendance();
    const confirmsDeparture = confirmationRefreshPending;
    confirmationRefreshPending = false;
    confirmationSnapshotReady = confirmsDeparture;
    // Take the first complete snapshot as soon as it arrives. A second list
    // can already be in the event loop while the initial scan is pending.
    scanAndSend(confirmsDeparture).catch(console.error);
  });

  let settings = {
    ...featureDefaults,
    enabled: true,
    colorHighlightEnabled: true,
    highlightFillMode: 'soft'
  };
  let highlightedProtocol = '';
  let observer = null;
  let scanTimer = null;
  let scanDeadline = 0;
  let forceNextScan = false;
  let periodicTimer = null;
  let candidateFingerprint = null;
  let candidateSince = 0;
  let lastSentFingerprint = null;
  let lastSentAt = 0;
  let toastRoot = null;
  let toastContainer = null;
  const scriptStartedAt = Date.now();

  const isSupportPage = ['https://suporte.ixcsoft.com.br', 'https://opasuiteapi.ixcsoft.com.br'].includes(location.origin);
  if (!isSupportPage) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes.enabled?.newValue === false || changes.otherTabsEnabled?.newValue === false)) {
        toastRoot?.remove();
      }
    });
  }
  if (isSupportPage) initialize().catch(error => console.error('Termofy não iniciou:', error));

  async function initialize() {
    await loadSettings();
    ensureHighlightStyles();
    applyHighlightedAttendance();
    watchSettings();
    observePage();
    scheduleScan(1200);
    periodicTimer = setInterval(() => scheduleScan(0), SCAN_INTERVAL_MS);
    window.postMessage({ source: 'opa-notify-content-ready-v1' }, location.origin);
  }

  async function loadSettings() {
    const stored = await chrome.storage.local.get([
      ...Object.keys(featureDefaults),
      'enabled',
      'colorHighlightEnabled',
      'highlightFillMode',
      'highlightedAttendanceProtocol'
    ]);
    for (const [key, fallback] of Object.entries(featureDefaults)) settings[key] = stored[key] ?? fallback;
    settings.enabled = stored.enabled !== false;
    settings.colorHighlightEnabled = stored.colorHighlightEnabled !== false;
    settings.highlightFillMode = normalizeHighlightFillMode(stored.highlightFillMode);
    highlightedProtocol = normalizeProtocol(stored.highlightedAttendanceProtocol);
  }

  function watchSettings() {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (Object.keys(featureDefaults).some(key => changes[key]) || changes.enabled) {
        for (const [key, fallback] of Object.entries(featureDefaults)) {
          if (changes[key]) settings[key] = changes[key].newValue ?? fallback;
        }
        if (changes.enabled) settings.enabled = changes.enabled.newValue !== false;
        if (changes.notifyClientMessages || changes.enabled) {
          cursors.clear();
          if (viewInitialized) for (const item of newMetadata.values()) observeMessage(item, item.cursor);
        }
        updateQueueFeatures();
        scheduleScan(0);
      }
      if (changes.colorHighlightEnabled) {
        settings.colorHighlightEnabled = changes.colorHighlightEnabled.newValue !== false;
        applyHighlightedAttendance();
      }

      if (changes.highlightFillMode) {
        settings.highlightFillMode = normalizeHighlightFillMode(changes.highlightFillMode.newValue);
        applyHighlightedAttendance();
      }

      if (changes.highlightedAttendanceProtocol) {
        highlightedProtocol = normalizeProtocol(
          changes.highlightedAttendanceProtocol.newValue
        );
        applyHighlightedAttendance();
      }
    });
  }

  function personalListAvailable() {
    return isPersonalNewQueue() && !document.querySelector(`${NEW_LIST} input:not([type=checkbox]):not([type=radio])`)?.value?.trim();
  }

  function observeMessage(item, cursor, legacy = false) {
    if (!settings.enabled || !settings.notifyClientMessages) return;
    const id = item.id || item.protocol;
    const previous = cursors.get(id);
    const token = typeof cursor?.id === 'string' ? cursor.id : '';
    // Keep a small window as direct updates and list responses can interleave.
    if (previous?.last === token) return;
    const seen = previous?.seen || [];
    if (!legacy && token && seen.includes(token)) return;
    cursors.set(id, { last: token, seen: token ? [...seen.slice(-15), token] : seen });
    if (!previous || !token || !cursor.incoming) return;
    if (legacy && /^\d+$/.test(token) && /^\d+$/.test(previous.last) && Number(token) <= Number(previous.last)) return;
    const attendance = { id, protocol: item.protocol, company: item.company };
    if (isOpenAttendance(attendance)) return;
    chrome.runtime.sendMessage({ type: 'CLIENT_MESSAGE', attendance, openAttendance: openAttendance(), tags: item.tags || [], cursor: token, text: cursor.text || '', legacy }).catch(console.warn);
  }

  function legacyQueueRoot() {
    if (!isOngoingAttendancesModuleActive()) return null;
    const selected = document.querySelector('button[data-id="meus_atendimentos"].selected_filtro_user_status');
    const list = selected?.closest('.list');
    if (list?.querySelector('.list_select_input')?.value.trim()) return null;
    return list?.querySelector('.list_dados') || selected?.closest('.list_dados');
  }

  function visibleRow(card) {
    const company = card.querySelector('p.italic')?.textContent.trim();
    const contact = card.querySelector('p.font-medium, button p')?.textContent.trim();
    return {
      id: cardId(card), protocol: extractProtocol(card) || '',
      company: company && normalizeInterfaceText(company) !== 'sem cliente vinculado' ? company : contact || 'Empresa não identificada',
      tags: (card.getAttribute('data-tag-names') || '').split('|').filter(Boolean)
    };
  }

  function updateQueueFeatures() {
    const modern = isNewInterface();
    const root = modern ? personalListAvailable() && document.querySelector(NEW_LIST) : legacyQueueRoot();
    if (!root || !settings.enabled) {
      clearInactivityLabels();
      groups?.clear();
      cursors.clear();
      visibleCandidates.clear();
      visibleBaseline.clear();
      viewInitialized = false;
      return;
    }
    const grouping = settings.groupByTag;
    if (!grouping) groups?.clear();
    if (!modern) clearInactivityLabels();
    const rows = [];
    if (modern) {
      const cards = [...root.querySelectorAll('[itemid]')];
      const mounted = new Set(cards.map(cardId));
      // A server-side departure can precede removal of the old card by React.
      // Only a newly mounted, previously unknown row is positive evidence.
      for (const id of visibleBaseline) if (!mounted.has(id)) visibleBaseline.delete(id);
      for (const id of mounted) if (newMetadata.has(id)) visibleBaseline.add(id);
      for (const id of visibleCandidates.keys()) if (!mounted.has(id) || newMetadata.has(id)) visibleCandidates.delete(id);
      for (const card of cards) {
        const id = cardId(card);
        if (!id) continue;
        const item = newMetadata.get(id);
        updateInactivityLabel(card, item?.activity);
        if (grouping) {
          const list = card.closest('ul');
          if (list && root.contains(list)) {
            let node = card;
            while (node.parentElement !== list) node = node.parentElement;
            const tags = card.getAttribute('data-tag-names');
            rows.push({
              id, node, tags: tags == null ? item?.tags || [] : tags.split('|').filter(Boolean),
              unread: item?.unread === true, pinned: item?.pinned === true
            });
          }
        }
        if (!viewInitialized || item || initialSnapshotPending || visibleBaseline.has(id)) continue;
        if (!visibleCandidates.has(id)) {
          visibleCandidates.set(id, Date.now());
          scheduleScan(1500);
        } else if (Date.now() - visibleCandidates.get(id) >= 1500) {
          visibleCandidates.set(id, Infinity);
          chrome.runtime.sendMessage({ type: 'VISIBLE_ARRIVAL', attendance: visibleRow(card), openAttendance: openAttendance() }).then(response => {
            if (!response?.success) visibleCandidates.delete(id);
          }).catch(() => visibleCandidates.delete(id));
        } else if (Number.isFinite(visibleCandidates.get(id))) {
          scheduleScan(visibleCandidates.get(id) + 1500 - Date.now());
        }
      }
    } else if (grouping || settings.notifyClientMessages) {
      const ids = new Set();
      for (const card of root.querySelectorAll('.chat[data-id]')) {
        const protocol = extractProtocol(card);
        if (!protocol) continue;
        const id = cardId(card) || protocol;
        const indicator = card.querySelector('.notifica.piscar');
        const tags = [...card.querySelectorAll('.tags .tag:not([data-opa-notify-tag]):not([data-opalert-tag]):not([id^="tag-departamento-"])')].map(tag => tag.textContent.trim()).filter(Boolean);
        const company = card.querySelector('.corpo > .title')?.textContent.trim() || 'Empresa não identificada';
        const item = { id, protocol, company, tags, unread: Boolean(indicator), pinned: Boolean(card.querySelector('.icone-atendimento-fixado')) };
        ids.add(id);
        const token = indicator && (indicator.dataset.messageId || indicator.textContent.trim() || 'unread');
        observeMessage(item, { id: token || '', incoming: Boolean(indicator) }, true);
        if (grouping) {
          let node = card;
          while (node.parentElement && node.parentElement !== root) node = node.parentElement;
          rows.push({ ...item, node });
        }
      }
      for (const id of cursors.keys()) if (!ids.has(id)) cursors.delete(id);
    }
    if (grouping && globalThis.OpaNotifyGroups) {
      groups ||= new globalThis.OpaNotifyGroups();
      groups.update(root, rows, settings, modern);
    }
  }

  function clearInactivityLabels() {
    for (const row of document.querySelectorAll(`.${INACTIVITY_ROW_CLASS}`)) row.remove();
    for (const tags of document.querySelectorAll(`.${GENERATED_TAGS_CLASS}`)) {
      if (!tags.children.length) tags.remove();
    }
  }

  function inactivityDuration(at) {
    const minutes = Math.floor((Date.now() - at) / 60000);
    if (minutes < 1) return 'menos de 1min';
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h${minutes % 60 ? ` ${minutes % 60}min` : ''}`;
    const days = Math.floor(hours / 24);
    return `${days}d${hours % 24 ? ` ${hours % 24}h` : ''}`;
  }

  // Shared with the Notify-owned Termostato adapter; original vendor files stay intact.
  function placeInactivityBesideMood(card) {
    const row = card.querySelector(`.${INACTIVITY_ROW_CLASS}`);
    const mood = card.querySelector('.ixc-selo');
    if (!row || !mood) return;
    let line = card.querySelector('.opa-notify-client-status');
    if (!line) {
      line = document.createElement('div');
      line.className = 'opa-notify-client-status';
      mood.before(line);
    }
    if (mood.parentElement !== line) line.prepend(mood);
    if (row.parentElement !== line) {
      const previous = row.parentElement;
      line.append(row);
      if (previous?.classList.contains(GENERATED_TAGS_CLASS) && !previous.children.length) previous.remove();
    }
  }
  globalThis.OpaNotifyPlaceInactivity = placeInactivityBesideMood;

  function updateInactivityLabel(card, activity) {
    let row = card.querySelector(`.${INACTIVITY_ROW_CLASS}`);
    const at = activity?.at;
    if (!Number.isFinite(at) || at <= 0 || at > Date.now() + 60000) {
      const parent = row?.parentElement;
      row?.remove();
      if (parent?.classList.contains(GENERATED_TAGS_CLASS) && !parent.children.length) parent.remove();
      return;
    }
    const tags = row?.parentElement || getOrCreateTagsContainer(card);
    if (!tags) return;
    if (!row) {
      row = document.createElement('div');
      row.className = INACTIVITY_ROW_CLASS;
      const tag = document.createElement('span');
      tag.className = INACTIVITY_TAG_CLASS;
      row.append(tag);
    }
    if (!row.parentElement) tags.append(row);
    placeInactivityBesideMood(card);
    const tag = row.firstElementChild;
    const waiting = activity.waitingForCustomer === true;
    const label = `${waiting ? 'Aguardando cliente' : 'Sem resposta'} há ${inactivityDuration(at)}`;
    if (tag.textContent !== label) tag.textContent = label;
    if (tag.dataset.state !== (waiting ? 'customer' : 'agent')) tag.dataset.state = waiting ? 'customer' : 'agent';
  }

  function observePage() {
    observer = new MutationObserver(mutations => {
      mutations = mutations.filter(m => m.attributeName !== 'class' ||
        m.target.matches('.notifica, [data-tutorial="customer-service-queue-in-progress"]') ||
        m.oldValue?.split(' ').includes('notifica'));
      if (!mutations.length) return;
      let shouldScanAttendances = false;

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

          shouldScanAttendances ||= changedAttendances;
          continue;
        }

        if (mutation.type === 'characterData') continue;
      }
      if (isNewInterface()) {
        shouldScanAttendances ||= mutations.some(m => m.target?.closest?.(NEW_LIST) ||
          [...m.addedNodes || []].some(n => n.matches?.(NEW_LIST) || n.querySelector?.(NEW_LIST)));
      }
      if (shouldScanAttendances) {
        applyHighlightedAttendance();
        scheduleScan(350);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function scheduleScan(delay, force = false) {
    forceNextScan ||= force;
    const deadline = Date.now() + delay;
    if (scanTimer !== null && scanDeadline <= deadline) return;
    clearTimeout(scanTimer);
    scanDeadline = deadline;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scanDeadline = 0;
      const force = forceNextScan;
      forceNextScan = false;
      scanAndSend(force).catch(console.error);
    }, delay);
  }

  async function scanAndSend(force = false) {
    if (scanBusy) { scheduleScan(100, force); return; }
    updateQueueFeatures();
    let items;
    const completeSnapshot = isNewInterface();
    if (completeSnapshot) {
      if (!isPersonalNewQueue()) { newQueue = null; queuePages.clear(); confirmationRefreshPending = false; confirmationSnapshotReady = false; return; }
      if (document.querySelector(`${NEW_LIST} input:not([type=checkbox]):not([type=radio])`)?.value?.trim()) return;
      const freshConfirmation = confirmationSnapshotReady;
      confirmationSnapshotReady = false;
      force ||= freshConfirmation;
      if (settings.enabled) {
        const confirm = !freshConfirmation && (force || confirmationRefreshPending);
        confirmationRefreshPending ||= confirm;
        window.postMessage({ source: 'opa-notify-refresh-queue-v1', confirm }, location.origin);
        // A cached absence is not a second observation. Wait for a fresh full
        // server snapshot before confirming that an attendance really left.
        if (confirm) return;
      }
      if (newQueue === null) return;
      items = newQueue;
      applyHighlightedAttendance();
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

    }

    if (!completeSnapshot && items.length === 0 && Date.now() - scriptStartedAt < INITIAL_EMPTY_DELAY_MS) {
      scheduleScan(1000);
      return;
    }

    const fingerprint = items
      .map(item => `${item.protocol}:${item.id}:${item.silent === true ? 'silent' : 'active'}`)
      .sort()
      .join('|');
    const now = Date.now();

    if (!completeSnapshot && fingerprint !== candidateFingerprint) {
      candidateFingerprint = fingerprint;
      candidateSince = now;
      scheduleScan(STABILITY_DELAY_MS);
      return;
    }

    if (!completeSnapshot && now - candidateSince < STABILITY_DELAY_MS) {
      scheduleScan(STABILITY_DELAY_MS - (now - candidateSince));
      return;
    }

    if (
      !force && fingerprint === lastSentFingerprint &&
      now - lastSentAt < UNCHANGED_HEARTBEAT_MS
    ) return;

    scanBusy = true;
    const response = await chrome.runtime.sendMessage({
      completeSnapshot,
      type: 'ATTENDANCE_SCAN',
      initialRead: initialSnapshotPending,
      openAttendance: openAttendance(),
      items,
      pageUrl: location.href,
      scannedAt: now
    }).catch(() => null);
    scanBusy = false;
    if (response?.success) {
      initialSnapshotPending = false;
      lastSentFingerprint = fingerprint;
      lastSentAt = now;
      if (Number.isFinite(response.nextScanIn) && response.nextScanIn > 0) {
        scheduleScan(Math.min(response.nextScanIn, 8000), true);
      }
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
      const tags = [...chat.querySelectorAll('.tags .tag:not([data-opa-notify-tag]):not([data-opalert-tag]):not([id^="tag-departamento-"])')]
        .map(tag => tag.textContent.trim()).filter(Boolean);
      result.set(protocol, { id, protocol, company, silent: OpaTagSettings.isAssumedOnly(tags) });
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
      sendResponse({ success: true, ready: true, version: '2.0.6' });
      return false;
    }

    if (message?.type === 'SHOW_ATTENDANCE_EVENT') {
      try {
        showToast(
          message.attendance,
          message.duration,
          message.isTest === true,
          ['finished', 'message'].includes(message.eventType) ? message.eventType : 'received',
          message.sourceTabId,
          message.position
        );
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: `Não foi possível exibir o cartão: ${error.message}` });
      }
      return false;
    }

    if (!isSupportPage) return false;

    if (message?.type === 'GET_MONITOR_DIAGNOSTICS') {
      sendResponse({ success: true, version: '2.0.6', interface: isNewInterface() ? 'new' : 'legacy', personalQueue: isOngoingAttendancesModuleActive(), completeQueueReady: newQueue !== null, completeQueueCount: newQueue?.length ?? null, lastCompleteQueueAt: lastCompleteQueueAt || null, completeQueueAgeMs: lastCompleteQueueAt ? Date.now() - lastCompleteQueueAt : null, initialSnapshotPending, visibleUnknownCount: visibleCandidates.size, refresh: queueRefreshState, awaitingDepartureConfirmation: confirmationRefreshPending, events: queueDiagnostics });
      return false;
    }

    if (message?.type === 'CHECK_ATTENDANCE_ACTIVE') {
      sendResponse({ success: true, active: isOpenAttendance(message.attendance || {}) });
      return false;
    }

    if (message?.type === 'BACKGROUND_ATTENDANCE_SCAN') {
      scanAndSend().then(() => sendResponse({ success: true })).catch(() => sendResponse({ success: false }));
      return true;
    }

    if (message?.type === 'FOCUS_ATTENDANCE') {
      focusAttendance(message.attendance).then(found => {
        if (!found) {
          ensureToastRoot();
          const status = document.createElement('div');
          status.className = 'toast';
          status.setAttribute('role', 'status');
          status.textContent = 'Conversa indisponível em Meus atendimentos.';
          toastContainer.prepend(status);
          setTimeout(() => status.remove(), 4000);
        }
        sendResponse({ success: found });
      }).catch(() => sendResponse({ success: false }));
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

      .${INACTIVITY_ROW_CLASS} {
        display: flex !important;
        flex: 0 0 100% !important;
        width: 100% !important;
        margin-top: 3px !important;
        pointer-events: none !important;
      }

      .opa-notify-client-status {
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }
      .opa-notify-client-status > .ixc-selo {
        flex: 0 0 auto !important;
        align-self: center !important;
      }
      .opa-notify-client-status > .${INACTIVITY_ROW_CLASS} {
        flex: 0 1 auto !important;
        width: auto !important;
        min-width: 0 !important;
        margin-top: 0 !important;
      }

      .${INACTIVITY_TAG_CLASS} {
        display: inline-block !important;
        max-width: 100% !important;
        padding: 2px 5px !important;
        border-radius: 3px !important;
        color: #fff !important;
        background: #b45309 !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        line-height: 1.25 !important;
        white-space: normal !important;
      }

      .${INACTIVITY_TAG_CLASS}[data-state="agent"] {
        background: #b91c1c !important;
      }

    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function applyHighlightedAttendance(root = document) {
    ensureHighlightStyles();

    const chats = [...document.querySelectorAll(CARD_SELECTOR)];
    let found = false;

    for (const chat of chats) {
      const tags = chat.hasAttribute('itemid')
        ? newMetadata.get(cardId(chat))?.tags || (chat.getAttribute('data-tag-names') || '').split('|')
        : [...chat.querySelectorAll('.tags .tag:not([data-opa-notify-tag]):not([data-opalert-tag]):not([id^="tag-departamento-"])')].map(tag => tag.textContent.trim());
      const shouldHighlight = Boolean(
        settings.colorHighlightEnabled &&
        highlightedProtocol &&
        !OpaTagSettings.isAssumedOnly(tags) &&
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
        --event-color-light: #ffb35c;
        --event-color-bg: rgba(239, 125, 0, 0.13);
        position: relative;
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr) 24px;
        gap: 11px;
        align-items: center;
        padding: 13px;
        color: #f7f8fb;
        background: #1e2633;
        border: 1px solid var(--event-color);
        border-radius: 11px;
        box-shadow: 0 14px 38px rgba(0, 0, 0, 0.42);
        pointer-events: auto;
        cursor: pointer;
        overflow: hidden;
        animation: enter .22s cubic-bezier(.19, 1, .22, 1) both;
      }
      .toast.finished {
        --event-color: #3ecf8e;
        --event-color-light: #91ebbd;
        --event-color-bg: rgba(62, 207, 142, 0.13);
        cursor: copy;
      }
      .toast.message {
        --event-color: #459bf5;
        --event-color-light: #a9d3ff;
        --event-color-bg: rgba(69, 155, 245, .14);
        background: #1b2a3b;
      }
      .message .heading { overflow-wrap: anywhere; }
      .message-text { margin: 4px 0 0; color: #d0dcec; font-size: 12px; font-weight: 500; line-height: 1.45; overflow-wrap: anywhere; white-space: pre-wrap; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; overflow: hidden; }
      .toast:focus-visible { outline: 2px solid var(--event-color-light); outline-offset: 2px; }
      .toast.copied {
        --event-color: #5da9ff;
        --event-color-light: #82beff;
        --event-color-bg: rgba(93, 169, 255, 0.16);
      }
      .toast.leaving { animation: leave .18s ease-in both; }
      .icon {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        border-radius: 10px;
        background: var(--event-color-bg);
        color: var(--event-color-light);
      }
      .icon svg {
        width: 22px;
        height: 22px;
        fill: currentColor;
      }
      .heading {
        margin: 0 0 4px;
        color: var(--event-color-light);
        font-size: 12px;
        font-weight: 700;
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
        color: #bfcbdc;
        font-size: 11px;
        font-weight: 550;
        letter-spacing: .02em;
      }
      .hint {
        margin-top: 5px;
        color: #b0bfd2;
        font-size: 10px;
      }
      .close {
        align-self: start;
        width: 24px;
        height: 24px;
        display: grid;
        place-items: center;
        padding: 0;
        color: #bfcbdc;
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
        height: 2px;
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
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes leave {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-8px); }
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
    const isMessage = eventType === 'message';
    const { title, iconSvg } = {
      received: { title: 'Novo atendimento recebido', iconSvg: bellIconSvg },
      finished: { title: 'Atendimento Finalizado', iconSvg: copyIconSvg },
      message: { title: 'Mensagem do cliente', iconSvg: messageIconSvg }
    }[eventType];
    const duration = clamp(Number(durationValue) || 6000, 5000, 30000);
    const toast = document.createElement('article');
    toast.className = `toast ${eventType}`;
    toast.setAttribute('role', 'alert');
    toast.tabIndex = 0;
    toast.addEventListener('keydown', event => {
      if (event.target === toast && ['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        toast.click();
      }
    });
    toast.setAttribute(
      'aria-label',
      isFinished
        ? 'Atendimento finalizado. Clique para copiar o protocolo.'
        : (isMessage ? (attendance?.company || 'Empresa não identificada') + '. Mensagem do cliente.' : title + '.') + ' Clique para abrir a conversa.'
    );

    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.innerHTML = iconSvg();

    const content = document.createElement('div');
    const heading = document.createElement('p');
    heading.className = 'heading';
    heading.textContent = isMessage ? attendance?.company || 'Empresa não identificada' : title;

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
    protocol.textContent = attendance?.protocol || '';

    if (isMessage) {
      const messageText = document.createElement('p');
      messageText.className = 'message-text';
      messageText.textContent = attendance?.messageText || 'Mensagem recebida';
      content.append(heading, messageText);
    } else {
      content.append(heading, company, protocol);
    }

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
        const opened = sourceTabId
          ? (await chrome.runtime.sendMessage({ type: 'OPEN_SOURCE_ATTENDANCE', sourceTabId, attendance }).catch(() => null))?.success
          : await focusAttendance(attendance);
        if (!opened) {
          clearTimeout(timeout);
          heading.textContent = 'Conversa indisponível na fila';
          timeout = setTimeout(() => removeToast(toast), 2200);
          return;
        }
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

  function messageIconSvg() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 3.5h14a2.5 2.5 0 0 1 2.5 2.5v9a2.5 2.5 0 0 1-2.5 2.5H10l-6 4v-4.2A2.5 2.5 0 0 1 2.5 15V6A2.5 2.5 0 0 1 5 3.5Z"/>
          <path d="M7 8.5h10M7 12.5h6"/>
        </g>
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
    groups?.reveal(attendance?.id);
    let target = null;
    if (isNewInterface()) {
      target = [...document.querySelectorAll(NEW_CARD)].find(card => cardId(card) === attendance?.id || extractProtocol(card) === attendance?.protocol);
    }

    if (!target && isNewInterface() && newMetadata.size) {
      const queue = [...newMetadata.values()];
      const index = queue.findIndex(item => item.id === attendance?.id || item.protocol === attendance?.protocol);
      const list = document.querySelector(NEW_LIST);
      const scroller = [...list.querySelectorAll('div')].find(element => element.scrollHeight > element.clientHeight && /auto|scroll/.test(getComputedStyle(element).overflowY));
      if (index >= 0 && scroller) {
        // The native rows have variable heights. Refine the offset using the
        // actual mounted IDs instead of assuming every row has equal height.
        const indices = new Map(queue.map((item, i) => [item.id, i]));
        let low = 0;
        let high = scroller.scrollHeight - scroller.clientHeight;
        let offset = high * index / Math.max(1, queue.length - 1);
        for (let attempt = 0; attempt < 10 && !target; attempt++) {
          scroller.scrollTop = offset;
          scroller.dispatchEvent(new Event('scroll'));
          await new Promise(resolve => setTimeout(resolve, 120));
          const mounted = [...list.querySelectorAll('[itemid]')];
          target = mounted.find(card => cardId(card) === attendance?.id || extractProtocol(card) === attendance?.protocol);
          const positions = mounted.map(card => indices.get(cardId(card))).filter(Number.isInteger);
          if (!positions.length) continue;
          if (Math.max(...positions) < index) low = offset;
          else if (Math.min(...positions) > index) high = offset;
          offset = (low + high) / 2;
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
    clickable.click();
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
