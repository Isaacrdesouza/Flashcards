/* =============================================================
   componentes.js — Pedaços de interface reutilizados pelas páginas
   Cada função devolve um texto HTML (ou abre um modal).
   ============================================================= */
'use strict';

const Ui = (() => {
  const { esc } = Util;

  /** Paleta de cores das matérias (todas legíveis sobre o fundo escuro) */
  const CORES = [
    { valor: '#5aa9ff', nome: 'Azul' },
    { valor: '#a78bfa', nome: 'Violeta' },
    { valor: '#4cc38a', nome: 'Verde' },
    { valor: '#f0b429', nome: 'Âmbar' },
    { valor: '#f2685f', nome: 'Coral' },
    { valor: '#f472b6', nome: 'Rosa' },
    { valor: '#22d3ee', nome: 'Ciano' },
    { valor: '#a3e635', nome: 'Lima' },
  ];

  /** Ícone da biblioteca SVG do index.html */
  const icone = (nome, classe = '') =>
    `<svg class="icone ${classe}" aria-hidden="true" focusable="false"><use href="#i-${nome}"></use></svg>`;

  /** Cabeçalho padrão de página. `titulo` e `acoes` são HTML. */
  function cabecalho({ titulo, subtitulo = '', acoes = '', voltar = '' }) {
    return `
      <header class="pagina-cabecalho">
        ${voltar ? `<a class="botao botao--fantasma botao--icone" href="${voltar}" aria-label="Voltar">${icone('voltar')}</a>` : ''}
        <div class="pagina-cabecalho__textos">
          <h1 class="pagina-titulo" tabindex="-1">${titulo}</h1>
          ${subtitulo ? `<p class="pagina-subtitulo">${subtitulo}</p>` : ''}
        </div>
        ${acoes ? `<div class="pagina-cabecalho__acoes">${acoes}</div>` : ''}
      </header>`;
  }

  /** Bloco de "nada por aqui ainda" com ação sugerida */
  function vazio({ icone: ic = 'cartoes', titulo, texto = '', acoes = '' }) {
    return `
      <div class="vazio">
        <div class="vazio__icone">${icone(ic)}</div>
        <h2 class="vazio__titulo">${titulo}</h2>
        ${texto ? `<p class="vazio__texto">${texto}</p>` : ''}
        ${acoes ? `<div class="vazio__acoes">${acoes}</div>` : ''}
      </div>`;
  }

  const pontoCor = cor => `<span class="ponto-cor" style="--cor:${esc(cor)}" aria-hidden="true"></span>`;

  const chipMateria = m =>
    `<span class="chip-materia">${pontoCor(m.cor)}<span>${esc(m.nome)}</span></span>`;

  /** Mini calendário de dias (S T Q Q S S D) com texto para leitor de tela */
  function diasMini(dias) {
    const nomes = Util.ORDEM_SEMANA.filter(x => dias.includes(x)).map(x => Util.DIAS_CURTOS[x]);
    return `
      <span class="dias-mini" aria-hidden="true">
        ${Util.ORDEM_SEMANA.map(x => `<span class="${dias.includes(x) ? 'ativo' : ''}">${Util.DIAS_CURTOS[x][0]}</span>`).join('')}
      </span>
      <span class="sr-only">${nomes.length ? 'Estuda: ' + nomes.join(', ') : 'Sem dias definidos'}</span>`;
  }

  /** Selo de situação do cartão (novo, para revisar, em X dias) */
  function seloCartao(c) {
    if (c.suspenso) return '<span class="selo selo--suspenso">Suspenso</span>';
    if (c.rep.estado === 'novo') return '<span class="selo selo--novo">Novo</span>';
    const h = Util.hoje();
    if (c.rep.vencimento <= h) {
      return c.rep.estado === 'aprendendo'
        ? '<span class="selo selo--aprendendo">Reaprender</span>'
        : '<span class="selo selo--vencido">Para revisar</span>';
    }
    return `<span class="selo">em ${Util.textoIntervalo(Util.diferencaDias(h, c.rep.vencimento))}</span>`;
  }

  /** Gera as <option> de um <select> */
  function opcoes(lista, selecionado, rotuloVazio = '') {
    return (rotuloVazio !== null && rotuloVazio !== '' ? `<option value="">${esc(rotuloVazio)}</option>` : '') +
      lista.map(i => `<option value="${esc(i.id)}" ${i.id === selecionado ? 'selected' : ''}>${esc(i.nome)}</option>`).join('');
  }

  /* ---------- Modais de formulário ---------- */

  /** Modal de criar/editar matéria. Retorna { nome, cor, dias } ou null. */
  async function modalMateria(m = null) {
    const corAtual = m ? m.cor : CORES[Estado.materias().length % CORES.length].valor;
    const dias = m ? m.dias : [];
    const corpo = `
      <label class="campo">
        <span class="campo__rotulo">Nome da matéria</span>
        <input type="text" name="nome" required maxlength="60" autocomplete="off" value="${esc(m ? m.nome : '')}">
      </label>
      <fieldset class="campo">
        <legend class="campo__rotulo">Cor</legend>
        <div class="seletor-cores">
          ${CORES.map(c => `
            <label class="cor-opcao">
              <input type="radio" name="cor" value="${c.valor}" ${c.valor === corAtual ? 'checked' : ''}>
              <span style="--cor:${c.valor}" aria-hidden="true"></span>
              <span class="sr-only">${c.nome}</span>
            </label>`).join('')}
        </div>
      </fieldset>
      <fieldset class="campo">
        <legend class="campo__rotulo">Dias de estudo no seu cronograma</legend>
        <div class="seletor-dias">
          ${Util.ORDEM_SEMANA.map(x => `
            <label class="dia-opcao" title="${Util.DIAS_LONGOS[x]}">
              <input type="checkbox" name="dias" value="${x}" ${dias.includes(x) ? 'checked' : ''} aria-label="${Util.DIAS_LONGOS[x]}">
              <span aria-hidden="true">${Util.DIAS_CURTOS[x]}</span>
            </label>`).join('')}
        </div>
        <span class="campo__ajuda">Nos dias marcados a matéria aparece em "Hoje" na tela inicial.</span>
      </fieldset>
      <label class="campo">
        <span class="campo__rotulo">Data da prova <span class="opcional">(opcional)</span></span>
        <input type="date" name="prova" value="${esc(m && m.prova ? m.prova : '')}">
        <span class="campo__ajuda">Até a prova, todos os cartões desta matéria são agendados para serem revistos antes do dia. Deixe vazio para não usar.</span>
      </label>`;
    const fd = await Util.abrirModal({ titulo: m ? 'Editar matéria' : 'Nova matéria', corpo, confirmar: m ? 'Salvar' : 'Criar matéria' });
    if (!fd) return null;
    return { nome: fd.get('nome').trim(), cor: fd.get('cor') || corAtual, dias: fd.getAll('dias').map(Number), prova: String(fd.get('prova') || '') || null };
  }

  /** Modal com um único campo de texto (nomes de assunto/grupo). Retorna texto ou null. */
  async function modalNome({ titulo, rotulo, valor = '', confirmar = 'Salvar', placeholder = '' }) {
    const fd = await Util.abrirModal({
      titulo, confirmar,
      corpo: `<label class="campo"><span class="campo__rotulo">${esc(rotulo)}</span>
        <input type="text" name="nome" required maxlength="80" autocomplete="off" value="${esc(valor)}" placeholder="${esc(placeholder)}"></label>`,
    });
    const nome = fd ? String(fd.get('nome')).trim() : '';
    return nome || null;
  }

  /** Nome configurado para o 3º nível (padrão "Frente"; pode ser "Aula", "Capítulo"…) */
  const nivel3 = () => Estado.config().nomeNivel3 || 'Assunto';
  /** O nome do 3º nível é masculino? ("Assunto", "Capítulo" → sim; "Aula" → não) */
  const masc3 = () => /o$/i.test(nivel3());
  /** Palavra concordando com o 3º nível: art3('um') → "um"/"uma"; também 'o', 'do', 'no', 'novo', 'nenhum', 'este', 'primeiro', 'dele' */
  const art3 = palavra => (({ um: ['um', 'uma'], o: ['o', 'a'], do: ['do', 'da'], no: ['no', 'na'], novo: ['novo', 'nova'], nenhum: ['nenhum', 'nenhuma'], este: ['este', 'esta'], primeiro: ['primeiro', 'primeira'], dele: ['dele', 'dela'] })[palavra] || [palavra, palavra])[masc3() ? 0 : 1];

  /** "Nova frente" / "Novo capítulo": palavras terminadas em "o" são tratadas como masculinas */
  const novoNivel3 = () => {
    const n = nivel3();
    return `${/o$/i.test(n) ? 'Novo' : 'Nova'} ${n.toLowerCase()}`;
  };

  /** Texto curto de um cartão para listas (sem marcas de formatação; lacunas como […]) */
  function resumoCartao(c, max = 110) {
    const base = c.tipo === 'lacuna' ? Util.lacunaResumo(c.frente) : c.frente;
    return Util.resumir(Util.semFormatacao(base), max);
  }
  function resumoVerso(c, max = 120) {
    return c.tipo === 'lacuna'
      ? Util.resumir(Util.palavrasOcultas(c.frente).join(' · '), max)
      : Util.resumir(Util.semFormatacao(c.verso), max);
  }

  /** Caminho de um cartão: "Matéria › Frente › Assunto" */
  function localCartao(c) {
    const m = Estado.materia(c.materiaId), a = Estado.assunto(c.assuntoId), g = c.grupoId ? Estado.grupo(c.grupoId) : null;
    return [m && m.nome, a && a.nome, g && g.nome].filter(Boolean).join(' › ');
  }

  /**
   * Painel "Cartões que você errou" (usado no Início e em Estatísticas).
   * periodo: 7 | 30 | 'tudo' · max: quantos mostrar · hrefPeriodo: link de cada botão de período
   * Suspensos aparecem na lista (com o selo), mas não entram no botão "Revisar".
   */
  function painelErrados({ periodo, max = 40, hrefPeriodo = null, verTodos = '', de = 'inicio' }) {
    const errados = Estado.cartoesErrados(periodo);
    const ativos = errados.filter(x => !x.cartao.suspenso).length;
    const texto = periodo === 'tudo' ? 'no histórico' : `nos últimos ${periodo} dias`;
    const PERIODOS = { 7: '7 dias', 30: '30 dias', tudo: 'Tudo' };
    return `
      <section class="painel painel-errados" aria-labelledby="t-errados">
        <div class="painel__cabecalho">
          <div>
            <h2 class="painel__titulo" id="t-errados">Cartões que você errou</h2>
            <p class="painel__nota">${errados.length
              ? `${Util.plural(errados.length, 'cartão', 'cartões')} com "Errei" ${texto} · os mais errados primeiro`
              : `Nenhum erro pendente ${texto}. Muito bem!`}</p>
          </div>
          ${errados.length ? (ativos
            ? `<a class="botao botao--primario" href="#/estudar?errados=${periodo}&livre=1&de=${de}" title="Responde só estes cartões, sem mudar a agenda">${icone('repetir')} Revisar estes cartões (${ativos})</a>`
            : '<span class="painel__nota">Todos estão suspensos: reative para revisar.</span>') : ''}
        </div>
        ${hrefPeriodo ? `
          <nav class="periodo periodo--compacto" aria-label="Período dos cartões errados">
            ${Object.entries(PERIODOS).map(([k, nome]) => `<a class="periodo__opcao" href="${hrefPeriodo(k)}" ${String(k) === String(periodo) ? 'aria-current="true"' : ''}>${nome}</a>`).join('')}
          </nav>` : ''}
        ${errados.length ? `
          <ul class="lista lista-errados" role="list">
            ${errados.slice(0, max).map(x => `
              <li class="linha-errado">
                <span class="linha-errado__erros" title="Vezes que errou">${x.erros}<span class="sr-only"> ${x.erros === 1 ? 'erro' : 'erros'}</span>×</span>
                <a class="linha-errado__conteudo" href="#/estudar?cartao=${x.cartao.id}&livre=1&de=${de}" title="Responder este cartão">
                  <span class="linha-errado__frente">${x.cartao.imagem ? icone('imagem', 'linha-cartao__img') : ''}${esc(resumoCartao(x.cartao, 100)) || '<em>(somente imagem)</em>'}</span>
                  <span class="linha-errado__local">${esc(localCartao(x.cartao))} · último erro ${esc(Util.formatarData(Util.dataISO(new Date(x.ultimoErro))))} · ${Math.round((1 - x.erros / x.respostas) * 100)}% de acerto</span>
                </a>
                <span class="linha-errado__acoes">
                  ${seloCartao(x.cartao)}
                  ${x.cartao.suspenso ? `<button type="button" class="botao botao--pequeno" data-reativar="${x.cartao.id}" title="Volta a aparecer no estudo">${icone('play')} Reativar</button>` : ''}
                  <a class="botao botao--fantasma botao--pequeno botao--icone" href="#/estudar?cartao=${x.cartao.id}&livre=1&de=${de}" aria-label="Responder este cartão" title="Responder">${icone('play')}</a>
                  <a class="botao botao--fantasma botao--pequeno botao--icone" href="#/cartao/${x.cartao.id}" aria-label="Editar este cartão" title="Editar">${icone('editar')}</a>
                </span>
              </li>`).join('')}
          </ul>
          ${errados.length > max ? `<p class="painel__nota painel__nota--rodape">Mostrando os ${max} mais errados de ${errados.length}. O botão "Revisar" inclui todos.${verTodos ? ` <a href="${verTodos}">Ver todos</a>` : ''}</p>` : ''}
          ${ativos < errados.length && ativos ? `<p class="painel__nota painel__nota--rodape">Cartões suspensos aparecem na lista, mas não entram na revisão.</p>` : ''}
          <p class="painel__nota painel__nota--rodape">Acertou um cartão depois de errar? Ele sai desta lista.</p>`
        : ''}
      </section>`;
  }

  /** Texto curto da prova: "Prova hoje", "Prova amanhã", "Prova em 12 dias" (ou '' sem prova futura) */
  function textoProva(m) {
    if (!m || !m.prova) return '';
    const dias = Util.diferencaDias(Util.hoje(), m.prova);
    if (dias < 0) return '';
    return dias === 0 ? 'Prova hoje' : dias === 1 ? 'Prova amanhã' : `Prova em ${dias} dias`;
  }
  const seloProva = m => {
    const t = textoProva(m);
    if (!t) return '';
    const dias = Util.diferencaDias(Util.hoje(), m.prova);
    return `<span class="selo selo--prova ${dias <= 7 ? 'selo--prova-perto' : ''}" title="${esc(Util.formatarData(m.prova, { weekday: 'long', day: 'numeric', month: 'long' }))}">${icone('calendario')} ${t}</span>`;
  };

  /** Aviso "foi para a lixeira" com botão Desfazer */
  function avisoLixeira(itemId, texto, depois = () => Rotas.recarregar()) {
    if (!itemId) return;
    Util.aviso(`${texto} · enviado para a lixeira`, 'info', {
      rotulo: 'Desfazer',
      fn: () => {
        const r = Estado.restaurar(itemId);
        Util.aviso(r.ok ? 'Restaurado' : r.motivo, r.ok ? 'sucesso' : 'erro');
        depois();
      },
    });
  }

  /** Liga o botão "Reativar" do painel de errados (a página redesenha depois) */
  function ligarPainelErrados(raiz) {
    raiz.addEventListener('click', e => {
      const b = e.target.closest('[data-reativar]');
      if (!b) return;
      Estado.suspenderCartoes([b.dataset.reativar], false);
      Util.aviso('Cartão reativado: volta a aparecer no estudo', 'sucesso');
      Rotas.recarregar();
    });
  }

  /* ---------- Barra de formatação (negrito, itálico, listas, cores) ---------- */
  const BOTOES_FORMATO = [
    { fmt: 'negrito', rotulo: 'Negrito (Ctrl + B)', html: '<strong>N</strong>' },
    { fmt: 'italico', rotulo: 'Itálico (Ctrl + I)', html: '<em>I</em>' },
    { fmt: 'sublinhado', rotulo: 'Sublinhado (Ctrl + U)', html: '<u>S</u>' },
    { fmt: 'marca', rotulo: 'Marca-texto', html: '<mark class="marca-texto">M</mark>' },
    { fmt: 'lista', rotulo: 'Lista com marcadores', html: '•≡' },
    { fmt: 'numerada', rotulo: 'Lista numerada', html: '1.≡' },
    ...Util.CORES_TEXTO.map(cor => ({ fmt: 'cor:' + cor, rotulo: `Texto ${cor}`, html: `<span class="amostra-cor cor-texto--${cor}">A</span>` })),
    { fmt: 'limpar', rotulo: 'Limpar formatação do trecho', html: '⌫' },
  ];
  const barraFormatacao = alvo => `
    <div class="barra-formato" role="toolbar" aria-label="Formatação do texto" data-alvo="${esc(alvo)}">
      ${BOTOES_FORMATO.map(b => `<button type="button" class="barra-formato__botao" data-fmt="${b.fmt}" title="${esc(b.rotulo)}" aria-label="${esc(b.rotulo)}">${b.html}</button>`).join('')}
    </div>`;

  /** Aplica um formato ao trecho selecionado de um <textarea> */
  function aplicarFormato(campo, fmt) {
    const t = campo.value;
    let ini = campo.selectionStart, fim = campo.selectionEnd;
    const sel = t.slice(ini, fim);
    const marcas = { negrito: ['**', '**'], italico: ['*', '*'], sublinhado: ['__', '__'], marca: ['==', '=='] };
    let novo, cursorIni, cursorFim;
    if (marcas[fmt] || fmt.startsWith('cor:')) {
      const [a, b] = marcas[fmt] || [`[${fmt.slice(4)}]`, `[/${fmt.slice(4)}]`];
      const texto = sel || 'texto';
      novo = a + texto + b;
      cursorIni = ini + a.length; cursorFim = cursorIni + texto.length;
    } else if (fmt === 'lista' || fmt === 'numerada') {
      // Aplica em todas as linhas tocadas pela seleção
      ini = t.lastIndexOf('\n', ini - 1) + 1;
      const proxima = t.indexOf('\n', fim);
      fim = proxima === -1 ? t.length : proxima;
      novo = t.slice(ini, fim).split('\n').map((l, i) => {
        const limpa = l.replace(/^\s*([-•]|\d+[.)])\s+/, '');
        return (fmt === 'lista' ? '- ' : `${i + 1}. `) + limpa;
      }).join('\n');
      cursorIni = ini; cursorFim = ini + novo.length;
    } else if (fmt === 'limpar') {
      novo = Util.semFormatacao(sel);
      cursorIni = ini; cursorFim = ini + novo.length;
    } else return;
    campo.focus();
    campo.setSelectionRange(ini, fim);
    // execCommand mantém o "desfazer" (Ctrl + Z) do navegador; se não existir, troca direto
    if (!document.execCommand || !document.execCommand('insertText', false, novo)) {
      campo.value = t.slice(0, ini) + novo + t.slice(fim);
    }
    campo.setSelectionRange(cursorIni, cursorFim);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /** Liga as barras de formatação e os atalhos Ctrl+B/I/U dentro de um elemento */
  function ligarFormatacao(raiz) {
    // Prévia logo abaixo do campo: aparece só quando o texto tem alguma formatação
    raiz.querySelectorAll('.barra-formato').forEach(barra => {
      const campo = raiz.querySelector('#' + barra.dataset.alvo);
      if (!campo) return;
      const previa = document.createElement('div');
      previa.className = 'previa-formato';
      previa.setAttribute('aria-live', 'polite');
      campo.insertAdjacentElement('afterend', previa);
      const atualizar = () => {
        const tem = Util.semFormatacao(campo.value) !== campo.value;
        previa.hidden = !tem;
        if (tem) previa.innerHTML = `<span class="previa-formato__rotulo">Como vai aparecer:</span>${Util.formatar(campo.value)}`;
      };
      campo.addEventListener('input', atualizar);
      atualizar();
    });
    raiz.addEventListener('pointerdown', e => { if (e.target.closest('.barra-formato__botao')) e.preventDefault(); });
    raiz.addEventListener('click', e => {
      const b = e.target.closest('.barra-formato__botao');
      if (!b) return;
      const campo = raiz.querySelector('#' + b.closest('.barra-formato').dataset.alvo);
      if (campo) aplicarFormato(campo, b.dataset.fmt);
    });
    raiz.addEventListener('keydown', e => {
      const campo = e.target;
      if (!(e.ctrlKey || e.metaKey) || campo.tagName !== 'TEXTAREA' || !raiz.querySelector(`.barra-formato[data-alvo="${campo.id}"]`)) return;
      const fmt = { b: 'negrito', i: 'italico', u: 'sublinhado' }[e.key.toLowerCase()];
      if (fmt) { e.preventDefault(); aplicarFormato(campo, fmt); }
    });
  }

  /** Modal "Mover para…": escolhe a frente de destino. Retorna o id da frente ou null. */
  async function modalMover(qtd, origem = {}) {
    const materias = Estado.materias();
    const n3 = nivel3();
    const fd = await Util.abrirModal({
      titulo: `Mover ${Util.plural(qtd, 'cartão', 'cartões')}`,
      confirmar: 'Mover',
      corpo: `
        <label class="campo"><span class="campo__rotulo">Matéria</span>
          <select name="materia" id="mv-materia">${opcoes(materias, origem.materiaId || materias[0]?.id)}</select></label>
        <label class="campo"><span class="campo__rotulo">Frente</span>
          <select name="assunto" id="mv-assunto"></select></label>
        <label class="campo"><span class="campo__rotulo">${esc(n3)}</span>
          <select name="grupo" id="mv-grupo" required></select>
          <span class="campo__ajuda" id="mv-ajuda" hidden>Esta frente ainda não tem ${esc(n3.toLowerCase())}. Crie ${art3('um')} na página da frente.</span></label>`,
      aoMontar(dlg) {
        const sm = dlg.querySelector('#mv-materia'), sa = dlg.querySelector('#mv-assunto'), sg = dlg.querySelector('#mv-grupo');
        const preencherFrentes = () => {
          const gs = sa.value ? Estado.gruposDe(sa.value) : [];
          sg.innerHTML = gs.length ? opcoes(gs, origem.grupoId) : '<option value="">—</option>';
          dlg.querySelector('#mv-ajuda').hidden = gs.length > 0;
        };
        const preencherAssuntos = () => {
          const as = Estado.assuntosDe(sm.value);
          sa.innerHTML = as.length ? opcoes(as, origem.assuntoId) : '<option value="">— sem frentes —</option>';
          preencherFrentes();
        };
        sm.addEventListener('change', preencherAssuntos);
        sa.addEventListener('change', preencherFrentes);
        preencherAssuntos();
      },
    });
    return fd && fd.get('grupo') ? String(fd.get('grupo')) : null;
  }

  /* ---------- Tema (escuro, claro ou igual ao sistema) ---------- */
  const TEMAS = {
    escuro: { nome: 'Escuro', icone: 'lua' },
    claro: { nome: 'Claro', icone: 'sol' },
    sistema: { nome: 'Automático', icone: 'config', nota: 'Segue o tema do aparelho' },
  };
  const mediaClaro = window.matchMedia('(prefers-color-scheme: light)');
  let temaPreferido = 'escuro';

  /** Aplica o tema na página e guarda uma cópia para o próximo carregamento (sem "piscar") */
  function aplicarTema(preferencia) {
    temaPreferido = TEMAS[preferencia] ? preferencia : 'escuro';
    const efetivo = temaPreferido === 'sistema' ? (mediaClaro.matches ? 'claro' : 'escuro') : temaPreferido;
    document.documentElement.setAttribute('data-tema', efetivo);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', efetivo === 'claro' ? '#f4f5f8' : '#0f1115');
    try { localStorage.setItem('flashcards-tema', temaPreferido); } catch (e) { /* navegador sem localStorage */ }
  }
  // No modo automático, acompanha a troca de tema do aparelho em tempo real
  mediaClaro.addEventListener?.('change', () => { if (temaPreferido === 'sistema') aplicarTema('sistema'); });

  /** Tipos de cartão (lista exibida ao criar um cartão) */
  const TIPOS_CARTAO = {
    basico: { nome: 'Flashcard (Padrão)', icone: 'cartoes', descricao: 'Pergunta na frente e resposta no verso.' },
    lacuna: { nome: 'Ocultação de palavras', icone: 'texto', descricao: 'Escreva uma frase e esconda a palavra que deve ser lembrada.' },
    imagem: { nome: 'Cartão de imagem', icone: 'imagem', descricao: 'Esconda partes de uma imagem e revele cada uma durante o estudo.' },
  };

  /** Ícone de pasta na cor da matéria */
  const pasta = (cor, classe = '') =>
    `<span class="pasta-icone ${classe}" style="--cor:${esc(cor)}" aria-hidden="true">${icone('pasta')}</span>`;

  /**
   * Caminho de pastas clicável: Matérias › Matéria › Assunto › Frente.
   * itens: [{ nome, href }] — o último é a pasta atual (sem link).
   */
  function trilha(itens) {
    return `
      <nav class="trilha" aria-label="Caminho das pastas">
        <ol>
          ${itens.map((it, i) => {
            const ultimo = i === itens.length - 1;
            return `<li>${ultimo
              ? `<span aria-current="page">${esc(it.nome)}</span>`
              : `<a href="${it.href}">${esc(it.nome)}</a>`}</li>`;
          }).join('')}
        </ol>
      </nav>`;
  }

  /**
   * Gráfico de barras verticais simples (uma única série).
   * dados: [{ rotulo, valor, destaque }] · Inclui tabela alternativa acessível.
   */
  function graficoBarras(dados, { titulo, unidade = 'revisões', altura = 160 }) {
    const maximo = Math.max(1, ...dados.map(x => x.valor));
    const total = dados.reduce((s, x) => s + x.valor, 0);
    return `
      <figure class="grafico" style="--altura:${altura}px">
        <figcaption class="sr-only">${esc(titulo)} — total de ${total} ${unidade}</figcaption>
        <ul class="grafico__barras">
          ${dados.map(x => `
            <li tabindex="0" aria-label="${esc(x.rotulo)}: ${x.valor} ${unidade}">
              <span class="grafico__dica" aria-hidden="true">${esc(x.rotulo)} · ${x.valor}</span>
              <span class="grafico__barra ${x.valor === 0 ? 'grafico__barra--zero' : ''} ${x.destaque ? 'grafico__barra--hoje' : ''}"
                    style="height:${x.valor === 0 ? 2 : Math.max(4, (x.valor / maximo) * 100)}${x.valor === 0 ? 'px' : '%'}"></span>
            </li>`).join('')}
        </ul>
        <div class="grafico__eixo" aria-hidden="true"><span>${esc(dados[0]?.rotulo || '')}</span><span>${esc(dados[dados.length - 1]?.rotulo || '')}</span></div>
        <details>
          <summary>Ver como tabela</summary>
          <table class="tabela"><thead><tr><th>Dia</th><th class="num">${esc(unidade)}</th></tr></thead>
            <tbody>${dados.map(x => `<tr><td>${esc(x.rotulo)}</td><td class="num">${x.valor}</td></tr>`).join('')}</tbody>
          </table>
        </details>
      </figure>`;
  }

  return {
    CORES, TIPOS_CARTAO, TEMAS, aplicarTema, icone, cabecalho,
    resumoCartao, resumoVerso, localCartao, painelErrados, ligarPainelErrados, avisoLixeira, textoProva, seloProva, barraFormatacao, aplicarFormato, ligarFormatacao, modalMover, vazio, pontoCor, chipMateria, diasMini, seloCartao, opcoes,
    modalMateria, modalNome, nivel3, novoNivel3, art3, pasta, trilha, graficoBarras,
  };
})();
