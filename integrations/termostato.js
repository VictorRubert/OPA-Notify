// Notify-owned integration. Keep termostato/ byte-for-byte identical to its ZIP.
// Loaded after the original modules and BEFORE their main.js bootstrap.
(() => {
  const t = window.IXCOpa;
  if (!t || t.notifyIntegration) return;
  t.notifyIntegration = true;
  t.VERSAO = '2.22.0';
  const overrideKey = 'termofyMoodOverrides';
  const levels = {
    0: { categoria: 'desconhecido', media: 0 },
    1: { categoria: 'furioso', media: -2 },
    2: { categoria: 'bravo', media: -1 },
    3: { categoria: 'neutro', media: 0 },
    4: { categoria: 'satisfeito', media: 1 },
    5: { categoria: 'encantado', media: 2 }
  };
  Object.assign(t.humor.CATEGORIAS, {
    furioso: { emoji: '😡', label: 'Extremamente furioso', cor: '#b91c1c' },
    bravo: { emoji: '😠', label: 'Bravo', cor: '#f97316' }
  });
  let overrides = {};
  const forced = id => {
    const level = overrides[id];
    if (level === undefined) return null;
    const value = levels[level];
    return { ...value, ...t.humor.CATEGORIAS[value.categoria], detalhes: [] };
  };
  const analyze = t.humor.analisarAtendimento;
  t.humor.analisarAtendimento = () => forced(t.dom.getAtendimentoId()) || analyze();
  const savedMood = t.storage.getHumor;
  t.storage.getHumor = id => {
    const value = forced(id);
    return value ? { ...value, ts: Date.now(), n: 0 } : savedMood(id);
  };
  const saveMood = t.storage.setHumor;
  t.storage.setHumor = (id, result) => {
    if (!forced(id)) saveMood(id, result);
  };
  const setLive = t.lista.setAoVivo;
  t.lista.setAoVivo = (id, result) => setLive(id, forced(id) || result);
  const renderMood = t.lista.renderTodos;
  t.lista.renderTodos = () => {
    renderMood();
    for (const card of t.dom.getListCards()) globalThis.OpaNotifyPlaceInactivity?.(card);
  };
  const defaults = {
    enabled: true,
    termostatoEnabled: true,
    termostatoHumorEnabled: true,
    termostatoPendingEnabled: true
  };
  let settings = { ...defaults };
  let ready = false;
  const earlyChanges = {};
  const active = () => ready && t.contextoValido() && settings.enabled && settings.termostatoEnabled;
  const modern = () => !!document.querySelector('[data-customer-service-id], [data-tutorial="customer-service-list"]');
  const canMark = () => active() && settings.termostatoPendingEnabled && modern();

  function apply() {
    t.CONFIG.PENDENCIA_ATIVA = !!(active() && settings.termostatoPendingEnabled);
    t.CONFIG.HUMOR_ATIVO = !!(active() && settings.termostatoHumorEnabled);
    t.pendencia.reset(); // cancel any scheduled mark when preferences change
    if (!t.CONFIG.HUMOR_ATIVO) {
      t.lista.setAoVivo(null, null);
      document.querySelectorAll('.ixc-selo, .ixc-selo__tooltip, #ixc-humor-termometro, .ixc-humor-slot').forEach(el => el.remove());
    }
    if (!t.CONFIG.PENDENCIA_ATIVA) delete document.documentElement.dataset.termostato;
  }

  function refresh() {
    if (!ready || !modern()) return;
    if (t.CONFIG.HUMOR_ATIVO) {
      const id = t.dom.getAtendimentoId();
      const loaded = id && (forced(id) || t.dom.getClientMessages().length + t.dom.getAgentMessages().length > 0);
      t.lista.setAoVivo(loaded ? id : null, loaded ? t.humor.analisarAtendimento() : null);
      if (t.CONFIG.HUMOR_NA_LISTA) t.lista.renderTodos();
    }
    if (canMark()) t.pendencia.check('notify-settings');
  }

  // Prevent action before saved settings load. main.js already waits on carregar().
  t.CONFIG.PENDENCIA_ATIVA = false;
  t.CONFIG.HUMOR_ATIVO = false;
  const load = t.storage.carregar;
  t.storage.carregar = async () => {
    const stored = await chrome.storage.local.get([...Object.keys(defaults), overrideKey]);
    settings = { ...defaults, ...stored, ...earlyChanges };
    overrides = stored[overrideKey] && typeof stored[overrideKey] === 'object' ? { ...stored[overrideKey] } : {};
    await load();
    ready = true;
    apply();
  };

  // A setting may change while the original code is waiting for an Opa menu.
  // Recheck at the actual click, without changing the original module on disk.
  const open = t.dom.abrirItemPendencia;
  t.dom.abrirItemPendencia = async id => {
    if (!canMark()) return { motivo: 'Termostato desativado na Notify' };
    const result = await open(id);
    if (!canMark()) {
      t.dom.fecharMenu();
      return { motivo: 'Termostato desativado na Notify' };
    }
    if (!result.item) return result;
    return { ...result, item: { click() {
      if (canMark() && t.dom.getAtendimentoId() === id) result.item.click();
      else t.dom.fecharMenu();
    } } };
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'TERMOFY_STATUS_COMMAND') return;
    (async () => {
      if (!ready || !active() || !t.CONFIG.HUMOR_ATIVO) throw Error('Ative o humor do Termostato.');
      const id = t.dom.getAtendimentoId();
      if (!id) throw Error('Abra a conversa do cliente no Opa.');
      if (message.value === 'read') delete overrides[id];
      else if (Object.hasOwn(levels, message.value)) overrides[id] = message.value;
      else throw Error('Comando inválido.');
      await chrome.storage.local.set({ [overrideKey]: overrides });
      t.lista.setAoVivo(null, null);
      refresh();
      return { success: true };
    })().then(sendResponse).catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    let changed = false;
    for (const key of Object.keys(defaults)) {
      if (!(key in changes)) continue;
      const value = changes[key].newValue ?? defaults[key];
      settings[key] = value;
      earlyChanges[key] = value;
      changed = true;
    }
    if (changed && ready) {
      apply();
      refresh();
    }
  });
})();
