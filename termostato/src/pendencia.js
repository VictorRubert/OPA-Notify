/* =========================================================
   PENDÊNCIA EXTERNA AUTOMÁTICA (OBRIGATÓRIA)
   A extensão SÓ MARCA, nunca desmarca. Resposta do cliente não importa.

   Opa novo (nov/2026): não existe mais checkbox. "Pendência externa" é um item
   do menu de ações do card (botão direito no card / setinha ⌄) que ALTERNA
   marca/desmarca. O estado vem das mensagens de sistema da conversa:
     "Fulano marcou pendência externa"    → marcada
     "Fulano desmarcou pendência externa" → desmarcada (por alguém, na mão)

   Referência de tempo padrão: "Nesta fila" do painel Detalhes
   - Já está na fila há 5 min ou mais (e até 8 h) → marca assim que o atendimento é aberto
   - Está há menos de 5 min                       → marca quando completar 5 min
     (com o atendimento aberto; se estiver fechado, marca quando for aberto)

   Marca quando TODAS as condições são verdadeiras:
   1. Tempo na fila >= TIMEOUT_MINUTES (5 min)
   2. Tempo na fila <= IDADE_MAX_HORAS (8 h)
   3. Não tem SÓ a etiqueta verde "ASSUMIDO AGENTE SMITH"
      (com a amarela "AJUDANDO AGENTE SMITH" junto, marca normalmente)
   4. A última mensagem de pendência da conversa NÃO é "desmarcou"
      (alguém desmarcou na mão → nunca remarca; se marcarem de novo na mão, volta a valer)
   5. A última mensagem de pendência NÃO é "marcou" (já está marcada)

   Como o item do menu alterna, depois de clicar a extensão espera a mensagem
   "marcou" aparecer e NÃO clica de novo nesse atendimento por ESPERA_CONFIRMACAO_MS
   (um segundo clique desmarcaria).
   ========================================================= */

IXCOpa.pendencia = (function () {
  const { dom, log, storage } = IXCOpa;
  const ESPERA_CONFIRMACAO_MS = 3 * 60 * 1000;
  let ultimoMotivo = '';
  let timerAgendado = null;
  let executando = false;
  const tentativas = {}; // id → timestamp do nosso último clique
  const ESPERA_FALHA_MS = 5 * 60 * 1000; // depois de não conseguir abrir o menu, espera antes de tentar de novo
  const falhouEm = {};   // id → timestamp da última falha ao abrir o menu

  // O texto "Nesta fila: 5 minutos" pode não ser atualizado pelo Opa enquanto
  // o painel fica aberto. Guardamos a hora estimada de entrada na fila e
  // seguimos contando pelo nosso relógio; recalcula quando o texto muda.
  const entradaFila = {}; // id → { texto, entrada (ms) }

  function minutosNaFila(id) {
    const fila = dom.getTempoNaFila();
    if (!fila) return null;
    const salvo = entradaFila[id];
    if (!salvo || salvo.texto !== fila.texto) {
      entradaFila[id] = { texto: fila.texto, entrada: Date.now() - fila.min * 60000 };
    }
    return (Date.now() - entradaFila[id].entrada) / 60000;
  }

  function minutosDeReferencia(id) {
    const ref = IXCOpa.CONFIG.TIMER_REFERENCIA;
    if (ref === 'fila') {
      const m = minutosNaFila(id);
      if (m !== null) return { min: m, ref: 'na fila' };
      // sem o texto da fila (painel fechado) → cai para a abertura
    }
    if (ref === 'primeiro_atendente') {
      const d = dom.getPrimeiraMsgAtendenteHumano();
      return d ? { min: (Date.now() - d.getTime()) / 60000, ref: 'desde o 1º atendente' } : null;
    }
    const abertura = dom.getDataAbertura();
    return abertura ? { min: (Date.now() - abertura.getTime()) / 60000, ref: 'desde a abertura' } : null;
  }

  function fmt(min) {
    return min < 60 ? `${min.toFixed(1)} min` : `${(min / 60).toFixed(1)} h`;
  }

  function contem(etiquetas, lista) {
    return etiquetas.some((e) => lista.some((x) => e.includes(x)));
  }

  /** Avalia as regras sem mexer em nada. Retorna { marcar, motivo }. */
  function avaliar() {
    const cfg = IXCOpa.CONFIG;
    const id = dom.getAtendimentoId();
    if (!id) return { marcar: false, motivo: 'sem atendimento aberto' };
    // Mensagens ainda não carregaram: não dá para saber o estado
    if (!dom.getClientMessages().length && !dom.getAgentMessages().length) {
      return { marcar: false, motivo: 'mensagens ainda carregando' };
    }

    const estado = dom.getEstadoPendencia();
    if (estado && estado.estado === 'marcada') {
      delete tentativas[id];
      storage.setMarcadoConhecido(id, true);
      return { marcar: false, motivo: `já está marcada (${estado.quem || 'alguém'})` };
    }
    if (estado && estado.estado === 'desmarcada') {
      storage.setMarcadoConhecido(id, false);
      return { marcar: false, motivo: `desmarcada manualmente por ${estado.quem || 'alguém'} → não remarca` };
    }
    // Já vimos no menu que está marcada (a mensagem "marcou…" pode não estar carregada na tela)
    if (storage.isMarcadoConhecido(id)) return { marcar: false, motivo: 'já está marcada (visto no menu)' };
    if (storage.isBloqueado(id)) return { marcar: false, motivo: 'desmarcada manualmente pelo atendente antes' };
    if (tentativas[id] && Date.now() - tentativas[id] < ESPERA_CONFIRMACAO_MS) {
      return { marcar: false, motivo: 'cliquei há pouco, aguardando a mensagem "marcou pendência externa"' };
    }

    if (falhouEm[id] && Date.now() - falhouEm[id] < ESPERA_FALHA_MS) {
      return { marcar: false, motivo: 'não consegui abrir o menu há pouco, aguardando para tentar de novo' };
    }

    const etiquetas = dom.getEtiquetas(id);
    if (contem(etiquetas, cfg.ETIQUETA_SMITH_ASSUMIDO) && !contem(etiquetas, cfg.ETIQUETA_SMITH_AJUDANDO)) {
      return { marcar: false, motivo: 'só com etiqueta ASSUMIDO AGENTE SMITH' };
    }

    const r = minutosDeReferencia(id);
    if (!r) return { marcar: false, motivo: 'não encontrei o tempo do atendimento no painel' };
    if (r.min > cfg.IDADE_MAX_HORAS * 60) {
      return { marcar: false, motivo: `${fmt(r.min)} ${r.ref} (limite ${cfg.IDADE_MAX_HORAS} h)` };
    }
    if (r.min < cfg.TIMEOUT_MINUTES) {
      return { marcar: false, motivo: `⏳ ${fmt(r.min)} ${r.ref}, marca aos ${cfg.TIMEOUT_MINUTES} min`, aguardando: true, faltaMs: (cfg.TIMEOUT_MINUTES - r.min) * 60000 };
    }
    return { marcar: true, motivo: `${fmt(r.min)} ${r.ref} → marcando pendência externa` };
  }

  // Aviso no console sem repetir a mesma frase a cada checagem
  let ultimoAviso = '';
  function avisar(msg) {
    ultimoDetalhe = msg;
    if (msg === ultimoAviso) return;
    ultimoAviso = msg;
    console.info(`[Termostato] ${msg}`);
  }
  let ultimoDetalhe = '';

  let focoAntes = null;
  function restaurarFoco() {
    const el = focoAntes;
    focoAntes = null;
    if (el && el.isConnected && el !== document.body && document.activeElement !== el) {
      try { el.focus({ preventScroll: true }); } catch (e) { /* ignora */ }
    }
  }

  // Volta a mostrar menus (assim que o nosso menu fechar) e devolve o foco
  let fimTimer = null;
  function finalizarMenu() {
    clearTimeout(fimTimer);
    fimTimer = setTimeout(() => {
      if (dom.menuAberto()) dom.fecharMenu();
      setTimeout(() => {
        document.documentElement.classList.remove('ixc-menu-oculto');
        restaurarFoco();
      }, 250);
    }, 150);
  }

  async function marcar(id) {
    executando = true;
    try {
      // Não atrapalha se o atendente estiver com outro menu/modal aberto
      const aberto = dom.getMenuOuModalAberto();
      if (aberto) {
        avisar(`⏸ adiando: há um menu/janela aberto na tela (${aberto})`);
        return;
      }
      // Menu invisível + devolve o foco (ex.: campo de mensagem) para onde estava
      focoAntes = document.activeElement;
      document.documentElement.classList.add('ixc-menu-oculto');
      const r = await dom.abrirItemPendencia(id);
      if (!r.item) {
        falhouEm[id] = Date.now();
        avisar(`⚠️ Não consegui ver o menu de pendência: ${r.motivo}. Tento de novo em ${ESPERA_FALHA_MS / 60000} min`);
        return;
      }
      // O menu mostra o estado real: "Desmarcar pendência externa" / ✓ → JÁ está marcada.
      // Nunca clica nesse caso (o item alterna e desmarcaria).
      if (r.marcada) {
        dom.fecharMenu();
        storage.setMarcadoConhecido(id, true);
        avisar(`já está marcada (vi no ${r.via}) → não mexo mais neste atendimento`);
        return;
      }
      // Confere de novo logo antes do clique
      if (dom.getAtendimentoId() !== id || dom.getEstadoPendencia()) {
        dom.fecharMenu();
        return;
      }
      tentativas[id] = Date.now();
      ultimoDetalhe = 'cliquei em "Pendência externa"';
      r.item.click();
      log('Pendência', `Clique em "Pendência externa" via ${r.via}`);
      finalizarMenu();

      // Se o Opa pedir confirmação, confirma
      const ok = await dom.esperar(dom.findConfirmOkButton, 1500);
      if (ok) {
        log('Pendência', 'Confirmação → OK');
        ok.click();
      }
      const marcou = await dom.esperar(() => dom.isPendenciaMarcada(), 8000);
      if (marcou) storage.setMarcadoConhecido(id, true);
      console.info(marcou
        ? '[Termostato] ✅ Pendência externa marcada'
        : '[Termostato] ⚠️ Cliquei em "Pendência externa" mas a mensagem "marcou pendência externa" não apareceu ainda');
      ultimoDetalhe = marcou ? `marcada via ${r.via}` : ultimoDetalhe;
    } catch (e) {
      console.error('[Termostato][Pendência]', e);
    } finally {
      executando = false;
      finalizarMenu(); // garante (idempotente)
    }
  }

  // Diagnóstico legível pelo console da página (contexto "top"), sem trocar de contexto:
  //   JSON.parse(document.documentElement.dataset.termostato)
  function publicarDiagnostico(res) {
    try {
      const id = dom.getAtendimentoId();
      const diag = {
        versao: IXCOpa.VERSAO,
        hora: new Date().toLocaleTimeString('pt-BR'),
        motivo: res.motivo,
        detalhe: ultimoDetalhe,
        marcar: res.marcar,
        id,
        nestaFila: dom.getTempoNaFila(),
        abertura: String(dom.getDataAbertura()),
        estado: dom.getEstadoPendencia(),
        etiquetas: dom.getEtiquetas(id),
        cardNaLista: !!dom.getCard(id),
        mensagens: dom.getClientMessages().length + dom.getAgentMessages().length,
      };
      const json = JSON.stringify(diag);
      if (document.documentElement.dataset.termostato !== json) document.documentElement.dataset.termostato = json;
    } catch (e) { /* diagnóstico nunca pode quebrar a extensão */ }
  }

  function check(origem = 'auto') {
    if (!IXCOpa.CONFIG.PENDENCIA_ATIVA || executando) return;

    const res = avaliar();
    // Log sempre visível quando o motivo muda (para diagnosticar sem ligar o DEBUG)
    const chave = res.aguardando ? 'aguardando' : res.marcar ? 'marcando' : res.motivo;
    if (chave !== ultimoMotivo && !/sem atendimento aberto|carregando/.test(res.motivo)) {
      ultimoMotivo = chave;
      console.info(`[Termostato] Pendência: ${res.marcar ? '🔴' : '—'} ${res.motivo}`);
    }
    log('Pendência', `(${origem}) ${res.motivo}`);
    publicarDiagnostico(res);

    // Atendimento novo: agenda a checagem para o segundo em que completar 5 min
    clearTimeout(timerAgendado);
    if (res.aguardando) {
      timerAgendado = setTimeout(() => check('cronometro'), Math.max(500, res.faltaMs + 500));
    }
    if (res.marcar) marcar(dom.getAtendimentoId());
  }

  function reset() {
    clearTimeout(timerAgendado);
    ultimoMotivo = '';
  }

  return { check, avaliar, reset };
})();
