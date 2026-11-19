/* =========================================================
   CAMADA DE ACESSO AO DOM DO OPA
   Tudo que depende da estrutura HTML do Opa fica aqui.
   Se o Opa mudar o layout, normalmente só este arquivo muda.

   Estrutura mapeada (Opa novo, React/Tailwind – nov/2026).
   As classes são utilitárias (Tailwind) e mudam à toa: usamos só
   atributos data-* / polaris-label / data-tutorial.

   div[data-customer-service-id]       (conversa aberta; id, protocolo, data-tag-names)
   ├── [data-tutorial="chat-header"]   (barra do topo: nome + botões)
   ├── [data-message-list]
   │   └── div[data-message-id][data-message-date][data-sender-type]
   │         sender-type: contact (cliente) | user (atendente/IA) | bot | assistant | system
   │         (o container é flex-col-reverse: a ORDEM DO DOM NÃO É CRONOLÓGICA,
   │          por isso ordenamos por data-message-date)
   │         (mensagem de sistema "Fulano marcou/desmarcou pendência externa" = estado da pendência)
   └── painel lateral "Detalhes"
       └── [data-tutorial="chat-panel-information"]  (Protocolo, Aberto em, Nesta fila…)

   Lista de atendimentos:
   [data-tutorial="customer-service-list"] li[itemid]   (itemid = id do atendimento)
     li[data-tutorial="customer-service-selected-item"] = card aberto
     li[data-tag-names="A|B|C"]                           = etiquetas
   ========================================================= */

IXCOpa.dom = (function () {
  const SEL = {
    chat: '[data-customer-service-id]',
    cabecalho: '[data-tutorial="chat-header"]',
    mensagem: '[data-message-id][data-sender-type]',
    msgCliente: '[data-message-id][data-sender-type="contact"]',
    // atendente, IA (Cadu), bots e assistentes – ação automática também conta
    msgAtendente: '[data-message-id][data-sender-type]:not([data-sender-type="contact"]):not([data-sender-type="system"])',
    painelInfo: '[data-tutorial="chat-panel-information"]',
    // Card de atendimento na lista lateral
    cardLista: '[data-tutorial="customer-service-list"] li[itemid]',
    // Modais do Opa novo (Radix)
    modal: '[role="alertdialog"], [role="dialog"][data-state="open"]',
  };

  const norm = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

  function chat() {
    return document.querySelector(SEL.chat);
  }

  // Id do atendimento aberto (usado para detectar troca de conversa)
  function getAtendimentoId() {
    const c = chat();
    return c ? c.getAttribute('data-customer-service-id') : null;
  }

  // ---- Pendência externa ----
  // No Opa novo não há checkbox: é um item do menu de ações do card da lista
  // (botão direito no card, ou a setinha ⌄). Ele ALTERNA (marca/desmarca).
  // O estado vem das mensagens de sistema da conversa:
  //   "Fulano marcou pendência externa" / "Fulano desmarcou pendência externa"
  const RE_EVENTO_PENDENCIA = /(?:^|\s)(des)?marcou\s+(?:a\s+)?pend[eê]ncia\s+externa/i;

  /** Último evento de pendência na conversa: { estado: 'marcada'|'desmarcada', quem, data } ou null */
  function getEstadoPendencia() {
    let ultimo = null;
    mensagens('[data-message-id][data-sender-type="system"]').forEach((el) => {
      const t = el.textContent.replace(/\s+/g, ' ').trim();
      const m = t.match(RE_EVENTO_PENDENCIA);
      if (!m) return;
      ultimo = {
        estado: m[1] ? 'desmarcada' : 'marcada',
        quem: t.slice(0, m.index).trim(),
        data: getMessageDate(el),
      };
    });
    return ultimo;
  }

  function getCard(id) {
    return id ? document.querySelector(`li[itemid="${CSS.escape(id)}"]`) : null;
  }

  // Item de pendência no menu aberto. No menu de contexto do card ele muda de nome
  // ("Pendência externa" ↔ "Desmarcar pendência externa"); no menu ⋮ da conversa o nome
  // é sempre "Pendência externa" e ganha um ✓ quando está marcada.
  function itemMenuPendencia() {
    return Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]')).find((el) =>
      /pend[eê]ncia externa/i.test(el.textContent) || /external\.pending/i.test(el.getAttribute('polaris-label') || '')
    ) || null;
  }

  /** O item do menu diz que a pendência JÁ está marcada? (true / false) */
  function itemIndicaMarcada(item) {
    const t = (item.textContent || '').replace(/\s+/g, ' ').trim();
    if (/^desmarcar|remover/i.test(t)) return true;
    if (/[✓✔]/.test(t)) return true;
    if (item.getAttribute('aria-checked') === 'true' || item.getAttribute('data-state') === 'checked') return true;
    if (item.querySelector('[class*="check"], [data-state="checked"], [aria-checked="true"]')) return true;
    if (/remove|unmark|desmarcar/i.test(item.getAttribute('polaris-label') || '')) return true;
    // Ícone do item + um 2º ícone (o ✓ do menu ⋮) = marcada. Na dúvida, NÃO clicar.
    if (item.querySelectorAll('i, svg').length > 1) return true;
    return false;
  }

  function esperar(cond, ms) {
    return new Promise((resolve) => {
      const inicio = Date.now();
      (function tick() {
        const r = cond();
        if (r || Date.now() - inicio > ms) return resolve(r || null);
        setTimeout(tick, 50);
      })();
    });
  }

  function fecharMenu() {
    if (!menuAberto()) return;
    const alvo = document.activeElement || document.body;
    alvo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  }

  function menuAberto() {
    return Array.from(document.querySelectorAll('[role="menu"]')).find((m) => m.getBoundingClientRect().height > 0) || null;
  }

  /**
   * Abre UM menu com o item de pendência e devolve:
   *   { item, marcada: true|false, via }  → item encontrado (menu continua aberto)
   *   { motivo }                           → não achou (menu já fechado)
   * Ordem: botão direito no card da lista; se o card não estiver desenhado, menu ⋮ da conversa.
   * (A setinha ⌄ do card não é usada: o clique nela pode "vazar" e abrir o atendimento.)
   */
  async function abrirItemPendencia(id) {
    const card = getCard(id);
    if (card) {
      const alvo = card.querySelector('button') || card;
      const r = alvo.getBoundingClientRect();
      alvo.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true, button: 2, buttons: 2,
        clientX: r.left + Math.min(40, r.width / 2), clientY: r.top + Math.min(20, r.height / 2) }));
      const item = await esperar(itemMenuPendencia, 1500);
      if (item) return { item, marcada: itemIndicaMarcada(item), via: 'botão direito no card' };
      const motivo = menuAberto() ? 'menu do card abriu sem o item de pendência' : 'menu do card não abriu';
      fecharMenu();
      return { motivo };
    }

    const mais = document.querySelector('[polaris-label="btn-customer.service.overflow"]');
    if (!mais) return { motivo: 'card do atendimento não está na lista e não achei o menu ⋮ da conversa' };
    const r = mais.getBoundingClientRect();
    // DropdownMenu do Radix abre no pointerdown; nada de "click" (evita clique vazar para outro lugar)
    mais.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true, button: 0, buttons: 1,
      clientX: r.left + 2, clientY: r.top + 2, pointerType: 'mouse' }));
    const item = await esperar(itemMenuPendencia, 1500);
    if (item) return { item, marcada: itemIndicaMarcada(item), via: 'menu ⋮ da conversa' };
    const motivo = menuAberto() ? 'menu ⋮ abriu sem o item de pendência' : 'menu ⋮ não abriu (card fora da lista)';
    fecharMenu();
    return { motivo };
  }

  function visivel(el) {
    if (!el || !el.isConnected || el.closest('[data-ixc]')) return false;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || +st.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  /** Menu/janela do Opa ABERTO e VISÍVEL agora (descrição curta) ou null.
   *  Elementos escondidos com role="menu"/"dialog" (ex.: menu do Agente Smith, modal do N2
   *  fechado) existem o tempo todo na página e não contam. */
  function getMenuOuModalAberto() {
    const candidatos = document.querySelectorAll(
      '[role="menu"][data-state="open"], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="dialog"][aria-modal="true"], [role="alertdialog"]'
    );
    for (const el of candidatos) {
      if (visivel(el)) return el.getAttribute('role') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '');
    }
    return null;
  }

  // Compatibilidade: código antigo procurava um checkbox
  function getPendenciaCheckbox() {
    return null;
  }

  function isPendenciaMarcada() {
    const e = getEstadoPendencia();
    return !!e && e.estado === 'marcada';
  }

  // ---- Mensagens ----
  function getMessageDate(msg) {
    const iso = msg && msg.getAttribute('data-message-date');
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d) ? null : d;
  }

  function ordenar(els) {
    return els
      .map((el, i) => ({ el, i, t: (getMessageDate(el) || new Date(0)).getTime() }))
      .sort((a, b) => a.t - b.t || a.i - b.i)
      .map((x) => x.el);
  }

  function mensagens(sel) {
    const c = chat();
    return c ? ordenar(Array.from(c.querySelectorAll(sel))) : [];
  }

  function getClientMessages() {
    return mensagens(SEL.msgCliente);
  }

  function getAgentMessages() {
    return mensagens(SEL.msgAtendente);
  }

  function last(arr) {
    return arr.length ? arr[arr.length - 1] : null;
  }

  // Nome que aparece em cima do balão ("Brenda…", "Cadu", "Enviado por API")
  function getRemetente(msg) {
    const s = msg && msg.querySelector('span.font-semibold');
    return s ? s.textContent.trim() : '';
  }

  /**
   * Extrai SÓ o que o cliente escreveu/falou na mensagem:
   * - texto do balão (blocos whitespace-pre-wrap), sem nome do remetente nem horário
   * - remove bloco citado (resposta a outra mensagem), se houver
   * - usa a transcrição se for áudio do próprio cliente
   * - ignora anexos (imagem, áudio, arquivo)
   */
  function getMessageText(msg) {
    if (!msg) return '';
    const clone = msg.cloneNode(true);

    // Áudio (Opa novo): a transcrição fica num <p> dentro do player (.bubble-media-min),
    // entre aspas curvas: “Pronto, no caso, eu só tentar o ativo…”. O outro <p> é a duração (00:04).
    let transcricao = '';
    clone.querySelectorAll('.bubble-media-min').forEach((player) => {
      player.querySelectorAll('p').forEach((p) => {
        const t = p.textContent.trim();
        if (!t || /^\d{1,2}:\d{2}(:\d{2})?$/.test(t) || p.classList.contains('absolute')) return;
        transcricao += ' ' + t.replace(/^[“"']\s*/, '').replace(/\s*[”"']$/, '');
      });
      player.remove();
    });

    // Citação (resposta a outra mensagem), prévia de link e anexos
    clone.querySelectorAll('[data-quoted-message-id], [data-reply-to], [class*="quote"], [class*="reply"], .bubble-media, a.flex, audio, img, video')
      .forEach((el) => el.remove());

    // Áudio (Opa antigo): transcrição "Transcrição: …"
    const blocos = new Set(clone.querySelectorAll('[id^="transcricao-"]'));
    clone.querySelectorAll('p, div, span').forEach((el) => {
      if (/^\s*transcri[cç][aã]o\s*:/i.test(el.textContent) && !el.querySelector('p, div')) blocos.add(el);
    });
    blocos.forEach((bloco) => {
      const t = bloco.cloneNode(true);
      t.querySelectorAll('a, button').forEach((el) => el.remove());
      transcricao += ' ' + t.textContent.replace(/^\s*transcri[cç][aã]o\s*:\s*/i, '').replace(/\.\.\.\s*$/, '');
      bloco.remove(); // não contar duas vezes
    });

    const partes = Array.from(clone.querySelectorAll('.whitespace-pre-wrap')).map((el) => el.textContent);
    const texto = (partes.join(' ') + ' ' + transcricao)
      .replace(/\.\.\.\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    return texto;
  }

  // Ponto de montagem do termômetro: um "slot" nosso entre o nome e os botões do cabeçalho
  function getTermometroHost() {
    const cab = document.querySelector(SEL.cabecalho);
    if (!cab) return null;
    let slot = cab.querySelector('.ixc-humor-slot');
    if (slot) return slot;
    const linha = cab.firstElementChild || cab;
    slot = document.createElement('div');
    slot.className = 'ixc-humor-slot';
    slot.setAttribute('data-ixc', '');
    const nome = linha.firstElementChild;
    if (nome && nome.nextSibling) linha.insertBefore(slot, nome.nextSibling);
    else linha.appendChild(slot);
    return slot;
  }

  function findConfirmOkButton() {
    const modal = document.querySelector(SEL.modal);
    if (!modal) return null;
    return Array.from(modal.querySelectorAll('button')).find((b) => /^(ok|confirmar|sim)$/i.test(b.textContent.trim())) || null;
  }

  // Texto de todas as etiquetas do atendimento (conversa aberta + card da lista),
  // em minúsculo e sem acento: ["assumido agente smith", "ajudando agente smith", ...]
  function getEtiquetas(id) {
    const fontes = [chat(), id ? document.querySelector(`li[itemid="${CSS.escape(id)}"]`) : null];
    const nomes = [];
    fontes.forEach((el) => {
      if (el) (el.getAttribute('data-tag-names') || '').split('|').forEach((t) => nomes.push(norm(t)));
    });
    return [...new Set(nomes.filter(Boolean))];
  }

  // Valor de um campo do painel "Informações" pelo rótulo ("Aberto em", "Nesta fila"…)
  function getCampoInfo(rotulo) {
    const painel = document.querySelector(SEL.painelInfo);
    if (!painel) return null;
    const alvo = norm(rotulo);
    for (const p of painel.querySelectorAll('p')) {
      if (norm(p.textContent) !== alvo) continue;
      const linha = p.parentElement;
      const valor = linha && Array.from(linha.children).find((c) => c !== p);
      if (valor) return valor.textContent.replace(/\s+/g, ' ').trim();
    }
    return null;
  }

  // "Aberto em: 16/11/2026 - 17:54" (painel lateral).
  // Se não achar (painel fechado), usa a data da primeira mensagem.
  function getDataAbertura() {
    const v = getCampoInfo('Aberto em');
    const m = v && v.match(/(\d{2})\/(\d{2})\/(\d{4})\D+(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0));
    const primeira = mensagens(SEL.mensagem)[0];
    return primeira ? getMessageDate(primeira) : null;
  }

  /**
   * Tempo na fila atual, a partir de "Nesta fila: 5 minutos" (painel lateral).
   * O Opa mostra o tempo arredondado (padrão moment.js), então devolvemos o
   * LIMITE INFERIOR em minutos, para nunca marcar antes da hora:
   *   "poucos segundos" → 0      "19 segundos" → 0.31 "um minuto" → 0.75   "5 minutos" → 4.5
   *   "uma hora" → 45            "3 horas" → 150      "um dia" → 1290
   * Aceita com ou sem "há" na frente (o Opa antigo escrevia "há 5 minutos").
   */
  function parseTempoRelativo(texto) {
    const t = norm(texto);
    const m = t.match(/(?:^|\s|ha\s+)(poucos|alguns|um|uma|\d+)\s+(segundo|minuto|hora|dia|semana|mes|meses|ano)s?/);
    if (!m) return null;
    const n = /^\d+$/.test(m[1]) ? +m[1] : (m[1] === 'um' || m[1] === 'uma' ? 1 : 0);
    const unidade = m[2];
    // O Opa novo mostra os segundos exatos ("19 segundos"); "poucos segundos" = 0
    if (unidade === 'segundo') return n > 1 ? (n - 0.5) / 60 : 0;
    // Limites do moment.js: 1 minuto = 45s..89s, N minutos = N-0.5.., 1 hora = 45min.., N horas = N-0.5h..
    if (unidade === 'minuto') return n === 1 ? 0.75 : n - 0.5;
    if (unidade === 'hora') return n === 1 ? 45 : (n - 0.5) * 60;
    if (unidade === 'dia') return n === 1 ? 21.5 * 60 : (n - 0.5) * 1440;
    return 30 * 1440; // semana/mês/ano: bem antigo
  }

  function getTempoNaFila() {
    const texto = getCampoInfo('Nesta fila');
    if (!texto) return null;
    const min = parseTempoRelativo(texto);
    return min === null ? null : { min, texto };
  }

  // Primeira mensagem de atendente humano: sender-type "user", menos as da IA
  // ("Enviado por API") e o aviso automático "Fulano iniciou o atendimento"
  function getPrimeiraMsgAtendenteHumano() {
    const m = mensagens('[data-message-id][data-sender-type="user"]').find(
      (el) => !/enviado por api/i.test(getRemetente(el)) && !/iniciou o atendimento\s*$/i.test(getMessageText(el))
    );
    return m ? getMessageDate(m) : null;
  }

  // Início do atendimento atual pelo painel ("Aberto em"), com 1 min de folga
  // (o painel mostra só hora:minuto). Sem o painel → null (não filtra).
  function getInicioAtendimento() {
    const v = getCampoInfo('Aberto em');
    const m = v && v.match(/(\d{2})\/(\d{2})\/(\d{4})\D+(\d{2}):(\d{2})/);
    return m ? new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime() - 60000 : null;
  }

  // Todas as mensagens DO ATENDIMENTO ATUAL em ordem cronológica, com quem enviou (para saber
  // se o atendente falou entre duas mensagens do cliente). Mensagens de sistema ficam de fora,
  // e as de atendimentos anteriores do mesmo contato (histórico acima) também.
  function getSequencia() {
    const inicio = getInicioAtendimento();
    return mensagens(SEL.mensagem)
      .filter((el) => el.getAttribute('data-sender-type') !== 'system')
      .filter((el) => { const d = getMessageDate(el); return !inicio || !d || d.getTime() >= inicio; })
      .map((el) => ({
        el,
        tipo: el.getAttribute('data-sender-type') === 'contact' ? 'cliente' : 'atendente',
      }));
  }

  function getListCards() {
    return Array.from(document.querySelectorAll(SEL.cardLista));
  }

  function getChatRoot() {
    return chat();
  }

  return {
    SEL,
    getAtendimentoId,
    getPendenciaCheckbox,
    isPendenciaMarcada,
    getEstadoPendencia,
    getCard,
    abrirItemPendencia,
    itemIndicaMarcada,
    fecharMenu,
    menuAberto,
    getMenuOuModalAberto,
    esperar,
    getClientMessages,
    getAgentMessages,
    last,
    getMessageDate,
    getMessageText,
    getTermometroHost,
    findConfirmOkButton,
    getChatRoot,
    getListCards,
    getEtiquetas,
    getCampoInfo,
    getInicioAtendimento,
    getRemetente,
    getDataAbertura,
    getTempoNaFila,
    parseTempoRelativo,
    getPrimeiraMsgAtendenteHumano,
    getSequencia,
  };
})();
