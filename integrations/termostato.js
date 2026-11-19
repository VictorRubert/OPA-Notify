// Notify-owned integration. Keep termostato/ byte-for-byte identical to its ZIP.
// Loaded after the original modules and BEFORE their main.js bootstrap.
(() => {
  const t = window.IXCOpa;
  if (!t || t.notifyIntegration) return;
  t.notifyIntegration = true;
  t.VERSAO = '2.22.0';
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
      const loaded = id && t.dom.getClientMessages().length + t.dom.getAgentMessages().length > 0;
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
    const stored = await chrome.storage.local.get(Object.keys(defaults));
    settings = { ...defaults, ...stored, ...earlyChanges };
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
