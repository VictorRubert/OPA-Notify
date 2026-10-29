// Runs in the page world. Observe the existing connection; never create a
// connection, authenticate, send requests, or forward message history/tokens.
(() => {
  if (globalThis.__OPA_NOTIFY_QUEUE_BRIDGE__) return;
  globalThis.__OPA_NOTIFY_QUEUE_BRIDGE__ = true;
  const EVENT = 'customer-services-ui:customer-service-queues:in-progress:list';
  const NativeSocket = globalThis.WebSocket;
  let buffered = [];
  const publish = (kind, data) => {
    if (kind === 'reset' || (kind === 'page' && data.page === 1)) buffered = [];
    const message = { source: 'opa-notify-queue-v1', kind, ...data };
    if (buffered.length < 1000) buffered.push(message);
    window.postMessage(message, location.origin);
  };
  window.addEventListener('message', event => {
    if (event.source === window && event.origin === location.origin && event.data?.source === 'opa-notify-content-ready-v1') {
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
  function observe(socket) {
    let observesQueue = false;
    let collectingPages = false;
    const send = socket.send;
    socket.send = function(value) {
      const result = Reflect.apply(send, this, arguments);
      const payload = packet(value);
      if (payload && !(Number(payload.page) > 1) && (!collectingPages || Number(payload.page) === 1)) { observesQueue = true; publish('reset', {}); }
      return result;
    };
    socket.addEventListener('message', event => {
      const parsed = decode(event.data);
      const route = parsed?.[1];
      if (route && typeof route._id === 'string' && Array.isArray(route.motivos)) {
        // A detail update changes only the reason state, never queue membership.
        window.postMessage({ source: 'opa-notify-queue-v1', kind: 'reasons', id: route._id, reasons: route.motivos.length }, location.origin);
      }
      const payload = parsed?.[0] === EVENT ? route : null;
      if (!payload || !Array.isArray(payload.items) || !Number.isInteger(payload.page) || typeof payload.hasMore !== 'boolean') return;
      observesQueue = true;
      collectingPages = payload.hasMore;
      const items = payload.items.map(item => {
        const client = item?.id_cliente;
        return {
          id: String(item?._id || ''), protocol: String(item?.protocolo || ''),
          company: String(client?.nome || client?.razao_social || item?.id_user?.nome || 'Empresa não identificada').slice(0, 250),
          reasons: Array.isArray(item?.motivos) ? item.motivos.length : null
        };
      });
      publish('page', { items, page: payload.page, hasMore: payload.hasMore, view: document.querySelector('[data-tutorial="customer-service-view-selector"]')?.textContent?.trim() || '' });
    });
    socket.addEventListener('close', () => { if (observesQueue) publish('reset', {}); });
    return socket;
  }
  globalThis.WebSocket = new Proxy(NativeSocket, {
    construct(target, args, newTarget) {
      return observe(Reflect.construct(target, args, newTarget));
    }
  });
})();
