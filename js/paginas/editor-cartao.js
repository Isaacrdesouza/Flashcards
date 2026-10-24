/* =============================================================
   paginas/editor-cartao.js — Criar / editar um flash card
   Ao criar, primeiro aparece a lista de tipos de cartão:
   • Flashcard (Padrão)      → frente e verso em texto
   • Ocultação de palavras   → frase com {{palavra}} escondida
   • Cartão de imagem        → imagem com áreas ocultas:
       - cada área marcada esconde aquela parte da imagem (a resposta está na própria imagem)
       - no estudo a área aparece como "?" e, ao tocar, some e mostra a imagem por baixo
       - cartões antigos podem ter áreas com texto: o texto continua editável/removível
   Endereços: #/cartao/novo?materia=ID&assunto=ID&grupo=ID (lista de tipos)
              #/cartao/novo?…&tipo=basico|lacuna|imagem · #/cartao/ID
   ============================================================= */
'use strict';

Rotas.registrar('cartao', {
  titulo: p => (p.id === 'novo' ? 'Novo cartão' : 'Editar cartão'),

  render(el, params) {
    const { esc } = Util;
    const editando = params.id && params.id !== 'novo' ? Estado.cartao(params.id) : null;
    if (params.id !== 'novo' && !editando) {
      el.innerHTML = Ui.cabecalho({ titulo: 'Cartão não encontrado', voltar: '#/materias' });
      return;
    }
    const materias = Estado.materias();
    if (!materias.length) {
      el.innerHTML = `${Ui.cabecalho({ titulo: 'Novo cartão', voltar: '#/materias' })}
        <section class="painel">${Ui.vazio({ titulo: 'Crie uma matéria primeiro', acoes: '<a class="botao botao--primario" href="#/materias">Ir para Matérias</a>' })}</section>`;
      return;
    }

    const nivel3 = Ui.nivel3();
    const TIPOS = Ui.TIPOS_CARTAO;
    // Local vindo do endereço (mantido ao escolher ou trocar o tipo)
    const qsLocal = ['materia', 'assunto', 'grupo'].filter(k => params[k]).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');

    /* ----- Novo cartão sem tipo escolhido: mostra a lista de tipos ----- */
    if (!editando && !TIPOS[params.tipo]) {
      const voltarLista = params.materia
        ? `#/materia/${params.materia}${params.assunto ? `?assunto=${params.assunto}${params.grupo ? `&grupo=${params.grupo}` : ''}` : ''}`
        : '#/materias';
      el.innerHTML = `
        ${Ui.cabecalho({ voltar: voltarLista, titulo: 'Novo cartão', subtitulo: 'Escolha o tipo de cartão que você quer criar.' })}
        <ul class="tipos-cartao" role="list">
          ${Object.entries(TIPOS).map(([chave, t]) => `
            <li>
              <a class="tipo-cartao" href="#/cartao/novo?${qsLocal ? qsLocal + '&' : ''}tipo=${chave}">
                <span class="tipo-cartao__icone" aria-hidden="true">${Ui.icone(t.icone)}</span>
                <span class="tipo-cartao__textos">
                  <span class="tipo-cartao__nome">${esc(t.nome)}</span>
                  <span class="tipo-cartao__descricao">${esc(t.descricao)}</span>
                </span>
                ${Ui.icone('avancar', 'tipo-cartao__seta')}
              </a>
            </li>`).join('')}
        </ul>`;
      setTimeout(() => el.querySelector('.tipo-cartao')?.focus(), 0);
      return;
    }

    // Tipo do cartão. Cartões antigos com imagem são tratados como "Cartão de imagem".
    const tipo = editando
      ? (editando.tipo === 'lacuna' ? 'lacuna' : (editando.tipo === 'imagem' || editando.imagem) ? 'imagem' : 'basico')
      : params.tipo;

    // Local inicial do cartão (do cartão editado ou dos parâmetros do endereço)
    let materiaId = editando ? editando.materiaId : (params.materia || materias[0].id);
    let assuntoId = editando ? editando.assuntoId : (params.assunto || '');
    let grupoId = editando ? editando.grupoId : (params.grupo || '');

    // Estado da imagem em edição
    let imagem = editando && editando.imagem
      ? { ...editando.imagem, sobreposicoes: editando.imagem.sobreposicoes.map(s => ({ ...s })), dataUrl: null }
      : null;
    let imagemAlterada = false;
    let selecionado = null;

    // Imagem anexada à resposta (Flashcard padrão): { id, alt, dataUrl }
    let anexo = editando && editando.imagemVerso ? { ...editando.imagemVerso, dataUrl: null } : null;
    let anexoAlterado = false;

    const voltarPara = () => {
      const a = assuntoId ? `?assunto=${assuntoId}${grupoId ? `&grupo=${grupoId}` : ''}` : '';
      return `#/materia/${materiaId}${a}`;
    };

    /* ----- Estrutura da página ----- */
    el.innerHTML = `
      ${Ui.cabecalho({
        voltar: voltarPara(),
        titulo: editando ? 'Editar cartão' : 'Novo cartão',
        subtitulo: `<span class="tipo-atual">${Ui.icone(TIPOS[tipo].icone)} ${esc(TIPOS[tipo].nome)}</span>` +
          (editando
            ? ` · Situação: ${Ui.seloCartao(editando)}${editando.suspenso ? ' (fora do estudo)' : ''}`
            : ` · <a href="#/cartao/novo${qsLocal ? '?' + qsLocal : ''}">Trocar tipo</a> · Atalho: Ctrl + Enter salva`),
        acoes: editando ? `
          <button class="botao" data-acao="suspender">${editando.suspenso ? `${Ui.icone('play')} Reativar` : 'Suspender'}</button>
          <button class="botao" data-acao="reiniciar">${Ui.icone('repetir')} Reiniciar progresso</button>
          <button class="botao botao--perigo botao--icone" data-acao="excluir" aria-label="Excluir cartão" title="Excluir cartão">${Ui.icone('lixeira')}</button>` : '',
      })}

      <form class="editor" id="form-cartao" novalidate>
        <section class="painel" aria-labelledby="t-local">
          <h2 class="painel__titulo painel__titulo--margem" id="t-local">Onde guardar</h2>
          <div class="grade-campos">
            <div class="campo">
              <label class="campo__rotulo" for="sel-materia">Matéria</label>
              <select name="materia" id="sel-materia" required>${Ui.opcoes(materias, materiaId)}</select>
            </div>
            <div class="campo">
              <label class="campo__rotulo" for="sel-assunto">Frente</label>
              <div class="campo-com-botao">
                <select name="assunto" id="sel-assunto" required></select>
                <button type="button" class="botao botao--icone" data-acao="novo-assunto" aria-label="Criar nova frente" title="Nova frente">${Ui.icone('mais')}</button>
              </div>
            </div>
            <div class="campo">
              <label class="campo__rotulo" for="sel-grupo">${esc(nivel3)}</label>
              <div class="campo-com-botao">
                <select name="grupo" id="sel-grupo" required></select>
                <button type="button" class="botao botao--icone" data-acao="novo-grupo" aria-label="Criar ${esc(Ui.novoNivel3().toLowerCase())}" title="${esc(Ui.novoNivel3())}">${Ui.icone('mais')}</button>
              </div>
            </div>
          </div>
        </section>

        ${tipo === 'basico' ? `
        <section class="painel" aria-labelledby="t-conteudo">
          <h2 class="painel__titulo painel__titulo--margem" id="t-conteudo">Conteúdo</h2>
          <div class="grade-frente-verso">
            <div class="campo">
              <label class="campo__rotulo" for="campo-frente">Frente (pergunta)</label>
              ${Ui.barraFormatacao('campo-frente')}
              <textarea name="frente" id="campo-frente" rows="5">${esc(editando ? editando.frente : '')}</textarea>
            </div>
            <div class="campo">
              <label class="campo__rotulo" for="campo-verso">Verso (resposta)</label>
              ${Ui.barraFormatacao('campo-verso')}
              <textarea name="verso" id="campo-verso" rows="5">${esc(editando ? editando.verso : '')}</textarea>
              <div class="anexo-resposta">
                <span class="campo__rotulo">Imagem na resposta <span class="opcional">(opcional)</span></span>
                <div id="area-anexo"></div>
              </div>
            </div>
          </div>
        </section>` : ''}

        ${tipo === 'lacuna' ? `
        <section class="painel" aria-labelledby="t-conteudo">
          <h2 class="painel__titulo painel__titulo--margem" id="t-conteudo">Frase</h2>
          <div class="lacuna-editor">
            <label class="campo">
              <span class="sr-only">Frase</span>
              <textarea name="frase" id="campo-frase" rows="4">${esc(editando ? editando.frente : '')}</textarea>
              <span class="campo__ajuda">Escreva a frase e <strong>toque na palavra</strong> abaixo que deve ficar escondida. Também dá para selecionar um trecho e usar <strong>Ocultar seleção</strong>, ou escrever a palavra entre chaves duplas: <code>{{palavra}}</code>.</span>
            </label>
            <div class="lacuna-editor__previa">
              <div class="lacuna-editor__topo">
                <span class="campo__rotulo">Toque para ocultar ou mostrar</span>
                <button type="button" class="botao botao--pequeno" data-acao="ocultar-selecao">Ocultar seleção</button>
              </div>
              <p class="lacuna-editor__palavras" id="previa-lacuna"></p>
            </div>
            <div class="campo">
              <label class="campo__rotulo" for="campo-extra">Observação no verso <span class="opcional">(opcional)</span></label>
              ${Ui.barraFormatacao('campo-extra')}
              <textarea name="extra" id="campo-extra" rows="2">${esc(editando ? editando.verso : '')}</textarea>
            </div>
          </div>
        </section>` : ''}

        ${tipo === 'imagem' ? `
        <section class="painel" aria-labelledby="t-imagem">
          <div class="painel__cabecalho">
            <div>
              <h2 class="painel__titulo" id="t-imagem">Imagem com áreas ocultas</h2>
              <p class="painel__nota">Marque as partes da imagem que devem ficar escondidas; no estudo, toque em cada área para revelar o que está por baixo.</p>
            </div>
          </div>
          <div id="area-imagem"></div>
        </section>

        <section class="painel" aria-labelledby="t-textos">
          <h2 class="painel__titulo painel__titulo--margem" id="t-textos">Textos <span class="opcional">(opcionais)</span></h2>
          <div class="grade-frente-verso">
            <div class="campo">
              <label class="campo__rotulo" for="campo-instrucao">Instrução na frente</label>
              ${Ui.barraFormatacao('campo-instrucao')}
              <textarea name="instrucao" id="campo-instrucao" rows="3">${esc(editando ? editando.frente : '')}</textarea>
            </div>
            <div class="campo">
              <label class="campo__rotulo" for="campo-observacao">Observação no verso</label>
              ${Ui.barraFormatacao('campo-observacao')}
              <textarea name="observacao" id="campo-observacao" rows="3">${esc(editando ? editando.verso : '')}</textarea>
            </div>
          </div>
        </section>` : ''}

        <p class="erro-formulario" id="erro-form" role="alert" hidden></p>

        <div class="barra-acoes">
          <button type="submit" class="botao botao--primario botao--grande" data-salvar="voltar">${Ui.icone('check')} Salvar</button>
          ${!editando ? `<button type="submit" class="botao botao--grande" data-salvar="outro">Salvar e criar outro</button>` : ''}
          <a class="botao botao--fantasma botao--grande" href="${voltarPara()}">Cancelar</a>
        </div>
      </form>`;

    const form = el.querySelector('#form-cartao');
    Ui.ligarFormatacao(form);
    const selMateria = el.querySelector('#sel-materia');
    const selAssunto = el.querySelector('#sel-assunto');
    const selGrupo = el.querySelector('#sel-grupo');
    const areaImagem = el.querySelector('#area-imagem');
    const erroForm = el.querySelector('#erro-form');

    /* ----- Selects dependentes (matéria → assunto → 3º nível) ----- */
    function preencherAssuntos() {
      const assuntos = Estado.assuntosDe(materiaId);
      if (!assuntos.find(a => a.id === assuntoId)) assuntoId = assuntos[0] ? assuntos[0].id : '';
      selAssunto.innerHTML = assuntos.length
        ? Ui.opcoes(assuntos, assuntoId)
        : '<option value="">— crie uma frente no botão + —</option>';
      preencherGrupos();
    }
    function preencherGrupos() {
      const grupos = assuntoId ? Estado.gruposDe(assuntoId) : [];
      if (!grupos.find(g => g.id === grupoId)) grupoId = grupos[0] ? grupos[0].id : '';
      selGrupo.innerHTML = grupos.length
        ? Ui.opcoes(grupos, grupoId)
        : `<option value="">— crie ${/o$/i.test(nivel3) ? 'um' : 'uma'} ${esc(nivel3.toLowerCase())} no botão + —</option>`;
    }
    preencherAssuntos();

    selMateria.addEventListener('change', () => { materiaId = selMateria.value; preencherAssuntos(); });
    selAssunto.addEventListener('change', () => { assuntoId = selAssunto.value; preencherGrupos(); });
    selGrupo.addEventListener('change', () => { grupoId = selGrupo.value; });

    /* =========================================================
       EDITOR DE IMAGEM COM RÓTULOS
       ========================================================= */

    async function desenharAreaImagem() {
      if (!imagem) {
        areaImagem.innerHTML = `
          <label class="zona-imagem" id="zona-imagem">
            <input type="file" accept="image/*" id="arquivo-imagem" class="sr-only">
            ${Ui.icone('imagem')}
            <span class="zona-imagem__titulo">Escolher imagem</span>
            <span class="zona-imagem__ajuda">Toque para escolher, arraste um arquivo aqui ou cole com Ctrl + V</span>
          </label>`;
        const zona = areaImagem.querySelector('#zona-imagem');
        areaImagem.querySelector('#arquivo-imagem').addEventListener('change', e => carregarArquivo(e.target.files[0]));
        zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('arrastando'); });
        zona.addEventListener('dragleave', () => zona.classList.remove('arrastando'));
        zona.addEventListener('drop', e => {
          e.preventDefault();
          zona.classList.remove('arrastando');
          carregarArquivo(e.dataTransfer.files[0]);
        });
        return;
      }

      // Carrega a imagem salva (se ainda não estiver em memória)
      if (!imagem.dataUrl) imagem.dataUrl = await Banco.lerImagem(imagem.id);

      areaImagem.innerHTML = `
        <div class="editor-imagem">
          <div class="editor-imagem__barra">
            <p class="editor-imagem__dica">${Ui.icone('texto')} <span><strong>Arraste</strong> sobre a imagem para cobrir a parte que quer esconder (ou <strong>toque</strong> para criar uma área padrão). Arraste uma área para movê-la; use o canto para redimensionar.</span></p>
            <div class="editor-imagem__botoes">
              <label class="botao botao--pequeno">
                <input type="file" accept="image/*" id="trocar-imagem" class="sr-only">Trocar imagem
              </label>
              <button type="button" class="botao botao--pequeno botao--perigo" data-acao="remover-imagem">Remover</button>
            </div>
          </div>
          <div class="palco" id="palco">
            <img src="${imagem.dataUrl || ''}" alt="${esc(imagem.alt || '')}" draggable="false">
            <div class="palco__rotulos" id="palco-rotulos"></div>
          </div>
          <label class="campo">
            <span class="campo__rotulo">Descrição da imagem (texto alternativo)</span>
            <input type="text" id="alt-imagem" maxlength="200" value="${esc(imagem.alt || '')}" required>
            <span class="campo__ajuda">Usada por leitores de tela e quando a imagem não carrega.</span>
          </label>
          <div>
            <h3 class="subtitulo-secao">Áreas ocultas</h3>
            <ol class="lista-rotulos" id="lista-rotulos"></ol>
          </div>
        </div>`;

      areaImagem.querySelector('#trocar-imagem').addEventListener('change', e => carregarArquivo(e.target.files[0], true));
      areaImagem.querySelector('#alt-imagem').addEventListener('input', e => { imagem.alt = e.target.value; });
      configurarPalco(areaImagem.querySelector('#palco'));
      desenharRotulos();
    }

    /** Lê o arquivo escolhido, comprime e mostra no editor */
    async function carregarArquivo(arquivo, manterRotulos = false) {
      if (!arquivo || !arquivo.type.startsWith('image/')) {
        Util.aviso('Escolha um arquivo de imagem.', 'erro');
        return;
      }
      try {
        const { dataUrl } = await Util.comprimirImagem(arquivo);
        const sugestaoAlt = arquivo.name ? arquivo.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') : '';
        imagem = {
          id: imagem ? imagem.id : null,
          alt: imagem && imagem.alt ? imagem.alt : sugestaoAlt,
          sobreposicoes: manterRotulos && imagem ? imagem.sobreposicoes : [],
          dataUrl,
        };
        imagemAlterada = true;
        desenharAreaImagem();
      } catch (erro) {
        Util.aviso(erro.message, 'erro');
      }
    }

    /** Desenha as caixas sobre a imagem e a lista editável de rótulos */
    function desenharRotulos() {
      const camada = areaImagem.querySelector('#palco-rotulos');
      const lista = areaImagem.querySelector('#lista-rotulos');
      if (!camada) return;

      camada.innerHTML = imagem.sobreposicoes.map((s, i) => `
        <div class="rotulo-editor ${s.texto ? '' : 'rotulo-editor--mascara'} ${selecionado === s.id ? 'selecionado' : ''}"
             data-id="${s.id}" style="left:${s.x}%;top:${s.y}%;width:${s.l}%;height:${s.a}%">
          <span class="rotulo-editor__num" aria-hidden="true">${i + 1}</span>
          <span class="rotulo-editor__texto">${esc(s.texto)}</span>
          <span class="rotulo-editor__alca" aria-hidden="true"></span>
        </div>`).join('');

      lista.innerHTML = imagem.sobreposicoes.length
        ? imagem.sobreposicoes.map((s, i) => `
          <li class="${selecionado === s.id ? 'selecionado' : ''}" data-id="${s.id}">
            <span class="lista-rotulos__num" aria-hidden="true">${i + 1}</span>
            ${s.texto
              ? `<input type="text" class="entrada" value="${esc(s.texto)}" data-rotulo="${s.id}" aria-label="Texto da área ${i + 1}" placeholder="Apague para só esconder a imagem">`
              : `<button type="button" class="lista-rotulos__area" data-selecionar="${s.id}">Área ${i + 1} <span>esconde esta parte da imagem</span></button>`}
            <button type="button" class="botao botao--fantasma botao--pequeno botao--icone" data-acao="remover-rotulo" data-id="${s.id}" aria-label="Remover área ${i + 1}">${Ui.icone('fechar')}</button>
          </li>`).join('')
        : '<li class="lista-rotulos__vazia">Nenhuma área ainda. Arraste sobre a imagem para esconder a primeira parte.</li>';

      lista.querySelectorAll('[data-selecionar]').forEach(b => b.addEventListener('click', () => marcarSelecionado(b.dataset.selecionar)));

      lista.querySelectorAll('[data-rotulo]').forEach(inp => {
        inp.addEventListener('focus', () => marcarSelecionado(inp.dataset.rotulo));
        inp.addEventListener('input', () => {
          const s = imagem.sobreposicoes.find(x => x.id === inp.dataset.rotulo);
          s.texto = inp.value;
          // Atualiza só a caixa correspondente (sem perder o foco do campo)
          const caixa = camada.querySelector(`[data-id="${s.id}"]`);
          caixa.querySelector('.rotulo-editor__texto').textContent = s.texto;
          caixa.classList.toggle('rotulo-editor--mascara', !s.texto);
        });
      });
    }

    function marcarSelecionado(id) {
      selecionado = id;
      areaImagem.querySelectorAll('[data-id]').forEach(x => x.classList.toggle('selecionado', x.dataset.id === id));
    }

    /** Desenhar, mover e redimensionar rótulos com mouse, caneta ou dedo */
    function configurarPalco(palco) {
      let modo = null;      // 'desenhar' | 'mover' | 'redimensionar'
      let alvo = null;      // rótulo sendo manipulado
      let inicio = null;    // ponto inicial (em %)
      let deslocamento = null;
      const limitar = (v, min = 0, max = 100) => Math.min(max, Math.max(min, v));

      const pontoEmPorcento = e => {
        const r = palco.getBoundingClientRect();
        return { x: limitar((e.clientX - r.left) / r.width * 100), y: limitar((e.clientY - r.top) / r.height * 100) };
      };
      const aplicarEstilo = s => {
        const caixa = palco.querySelector(`[data-id="${s.id}"]`);
        if (caixa) Object.assign(caixa.style, { left: s.x + '%', top: s.y + '%', width: s.l + '%', height: s.a + '%' });
      };

      palco.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        const p = pontoEmPorcento(e);
        const caixa = e.target.closest('.rotulo-editor');
        if (caixa) {
          alvo = imagem.sobreposicoes.find(s => s.id === caixa.dataset.id);
          modo = e.target.classList.contains('rotulo-editor__alca') ? 'redimensionar' : 'mover';
          deslocamento = { x: p.x - alvo.x, y: p.y - alvo.y };
          marcarSelecionado(alvo.id);
        } else {
          modo = 'desenhar';
          inicio = p;
          alvo = { id: Util.gerarId(), x: p.x, y: p.y, l: 0, a: 0, texto: '' };
          imagem.sobreposicoes.push(alvo);
          selecionado = alvo.id;
          desenharRotulos();
        }
        palco.setPointerCapture(e.pointerId);
        e.preventDefault();
      });

      palco.addEventListener('pointermove', e => {
        if (!modo) return;
        const p = pontoEmPorcento(e);
        if (modo === 'desenhar') {
          alvo.x = Math.min(inicio.x, p.x);
          alvo.y = Math.min(inicio.y, p.y);
          alvo.l = Math.abs(p.x - inicio.x);
          alvo.a = Math.abs(p.y - inicio.y);
        } else if (modo === 'mover') {
          alvo.x = limitar(p.x - deslocamento.x, 0, 100 - alvo.l);
          alvo.y = limitar(p.y - deslocamento.y, 0, 100 - alvo.a);
        } else {
          alvo.l = limitar(p.x - alvo.x, 3, 100 - alvo.x);
          alvo.a = limitar(p.y - alvo.y, 3, 100 - alvo.y);
        }
        aplicarEstilo(alvo);
      });

      const finalizar = () => {
        if (!modo) return;
        const eraDesenho = modo === 'desenhar';
        if (eraDesenho && alvo.l < 3 && alvo.a < 3) {
          // Foi só um toque: cria uma área de tamanho padrão centrada no ponto
          alvo.l = 24; alvo.a = 9;
          alvo.x = limitar(inicio.x - alvo.l / 2, 0, 100 - alvo.l);
          alvo.y = limitar(inicio.y - alvo.a / 2, 0, 100 - alvo.a);
        }
        alvo.l = Math.max(alvo.l, 3);
        alvo.a = Math.max(alvo.a, 3);
        // Arredonda para guardar números curtos
        ['x', 'y', 'l', 'a'].forEach(k => { alvo[k] = Math.round(alvo[k] * 100) / 100; });
        const id = alvo.id;
        modo = null; alvo = null;
        desenharRotulos();
        if (eraDesenho) marcarSelecionado(id);
      };
      palco.addEventListener('pointerup', finalizar);
      palco.addEventListener('pointercancel', finalizar);
    }

    if (tipo === 'imagem') desenharAreaImagem();

    /* =========================================================
       ANEXO: IMAGEM COMO RESPOSTA (Flashcard padrão)
       Aparece no verso do cartão, junto (ou no lugar) do texto.
       ========================================================= */
    const areaAnexo = el.querySelector('#area-anexo');

    async function desenharAnexo() {
      if (!areaAnexo) return;
      if (!anexo) {
        areaAnexo.innerHTML = `
          <label class="zona-anexo" id="zona-anexo">
            <input type="file" accept="image/*" id="arquivo-anexo" class="sr-only">
            ${Ui.icone('imagem')}
            <span><strong>Anexar imagem</strong> <span class="zona-anexo__ajuda">· toque para escolher, arraste ou cole com Ctrl + V</span></span>
          </label>`;
        const zona = areaAnexo.querySelector('#zona-anexo');
        areaAnexo.querySelector('#arquivo-anexo').addEventListener('change', e => carregarAnexo(e.target.files[0]));
        zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('arrastando'); });
        zona.addEventListener('dragleave', () => zona.classList.remove('arrastando'));
        zona.addEventListener('drop', e => { e.preventDefault(); zona.classList.remove('arrastando'); carregarAnexo(e.dataTransfer.files[0]); });
        return;
      }
      if (!anexo.dataUrl && anexo.id) anexo.dataUrl = await Banco.lerImagem(anexo.id);
      areaAnexo.innerHTML = `
        <div class="anexo">
          <img class="anexo__imagem" src="${anexo.dataUrl || ''}" alt="${esc(anexo.alt || '')}">
          <div class="anexo__lado">
            <label class="campo">
              <span class="campo__rotulo">Descrição da imagem</span>
              <input type="text" id="alt-anexo" maxlength="200" value="${esc(anexo.alt || '')}" required>
            </label>
            <div class="acoes-linha">
              <label class="botao botao--pequeno"><input type="file" accept="image/*" id="trocar-anexo" class="sr-only">Trocar</label>
              <button type="button" class="botao botao--pequeno botao--perigo" data-acao="remover-anexo">Remover</button>
            </div>
          </div>
        </div>`;
      areaAnexo.querySelector('#alt-anexo').addEventListener('input', e => { anexo.alt = e.target.value; });
      areaAnexo.querySelector('#trocar-anexo').addEventListener('change', e => carregarAnexo(e.target.files[0]));
    }

    async function carregarAnexo(arquivo) {
      if (!arquivo || !arquivo.type.startsWith('image/')) { Util.aviso('Escolha um arquivo de imagem.', 'erro'); return; }
      try {
        const { dataUrl } = await Util.comprimirImagem(arquivo);
        const sugestaoAlt = arquivo.name ? arquivo.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') : '';
        anexo = { id: anexo ? anexo.id : null, alt: anexo && anexo.alt ? anexo.alt : sugestaoAlt, dataUrl };
        anexoAlterado = true;
        desenharAnexo();
      } catch (erro) {
        Util.aviso(erro.message, 'erro');
      }
    }
    if (tipo === 'basico') desenharAnexo();

    /* ----- Colar imagem com Ctrl + V (cartão de imagem ou anexo da resposta) ----- */
    function aoColar(e) {
      if (tipo !== 'imagem' && tipo !== 'basico') return;
      const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
      if (!item) return;
      e.preventDefault();
      if (tipo === 'basico') carregarAnexo(item.getAsFile());
      else carregarArquivo(item.getAsFile(), !!imagem);
    }
    document.addEventListener('paste', aoColar);

    /* ----- Ctrl + Enter salva ----- */
    function aoTeclar(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        salvar(editando ? 'voltar' : 'outro');
      }
    }
    document.addEventListener('keydown', aoTeclar);

    /* =========================================================
       OCULTAR PALAVRA (cartão de lacuna)
       A frase guarda as palavras escondidas entre {{ e }}.
       ========================================================= */
    const campoFrase = el.querySelector('#campo-frase');
    const previaLacuna = el.querySelector('#previa-lacuna');
    let ocultarSelecao = () => {};
    if (tipo === 'lacuna') {
      // Palavras (letras, números, hífen e apóstrofo) ou trechos já ocultos
      const TOKEN = /\{\{(.+?)\}\}|[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu;

      function desenharPreviaLacuna() {
        const texto = campoFrase.value;
        if (!texto.trim()) {
          previaLacuna.innerHTML = '<span class="lacuna-editor__vazio">A frase aparece aqui para você escolher a palavra.</span>';
          return;
        }
        let html = '', fim = 0;
        for (const m of texto.matchAll(TOKEN)) {
          html += Util.textoParaHtml(texto.slice(fim, m.index));
          const oculto = m[1] !== undefined;
          html += `<button type="button" class="palavra ${oculto ? 'palavra--oculta' : ''}" data-ini="${m.index}" data-fim="${m.index + m[0].length}" aria-pressed="${oculto}">${esc(oculto ? m[1] : m[0])}</button>`;
          fim = m.index + m[0].length;
        }
        html += Util.textoParaHtml(texto.slice(fim));
        previaLacuna.innerHTML = html;
      }

      /** Troca um trecho da frase e redesenha a prévia */
      function trocarTrecho(ini, fim, novo) {
        const t = campoFrase.value;
        campoFrase.value = t.slice(0, ini) + novo + t.slice(fim);
        desenharPreviaLacuna();
      }

      previaLacuna.addEventListener('click', e => {
        const b = e.target.closest('.palavra');
        if (!b) return;
        const ini = Number(b.dataset.ini), fim = Number(b.dataset.fim);
        const trecho = campoFrase.value.slice(ini, fim);
        const m = /^\{\{(.+?)\}\}$/.exec(trecho);
        trocarTrecho(ini, fim, m ? m[1] : `{{${trecho}}}`);
        // Mantém o foco na mesma palavra (navegação por teclado)
        previaLacuna.querySelector(`.palavra[data-ini="${ini}"]`)?.focus();
      });
      campoFrase.addEventListener('input', desenharPreviaLacuna);
      desenharPreviaLacuna();

      /** Oculta o trecho selecionado no campo da frase */
      ocultarSelecao = function () {
        let ini = campoFrase.selectionStart, fim = campoFrase.selectionEnd;
        const t = campoFrase.value;
        while (ini < fim && /\s/.test(t[ini])) ini++;
        while (fim > ini && /\s/.test(t[fim - 1])) fim--;
        if (ini === fim) { Util.aviso('Selecione na frase o trecho que quer esconder.', 'erro'); campoFrase.focus(); return; }
        const trecho = t.slice(ini, fim);
        if (/\{\{|\}\}/.test(trecho)) { Util.aviso('Esse trecho já tem uma parte oculta.', 'erro'); return; }
        trocarTrecho(ini, fim, `{{${trecho}}}`);
      }
      // Evita que o toque no botão tire a seleção do campo
      el.querySelector('[data-acao="ocultar-selecao"]').addEventListener('pointerdown', e => e.preventDefault());
    }

    /* ----- Botões diversos ----- */
    el.addEventListener('click', async e => {
      const btn = e.target.closest('[data-acao]');
      if (!btn) return;
      switch (btn.dataset.acao) {
        case 'novo-assunto': {
          const nome = await Ui.modalNome({ titulo: 'Nova frente', rotulo: 'Nome da frente', confirmar: 'Criar' });
          if (nome) { assuntoId = Estado.criarAssunto(materiaId, nome).id; preencherAssuntos(); }
          break;
        }
        case 'novo-grupo': {
          if (!assuntoId) { Util.aviso('Escolha ou crie uma frente primeiro.', 'erro'); break; }
          const nome = await Ui.modalNome({ titulo: Ui.novoNivel3(), rotulo: 'Nome', confirmar: 'Criar' });
          if (nome) { grupoId = Estado.criarGrupo(assuntoId, nome).id; preencherGrupos(); }
          break;
        }
        case 'ocultar-selecao':
          ocultarSelecao();
          break;
        case 'remover-anexo':
          anexo = null; anexoAlterado = true;
          desenharAnexo();
          break;
        case 'remover-imagem':
          imagem = null; imagemAlterada = true; selecionado = null;
          desenharAreaImagem();
          break;
        case 'remover-rotulo':
          imagem.sobreposicoes = imagem.sobreposicoes.filter(s => s.id !== btn.dataset.id);
          desenharRotulos();
          break;
        case 'suspender': {
          const suspender = !editando.suspenso;
          Estado.suspenderCartoes([editando.id], suspender);
          Util.aviso(suspender ? 'Cartão suspenso: não aparece mais no estudo' : 'Cartão reativado', 'sucesso');
          Rotas.recarregar();
          break;
        }
        case 'reiniciar':
          if (await Util.confirmar('O cartão volta a ser "novo" e perde o histórico de agendamento.', { titulo: 'Reiniciar progresso', botao: 'Reiniciar' })) {
            Estado.reiniciarCartao(editando.id);
            Util.aviso('Progresso reiniciado');
            Rotas.recarregar();
          }
          break;
        case 'excluir':
          {
            const item = Estado.excluirCartao(editando.id);
            Rotas.ir(voltarPara());
            Ui.avisoLixeira(item, 'Cartão excluído');
          }
          break;
      }
    });

    /* ----- Salvar ----- */
    form.addEventListener('submit', e => {
      e.preventDefault();
      salvar(e.submitter ? e.submitter.dataset.salvar : 'voltar');
    });

    function mostrarErro(msg, campo) {
      erroForm.textContent = msg;
      erroForm.hidden = false;
      if (campo) campo.focus();
    }

    async function salvar(destino) {
      const lacuna = tipo === 'lacuna';
      const campos = { basico: ['frente', 'verso'], lacuna: ['frase', 'extra'], imagem: ['instrucao', 'observacao'] }[tipo];
      const frente = form[campos[0]].value.trim();
      const verso = form[campos[1]].value.trim();
      if (tipo !== 'imagem') imagem = null;
      erroForm.hidden = true;

      if (!assuntoId) return mostrarErro('Escolha ou crie uma frente para o cartão.', selAssunto);
      if (!grupoId) return mostrarErro(`Escolha ou crie ${/o$/i.test(nivel3) ? 'um' : 'uma'} ${nivel3.toLowerCase()} para o cartão (botão + ao lado).`, selGrupo);
      if (lacuna && !frente) return mostrarErro('Escreva a frase do cartão.', form.frase);
      if (lacuna && !Util.temLacuna(frente)) return mostrarErro('Toque em pelo menos uma palavra da frase para escondê-la.', form.frase);
      if (tipo === 'basico' && !frente) return mostrarErro('Escreva a frente do cartão (pergunta).', form.frente);
      if (tipo !== 'basico') anexo = null;
      if (tipo === 'basico' && !verso && !anexo) return mostrarErro('Escreva o verso do cartão (resposta) ou anexe uma imagem.', form.verso);
      if (anexo && !String(anexo.alt || '').trim()) return mostrarErro('Descreva a imagem da resposta.', areaAnexo.querySelector('#alt-anexo'));
      if (tipo === 'imagem' && !imagem) return mostrarErro('Escolha a imagem do cartão.', areaImagem.querySelector('#arquivo-imagem'));
      if (tipo === 'imagem' && !imagem.sobreposicoes.length) return mostrarErro('Arraste sobre a imagem para marcar pelo menos uma área oculta.', null);
      if (imagem && !String(imagem.alt || '').trim()) return mostrarErro('Descreva a imagem (texto alternativo).', areaImagem.querySelector('#alt-imagem'));

      // Grava a imagem (se nova/trocada) e apaga a antiga
      let dadosImagem = null;
      const idAntigo = editando && editando.imagem ? editando.imagem.id : null;
      if (imagem) {
        const id = imagemAlterada || !imagem.id ? Util.gerarId() : imagem.id;
        if (imagemAlterada || !imagem.id) await Banco.salvarImagem(id, imagem.dataUrl);
        dadosImagem = {
          id,
          alt: imagem.alt.trim(),
          sobreposicoes: imagem.sobreposicoes.map(s => ({ ...s, texto: s.texto.trim() })),
        };
      }
      if (idAntigo && (!dadosImagem || dadosImagem.id !== idAntigo)) Banco.apagarImagem(idAntigo);

      // Grava a imagem da resposta (se nova/trocada) e apaga a antiga
      let dadosAnexo = null;
      const idAnexoAntigo = editando && editando.imagemVerso ? editando.imagemVerso.id : null;
      if (anexo) {
        const id = anexoAlterado || !anexo.id ? Util.gerarId() : anexo.id;
        if (anexoAlterado || !anexo.id) await Banco.salvarImagem(id, anexo.dataUrl);
        dadosAnexo = { id, alt: anexo.alt.trim() };
      }
      if (idAnexoAntigo && (!dadosAnexo || dadosAnexo.id !== idAnexoAntigo)) Banco.apagarImagem(idAnexoAntigo);

      const dados = { materiaId, assuntoId, grupoId, tipo, frente, verso, imagem: dadosImagem, imagemVerso: dadosAnexo };
      if (editando) {
        Estado.atualizarCartao(editando.id, dados);
        Util.aviso('Cartão salvo', 'sucesso');
      } else {
        Estado.criarCartao(dados);
        Util.aviso('Cartão criado', 'sucesso');
      }

      if (destino === 'outro') {
        Rotas.ir(`#/cartao/novo?materia=${materiaId}&assunto=${assuntoId}&grupo=${grupoId}&tipo=${tipo}`);
      } else {
        Rotas.ir(voltarPara());
      }
    }

    // Foco inicial na frente ao criar
    if (!editando) setTimeout(() => el.querySelector({ basico: '#campo-frente', lacuna: '#campo-frase', imagem: '#arquivo-imagem' }[tipo])?.focus(), 0);

    // Limpeza ao sair da página
    return () => {
      document.removeEventListener('paste', aoColar);
      document.removeEventListener('keydown', aoTeclar);
    };
  },
});
