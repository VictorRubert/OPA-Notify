/* =========================================================
   PERSISTÊNCIA (chrome.storage.local)
   - humor:      último humor medido por atendimento (para a lista)
   - bloqueados: atendimentos em que o atendente DESMARCOU a pendência
                 manualmente → a extensão não marca mais automaticamente

   Não guardamos o texto das mensagens, só categoria/nota/horário.
   Mantém um cache em memória para leitura síncrona.
   ========================================================= */

IXCOpa.storage = (function () {
  const KEY = 'ixcOpa';
  let dados = { humor: {}, bloqueados: {}, marcados: {} };
  let carregado = false;
  let salvarTimer = null;

  const temChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  function carregar() {
    return new Promise((resolve) => {
      if (!temChrome) { carregado = true; return resolve(); }
      chrome.storage.local.get(KEY, (res) => {
        if (res && res[KEY]) dados = { humor: {}, bloqueados: {}, marcados: {}, ...res[KEY] };
        limparAntigos();
        carregado = true;
        resolve();
      });
    });
  }

  function salvar() {
    if (!temChrome) return;
    clearTimeout(salvarTimer);
    salvarTimer = setTimeout(() => {
      if (!IXCOpa.contextoValido()) return; // extensão recarregada sem F5 na aba
      try {
        chrome.storage.local.set({ [KEY]: dados });
      } catch (e) { /* idem */ }
    }, 300);
  }

  function limparAntigos() {
    const limite = Date.now() - IXCOpa.CONFIG.HUMOR_CACHE_DIAS * 86400000;
    for (const grupo of ['humor', 'bloqueados', 'marcados']) {
      if (!dados[grupo]) dados[grupo] = {};
      for (const [id, v] of Object.entries(dados[grupo])) {
        if ((v.ts || 0) < limite) delete dados[grupo][id];
      }
    }
  }

  // ---- humor ----
  function getHumor(id) {
    return dados.humor[id] || null;
  }
  function setHumor(id, resultado) {
    const atual = dados.humor[id];
    const novo = { categoria: resultado.categoria, media: +resultado.media.toFixed(2), n: resultado.detalhes.length, ts: Date.now() };
    if (atual && atual.categoria === novo.categoria && atual.media === novo.media && atual.n === novo.n) return;
    dados.humor[id] = novo;
    salvar();
  }

  // ---- bloqueio de pendência ----
  function isBloqueado(id) {
    return !!dados.bloqueados[id];
  }
  function bloquear(id) {
    dados.bloqueados[id] = { ts: Date.now() };
    salvar();
  }

  function desbloquear(id) {
    if (!dados.bloqueados[id]) return;
    delete dados.bloqueados[id];
    salvar();
  }

  // ---- pendência que a extensão VIU marcada no menu ("Desmarcar pendência externa" / ✓) ----
  // Evita reabrir menus em atendimentos já marcados cuja mensagem "marcou…" não está carregada.
  function isMarcadoConhecido(id) {
    return !!dados.marcados[id];
  }
  function setMarcadoConhecido(id, sim) {
    if (sim) dados.marcados[id] = { ts: Date.now() };
    else if (dados.marcados[id]) delete dados.marcados[id];
    else return;
    salvar();
  }

  return { carregar, getHumor, setHumor, isBloqueado, bloquear, desbloquear, isMarcadoConhecido, setMarcadoConhecido, get carregado() { return carregado; } };
})();
