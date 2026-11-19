// Runs in the page world. Observe the existing connection and periodically
// repeat only queue-read requests previously sent by Opa. Never create a new
// connection, extract authentication, or forward history/tokens/query payloads.
(() => {
  if (globalThis.__OPA_NOTIFY_QUEUE_BRIDGE__) return;
  globalThis.__OPA_NOTIFY_QUEUE_BRIDGE__ = true;
  const EVENT = 'customer-services-ui:customer-service-queues:in-progress:list';
  const LOAD_EVENT = 'customer-services-ui:customer-service-queues:in-progress:load-customer-services';
  const REFRESH_INTERVAL_MS = 15000;
  const refreshers = new Map();
  function personalView() {
    const filter = document.querySelector('[data-tutorial="customer-service-view-selector"]');
    const tab = document.querySelector('[data-tutorial="customer-service-queue-in-progress"]');
    const personal = filter?.textContent?.trim().toLowerCase() === 'meus atendimentos';
    return personal && Boolean(tab && (tab.getAttribute('data-active') === 'true' || (tab.classList.contains('bg-gray-200') && tab.classList.contains('border-gray-400'))));
  }
  const NativeSocket = globalThis.WebSocket;
  let buffered = [];
  const diagnostics = [];
  const diagnose = (parsed, direction, automatic = false) => {
    const name = parsed?.[0];
    if (typeof name !== 'string' || !name.startsWith('customer-services-ui:customer-service-queues:in-progress:')) return;
    const payload = parsed[1];
    const message = { source: 'opa-notify-queue-v1', kind: 'diagnostic', automatic, event: name.replace(/[a-f0-9]{24}/gi, '<id>').replace(/OPA\d{6,}/g, '<protocol>'), direction, count: Array.isArray(payload) ? payload.length : Array.isArray(payload?.items) ? payload.items.length : null, page: Number.isInteger(payload?.page) ? payload.page : null, hasMore: typeof payload?.hasMore === 'boolean' ? payload.hasMore : null };
    diagnostics.push(message);
    if (diagnostics.length > 40) diagnostics.shift();
    window.postMessage(message, location.origin);
  };
  const publish = (kind, data) => {
    if (kind === 'reset' || (kind === 'page' && data.page === 1)) buffered = [];
    const message = { source: 'opa-notify-queue-v1', kind, ...data };
    if (buffered.length < 1000) buffered.push(message);
    window.postMessage(message, location.origin);
  };
  window.addEventListener('message', event => {
    if (event.source === window && event.origin === location.origin && event.data?.source === 'opa-notify-refresh-queue-v1') {
      for (const refresh of refreshers.values()) refresh(event.data.confirm === true);
      return;
    }
    if (event.source === window && event.origin === location.origin && event.data?.source === 'opa-notify-content-ready-v1') {
      for (const message of diagnostics) window.postMessage(message, location.origin);
      for (const message of buffered) window.postMessage(message, location.origin);
    }
  });
  function decode(value) {
    if (typeof value !== 'string' || !value.startsWith('42')) return null;
    // Socket.IO may include an acknowledgement number before the JSON array.
    const start = value.indexOf('[');
    if (start < 0) return null;
    try {
      const parsed = JSON.parse(value.slice(start));
      return Array.isArray(parsed) ? parsed : null;
    } catch { return null; }
  }
  function packet(value) {
    const parsed = decode(value);
    return parsed?.[0] === EVENT ? parsed[1] : null;
  }
  function mediaPreview(message) {
    const media = message?.objeto && typeof message.objeto === 'object' ? message.objeto : {};
    const types = [message?.tipo, media.tipo, media.type, media.mediaType, media.mimeType, media.mimetype, media.mime, media.contentType];
    for (const value of types) {
      if (typeof value !== 'string') continue;
      const type = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      if (/^(?:image|imagem|foto)(?:\/|$)/.test(type)) return 'Enviou uma foto';
      if (/^audio(?:\/|$)/.test(type)) return 'Enviou um áudio';
      if (/^video(?:\/|$)/.test(type)) return 'Enviou um vídeo';
    }
    // Some Opa file messages identify the media only by its file name.
    if (typeof message?.tipo !== 'string' || !['arquivo', 'anexo', 'documento', 'midia', 'mídia', 'file', 'media'].includes(message.tipo.toLowerCase())) return '';
    const file = [media.nome, media.name, media.filename, media.fileName, message.mensagem].find(value => typeof value === 'string' && value.trim());
    const extension = file?.split(/[?#]/, 1)[0].match(/\.([a-z0-9]+)\s*$/i)?.[1]?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'avif'].includes(extension)) return 'Enviou uma foto';
    if (['mp3', 'ogg', 'opus', 'wav', 'm4a', 'aac'].includes(extension)) return 'Enviou um áudio';
    if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(extension)) return 'Enviou um vídeo';
    return '';
  }
  // Forward only the latest customer message needed for the on-screen alert.
  function messageCursor(message) {
    if (typeof message?._id !== 'string' || !message._id) return null;
    const incoming = message.tipoDestinatario === 'usuarios' && !message.id_atend &&
      !message.systemMessage && !message.systemNoteMessage;
    return {
      id: message._id.slice(0, 120),
      text: incoming ? mediaPreview(message) || (typeof message.mensagem === 'string' ? message.mensagem.trim().slice(0, 500) : '') : '',
      incoming
    };
  }
  function messageActivity(message, waitingForCustomer = false, fallbackDate = null) {
    if (!message || message.systemMessage || message.systemNoteMessage) return null;
    const at = [message.data, message.createdAt, fallbackDate]
      .map(date => typeof date === 'string' ? Date.parse(date) : NaN)
      .find(date => Number.isFinite(date) && date > 0 && date <= Date.now() + 60000);
    if (at === undefined) return null;
    const outgoing = message.tipoDestinatario === 'clientes_users';
    const incoming = message.tipoDestinatario === 'usuarios' && !message.id_atend;
    if (!outgoing && !incoming) return null;
    return { at, waitingForCustomer: waitingForCustomer === true || outgoing };
  }

  function observe(socket) {
    let observesQueue = false;
    let collectingPages = false;
    const send = socket.send;
    const requests = new Map();
    let lastRequestAt = 0;
    let queryConfirmed = false;
    let completePageCount = 0;
    const reportRefresh = state => window.postMessage({ source: 'opa-notify-queue-v1', kind: 'refresh-status', state, queryCaptured: requests.has(LOAD_EVENT + ':1') && requests.has(EVENT + ':1'), lastRequestAt, intervalMs: REFRESH_INTERVAL_MS }, location.origin);
    const refresh = (confirm = false) => {
      if (!observesQueue) return;
      if (!personalView()) return reportRefresh('inactive-view');
      if (!queryConfirmed || collectingPages) return reportRefresh('waiting-for-complete-query');
      if (socket.readyState !== NativeSocket.OPEN) return reportRefresh('socket-not-open');
      if (Date.now() - lastRequestAt < (confirm ? 2000 : REFRESH_INTERVAL_MS)) return reportRefresh('rate-limited');
      const search = document.querySelector('[data-tutorial="customer-service-list"] input:not([type="checkbox"]):not([type="radio"])');
      if (search?.value?.trim()) return reportRefresh('search-active');
      // Replay the exact captured preferences and pages, never invent an API
      // request or use DOM disappearance as evidence of a queue departure.
      const frames = [];
      const load = requests.get(LOAD_EVENT + ':1');
      if (!load) return reportRefresh('missing-query');
      frames.push(load);
      for (let page = 1; page <= completePageCount; page++) {
        const frame = requests.get(EVENT + ':' + page);
        if (!frame) return reportRefresh('missing-page-query');
        frames.push(frame);
      }
      lastRequestAt = Date.now();
      collectingPages = false;
      publish('reset', {});
      try {
        for (const frame of frames) {
          Reflect.apply(send, socket, [frame]);
          diagnose(decode(frame), 'sent', true);
        }
        reportRefresh('sent');
      } catch {
        queryConfirmed = false;
        reportRefresh('send-failed');
        publish('reset', {});
      }
    };
    refreshers.set(socket, refresh);
    socket.send = function(value) {
      const result = Reflect.apply(send, this, arguments);
      const parsed = decode(value);
      diagnose(parsed, 'sent');
      if (parsed && (parsed[0] === EVENT || parsed[0] === LOAD_EVENT)) {
        lastRequestAt = Date.now();
        const payload = parsed[1];
        // Acknowledgement IDs/namespaces are intentionally not replayed: they
        // belong to the app's callback machinery. The observed queue uses 42[.
        if (typeof value === 'string' && value.startsWith('42[') && (payload == null || (typeof payload === 'object' && !Array.isArray(payload)))) {
          const page = payload?.page ?? 1;
          if (Number.isInteger(page) && page >= 1 && page <= 1000) {
            if (parsed[0] === LOAD_EVENT && page === 1) { requests.clear(); queryConfirmed = false; completePageCount = 0; }
            if (personalView()) requests.set(parsed[0] + ':' + page, value);
            else { requests.clear(); queryConfirmed = false; }
          }
        }
      }
      const payload = packet(value);
      if (payload && !(Number(payload.page) > 1) && (!collectingPages || Number(payload.page) === 1)) { observesQueue = true; publish('reset', {}); }
      return result;
    };
    socket.addEventListener('message', event => {
      const parsed = decode(event.data);
      diagnose(parsed, 'received');
      const route = parsed?.[1];
      const message = route?.lastMessage || route;
      const cursor = messageCursor(message);
      const routeId = route?.lastMessage ? route._id : route?.id_rota;
      if (cursor && typeof routeId === 'string' && personalView()) {
        window.postMessage({ source: 'opa-notify-queue-v1', kind: 'message', id: routeId, cursor, activity: messageActivity(message, route?.aguardandoCliente, route?.update), unread: message.statusEnvio?.status ? message.statusEnvio.status !== 'read' : null }, location.origin);
      }
      const payload = parsed?.[0] === EVENT ? route : null;
      if (!payload || !Array.isArray(payload.items) || !Number.isInteger(payload.page) || typeof payload.hasMore !== 'boolean') return;
      observesQueue = true;
      collectingPages = payload.hasMore;
      if (!payload.hasMore && personalView()) {
        completePageCount = payload.page;
        queryConfirmed = requests.has(LOAD_EVENT + ':1') && requests.has(EVENT + ':1');
      }
      const items = payload.items.map(item => {
        const client = item?.id_cliente;
        return {
          id: String(item?._id || ''), protocol: String(item?.protocolo || ''),
          company: String(client?.nome || client?.razao_social || item?.id_user?.nome || 'Empresa não identificada').slice(0, 250),
          tags: Array.isArray(item?.tags) ? item.tags.map(tag => tag?.nome).filter(name => typeof name === 'string').map(name => name.slice(0, 120)) : [],
          pinned: Boolean(item?.atend_fixado_topo || item?.data_fixacao),
          unread: Boolean(item?.lastMessage?.tipoDestinatario === 'usuarios' && item.lastMessage.statusEnvio?.status && item.lastMessage.statusEnvio.status !== 'read'),
          cursor: messageCursor(item?.lastMessage),
          activity: messageActivity(item?.lastMessage, item?.aguardandoCliente, item?.update)
        };
      });
      publish('page', { items, page: payload.page, hasMore: payload.hasMore, view: document.querySelector('[data-tutorial="customer-service-view-selector"]')?.textContent?.trim() || '' });
    });
    socket.addEventListener('close', () => { refreshers.delete(socket); requests.clear(); if (observesQueue) publish('reset', {}); });
    return socket;
  }
  globalThis.WebSocket = new Proxy(NativeSocket, {
    construct(target, args, newTarget) {
      return observe(Reflect.construct(target, args, newTarget));
    }
  });
})();
