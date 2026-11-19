/* =========================================================
   MOTOR DO TERMÔMETRO DE HUMOR
   1. Pega as últimas N mensagens do cliente que têm texto
   2. Dá uma nota de -2 a +2 para cada uma (regras em humor-regras.js)
   3. Faz média ponderada (mensagens recentes pesam mais)
   4. Converte em categoria: estressado | neutro | satisfeito | desconhecido
   ========================================================= */

IXCOpa.humor = (function () {
  const R = () => IXCOpa.HUMOR_REGRAS;

  const CATEGORIAS = {
    estressado:   { emoji: '😡', label: 'Estressado',   cor: '#e53935' },
    neutro:       { emoji: '😐', label: 'Neutro',       cor: '#fbc02d' },
    satisfeito:   { emoji: '😊', label: 'Satisfeito',   cor: '#43a047' },
    encantado:    { emoji: '🚀', label: 'Muito satisfeito', cor: '#7c4dff' },
    desconhecido: { emoji: '?', label: 'Não mapeado',  cor: '#9e9e9e' },
  };

  // Abreviações comuns viram a palavra inteira, para casar com os termos
  const ABREVIACOES = [[/\bvcs\b/g, 'voces'], [/\bvc\b/g, 'voce'], [/\bp\/\s*/g, 'para '], [/\bq\b/g, 'que'], [/\btb\b|\btbm\b/g, 'tambem']];

  function normalizar(texto) {
    let t = texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    for (const [re, por] of ABREVIACOES) t = t.replace(re, por);
    return t;
  }

  function escapeRegex(s) {
    return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }

  // Compila os termos uma vez (mais longos primeiro)
  let compilados = null;
  function termosCompilados() {
    if (compilados) return compilados;
    compilados = R().termos
      .slice()
      .sort((a, b) => b[0].length - a[0].length)
      .map(([termo, peso]) => {
        // "*" em qualquer posição casa o final da palavra: "obrigad* por nada"
        const base = escapeRegex(termo).replace(/\*/g, '[a-z]*').replace(/ /g, '[\\s,.;:!?-]+');
        const re = new RegExp(`(^|[^a-z0-9])(${base})(?=[^a-z0-9]|$)`, 'g');
        return { termo, peso, re };
      });
    return compilados;
  }

  function temRisada(texto) {
    return R().risada.test(normalizar(texto));
  }

  // Para termo NEGATIVO, o "não" só inverte se vier colado ("não irritado") ou com um verbo
  // de ligação no meio ("não estou irritado", "não quero cancelar"). Em "se não resolver vou
  // sair da IXC" o "não" é de "resolver", não da ameaça.
  const LIGACAO = ['estou', 'to', 'ta', 'esta', 'e', 'foi', 'sou', 'quero', 'vou', 'vai', 'fiquei', 'fico', 'estamos', 'queremos', 'vamos'];
  function negacaoColada(anterior) {
    const n = anterior.length;
    const neg = IXCOpa.HUMOR_REGRAS.negadores;
    if (n >= 1 && neg.includes(anterior[n - 1])) return true;
    return n >= 2 && neg.includes(anterior[n - 2]) && LIGACAO.includes(anterior[n - 1]);
  }

  /**
   * Nota de uma mensagem.
   * @returns {{score:number, mapeada:boolean, sinais:string[], negativo:number, positivo:number, risada:boolean}}
   */
  function pontuarMensagem(textoOriginal) {
    const regras = R();
    let texto = ' ' + normalizar(textoOriginal) + ' ';
    const sinais = [];
    let positivo = 0;
    let negativo = 0;
    let mapeada = false;
    const elogios = []; // elogios que podem ser irônicos (para a detecção de sarcasmo)
    let positivoTermos = 0;
    let revolta = false; // algo que indica raiva de verdade (não só relato de problema)
    let ironiaExplicita = null; // "só que não", "ajuda nenhuma"...
    let confirmacao = false;    // "funciona", "deu certo", "obrigado"... → nunca é sarcasmo
    let colaboracao = false;    // "segue o print", "já testei"... → satisfação começa aqui
    let menorTermo = 0;         // termo mais negativo da mensagem (para separar relato de frustração)

    // 0) Operações no sistema ("remover cadastros do cliente") → neutras
    for (const re of regras.padroesOperacionais || []) {
      re.lastIndex = 0;
      texto = texto.replace(re, (m) => {
        mapeada = true;
        sinais.push(`operação no sistema: "${m.trim()}" (0)`);
        return ' '.repeat(m.length);
      });
    }

    // 1) Termos (mais longos primeiro; o trecho casado é apagado para não contar 2x)
    for (const { termo, peso, re } of termosCompilados()) {
      re.lastIndex = 0;
      texto = texto.replace(re, (m, antes, achado, offset, full) => {
        mapeada = true;
        let p = peso;

        // Negação nas 2 palavras anteriores
        // (corta na última pontuação: em "nao, e um absurdo" o "nao" não nega o "absurdo")
        const anterior = full.slice(Math.max(0, offset - 30), offset + antes.length)
          .split(/[,.;:!?]/).pop().trim().split(/\s+/).slice(-3);
        // Português usa dupla negação como reforço: "não há NENHUM prazo", "não tem NADA",
        // "não respondem NUNCA" → o "não" não inverte esses termos
        const reforco = /^(nao |nenhum|nenhuma|nada|ninguem|nunca|sem )/.test(termo);
        // "de nada" é cortesia, não negação
        // (olha só as 2 últimas palavras; a 3ª serve para reconhecer "de nada", que é cortesia)
        const negado = anterior.some((w, i) => i >= anterior.length - 2 && regras.negadores.includes(w) &&
          !(w === 'nada' && anterior[i - 1] === 'de')) && !reforco && !(regras.naoNegaveis || []).includes(termo);
        // "bom"/"boa" sozinhos são neutros, mas "não ficou bom" é negativo
        if (negado && p === 0 && (regras.neutrosNegaveis || []).includes(termo)) p = 0.0001;
        if (negado && p > 0) {
          // "nao ficou bom", "nem funcionou" → negativo
          p = regras.pesoNegacao;
          sinais.push(`negação+"${termo}" (${p})`);
        } else if (negado && p < 0 && negacaoColada(anterior)) {
          // "nao estou irritado", "nao e urgente" → anula o estresse
          p = regras.pesoNegativoNegado;
          sinais.push(`negação+"${termo}" (+${p})`);
        }
        if (p > 0) positivo += p;
        if (p < 0) negativo += p;
        if (p <= regras.pesoRevolta) revolta = true;
        if (p < menorTermo) menorTermo = p;
        if (regras.frasesIronicas.includes(termo)) ironiaExplicita = termo;
        if (p > 0 && regras.confirmacoes.includes(termo)) confirmacao = true;
        if (p > 0 && (regras.colaboracao || []).includes(termo)) colaboracao = true;
        if (p > 0) positivoTermos += p;
        if (p > 0 && regras.elogiosIronicos.includes(termo)) elogios.push({ termo, p });
        if (p !== 0 && !sinais.some((s) => s.includes(termo))) sinais.push(`${termo} (${p > 0 ? '+' : ''}${p})`);
        return antes + ' '.repeat(achado.length);
      });
    }

    // 1b) Sarcasmo na própria mensagem: elogio + (reclamação | deboche | aspas)
    let sarcasmo = false;
    if (elogios.length && !confirmacao) {
      const norm = normalizar(textoOriginal);
      const motivos = [];
      if (negativo <= regras.sarcasmoNegativoMinimo) motivos.push('elogio + reclamação');
      if (regras.emojisDeboche.some((e) => textoOriginal.includes(e))) motivos.push('elogio + emoji de deboche');
      const entreAspas = elogios.some(({ termo }) => {
        const base = escapeRegex(termo.replace('*', '')).replace(/ /g, '\\s+');
        const Q = `["“”'‘’]`;
        // "ótimo" entre aspas, ou aspas na palavra logo depois: excelente "atendimento"
        return new RegExp(`${Q}\\s*${base}[a-z]*\\s*${Q}`).test(norm) ||
          new RegExp(`${base}[a-z]*[\\s,]+([a-z]+\\s+){0,2}${Q}[a-z ]{2,30}${Q}`).test(norm);
      });
      if (entreAspas) motivos.push('elogio entre aspas');
      if (motivos.length) {
        sarcasmo = true;
        const anulado = elogios.reduce((t, e) => t + e.p, 0);
        positivo -= anulado;
        negativo += regras.pesoSarcasmo;
        sinais.push(`🙃 sarcasmo: ${motivos.join(', ')} → "${elogios.map((e) => e.termo).join('", "')}" vira ${regras.pesoSarcasmo}`);
      }
    }
    // Frase sempre irônica anula TODOS os elogios da mensagem: "Resolveu sim, só que não"
    if (ironiaExplicita && positivoTermos > 0 && !sarcasmo) {
      positivo -= positivoTermos;
      sarcasmo = true;
      sinais.push(`🙃 sarcasmo explícito ("${ironiaExplicita}") anula os elogios`);
    } else if (ironiaExplicita) {
      sarcasmo = true;
    }
    // Mensagem que é só elogio irônico-possível (usado na regra d, entre mensagens)
    const somaElogios = elogios.reduce((t, e) => t + e.p, 0);
    const soElogio = !sarcasmo && !confirmacao && elogios.length > 0 && negativo === 0 && Math.abs(positivoTermos - somaElogios) < 1e-9;
    const palavras = normalizar(textoOriginal).split(/[^a-z0-9]+/).filter(Boolean).length;

    // 1c) Pergunta sem revolta: o cliente está perguntando/aguardando, não brigando
    const norm0 = normalizar(textoOriginal).trim();
    const pergunta = /\?/.test(textoOriginal) || regras.inicioPergunta.test(norm0);
    const temDeboche = regras.emojisNegativos.some((e) => textoOriginal.includes(e));
    const letras0 = textoOriginal.replace(/[^A-Za-zÀ-ÿ]/g, '');
    const caps0 = letras0.length >= 8 && letras0.replace(/[^A-ZÀ-Þ]/g, '').length / letras0.length > 0.7;
    const semRevolta = !revolta && !sarcasmo && !temDeboche && !/!{2,}/.test(textoOriginal);
    let explicacao = false;
    if (pergunta && negativo < 0 && semRevolta) {
      negativo *= regras.fatorPerguntaSemRevolta;
      sinais.push(`pergunta sem revolta x${regras.fatorPerguntaSemRevolta}`);
    } else if (negativo < 0 && semRevolta &&
      (palavras >= regras.explicacaoMinPalavras || regras.marcadoresExplicacao.test(' ' + norm0 + ' '))) {
      // 1d) Explicação de cenário: o cliente está contando o que acontece, não reclamando
      explicacao = true;
      negativo = Math.max(negativo * regras.fatorExplicacao, regras.limiteExplicacao);
      sinais.push(`explicação/contexto (máx ${regras.limiteExplicacao})`);
    }

    // 1e) Informação relevante: cliente detalhando o problema está colaborando → positivo
    const cobranca = regras.cobrancas.test(norm0);
    const podeInformar = semRevolta && !cobranca && menorTermo > regras.frustracaoMax && !caps0;
    const temDetalhe = regras.marcadoresExplicacao.test(' ' + norm0 + ' ') || regras.termosDetalhe.test(' ' + norm0 + ' ') || /\d/.test(norm0);
    let informativa = false;
    if (podeInformar && palavras >= regras.informativaMinPalavras && temDetalhe) {
      informativa = true;
      if (negativo < 0) sinais.push(`relato detalhado: negativo ${negativo.toFixed(1)} zerado`);
      negativo = 0;
      positivo += regras.pesoInformativa;
      mapeada = true;
      sinais.push('relato detalhado (neutro)');
    }

        if (/^\s*\?{1,2}\s*$/.test(textoOriginal)) { negativo += -0.5; mapeada = true; sinais.push('"?" sozinho: cobrando resposta (-0.5)'); }

    // 2) Emojis
    for (const e of regras.emojisPositivos) if (textoOriginal.includes(e)) { positivo += regras.pesoEmoji; mapeada = true; sinais.push(`${e} (+${regras.pesoEmoji})`); }
    for (const e of regras.emojisNegativos) if (textoOriginal.includes(e)) { negativo -= regras.pesoEmoji; mapeada = true; sinais.push(`${e} (-${regras.pesoEmoji})`); }

    // 3) Risada
    const risada = temRisada(textoOriginal);
    if (risada) { positivo += regras.pesoRisada; mapeada = true; sinais.push(`risada (+${regras.pesoRisada})`); }

    // 4) Intensidade
    const letras = textoOriginal.replace(/[^A-Za-zÀ-ÿ]/g, '');
    const maiusculas = letras.replace(/[^A-ZÀ-Þ]/g, '');
    const capsLock = letras.length >= 8 && maiusculas.length / letras.length > 0.7;
    // CAPS só é alerta se a mensagem já tiver reclamação (senão pode ter sido sem querer)
    let penalidadeCaps = 0;
    const negativoAntesCaps = negativo;
    if (capsLock && negativo < 0 && !explicacao) {
      negativo += regras.pesoCapsLock;
      penalidadeCaps = regras.pesoCapsLock;
      sinais.push(`CAPS com reclamação (${regras.pesoCapsLock})`);
    }
    let interrog = 0;
    if (/^\s*\?{3,}\s*$/.test(textoOriginal)) { interrog = regras.pesoInterrogacoes; negativo += interrog; mapeada = true; sinais.push(`"???" sozinho: cobrança insistente (${regras.pesoInterrogacoes})`); }
    if ((penalidadeCaps || /!{2,}/.test(textoOriginal)) && negativo < 0) {
      negativo *= regras.fatorIntensidade;
      sinais.push(`intensidade x${regras.fatorIntensidade}`);
    }

    return { score: positivo + negativo, positivo, negativo, mapeada, sinais, risada, sarcasmo, soElogio, somaElogios, palavras, pergunta, revolta, capsLock, penalidadeCaps, confirmacao,
      cobranca, informativa, podeInformar, temDetalhe, colaboracao, elogio: elogios.length > 0 && !sarcasmo,
      negativoSemCaps: (negativoAntesCaps + interrog) * (/!{2,}/.test(textoOriginal) && negativoAntesCaps + interrog < 0 ? regras.fatorIntensidade : 1) };
  }

  /**
   * Analisa uma lista de textos do cliente (ordem cronológica).
   */
  function analisarTextos(entradas) {
    const cfg = IXCOpa.CONFIG;
    const regras = R();
    // Aceita strings ou { texto, emSequencia, respondeuPergunta } (emSequencia = o cliente
    // mandou esta mensagem logo depois de outra dele, sem o atendente falar no meio;
    // respondeuPergunta = a mensagem anterior do atendente terminava com "?")
    const janela = entradas
      .map((e) => (typeof e === 'string' ? { texto: e, emSequencia: true } : e))
      .filter((e) => e.texto && e.texto.trim())
      .slice(-cfg.HUMOR_JANELA);

    if (!janela.length) {
      return { categoria: 'desconhecido', ...CATEGORIAS.desconhecido, media: 0, detalhes: [] };
    }

    const notas = janela.map((e) => ({ texto: e.texto, emSequencia: e.emSequencia, ...pontuarMensagem(e.texto) }));

    // Resposta a uma pergunta do atendente, com conteúdo, também é informação relevante
    notas.forEach((n, i) => {
      const e = janela[i];
      if (!e.respondeuPergunta || n.informativa || !n.podeInformar) return;
      if (n.palavras < regras.informativaMinPalavrasResposta || !n.temDetalhe) return;
      n.informativa = true;
      if (n.negativo < 0) n.sinais.push(`relato detalhado: negativo ${n.negativo.toFixed(1)} zerado`);
      n.negativo = 0;
      n.positivo += regras.pesoInformativa;
      n.mapeada = true;
      n.sinais.push('respondeu a pergunta do atendente com detalhe (neutro)');
    });

    // CAPS como estilo: se o cliente escreve várias mensagens em CAPS, não é grito
    if (notas.filter((n) => n.capsLock).length >= regras.capsEstiloMinMsgs) {
      notas.forEach((n) => {
        if (!n.penalidadeCaps) return;
        n.negativo = n.negativoSemCaps;
        n.sinais.push('CAPS ignorado (cliente escreve sempre em maiúsculas)');
      });
    }

    // Risada suaviza o negativo da própria mensagem e das vizinhas
    notas.forEach((n, i) => {
      const vizinhaRindo = n.risada || (notas[i - 1] && notas[i - 1].risada) || (notas[i + 1] && notas[i + 1].risada);
      if (vizinhaRindo && n.negativo < 0) {
        n.negativo *= regras.fatorRisadaNoNegativo;
        n.sinais.push(`suavizado por risada x${regras.fatorRisadaNoNegativo}`);
      }
      const lim = regras.limiteMensagem;
      n.score = Math.max(-lim, Math.min(lim, n.positivo + n.negativo));
    });

    // Insistência: a partir da 2ª cobrança na janela, cada nova cobrança pesa mais
    let cobrancasVistas = 0;
    notas.forEach((n) => {
      if (!n.cobranca) return;
      cobrancasVistas++;
      if (cobrancasVistas < 2) return;
      n.negativo += regras.pesoInsistencia;
      n.mapeada = true;
      n.sinais.push(`insistência: ${cobrancasVistas}ª cobrança (${regras.pesoInsistencia})`);
      const lim = regras.limiteMensagem;
      n.score = Math.max(-lim, Math.min(lim, n.positivo + n.negativo));
    });

    // Sarcasmo entre mensagens (regra d): reclamação → "ótimo" curto, sem o atendente no meio
    notas.forEach((n, i) => {
      const ant = notas[i - 1];
      if (!ant || !n.soElogio || !n.emSequencia) return;
      if (n.palavras > regras.sarcasmoMaxPalavras || ant.score > regras.sarcasmoMensagemAnterior) return;
      n.positivo -= n.somaElogios;
      n.negativo += regras.pesoSarcasmo;
      n.sarcasmo = true;
      n.sinais.push(`🙃 sarcasmo: elogio logo após reclamação → ${regras.pesoSarcasmo}`);
      const lim = regras.limiteMensagem;
      n.score = Math.max(-lim, Math.min(lim, n.positivo + n.negativo));
    });

    if (!notas.some((n) => n.mapeada)) {
      return { categoria: 'desconhecido', ...CATEGORIAS.desconhecido, media: 0, detalhes: notas };
    }

    // Média ponderada: a mais recente é a última do array
    let soma = 0, pesos = 0;
    notas.slice().reverse().forEach((n, idx) => {
      if (!n.mapeada) return; // mensagem não entendida não puxa a média para o zero
      const w = cfg.HUMOR_PESOS_RECENCIA[idx] ?? cfg.HUMOR_PESOS_RECENCIA[cfg.HUMOR_PESOS_RECENCIA.length - 1];
      soma += n.score * w;
      pesos += w;
    });
    const media = pesos ? soma / pesos : 0;

    const ultimaEntendida = notas.filter((n) => n.mapeada).pop();
    let gatilho = ultimaEntendida && ultimaEntendida.score <= cfg.HUMOR_GATILHO_ULTIMA;
    if (gatilho) ultimaEntendida.sinais.push('⚡ gatilho: última mensagem muito negativa');

    // Estresse recente persiste enquanto o cliente não disser nada positivo depois
    if (!gatilho) {
      const ultimasEntendidas = notas.filter((n) => n.mapeada).slice(-(cfg.HUMOR_ESTRESSE_RECENTE_MSGS || 0));
      const idx = ultimasEntendidas.map((n) => n.score <= cfg.HUMOR_GATILHO_ULTIMA).lastIndexOf(true);
      if (idx >= 0 && ultimasEntendidas.slice(idx + 1).every((n) => n.score < cfg.HUMOR_LIMIAR_SATISFEITO)) {
        gatilho = true;
        ultimasEntendidas[idx].sinais.push('⚡ estresse recente: nada positivo depois desta mensagem');
      }
    }

    const positivas = notas.filter((n) => n.mapeada && n.score >= cfg.HUMOR_LIMIAR_SATISFEITO).length;

    // Gatilho positivo: agradecimento/confirmação recente, sem reclamação depois
    const entendidas = notas.filter((n) => n.mapeada);
    const recentes = entendidas.slice(-cfg.HUMOR_GATILHO_POSITIVO_ULTIMAS);
    // Gatilho positivo: agradecimento/confirmação, COLABORAÇÃO (fez o que foi pedido) ou
    // ELOGIO sincero ("Incrível!", "Ótimo!", "Excelente!" – sem sinal de sarcasmo).
    // Depois de estresse na janela, só agradecimento/confirmação tira do vermelho.
    const teveEstresse = entendidas.some((n) => n.score <= cfg.HUMOR_GATILHO_ULTIMA);
    const idxAgradece = recentes.findIndex((n) => (n.confirmacao || ((n.colaboracao || n.elogio) && !teveEstresse)) && !n.sarcasmo && n.score >= cfg.HUMOR_GATILHO_POSITIVO_MIN);
    const gatilhoPositivo = !gatilho && idxAgradece >= 0 && recentes.slice(idxAgradece + 1).every((n) => n.score >= 0);
    if (gatilhoPositivo) recentes[idxAgradece].sinais.push(recentes[idxAgradece].colaboracao && !recentes[idxAgradece].confirmacao
      ? '💚 gatilho: cliente colaborou (fez o que foi pedido) e não reclamou depois'
      : recentes[idxAgradece].elogio && !recentes[idxAgradece].confirmacao
      ? '💚 gatilho: cliente elogiou e não reclamou depois'
      : '💚 gatilho: cliente agradeceu/confirmou e não reclamou depois');

    let categoria = 'neutro';
    if (gatilho || media <= cfg.HUMOR_LIMIAR_ESTRESSADO) categoria = 'estressado';
    else if (media >= cfg.HUMOR_LIMIAR_FOGUETE && positivas >= cfg.HUMOR_FOGUETE_MIN_MSGS) categoria = 'encantado';
    else if (media >= cfg.HUMOR_LIMIAR_SATISFEITO || gatilhoPositivo) categoria = 'satisfeito';

    return { categoria, ...CATEGORIAS[categoria], media, detalhes: notas };
  }

  // Lê o DOM do Opa e analisa
  function analisarAtendimento() {
    const { dom } = IXCOpa;
    const seq = dom.getSequencia();
    const entradas = [];
    seq.forEach((m, i) => {
      if (m.tipo !== 'cliente') return;
      const ant = seq[i - 1];
      entradas.push({
        texto: dom.getMessageText(m.el),
        emSequencia: !!ant && ant.tipo === 'cliente',
        respondeuPergunta: !!ant && ant.tipo === 'atendente' && /\?\s*$/.test(dom.getMessageText(ant.el)),
      });
    });
    return analisarTextos(entradas);
  }

  return { CATEGORIAS, pontuarMensagem, analisarTextos, analisarAtendimento, normalizar };
})();
