/* =========================================================
   CONFIGURAÇÕES GERAIS
   Todos os arquivos compartilham o namespace window.IXCOpa
   (content scripts listados no manifest rodam no mesmo escopo isolado).
   ========================================================= */

window.IXCOpa = window.IXCOpa || {};

IXCOpa.CONFIG = {
  // Liga/desliga os logs no console (deixe false em produção)
  DEBUG: false,

  // --- Pendência externa ---
  PENDENCIA_ATIVA: true,
  // A pendência é OBRIGATÓRIA: marca quando o atendimento completa TIMEOUT_MINUTES
  // na fila do atendente, haja resposta do cliente ou não. Só o atendente desmarca
  // (e aí não marca mais).
  TIMEOUT_MINUTES: 5,
  // Atendimentos há mais que isso (na mesma referência) NÃO são marcados
  IDADE_MAX_HORAS: 8,
  // De onde o tempo conta (vale para os 5 min e para as 8 h):
  //  'fila'              → "Nesta fila há ..." do painel lateral (padrão)
  //  'abertura'          → "Atendimento aberto em ..." (inclui triagem/outras filas)
  //  'primeiro_atendente'→ primeira mensagem de um atendente humano
  TIMER_REFERENCIA: 'fila',
  // Etiquetas do Agente Smith (texto, minúsculo e sem acento; basta conter)
  ETIQUETA_SMITH_ASSUMIDO: ['assumido agente smith', 'atendendo agente smith'], // verde → bloqueia
  ETIQUETA_SMITH_AJUDANDO: ['ajudando agente smith'],                          // amarela → libera
  FALLBACK_INTERVAL: 30000,     // checagem de garantia (30 s)

  // --- Termômetro de humor ---
  HUMOR_ATIVO: true,
  HUMOR_NA_LISTA: true,          // selo emoji + barrinha vertical em cada card da lista
  HUMOR_NO_CABECALHO: false,     // termômetro grande no topo da conversa aberta
  HUMOR_JANELA: 5,               // quantas mensagens do cliente (com texto) analisar
  // Peso de cada mensagem da janela, da mais recente para a mais antiga
  HUMOR_PESOS_RECENCIA: [1.0, 0.85, 0.7, 0.55, 0.4],
  HUMOR_LIMIAR_ESTRESSADO: -0.8, // média <= isso → estressado (relato de problema sozinho fica 😐 com nota baixa)
  HUMOR_LIMIAR_SATISFEITO: 0.5,  // média >= isso → satisfeito
  HUMOR_LIMIAR_FOGUETE: 1.3,     // média >= isso → 🚀 muito satisfeito…
  HUMOR_FOGUETE_MIN_MSGS: 2,     // …com pelo menos 2 mensagens positivas na janela
  // Gatilho imediato: se a última mensagem entendida do cliente tiver nota <= isso,
  // fica estressado mesmo que as anteriores tenham sido positivas
  HUMOR_GATILHO_ULTIMA: -1.5,
  // Estresse recente persiste: se uma das N últimas mensagens entendidas teve nota <= HUMOR_GATILHO_ULTIMA
  // e o cliente não disse nada positivo depois (nota >= HUMOR_LIMIAR_SATISFEITO), continua estressado.
  // Mensagens neutras depois ("sim", "ok", "olá") não apagam a reclamação.
  HUMOR_ESTRESSE_RECENTE_MSGS: 3,
  // Gatilho positivo: se o cliente agradeceu/confirmou ("obrigado pela explicação",
  // "deu certo", "funciona") em uma das últimas N mensagens entendidas e não reclamou
  // depois disso, fica no mínimo 😊 — mesmo que tenha relatado problemas antes.
  HUMOR_GATILHO_POSITIVO_ULTIMAS: 2,
  HUMOR_GATILHO_POSITIVO_MIN: 0.7, // nota mínima da mensagem de agradecimento/confirmação
  HUMOR_CACHE_DIAS: 7,          // por quanto tempo lembrar o humor de um atendimento

  // --- Observer ---
  DEBOUNCE_MS: 500,
};

IXCOpa.log = function (scope, ...args) {
  if (IXCOpa.CONFIG.DEBUG) console.log(`[Termostato][${scope}]`, ...args);
};

// Qualquer elemento criado pela extensão recebe data-ixc,
// assim o observer sabe ignorar mutações causadas por nós mesmos.
IXCOpa.isOwnNode = function (node) {
  const el = node && (node.nodeType === 1 ? node : node.parentElement);
  return !!(el && el.closest && el.closest('[data-ixc]'));
};

/**
 * A extensão ainda está viva? Depois de recarregar a extensão (↻) sem dar F5 na aba,
 * a versão antiga continua rodando na página, mas sem acesso ao chrome.* →
 * "Extension context invalidated". Nesse caso ela deve se desligar em silêncio.
 */
IXCOpa.contextoValido = function () {
  try {
    return typeof chrome !== 'undefined' && !!(chrome.runtime && chrome.runtime.id);
  } catch (e) {
    return false;
  }
};

// Versão (aparece no rodapé do balão para conferir qual está rodando)
IXCOpa.VERSAO = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
  ? chrome.runtime.getManifest().version : 'dev';

/**
 * Trava as cores do balão com estilo INLINE + !important (nível mais forte do CSS),
 * para nenhum CSS do Opa (tema claro/escuro) conseguir trocar a cor do texto.
 */
IXCOpa.travarCores = function (raiz) {
  const set = (el, prop, val) => el.style.setProperty(prop, val, 'important');
  const TEXTO = '#f1f4f8', SECUNDARIO = '#b9c2cf';
  set(raiz, 'background', '#1f2633');
  set(raiz, 'border', '1px solid #5b6678');
  [raiz, ...raiz.querySelectorAll('*')].forEach((el) => {
    let cor = TEXTO;
    if (el.matches('small, .ixc-humor__media, .ixc-humor__media *, .ixc-humor__versao')) cor = SECUNDARIO;
    if (el.matches('.ixc-humor__nota--neu')) cor = '#222222';
    else if (el.matches('.ixc-humor__nota')) cor = '#ffffff';
    if (el.matches('.ixc-selo__tooltip-titulo')) cor = el.dataset.cor || TEXTO;
    set(el, 'color', cor);
    set(el, '-webkit-text-fill-color', cor);
    set(el, 'text-shadow', 'none');
    set(el, 'opacity', '1');
    if (!el.matches('.ixc-humor__nota')) set(el, 'background-color', 'transparent');
  });
  set(raiz, 'background', '#1f2633');
};
