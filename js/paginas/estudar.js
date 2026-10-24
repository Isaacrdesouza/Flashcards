/* =============================================================
   paginas/estudar.js — Sessão de estudo com flash cards animados

   Endereços:
     #/estudar?escopo=hoje            → matérias do cronograma de hoje
     #/estudar?escopo=tudo            → todas as matérias
     #/estudar?materia=ID&assunto=ID&grupo=ID
     #/estudar?plano=AAAA-MM-DD       → assuntos do plano da semana
     #/estudar?errados=30             → cartões respondidos errado no período (7, 30 ou tudo)
     #/estudar?cartao=ID              → um cartão específico (ex.: tocado na lista de errados)
     &de=inicio|estatisticas          → para onde "Encerrar" volta
     &livre=1  → revisão livre: todos os cartões, sem mexer na agenda

   Controles: tocar/Espaço vira · 1–4 responde · deslizar ← errei / → bom
              Z volta ao cartão anterior (desfaz a resposta) · E edita o cartão
   Cartões suspensos nunca entram na sessão.
   ============================================================= */
'use strict';

Rotas.registrar('estudar', {
  titulo: 'Estudar',

  render(el, params) {
    const { esc } = Util;
    document.body.classList.add('modo-estudo');

    const livre = params.livre === '1';
    const hojeIso = Util.hoje();

    /* ----- 1. Descobre o que estudar (filtro) ----- */
    let filtro = {};
    let titulo = 'Estudo';
    let voltar = '#/inicio';
    if (params.escopo === 'hoje') {
      const dia = Util.diaSemana(hojeIso);
      filtro.materiaIds = Estado.materias().filter(m => m.dias.includes(dia)).map(m => m.id);
      titulo = 'Matérias de hoje';
    } else if (params.escopo === 'tudo') {
      titulo = 'Todas as matérias';
    } else if (params.plano) {
      filtro.itensPlano = Estado.plano(params.plano);
      titulo = 'Plano da semana';
    } else if (params.errados) {
      filtro.ids = Estado.cartoesErrados(params.errados).map(x => x.cartao.id);
      titulo = params.errados === 'tudo' ? 'Cartões que você errou' : `Errados nos últimos ${params.errados} dias`;
      voltar = '#/estatisticas';
    } else if (params.cartao) {
      filtro.ids = [params.cartao];
      titulo = 'Revisar cartão';
    } else if (params.materia) {
      const m = Estado.materia(params.materia);
      const a = params.assunto ? Estado.assunto(params.assunto) : null;
      const g = params.grupo ? Estado.grupo(params.grupo) : null;
      filtro.materiaId = params.materia;
      if (a) filtro.assuntoId = a.id;
      if (g) filtro.grupoId = g.id;
      titulo = [m && m.nome, a && a.nome, g && g.nome].filter(Boolean).join(' › ') || 'Estudo';
      voltar = `#/materia/${params.materia}${a ? `?assunto=${a.id}${g ? `&grupo=${g.id}` : ''}` : ''}`;
    }
    if (livre) titulo = `Revisão livre · ${titulo}`;
    const qsLivre = location.hash.split('?')[1]?.replace(/&?livre=1/, '') || '';

    /* ----- 2. Monta a fila de cartões ----- */
    // Suspensos ficam de fora, exceto quando o cartão foi escolhido diretamente
    const lista = Estado.cartoes(filtro).filter(c => params.cartao || Estado.ativo(c));
    if (params.de === 'inicio') voltar = '#/inicio';
    if (params.de === 'estatisticas') voltar = '#/estatisticas';
    let fila;
    if (livre) {
      fila = Util.embaralhar(lista).map(c => c.id);
    } else {
      const revisar = lista.filter(c => Estado.estaVencido(c, hojeIso))
        .sort((a, b) => a.rep.vencimento.localeCompare(b.rep.vencimento));
      const novos = lista.filter(c => c.rep.estado === 'novo')
        .sort((a, b) => a.criadoEm - b.criadoEm)
        .slice(0, Estado.novosRestantesHoje());
      // Revisões primeiro, depois os novos (como no Anki)
      fila = [...revisar, ...novos].map(c => c.id);
    }
    const totalInicial = fila.length;
    const sessao = { respondidas: 0, acertos: 0, inicio: Date.now(), concluidos: new Set() };
    // Pilha para "voltar ao cartão anterior": cada passo guarda como tudo estava antes
    const passos = [];
    const meta = Estado.config().metaDiaria || 0;
    let virado = false;
    let ocupado = false; // evita respostas duplas durante a animação

    const animacoesAtivas = () =>
      Estado.config().animacoes && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ----- 3. Estrutura fixa da tela ----- */
    el.innerHTML = `
      <div class="estudo">
        <header class="estudo__topo">
          <a class="botao botao--fantasma" href="${voltar}">${Ui.icone('fechar')} <span class="estudo__sair">Encerrar</span></a>
          <div class="estudo__info">
            <h1 class="estudo__titulo" tabindex="-1">${esc(titulo)}</h1>
            <div class="progresso" role="progressbar" aria-label="Progresso da sessão" aria-valuemin="0" aria-valuemax="100" id="progresso">
              <div class="progresso__barra" id="progresso-barra" style="width:0%"></div>
            </div>
          </div>
          <div class="estudo__contadores" id="contadores" aria-live="off"></div>
        </header>
        <div class="estudo__ferramentas" id="ferramentas">
          <button type="button" class="botao botao--pequeno botao--fantasma" data-ferramenta="anterior" disabled title="Voltar ao cartão anterior (Z)">${Ui.icone('voltar')}<span>Anterior</span></button>
          <span class="estudo__meta" id="meta-estudo"></span>
          <button type="button" class="botao botao--pequeno botao--fantasma" data-ferramenta="editar" title="Editar este cartão (E)">${Ui.icone('editar')}<span>Editar</span></button>
          <button type="button" class="botao botao--pequeno botao--fantasma" data-ferramenta="suspender" title="Suspender: tira o cartão do estudo sem apagar">${Ui.icone('fechar')}<span>Suspender</span></button>
        </div>
        <div class="estudo__palco" id="palco-estudo"></div>
        <div class="estudo__acoes" id="acoes-estudo"></div>
        <p class="estudo__atalhos" aria-hidden="true">Espaço: virar · 1 a 4: responder · Z: anterior · E: editar · deslize ← errei / → bom</p>
      </div>`;

    const palco = el.querySelector('#palco-estudo');
    const acoes = el.querySelector('#acoes-estudo');

    /* ----- Contadores (novos · reaprender · revisar) e progresso ----- */
    function atualizarTopo() {
      const unicos = [...new Set(fila)].map(id => Estado.cartao(id)).filter(Boolean);
      const n = { novo: 0, aprendendo: 0, revisao: 0 };
      unicos.forEach(c => { n[c.rep.estado]++; });
      el.querySelector('#contadores').innerHTML = livre
        ? `<span class="cont" title="Restantes">${unicos.length}<span class="sr-only"> restantes</span></span>`
        : `<span class="cont cont--novo" title="Novos">${n.novo}<span class="sr-only"> novos</span></span>
           <span class="cont cont--aprendendo" title="Reaprender">${n.aprendendo}<span class="sr-only"> para reaprender</span></span>
           <span class="cont cont--revisar" title="Revisar">${n.revisao}<span class="sr-only"> para revisar</span></span>`;
      const pct = totalInicial ? Math.round(sessao.concluidos.size / totalInicial * 100) : 100;
      el.querySelector('#progresso-barra').style.width = pct + '%';
      el.querySelector('#progresso').setAttribute('aria-valuenow', pct);
      el.querySelector('[data-ferramenta="anterior"]').disabled = !passos.length;
      // Meta diária (definida em Ajustes)
      const feitas = Estado.revisoesHoje();
      el.querySelector('#meta-estudo').innerHTML = meta
        ? `<span class="${feitas >= meta ? 'estudo__meta--batida' : ''}">${feitas >= meta ? Ui.icone('check') : ''}Meta: ${Math.min(feitas, meta)}/${meta}</span>`
        : '';
    }

    /* ----- Imagem com áreas ocultas (frente: escondidas · verso: reveladas) ----- */
    function htmlImagem(c, revelado) {
      if (!c.imagem) return '';
      const rotulos = c.imagem.sobreposicoes.map((s, i) => {
        const estilo = `left:${s.x}%;top:${s.y}%;width:${s.l}%;height:${s.a}%`;
        const classe = `rotulo ${s.texto ? '' : 'rotulo--mascara'}`;
        return revelado
          ? `<span class="${classe} revelado" style="${estilo}"><span class="rotulo__texto">${esc(s.texto)}</span></span>`
          : `<button type="button" class="${classe}" style="${estilo}" data-rotulo aria-pressed="false"
               aria-label="${s.texto ? `Revelar texto ${i + 1}` : `Mostrar área escondida ${i + 1}`}">
               <span class="rotulo__oculto" aria-hidden="true">?</span>
               <span class="rotulo__texto">${esc(s.texto)}</span>
             </button>`;
      }).join('');
      return `
        <figure class="figura-rotulos">
          <img data-imagem="${c.imagem.id}" alt="${esc(c.imagem.alt)}" draggable="false">
          ${rotulos}
        </figure>
        ${!revelado && c.imagem.sobreposicoes.length > 1 ? '<button type="button" class="botao botao--pequeno botao--fantasma revelar-todos" data-revelar-todos>Revelar todas</button>' : ''}`;
    }

    /* ----- Mostra o cartão atual ----- */
    function mostrarCartao(entrada = true) {
      el.querySelectorAll('[data-ferramenta="editar"], [data-ferramenta="suspender"]').forEach(b => { b.hidden = false; });
      el.querySelector('.estudo__atalhos').hidden = false;
      // Pula cartões excluídos durante a sessão
      while (fila.length && !Estado.cartao(fila[0])) fila.shift();
      atualizarTopo();
      if (!fila.length) return terminar();

      const c = Estado.cartao(fila[0]);
      const m = Estado.materia(c.materiaId);
      const a = Estado.assunto(c.assuntoId);
      const g = c.grupoId ? Estado.grupo(c.grupoId) : null;
      virado = false;

      const meta = `
        <div class="face__meta">
          ${m ? Ui.chipMateria(m) : ''}
          <span class="face__local">${esc(a ? a.nome : '')}${g ? ` › ${esc(g.nome)}` : ''}</span>
          ${!livre ? Ui.seloCartao(c) : ''}
        </div>`;

      const lacuna = c.tipo === 'lacuna';
      // Frente: pergunta, ou frase com as palavras escondidas
      const corpoFrente = lacuna
        ? `<div class="face__texto face__texto--lacuna">${Util.lacunaParaHtml(c.frente, 'oculto')}</div>`
        : (c.frente ? `<div class="face__texto">${Util.formatar(c.frente)}</div>` : '');
      // Verso: frase completa com a palavra destacada (+ observação), ou pergunta e resposta
      const corpoVerso = lacuna
        ? `<div class="face__texto face__texto--lacuna">${Util.lacunaParaHtml(c.frente, 'revelado')}</div>
           ${c.verso ? `<hr class="face__divisor"><div class="face__pergunta">${Util.formatar(c.verso)}</div>` : ''}`
        : `${c.frente ? `<div class="face__pergunta">${Util.formatar(c.frente)}</div><hr class="face__divisor">` : ''}
           ${c.verso ? `<div class="face__texto">${Util.formatar(c.verso)}</div>` : ''}
           ${c.imagemVerso ? `<figure class="figura-resposta"><img data-imagem-verso="${esc(c.imagemVerso.id)}" alt="${esc(c.imagemVerso.alt || '')}" draggable="false"></figure>` : ''}`;

      palco.innerHTML = `
        <div class="cena ${entrada && animacoesAtivas() ? 'cena--entrando' : ''}" id="cena">
          <div class="cartao-estudo" id="cartao-estudo">
            <section class="face face--frente" aria-label="Pergunta" id="face-frente">
              ${meta}
              <div class="face__corpo">
                ${corpoFrente}
                ${htmlImagem(c, false)}
              </div>
              <p class="face__dica" aria-hidden="true">Toque para virar</p>
            </section>
            <section class="face face--verso" aria-label="Resposta" id="face-verso" tabindex="-1" inert>
              ${meta}
              <div class="face__corpo">
                ${corpoVerso}
                ${htmlImagem(c, true)}
              </div>
            </section>
          </div>
          <div class="cena__selo cena__selo--esquerda" aria-hidden="true">Errei</div>
          <div class="cena__selo cena__selo--direita" aria-hidden="true">Bom</div>
        </div>`;

      // Carrega a imagem anexada à resposta
      if (c.imagemVerso) {
        Banco.lerImagem(c.imagemVerso.id).then(src => {
          const img = palco.querySelector('img[data-imagem-verso]');
          if (img && src) img.src = src;
        });
      }
      // Carrega a imagem (a mesma nas duas faces)
      if (c.imagem) {
        Banco.lerImagem(c.imagem.id).then(src => {
          palco.querySelectorAll('img[data-imagem]').forEach(img => { if (src) img.src = src; });
        });
      }

      desenharBotoesFrente();
      configurarGestos();
      // Mantém o foco no botão principal: Espaço/Enter viram o cartão e o leitor de tela acompanha
      acoes.querySelector('[data-acao="virar"]').focus({ preventScroll: true });
    }

    function desenharBotoesFrente() {
      acoes.innerHTML = `<button class="botao botao--primario botao--grande botao--bloco" data-acao="virar">Mostrar resposta <kbd>Espaço</kbd></button>`;
    }

    function desenharBotoesResposta() {
      const c = Estado.cartao(fila[0]);
      if (livre) {
        acoes.innerHTML = `
          <div class="respostas respostas--duas">
            <button class="resposta resposta--errei" data-resposta="1"><span class="resposta__rotulo">Errei</span><span class="resposta__tempo">repetir</span></button>
            <button class="resposta resposta--bom" data-resposta="3"><span class="resposta__rotulo">Acertei</span><span class="resposta__tempo">próximo</span></button>
          </div>`;
        return;
      }
      const prev = Repeticao.previsoes(c.rep);
      acoes.innerHTML = `
        <div class="respostas">
          ${Repeticao.RESPOSTAS.map(r => `
            <button class="resposta resposta--${r.classe}" data-resposta="${r.valor}" aria-label="${r.rotulo}, próxima revisão: ${prev[r.valor]}">
              <span class="resposta__tempo" aria-hidden="true">${prev[r.valor]}</span>
              <span class="resposta__rotulo" aria-hidden="true">${r.rotulo}</span>
              <kbd aria-hidden="true">${r.valor}</kbd>
            </button>`).join('')}
        </div>`;
    }

    /* ----- Virar o cartão ----- */
    function virar() {
      if (virado || !fila.length) return;
      virado = true;
      el.querySelector('#cartao-estudo').classList.add('virado');
      el.querySelector('#face-frente').setAttribute('inert', '');
      const verso = el.querySelector('#face-verso');
      verso.removeAttribute('inert');
      desenharBotoesResposta();
      verso.focus({ preventScroll: true });
    }

    /* ----- Responder ----- */
    function responder(valor) {
      if (!virado || ocupado || !fila.length) return;
      ocupado = true;
      guardarPasso('resposta', fila[0], valor);
      const id = fila.shift();

      if (!livre) Estado.registrarResposta(id, valor);
      // Na revisão livre, acertar marca o cartão como corrigido (sai da lista de errados)
      else if (valor > 1) Estado.marcarCorrigido(id);
      if (livre) Estado.registrarLivre(); // conta na meta se a opção estiver ligada
      sessao.respondidas++;
      if (valor > 1) { sessao.acertos++; sessao.concluidos.add(id); }
      // Errou: o cartão volta para o fim da fila desta sessão
      if (valor === 1) fila.push(id);

      const cena = el.querySelector('#cena');
      const direcao = valor === 1 ? 'esquerda' : valor === 4 ? 'cima' : 'direita';
      const atraso = animacoesAtivas() ? 280 : 0;
      cena.classList.remove('cena--entrando');
      cena.style.transform = '';
      cena.classList.add(`cena--saindo-${direcao}`);
      setTimeout(() => { ocupado = false; mostrarCartao(); }, atraso);
    }

    /* ----- Voltar ao cartão anterior (desfaz a última resposta ou suspensão) ----- */
    function guardarPasso(tipo, id, valor) {
      const c = Estado.cartao(id);
      passos.push({
        tipo, id, valor,
        rep: { ...c.rep },
        corrigidoEm: c.corrigidoEm || null,
        fila: [...fila],
        respondidas: sessao.respondidas, acertos: sessao.acertos,
        concluidos: new Set(sessao.concluidos),
      });
      if (passos.length > 50) passos.shift();
    }

    function voltarAnterior() {
      const p = passos.pop();
      if (!p || ocupado) return;
      if (p.tipo === 'resposta' && !livre) Estado.desfazerResposta(p.id, p.rep);
      if (p.tipo === 'resposta' && livre) { Estado.marcarCorrigido(p.id, p.corrigidoEm); Estado.desfazerLivre(); }
      if (p.tipo === 'suspender') Estado.suspenderCartoes([p.id], false);
      fila = p.fila;
      sessao.respondidas = p.respondidas; sessao.acertos = p.acertos; sessao.concluidos = p.concluidos;
      Util.aviso(p.tipo === 'suspender' ? 'Suspensão desfeita' : 'Voltou ao cartão anterior');
      el.querySelector('.estudo__atalhos').hidden = false;
      mostrarCartao();
    }

    /* ----- Suspender o cartão atual (sai desta e das próximas sessões) ----- */
    function suspenderAtual() {
      if (!fila.length || ocupado) return;
      const id = fila[0];
      guardarPasso('suspender', id);
      Estado.suspenderCartoes([id], true);
      fila = fila.filter(x => x !== id);
      Util.aviso('Cartão suspenso. Use "Anterior" para desfazer ou reative na lista de cartões.');
      mostrarCartao();
    }

    /* ----- Editar o cartão atual sem sair do estudo ----- */
    async function editarAtual() {
      if (!fila.length || ocupado) return;
      const c = Estado.cartao(fila[0]);
      const estavaVirado = virado;
      const campos = {
        basico: [['frente', 'Frente (pergunta)'], ['verso', 'Verso (resposta)']],
        lacuna: [['frente', 'Frase (palavra escondida entre {{ e }})'], ['verso', 'Observação no verso']],
        imagem: [['frente', 'Instrução na frente'], ['verso', 'Observação no verso']],
      }[c.tipo === 'lacuna' ? 'lacuna' : (c.tipo === 'imagem' || c.imagem) ? 'imagem' : 'basico'];
      const fd = await Util.abrirModal({
        titulo: 'Editar cartão',
        confirmar: 'Salvar',
        corpo: `
          ${campos.map(([nome, rotulo]) => `
            <div class="campo">
              <label class="campo__rotulo" for="ed-${nome}">${esc(rotulo)}</label>
              ${Ui.barraFormatacao('ed-' + nome)}
              <textarea name="${nome}" id="ed-${nome}" rows="4">${esc(c[nome])}</textarea>
            </div>`).join('')}
          ${c.imagemVerso ? `<p class="campo__ajuda">Para trocar a imagem da resposta, use o <a href="#/cartao/${c.id}">editor completo</a> (encerra a sessão).</p>` : ''}
          ${c.imagem ? `<p class="campo__ajuda">Para mudar a imagem ou as áreas ocultas, use o <a href="#/cartao/${c.id}">editor completo</a> (encerra a sessão).</p>` : ''}`,
        aoMontar: dlg => Ui.ligarFormatacao(dlg),
      });
      if (!fd) return;
      const frente = String(fd.get('frente')).trim(), verso = String(fd.get('verso')).trim();
      if (c.tipo === 'lacuna' && !Util.temLacuna(frente)) { Util.aviso('A frase precisa ter uma palavra entre {{ e }}.', 'erro'); return; }
      if (c.tipo !== 'lacuna' && !c.imagem && (!frente || (!verso && !c.imagemVerso))) { Util.aviso('Frente e verso não podem ficar vazios.', 'erro'); return; }
      Estado.atualizarCartao(c.id, { frente, verso });
      Util.aviso('Cartão atualizado', 'sucesso');
      mostrarCartao(false);
      if (estavaVirado) virar();
    }

    /* ----- Gestos de deslizar (tablet/celular) ----- */
    function configurarGestos() {
      const cena = el.querySelector('#cena');
      let inicioX = null, dx = 0, arrastou = false;

      cena.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        inicioX = e.clientX; dx = 0; arrastou = false;
      });
      cena.addEventListener('pointermove', e => {
        if (inicioX === null || !virado) return;
        dx = e.clientX - inicioX;
        if (Math.abs(dx) > 8) {
          arrastou = true;
          cena.setPointerCapture(e.pointerId);
          cena.classList.add('cena--arrastando');
          cena.style.transform = `translateX(${dx}px) rotate(${dx / 25}deg)`;
          cena.dataset.direcao = dx < -50 ? 'esquerda' : dx > 50 ? 'direita' : '';
        }
      });
      const soltar = () => {
        if (inicioX === null) return;
        cena.classList.remove('cena--arrastando');
        if (arrastou && Math.abs(dx) > 110) {
          responder(dx < 0 ? 1 : 3);
        } else {
          cena.style.transform = '';
          cena.dataset.direcao = '';
        }
        inicioX = null;
      };
      cena.addEventListener('pointerup', e => {
        const foiToque = !arrastou;
        soltar();
        // Um toque simples na frente vira o cartão
        if (foiToque && !virado && !e.target.closest('button')) virar();
      });
      cena.addEventListener('pointercancel', soltar);
    }

    /* ----- Fim da sessão ----- */
    function terminar() {
      acoes.innerHTML = '';
      el.querySelector('#ferramentas').querySelectorAll('[data-ferramenta="editar"], [data-ferramenta="suspender"]').forEach(b => { b.hidden = true; });
      el.querySelector('.estudo__atalhos').hidden = true;

      if (sessao.respondidas === 0) {
        const proximo = Estado.proximoVencimento(filtro);
        const temCartoes = lista.length > 0;
        palco.innerHTML = `
          <div class="fim-sessao">
            ${Ui.vazio({
              icone: 'check',
              titulo: temCartoes ? 'Tudo em dia por aqui!' : 'Nenhum cartão neste conteúdo',
              texto: temCartoes
                ? (proximo ? `Próxima revisão: ${Util.formatarData(proximo, { weekday: 'long', day: 'numeric', month: 'long' })}.` : 'Não há revisões agendadas.') +
                  (Estado.novosRestantesHoje() === 0 ? ' O limite de cartões novos de hoje já foi atingido (ajuste em Ajustes).' : '')
                : 'Adicione cartões para começar a estudar.',
              acoes: `
                ${temCartoes && !livre ? `<a class="botao botao--primario" href="#/estudar?${qsLivre}&livre=1">${Ui.icone('repetir')} Revisão livre</a>` : ''}
                <a class="botao" href="${voltar}">Voltar</a>`,
            })}
          </div>`;
        return;
      }

      const minutos = Math.max(1, Math.round((Date.now() - sessao.inicio) / 60000));
      const taxa = Math.round(sessao.acertos / sessao.respondidas * 100);
      palco.innerHTML = `
        <div class="fim-sessao ${animacoesAtivas() ? 'fim-sessao--animado' : ''}">
          <div class="vazio">
            <div class="vazio__icone vazio__icone--sucesso">${Ui.icone('check')}</div>
            <h2 class="vazio__titulo" tabindex="-1" id="titulo-fim">Sessão concluída!</h2>
            <dl class="fim-sessao__numeros">
              <div><dt>Cartões</dt><dd>${totalInicial}</dd></div>
              <div><dt>Respostas</dt><dd>${sessao.respondidas}</dd></div>
              <div><dt>Acertos</dt><dd>${taxa}%</dd></div>
              <div><dt>Tempo</dt><dd>${minutos} min</dd></div>
            </dl>
            ${meta ? `<p class="fim-sessao__meta">${Estado.revisoesHoje() >= meta
              ? `${Ui.icone('check')} Meta do dia batida: ${Estado.revisoesHoje()} de ${meta} revisões!`
              : `Meta do dia: ${Estado.revisoesHoje()} de ${meta} · faltam ${meta - Estado.revisoesHoje()}`}</p>` : ''}
            <div class="vazio__acoes">
              <a class="botao botao--primario" href="#/inicio">Voltar ao início</a>
              <a class="botao" href="${voltar}">Voltar</a>
            </div>
          </div>
        </div>`;
      el.querySelector('#titulo-fim').focus();
    }

    /* ----- Cliques (delegação) ----- */
    el.addEventListener('click', e => {
      const palavra = e.target.closest('[data-lacuna]');
      if (palavra) {
        const aberta = palavra.classList.toggle('revelado');
        palavra.setAttribute('aria-pressed', aberta);
        if (e.detail > 0) acoes.querySelector('[data-acao="virar"]')?.focus({ preventScroll: true });
        return;
      }
      const rotulo = e.target.closest('[data-rotulo]');
      if (rotulo) {
        const aberto = rotulo.classList.toggle('revelado');
        rotulo.setAttribute('aria-pressed', aberto);
        // Clique com mouse/dedo: devolve o foco ao botão principal (Espaço continua virando)
        if (e.detail > 0) acoes.querySelector('[data-acao="virar"]')?.focus({ preventScroll: true });
        return;
      }
      if (e.target.closest('[data-revelar-todos]')) {
        el.querySelectorAll('#face-frente [data-rotulo]').forEach(r => { r.classList.add('revelado'); r.setAttribute('aria-pressed', 'true'); });
        return;
      }
      const ferramenta = e.target.closest('[data-ferramenta]')?.dataset.ferramenta;
      if (ferramenta === 'anterior') return voltarAnterior();
      if (ferramenta === 'editar') return editarAtual();
      if (ferramenta === 'suspender') return suspenderAtual();
      if (e.target.closest('[data-acao="virar"]')) return virar();
      const resp = e.target.closest('[data-resposta]');
      if (resp) responder(Number(resp.dataset.resposta));
    });

    /* ----- Atalhos de teclado ----- */
    function aoTeclar(e) {
      if (document.querySelector('dialog[open]') || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      const emControle = e.target.closest && e.target.closest('button, a, input, textarea, select');
      const emTexto = e.target.closest && e.target.closest('input, textarea, select');
      if ((e.key === ' ' || e.key === 'Enter') && !emControle) {
        e.preventDefault();
        virar();
      } else if (e.key.toLowerCase() === 'z' && !emTexto) {
        e.preventDefault();
        voltarAnterior();
      } else if (e.key.toLowerCase() === 'e' && !emTexto && fila.length) {
        e.preventDefault();
        editarAtual();
      } else if (/^[1-4]$/.test(e.key) && virado) {
        e.preventDefault();
        const valor = Number(e.key);
        responder(livre ? (valor === 1 ? 1 : 3) : valor);
      }
    }
    document.addEventListener('keydown', aoTeclar);

    mostrarCartao(false);

    return () => document.removeEventListener('keydown', aoTeclar);
  },
});
