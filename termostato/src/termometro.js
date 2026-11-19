/* =========================================================
   COMPONENTE VISUAL DO TERMÔMETRO
   Fica no espaço central do .cabecalho da conversa:
   ←        😡 ▮▮▮▮▮▮▮▮ Estressado        ⋮
   Passe o mouse para ver quais mensagens/termos pesaram.
   ========================================================= */

IXCOpa.termometro = (function () {
  const ID = 'ixc-humor-termometro';

  // Posição do preenchimento da barra: -2 (vazio/vermelho) … +2 (cheio/verde)
  function percentual(resultado) {
    return IXCOpa.lista ? IXCOpa.lista.percentual(resultado.categoria, resultado.media) : 50;
  }

  function criar() {
    const el = document.createElement('div');
    el.id = ID;
    el.className = 'ixc-humor';
    el.setAttribute('data-ixc', '');
    el.innerHTML = `
      <span class="ixc-humor__emoji" aria-hidden="true"></span>
      <span class="ixc-humor__barra"><span class="ixc-humor__fill"></span></span>
      <span class="ixc-humor__label"></span>
      <div class="ixc-humor__tooltip" role="tooltip"></div>`;
    return el;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function montarTooltip(resultado) {
    if (!resultado.detalhes.length) {
      return '<b>Sem mensagens do cliente ainda.</b>';
    }
    const linhas = resultado.detalhes.map((d) => {
      const nota = d.mapeada ? (d.score > 0 ? '+' : '') + d.score.toFixed(1) : '?';
      const cls = !d.mapeada ? 'q' : d.score <= -0.8 ? 'neg' : d.score >= 1.3 ? 'top' : d.score >= 0.5 ? 'pos' : 'neu';
      const texto = d.texto.length > 70 ? d.texto.slice(0, 70) + '…' : d.texto;
      return `<li><span class="ixc-humor__nota ixc-humor__nota--${cls}">${nota}</span>
                <span>${escapeHtml(texto)}${d.sinais.length ? `<small>${escapeHtml(d.sinais.join(' · '))}</small>` : ''}</span></li>`;
    });
    return `<b>Últimas ${resultado.detalhes.length} mensagens do cliente</b>
            <ul>${linhas.join('')}</ul>
            <div class="ixc-humor__media">Média: ${resultado.media.toFixed(2)} · <span class="ixc-humor__versao">Termostato v${IXCOpa.VERSAO}</span></div>`;
  }

  /**
   * Renderiza (ou atualiza) o termômetro. Retorna false se o cabeçalho
   * ainda não existe na tela.
   */
  function render(resultado) {
    const host = IXCOpa.dom.getTermometroHost();
    if (!host) return false;

    let el = document.getElementById(ID);
    if (!el || !host.contains(el)) {
      if (el) el.remove();
      el = criar();
      host.appendChild(el);
    }

    // Evita reescrever o DOM se nada mudou (não gera mutações à toa)
    const assinatura = resultado.categoria + '|' + resultado.media.toFixed(2) + '|' + resultado.detalhes.map((d) => d.texto).join('\u0001');
    if (el.dataset.assinatura === assinatura) return true;
    el.dataset.assinatura = assinatura;

    el.dataset.categoria = resultado.categoria;
    el.style.setProperty('--ixc-humor-cor', resultado.cor);
    el.querySelector('.ixc-humor__emoji').textContent = resultado.emoji;
    el.querySelector('.ixc-humor__label').textContent = resultado.label;
    el.querySelector('.ixc-humor__fill').style.width = percentual(resultado) + '%';
    el.querySelector('.ixc-humor__tooltip').innerHTML = montarTooltip(resultado);
    IXCOpa.travarCores(el.querySelector('.ixc-humor__tooltip'));
    el.setAttribute('aria-label', `Humor do cliente: ${resultado.label}`);
    return true;
  }

  return { ID, render, montarTooltip };
})();
