/* =========================================================
   SELO DE HUMOR NA LISTA DE ATENDIMENTOS
   Cantinho de cada card:  😡▮   (emoji + barrinha vertical colorida)

   - Atendimento aberto: humor ao vivo (últimas 5 mensagens do cliente)
   - Outros: último humor medido quando foram abertos (chrome.storage)
   - Nunca abertos: ❓ (não mapeado ainda)
   Passe o mouse no selo para ver o detalhe.
   ========================================================= */

IXCOpa.lista = (function () {
  const { dom, humor, storage } = IXCOpa;
  const CLS = 'ixc-selo';
  let resultadoAoVivo = null; // { id, resultado }
  let tooltip = null;

  function percentual(categoria, media) {
    if (categoria === 'desconhecido' || categoria === 'encantado') return 100;
    const p = ((media + 2) / 4) * 100;
    // a altura acompanha a categoria (ex.: 😊 pelo gatilho de agradecimento nunca fica "meia barra")
    const faixa = { estressado: [12, 30], neutro: [32, 62], satisfeito: [68, 92] }[categoria] || [8, 100];
    return Math.max(faixa[0], Math.min(faixa[1], p));
  }

  function criarSelo() {
    const el = document.createElement('div');
    el.className = CLS;
    el.setAttribute('data-ixc', '');
    el.innerHTML = `<span class="${CLS}__emoji"></span><span class="${CLS}__barra"><span class="${CLS}__fill"></span></span>`;
    el.addEventListener('mouseenter', mostrarTooltip);
    el.addEventListener('mouseleave', esconderTooltip);
    // não deixa o clique no selo abrir/alterar o atendimento
    el.addEventListener('click', (e) => e.stopPropagation());
    return el;
  }

  function dadosDoCard(id) {
    if (resultadoAoVivo && resultadoAoVivo.id === id) {
      const r = resultadoAoVivo.resultado;
      return { categoria: r.categoria, media: r.media, aoVivo: true };
    }
    const salvo = storage.getHumor(id);
    if (salvo) return { categoria: salvo.categoria, media: salvo.media, ts: salvo.ts, n: salvo.n };
    return { categoria: 'desconhecido', media: 0 };
  }

  // Canto inferior esquerdo, logo abaixo das etiquetas (como no Opa antigo).
  // Card: li[itemid] > button > div(conteúdo, flex-col) > [título+hora] [prévia] [etiquetas]
  // A lista é virtualizada com altura medida, então a linha extra empurra o card de baixo.
  function posicionar(card, selo) {
    const conteudo = card.querySelector('button > div.flex-col') || card.querySelector('button') || card;
    const tags = conteudo.querySelector(':scope > .flex-wrap');
    if (tags) tags.after(selo);
    else conteudo.appendChild(selo);
  }

  function renderCard(card) {
    const id = card.getAttribute('itemid');
    if (!id) return;
    let selo = card.querySelector('.' + CLS);
    if (selo && !selo.isConnected) selo = null;
    if (!selo) {
      selo = criarSelo();
      posicionar(card, selo);
    }
    const d = dadosDoCard(id);
    const cat = humor.CATEGORIAS[d.categoria];
    const assinatura = `${id}|${d.categoria}|${d.media.toFixed(2)}|${d.aoVivo ? 1 : 0}`;
    if (selo.dataset.assinatura === assinatura) return;
    selo.dataset.assinatura = assinatura;
    selo.dataset.categoria = d.categoria;
    selo.dataset.id = id;
    selo.style.setProperty('--ixc-humor-cor', cat.cor);
    selo.querySelector(`.${CLS}__emoji`).textContent = cat.emoji;
    selo.querySelector(`.${CLS}__fill`).style.height = percentual(d.categoria, d.media) + '%';
    selo.setAttribute('aria-label', `Humor do cliente: ${cat.label}`);
  }

  function renderTodos() {
    dom.getListCards().forEach(renderCard);
  }

  // ---- Tooltip único, fixo no body (a lista tem overflow e cortaria) ----
  function garantirTooltip() {
    if (tooltip && document.body.contains(tooltip)) return tooltip;
    tooltip = document.createElement('div');
    tooltip.className = 'ixc-humor__tooltip ixc-selo__tooltip';
    tooltip.setAttribute('data-ixc', '');
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function hora(ts) {
    return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function mostrarTooltip(e) {
    const selo = e.currentTarget;
    const id = selo.dataset.id;
    const d = dadosDoCard(id);
    const cat = humor.CATEGORIAS[d.categoria];
    const t = garantirTooltip();

    let corpo;
    if (d.aoVivo) {
      corpo = IXCOpa.termometro.montarTooltip(resultadoAoVivo.resultado);
    } else if (d.ts) {
      corpo = `<div>Medido em ${hora(d.ts)} (últimas ${d.n} mensagens)</div>
               <div class="ixc-humor__media">Média: ${d.media.toFixed(2)} · abra o atendimento para atualizar · <span class="ixc-humor__versao">Termostato v${IXCOpa.VERSAO}</span></div>`;
    } else {
      corpo = '<div>Ainda não analisado. Abra o atendimento para medir o humor.</div>';
    }
    t.innerHTML = `<div class="ixc-selo__tooltip-titulo" data-cor="${cat.cor}">${cat.emoji} ${cat.label}</div>${corpo}`;

    IXCOpa.travarCores(t);

    const r = selo.getBoundingClientRect();
    t.style.display = 'block';
    const largura = t.offsetWidth;
    let left = r.right + 10;
    if (left + largura > window.innerWidth - 8) left = Math.max(8, r.left - largura - 10);
    t.style.left = left + 'px';
    t.style.top = Math.max(8, Math.min(r.top - 10, window.innerHeight - t.offsetHeight - 8)) + 'px';
  }

  function esconderTooltip() {
    if (tooltip) tooltip.style.display = 'none';
  }

  function setAoVivo(id, resultado) {
    resultadoAoVivo = id ? { id, resultado } : null;
    if (id && resultado) storage.setHumor(id, resultado);
  }

  return { renderTodos, setAoVivo, percentual };
})();
