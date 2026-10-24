/* =============================================================
   tutorial.js — Tutoriais interativos (motor)
   • Destaca um elemento real da página e mostra um balão explicando
   • Passos "clique": a pessoa toca no elemento destacado e o tutorial
     espera a ação terminar (ex.: criar a matéria na janela que abriu)
   • Passos "livre": a pessoa pode digitar/mexer dentro da área destacada
   • Passos sem alvo: balão no centro da tela (boas-vindas, conclusões)

   O conteúdo de cada tutorial fica em js/tutoriais.js.
   O que já foi visto fica guardado na conta (config.tutorial), então
   vale em todos os aparelhos:
     { dicas: bool, primeirosPassos: bool, visto: { idDoTutorial: true } }
   ============================================================= */
'use strict';

const Tutorial = (() => {
  const { esc } = Util;
  const TOURS = {};
  const PAGINAS = {};          // nome da rota → função (params) => id do tutorial da página
  let atual = null;            // tutorial em andamento
  let camada = null;           // elementos da sobreposição
  let liberado = false;        // só mostra dicas automáticas depois de decidir o primeiro acesso
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const suave = () => (Estado.config().animacoes && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto');

  /* ---------- Preferências (guardadas na conta) ---------- */
  const prefs = () => Estado.config().tutorial || null;
  function gravar(campos) {
    const p = prefs() || { dicas: true, primeirosPassos: true, visto: {} };
    Estado.atualizarConfig({ tutorial: { ...p, ...campos } });
  }
  const jaViu = id => !!prefs()?.visto?.[id];
  function marcarVisto(id) { gravar({ visto: { ...(prefs()?.visto || {}), [id]: true } }); }

  /* ---------- Registro ---------- */
  /** registrar(id, { titulo, passos: [...] | (contexto) => [...], depois?: fn, missao?: bool }) */
  function registrar(id, def) { TOURS[id] = def; }
  /** paginas({ materias: () => 'materias', materia: p => p.grupo ? 'frente' : 'pastas', … }) */
  function paginas(mapa) { Object.assign(PAGINAS, mapa); }
  const tourDaPagina = (nome, params) => (PAGINAS[nome] ? PAGINAS[nome](params || {}) : null);
  const existe = id => !!TOURS[id];

  /* =========================================================
     SOBREPOSIÇÃO (escurece tudo menos o elemento destacado)
     ========================================================= */
  function montar() {
    if (camada) return;
    const raiz = document.createElement('div');
    raiz.className = 'tour';
    raiz.hidden = true;
    raiz.innerHTML = `
      <div class="tour__sombra" data-lado="cima"></div>
      <div class="tour__sombra" data-lado="baixo"></div>
      <div class="tour__sombra" data-lado="esq"></div>
      <div class="tour__sombra" data-lado="dir"></div>
      <div class="tour__anel" aria-hidden="true"></div>
      <div class="tour__tampa"></div>
      <div class="tour__balao" role="dialog" aria-modal="false" aria-labelledby="tour-titulo" aria-describedby="tour-texto" tabindex="-1">
        <div class="tour__topo">
          <span class="tour__passo" id="tour-passo"></span>
          <button type="button" class="tour__fechar" data-tour="fechar" aria-label="Fechar tutorial" title="Fechar tutorial (Esc)">${Ui.icone('fechar')}</button>
        </div>
        <div class="tour__corpo">
          <h2 class="tour__titulo" id="tour-titulo"></h2>
          <div class="tour__texto" id="tour-texto"></div>
        </div>
        <p class="tour__dica-clique" hidden>${Ui.icone('avancar')} <span></span></p>
        <div class="tour__rodape"></div>
      </div>`;
    document.body.appendChild(raiz);
    camada = {
      raiz,
      sombras: [...raiz.querySelectorAll('.tour__sombra')],
      anel: raiz.querySelector('.tour__anel'),
      tampa: raiz.querySelector('.tour__tampa'),
      balao: raiz.querySelector('.tour__balao'),
    };
    raiz.addEventListener('click', aoClicarCamada);
    window.addEventListener('resize', reposicionar, { passive: true });
    window.addEventListener('scroll', reposicionar, { passive: true, capture: true });
    window.addEventListener('keydown', aoTeclar, true);
  }

  let quadro = 0;
  function reposicionar() {
    if (!atual || !camada || camada.raiz.hidden) return;
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(posicionar);
  }

  /** Elemento visível de verdade (não escondido por CSS, com tamanho) */
  const visivel = el => !!el && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

  function resolverAlvo(alvo) {
    if (!alvo) return null;
    if (typeof alvo === 'function') { const el = alvo(); return visivel(el) ? el : null; }
    const lista = [...document.querySelectorAll(alvo)];
    return lista.find(visivel) || null;
  }

  /** Espera o alvo aparecer (a página pode estar sendo desenhada) */
  async function esperarAlvo(alvo, limite, token) {
    const inicio = Date.now(), fim = inicio + limite;
    while (Date.now() < fim) {
      if (!atual || atual.token !== token) return null;
      if (!document.querySelector('dialog[open]')) {
        const el = resolverAlvo(alvo);
        if (el) return el;
        // Existe mas está escondido nesta tela (ex.: item do menu que não aparece no celular): pula logo
        if (typeof alvo === 'string' && Date.now() - inicio > 250 && document.querySelector(alvo)) return null;
      }
      await espera(100);
    }
    return null;
  }

  function posicionar() {
    if (!atual || !camada) return;
    const p = atual.passos[atual.i];
    if (atual.el && !atual.el.isConnected) atual.el = resolverAlvo(p.alvo);  // a página foi redesenhada
    const el = atual.el;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const [cima, baixo, esq, dir] = camada.sombras;
    const caixa = (n, x, y, w, h) => Object.assign(n.style, { left: `${x}px`, top: `${y}px`, width: `${Math.max(0, w)}px`, height: `${Math.max(0, h)}px` });

    if (!el) {
      // Sem alvo: escurece tudo e centraliza o balão
      caixa(cima, 0, 0, vw, vh); caixa(baixo, 0, 0, 0, 0); caixa(esq, 0, 0, 0, 0); caixa(dir, 0, 0, 0, 0);
      camada.anel.hidden = true; camada.tampa.hidden = true;
      camada.balao.classList.add('tour__balao--centro');
      Object.assign(camada.balao.style, { left: '', top: '' });
      return;
    }
    camada.balao.classList.remove('tour__balao--centro');
    const m = p.margem ?? 8;
    const r = el.getBoundingClientRect();
    const x1 = Math.max(4, r.left - m), y1 = Math.max(4, r.top - m);
    const x2 = Math.min(vw - 4, r.right + m), y2 = Math.min(vh - 4, r.bottom + m);
    caixa(cima, 0, 0, vw, y1);
    caixa(baixo, 0, y2, vw, vh - y2);
    caixa(esq, 0, y1, x1, y2 - y1);
    caixa(dir, x2, y1, vw - x2, y2 - y1);
    camada.anel.hidden = false;
    caixa(camada.anel, x1, y1, x2 - x1, y2 - y1);
    camada.tampa.hidden = !!(p.clique || p.livre);
    caixa(camada.tampa, x1, y1, x2 - x1, y2 - y1);

    // Balão: abaixo, acima, à direita ou à esquerda — onde couber
    const b = camada.balao;
    const bw = b.offsetWidth, bh = b.offsetHeight, gap = 14, borda = 12;
    const cabe = { baixo: vh - y2 - gap >= bh + borda, cima: y1 - gap >= bh + borda, dir: vw - x2 - gap >= bw + borda, esq: x1 - gap >= bw + borda };
    const ordem = p.lado ? [p.lado, 'baixo', 'cima', 'dir', 'esq'] : ['baixo', 'cima', 'dir', 'esq'];
    const lado = ordem.find(l => cabe[l]);
    let left, top;
    const centroX = (x1 + x2) / 2 - bw / 2, centroY = (y1 + y2) / 2 - bh / 2;
    if (lado === 'baixo') { top = y2 + gap; left = centroX; }
    else if (lado === 'cima') { top = y1 - gap - bh; left = centroX; }
    else if (lado === 'dir') { left = x2 + gap; top = centroY; }
    else if (lado === 'esq') { left = x1 - gap - bw; top = centroY; }
    else { // não cabe em lugar nenhum (alvo grande): encosta no canto com mais espaço
      left = (vw - bw) / 2;
      top = (vh - y2) > y1 ? vh - bh - borda : borda;
    }
    left = Math.min(Math.max(borda, left), vw - bw - borda);
    top = Math.min(Math.max(borda, top), vh - bh - borda);
    b.dataset.lado = lado || 'sobre';
    Object.assign(b.style, { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` });
  }

  /* =========================================================
     ANDAMENTO
     ========================================================= */
  async function iniciar(id, contexto = {}) {
    const t = TOURS[id];
    if (!t) return;
    if (atual) encerrar(false);
    const passos = (typeof t.passos === 'function' ? t.passos(contexto) : t.passos).filter(p => !p.se || p.se());
    if (!passos.length) return;
    montar();
    atual = { id, t, passos, i: 0, token: 0, el: null, contexto };
    document.body.classList.add('com-tutorial');
    await mostrar(0, 1);
  }

  async function mostrar(i, direcao) {
    if (!atual) return;
    if (i < 0) i = 0;
    if (i >= atual.passos.length) { encerrar(true); return; }
    const token = ++atual.token;
    atual.i = i;
    atual.esperando = false;
    desligarClique();
    const p = atual.passos[i];
    camada.raiz.hidden = true;

    if (p.ir) {
      const destino = typeof p.ir === 'function' ? p.ir() : p.ir;
      if (destino && location.hash !== destino) { atual.navegando = true; location.hash = destino; await espera(80); atual && (atual.navegando = false); }
    }
    let el = null;
    if (p.alvo) {
      el = await esperarAlvo(p.alvo, p.ir ? 4000 : 1500, token);
      if (!atual || atual.token !== token) return;
      if (!el) { await mostrar(i + direcao, direcao); return; }  // elemento não existe nesta tela: pula o passo
    }
    atual.el = el;
    desenharBalao(p);
    camada.raiz.hidden = false;
    camada.raiz.classList.toggle('tour--clique', !!p.clique);
    if (el) {
      const r = el.getBoundingClientRect();
      const fora = r.top < 70 || r.bottom > window.innerHeight - 70;
      if (fora) { el.scrollIntoView({ block: r.height > window.innerHeight * .6 ? 'start' : 'center', behavior: suave() }); await espera(suave() === 'smooth' ? 380 : 30); }
    }
    if (!atual || atual.token !== token) return;
    posicionar();
    requestAnimationFrame(posicionar);   // o balão já tem o tamanho final
    camada.balao.classList.remove('tour__balao--entrando');
    void camada.balao.offsetWidth;
    camada.balao.classList.add('tour__balao--entrando');
    if (p.clique && el) ligarClique(p, token);
    if (p.aoMostrar) try { p.aoMostrar(el); } catch (e) { console.error(e); }
    const foco = camada.balao.querySelector('[data-foco]') || camada.balao;
    foco.focus({ preventScroll: true });
  }

  function desenharBalao(p) {
    const b = camada.balao;
    const total = atual.passos.length;
    const numero = atual.passos.slice(0, atual.i + 1).filter(x => !x.semNumero).length;
    const contaveis = atual.passos.filter(x => !x.semNumero).length;
    b.querySelector('#tour-passo').textContent = p.semNumero || contaveis <= 1 ? (atual.t.titulo || '') : `${atual.t.titulo ? atual.t.titulo + ' · ' : ''}${numero} de ${contaveis}`;
    b.querySelector('#tour-titulo').innerHTML = p.titulo || '';
    b.querySelector('#tour-texto').innerHTML = typeof p.texto === 'function' ? p.texto() : (p.texto || '');
    b.classList.toggle('tour__balao--largo', !!p.largo);
    const dica = b.querySelector('.tour__dica-clique');
    dica.hidden = !p.clique;
    if (p.clique) dica.querySelector('span').textContent = p.dicaClique || 'Toque no item destacado para continuar.';

    const rodape = b.querySelector('.tour__rodape');
    if (p.botoes) {
      rodape.innerHTML = p.botoes.map((x, n) => `<button type="button" class="botao ${x.primario ? 'botao--primario' : x.fantasma ? 'botao--fantasma' : ''}" data-tour-botao="${n}" ${x.primario ? 'data-foco' : ''}>${x.rotulo}</button>`).join('');
    } else {
      const ultimo = atual.i === total - 1;
      rodape.innerHTML = `
        ${atual.i > 0 && !atual.passos[atual.i - 1].clique ? '<button type="button" class="botao botao--fantasma" data-tour="voltar">Voltar</button>' : '<span></span>'}
        ${p.clique ? '<button type="button" class="botao botao--fantasma" data-tour="fechar">Sair do tutorial</button>'
          : `<button type="button" class="botao botao--primario" data-tour="proximo" data-foco>${ultimo ? (p.rotuloFim || 'Concluir') : (p.rotuloProximo || 'Próximo')}</button>`}`;
    }
  }

  /* ---------- Passos em que a pessoa toca no elemento ---------- */
  function ligarClique(p, token) {
    const el = atual.el;
    const ouvinte = e => {
      if (!atual || atual.token !== token) return;
      const alvoAtual = atual.el && atual.el.isConnected ? atual.el : el;
      if (!(e.target === alvoAtual || alvoAtual.contains(e.target))) return;
      desligarClique();
      atual.esperando = true;
      camada.raiz.hidden = true;     // deixa a janela ou a página nova aparecer
      depoisDoClique(p, token);
    };
    document.addEventListener('click', ouvinte, true);
    atual.desligar = () => document.removeEventListener('click', ouvinte, true);
  }
  function desligarClique() { if (atual?.desligar) { atual.desligar(); atual.desligar = null; } }

  async function depoisDoClique(p, token) {
    await espera(350);
    // Enquanto uma janela (ex.: "Nova matéria") estiver aberta, o tutorial espera
    while (atual && atual.token === token && document.querySelector('dialog[open]')) await espera(200);
    if (!atual || atual.token !== token) return;
    await espera(300);
    if (p.concluido && !p.concluido()) { await mostrar(atual.i, 1); return; }   // cancelou: mostra o mesmo passo de novo
    await mostrar(atual.i + 1, 1);
  }

  /* ---------- Botões e teclado ---------- */
  function aoClicarCamada(e) {
    if (!atual) return;
    const acao = e.target.closest('[data-tour]')?.dataset.tour;
    const botao = e.target.closest('[data-tour-botao]');
    if (acao === 'fechar') encerrar(false);
    else if (acao === 'proximo') mostrar(atual.i + 1, 1);
    else if (acao === 'voltar') mostrar(atual.i - 1, -1);
    else if (botao) {
      const def = atual.passos[atual.i].botoes[+botao.dataset.tourBotao];
      const fn = def.acao;
      if (def.encerra !== false) encerrar(def.conclui !== false);
      if (fn) fn();
    } else if (e.target.closest('.tour__sombra, .tour__tampa') && !atual.passos[atual.i].clique) {
      // Toque fora: chama a atenção para o balão
      camada.balao.classList.remove('tour__balao--chamar');
      void camada.balao.offsetWidth;
      camada.balao.classList.add('tour__balao--chamar');
    }
  }

  function aoTeclar(e) {
    if (!atual || !camada || camada.raiz.hidden || atual.esperando) return;
    const p = atual.passos[atual.i];
    const noBalao = camada.balao.contains(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); encerrar(false); return; }
    if ((p.livre || p.clique) && !noBalao) return;   // está usando a área liberada da página
    if (!p.botoes && !p.clique && e.key === 'ArrowRight') { e.preventDefault(); mostrar(atual.i + 1, 1); }
    else if (!p.botoes && !p.clique && e.key === 'ArrowLeft' && atual.i > 0 && !atual.passos[atual.i - 1].clique) { e.preventDefault(); mostrar(atual.i - 1, -1); }
    e.stopPropagation();   // não aciona os atalhos da página (ex.: Espaço vira o cartão no estudo)
  }

  /** Termina o tutorial. concluido = chegou ao fim (ou a pessoa fechou: também não mostra de novo sozinho) */
  function encerrar(concluido) {
    if (!atual) return;
    const t = atual.t, id = atual.id;
    desligarClique();
    atual = null;
    if (camada) camada.raiz.hidden = true;
    document.body.classList.remove('com-tutorial');
    if (!t.missao) marcarVisto(id);
    if (concluido && t.depois) setTimeout(() => t.depois(), 50);
    else setTimeout(() => verificarPagina(), 400);
  }

  /* =========================================================
     DICAS AUTOMÁTICAS AO ABRIR UMA PÁGINA
     ========================================================= */
  let ultimaRota = null;
  /** Chamado pelo Rotas depois de desenhar cada página */
  function aoRenderizar(nome, params) {
    colocarBotaoAjuda(nome, params);
    const rota = `${nome}|${JSON.stringify(params || {})}`;
    const mudou = rota !== ultimaRota;
    ultimaRota = rota;
    if (atual) {
      // Saiu da página durante um tutorial de página (não uma missão): encerra
      if (mudou && !atual.t.missao && !atual.navegando && !atual.esperando && atual.t.pagina && atual.t.pagina !== nome) encerrar(false);
      return;
    }
    if (mudou) setTimeout(() => verificarPagina(), 450);
  }

  function verificarPagina() {
    if (!liberado || atual || !prefs()?.dicas) return;
    if (document.querySelector('dialog[open]') || document.querySelector('.acesso')) return;
    const { nome, id, params } = Rotas.rotaAtual();
    const tid = tourDaPagina(nome, { id, ...params });
    if (tid && TOURS[tid] && !jaViu(tid)) iniciar(tid);
  }

  /** Botão "?" no topo de cada página que tem tutorial */
  function colocarBotaoAjuda(nome, params) {
    const tid = tourDaPagina(nome, params);
    if (!tid || !TOURS[tid]) return;
    const area = document.querySelector('#conteudo .pagina');
    if (!area || area.querySelector('.botao-ajuda')) return;
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'botao botao--fantasma botao--icone botao-ajuda';
    botao.setAttribute('aria-label', 'Como usar esta página');
    botao.title = 'Como usar esta página';
    botao.innerHTML = Ui.icone('ajuda');
    botao.addEventListener('click', () => iniciar(tid));
    const ferramentas = area.querySelector('.estudo__ferramentas');
    const cab = area.querySelector('.pagina-cabecalho');
    if (ferramentas) { botao.classList.add('botao--pequeno'); ferramentas.appendChild(botao); }
    else if (cab) {
      let acoes = cab.querySelector('.pagina-cabecalho__acoes');
      if (!acoes) { acoes = document.createElement('div'); acoes.className = 'pagina-cabecalho__acoes'; cab.appendChild(acoes); }
      acoes.appendChild(botao);
    }
  }

  /* =========================================================
     PRIMEIRO ACESSO
     ========================================================= */
  /**
   * Chamado ao abrir o site. Espera a primeira sincronização (para saber se a conta
   * já tem cartões em outro aparelho) e decide:
   *   conta vazia → boas-vindas + dicas automáticas + primeiros passos
   *   conta com dados → só avisa que existem tutoriais (sem interromper)
   */
  async function aoAbrirApp() {
    if (!prefs()) {
      await Promise.race([Nuvem.primeiraSincronizacao(), espera(6000)]);
      if (!prefs()) {   // a nuvem pode ter trazido as preferências de outro aparelho
        const novo = !Estado.materias().length && !Estado.totalCartoes();
        gravar({ dicas: novo, primeirosPassos: novo, visto: {} });
        liberado = true;
        if (novo) { Rotas.recarregar(); setTimeout(() => iniciar('boas-vindas'), 300); return; }
        Util.aviso('Novidade: tutoriais interativos. Toque no botão ? no topo das páginas ou veja em Ajustes.', 'info', { rotulo: 'Ver agora', fn: () => iniciar('boas-vindas') });
        return;
      }
    }
    liberado = true;
    verificarPagina();
  }

  /* ---------- Ajustes ---------- */
  function ligarDicas(sim) { gravar({ dicas: !!sim }); }
  function recomecar() { gravar({ dicas: true, primeirosPassos: true, visto: {} }); }
  const emAndamento = () => !!atual;

  return {
    registrar, paginas, existe, iniciar, encerrar: () => encerrar(false), aoRenderizar, aoAbrirApp,
    prefs, gravar, jaViu, ligarDicas, recomecar, emAndamento,
  };
})();
