/* =============================================================
   paginas/importar-anki.js — Importar um pacote do Anki (.apkg)
   Aba "Arquivo do Anki" da página Importar (#/importar?modo=anki)
   1. Escolher o arquivo (ou arrastar)
   2. Ver o que tem dentro: baralhos, cartões, imagens
   3. Escolher como organizar e importar
   A leitura do arquivo fica em js/anki.js.
   ============================================================= */
'use strict';

const ImportarAnki = (() => {
  const { esc } = Util;
  const NOVO = '__novo__';

  /**
   * Baralho do Anki → Matéria › Frente › Assunto
   * inicio:  quantos níveis do topo pular (ex.: "Med::Física::…" com inicio 1 → a matéria é "Física")
   * separar: sub-baralhos abaixo do 3º nível viram pastas próprias ("A › B"); senão entram no Assunto de cima
   */
  function pastasDoBaralho(partes, { inicio = 0, separar = false } = {}) {
    const todos = partes.map(s => String(s).trim()).filter(Boolean);
    const p = todos.slice(Math.min(inicio, Math.max(0, todos.length - 1)));
    return {
      materia: !p[0] || p[0] === 'Default' ? 'Anki' : p[0],
      frente: p[1] || 'Geral',
      assunto: p.length > 2 ? (separar ? p.slice(2).join(' › ') : p[2]) : 'Geral',
    };
  }
  const chaveDe = x => `${x.materia}\u0001${x.frente}\u0001${x.assunto}`.toLowerCase();
  const normalizar = t => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();

  function render(el, params = {}) {
    let lido = null;          // resultado de Anki.ler()
    let nomeArquivo = '';
    let ocupado = false;
    const niveis = { inicio: 0, separar: false };   // como os baralhos viram pastas

    el.innerHTML = `
      <section class="painel" aria-labelledby="t-anki-arquivo">
        <h2 class="painel__titulo painel__titulo--margem" id="t-anki-arquivo">1. Escolha o arquivo do Anki</h2>
        <label class="zona-arquivo" id="zona-anki">
          <input type="file" id="arquivo-anki" accept=".apkg,.colpkg" class="sr-only">
          <span class="zona-arquivo__icone" aria-hidden="true">${Ui.icone('importar')}</span>
          <span class="zona-arquivo__titulo">Toque para escolher o arquivo <strong>.apkg</strong></span>
          <span class="zona-arquivo__texto">ou arraste e solte aqui. Imagens, formatação e omissões de palavras vêm junto.</span>
        </label>
        <details class="ajuda-anki">
          <summary>Como exportar do Anki</summary>
          <ol>
            <li>No Anki do computador, abra <strong>Arquivo → Exportar…</strong> (ou clique na engrenagem do baralho → <strong>Exportar</strong>).</li>
            <li>Em formato, escolha <strong>Pacote de baralhos do Anki (*.apkg)</strong>.</li>
            <li>Marque <strong>Incluir mídia</strong> (para trazer as imagens) e, se quiser manter o progresso, <strong>Incluir informações de agendamento</strong>.</li>
            <li>Salve e escolha o arquivo aqui.</li>
          </ol>
        </details>
        <p class="estado-anki" id="estado-anki" role="status" aria-live="polite" hidden></p>
      </section>
      <div id="anki-resultado"></div>`;

    const $ = s => el.querySelector(s);
    const entrada = $('#arquivo-anki');
    const zona = $('#zona-anki');
    const estado = $('#estado-anki');
    const area = $('#anki-resultado');

    const mostrarEstado = (texto, tipo = '') => {
      estado.hidden = !texto;
      estado.className = `estado-anki ${tipo ? `estado-anki--${tipo}` : ''}`;
      estado.innerHTML = tipo === 'carregando' ? `<span class="girando" aria-hidden="true"></span>${esc(texto)}` : esc(texto);
    };

    /* ----- Escolher / arrastar ----- */
    entrada.addEventListener('change', () => entrada.files[0] && abrir(entrada.files[0]));
    ['dragenter', 'dragover'].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.add('zona-arquivo--sobre'); }));
    ['dragleave', 'drop'].forEach(ev => zona.addEventListener(ev, () => zona.classList.remove('zona-arquivo--sobre')));
    zona.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) abrir(f); });

    async function abrir(arquivo) {
      if (ocupado) return;
      if (!/\.(apkg|colpkg)$/i.test(arquivo.name)) {
        mostrarEstado('Escolha um arquivo .apkg exportado pelo Anki.', 'erro');
        return;
      }
      ocupado = true;
      area.innerHTML = '';
      nomeArquivo = arquivo.name.replace(/\.(apkg|colpkg)$/i, '');
      try {
        lido = await Anki.ler(arquivo, msg => mostrarEstado(msg, 'carregando'));
        if (!lido.cartoes.length) {
          mostrarEstado('Não encontrei cartões neste arquivo.', 'erro');
          lido = null;
        } else {
          mostrarEstado(`Arquivo lido: ${arquivo.name} (${(arquivo.size / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB)`, 'ok');
          desenharResultado();
        }
      } catch (erro) {
        console.error(erro);
        mostrarEstado(erro.message || 'Não foi possível ler o arquivo.', 'erro');
      } finally {
        ocupado = false;
        entrada.value = '';
      }
    }

    /* ----- Resumo e opções ----- */
    /** Pastas que serão usadas com as opções atuais */
    function agrupar() {
      const grupos = new Map();
      for (const c of lido.cartoes) {
        const p = pastasDoBaralho(c.baralho, niveis);
        const k = chaveDe(p);
        if (!grupos.has(k)) grupos.set(k, { ...p, n: 0 });
        grupos.get(k).n++;
      }
      return grupos;
    }

    function desenharResultado() {
      const materias = Estado.materias();
      // Estrutura dos baralhos: profundidade e nomes de cada nível
      const caminhos = new Set(lido.cartoes.map(c => c.baralho.join('\u0001')));
      const profundidade = Math.max(...lido.cartoes.map(c => c.baralho.length));
      const nomesNivel = i => [...new Set(lido.cartoes.map(c => c.baralho[i]).filter(Boolean))];
      // Um único baralho no topo com muitos níveis abaixo (ex.: "Med::Física::Cinemática::…"): começa pelo 2º nível
      niveis.inicio = nomesNivel(0).length === 1 && profundidade >= 4 ? 1 : 0;
      niveis.separar = false;
      const exemplos = i => { const n = nomesNivel(i); return n.slice(0, 3).join(', ') + (n.length > 3 ? '…' : ''); };
      const tipos = { basico: 0, lacuna: 0, imagem: 0 };
      lido.cartoes.forEach(c => { tipos[c.tipo]++; });
      const comProgresso = lido.cartoes.filter(c => c.progresso.rep).length;
      const suspensos = lido.cartoes.filter(c => c.progresso.suspenso).length;
      const av = lido.avisos;
      const n3 = Ui.nivel3();

      area.innerHTML = `
        <section class="painel" aria-labelledby="t-anki-conteudo">
          <h2 class="painel__titulo painel__titulo--margem" id="t-anki-conteudo">2. O que tem no arquivo</h2>
          <div class="resumo resumo--compacto">
            <div class="resumo__item resumo__item--destaque"><span class="resumo__valor">${lido.cartoes.length.toLocaleString('pt-BR')}</span><span class="resumo__rotulo">cartões</span></div>
            <div class="resumo__item"><span class="resumo__valor">${caminhos.size}</span><span class="resumo__rotulo">${caminhos.size === 1 ? 'baralho' : 'baralhos'}</span></div>
            <div class="resumo__item"><span class="resumo__valor">${lido.imagens.length}</span><span class="resumo__rotulo">${lido.imagens.length === 1 ? 'imagem' : 'imagens'}</span></div>
            <div class="resumo__item"><span class="resumo__valor">${comProgresso}</span><span class="resumo__rotulo">já estudados no Anki</span></div>
          </div>
          <p class="painel__nota painel__nota--margem">
            ${[tipos.basico && Util.plural(tipos.basico, 'flashcard', 'flashcards'), tipos.lacuna && Util.plural(tipos.lacuna, 'de ocultação de palavras', 'de ocultação de palavras'), tipos.imagem && Util.plural(tipos.imagem, 'de imagem', 'de imagem')].filter(Boolean).join(' · ')}
            ${suspensos ? ` · ${Util.plural(suspensos, 'suspenso', 'suspensos')}` : ''}
          </p>
          ${(av.vazios || av.semImagem.length || av.sons) ? `
            <ul class="avisos-anki">
              ${av.vazios ? `<li>${Util.plural(av.vazios, 'cartão vazio ou sem pergunta foi ignorado', 'cartões vazios ou sem pergunta foram ignorados')}.</li>` : ''}
              ${av.semImagem.length ? `<li>${Util.plural(av.semImagem.length, 'imagem não veio', 'imagens não vieram')} no arquivo (exporte com <strong>Incluir mídia</strong> marcado).</li>` : ''}
              ${av.sons ? `<li>Os áudios não são importados (${Util.plural(av.sons, 'nota tem', 'notas têm')} som).</li>` : ''}
            </ul>` : ''}
        </section>

        <form class="painel" id="form-anki" aria-labelledby="t-anki-como" novalidate>
          <h2 class="painel__titulo painel__titulo--margem" id="t-anki-como">3. Como importar</h2>
          <div class="opcoes-anki" role="radiogroup" aria-labelledby="t-anki-como">
            <label class="opcao-anki">
              <input type="radio" name="modo" value="baralhos" checked>
              <span class="opcao-anki__textos">
                <span class="opcao-anki__titulo">Criar as pastas a partir dos baralhos</span>
                <span class="opcao-anki__texto">Baralho › Sub-baralho › Sub-sub-baralho viram Matéria › Frente › ${esc(n3)}. Pastas com o mesmo nome são aproveitadas.</span>
              </span>
            </label>
            <label class="opcao-anki">
              <input type="radio" name="modo" value="um-lugar">
              <span class="opcao-anki__textos">
                <span class="opcao-anki__titulo">Colocar tudo em uma pasta</span>
                <span class="opcao-anki__texto">Todos os cartões vão para ${Ui.art3('o')} ${esc(n3.toLowerCase())} que você escolher.</span>
              </span>
            </label>
          </div>

          <div id="niveis-anki">
            ${profundidade > 1 ? `
            <div class="niveis-anki">
              <label class="campo"><span class="campo__rotulo">A matéria começa no</span>
                <select id="anki-inicio">
                  ${Array.from({ length: Math.min(profundidade - 1, 3) }, (_, i) => `<option value="${i}" ${i === niveis.inicio ? 'selected' : ''}>${i + 1}º nível do Anki (${esc(exemplos(i))})</option>`).join('')}
                </select>
                <span class="campo__ajuda">Os níveis acima são deixados de lado. Use quando o primeiro baralho é só uma "caixa" que guarda os outros.</span></label>
              <label class="interruptor interruptor--compacto" id="campo-separar" ${profundidade - niveis.inicio > 3 ? '' : 'hidden'}>
                <span>Criar pastas separadas para os sub-baralhos mais fundos <span class="campo__ajuda">(desligado: eles entram ${Ui.art3('no')} ${esc(n3.toLowerCase())} de cima, sem criar uma pasta para cada um)</span></span>
                <input type="checkbox" id="anki-separar">
              </label>
            </div>` : ''}
            <p class="painel__nota" id="contagem-pastas"></p>
            <ul class="pastas-anki" id="pastas-anki" aria-label="Pastas que serão usadas"></ul>
          </div>

          <div class="grade-campos" id="destino-anki" hidden>
            <label class="campo"><span class="campo__rotulo">Matéria</span>
              <select id="anki-materia">${Ui.opcoes(materias, params.materia || (materias[0] || {}).id)}<option value="${NOVO}" ${materias.length ? '' : 'selected'}>+ Nova matéria…</option></select></label>
            <label class="campo" id="anki-campo-nova-materia" hidden><span class="campo__rotulo">Nome da nova matéria</span>
              <input type="text" id="anki-nova-materia" maxlength="80" value="${esc(nomeArquivo)}"></label>
            <label class="campo"><span class="campo__rotulo">Frente</span><select id="anki-assunto"></select></label>
            <label class="campo" id="anki-campo-nova-frente" hidden><span class="campo__rotulo">Nome da nova frente</span>
              <input type="text" id="anki-nova-frente" maxlength="80" value="Geral"></label>
            <label class="campo"><span class="campo__rotulo">${esc(n3)}</span><select id="anki-grupo"></select></label>
            <label class="campo" id="anki-campo-novo-grupo" hidden><span class="campo__rotulo">Nome — ${esc(Ui.novoNivel3().toLowerCase())}</span>
              <input type="text" id="anki-novo-grupo" maxlength="80" value="${esc(nomeArquivo)}"></label>
          </div>

          <label class="interruptor">
            <span>Manter o progresso do Anki <span class="campo__ajuda">(intervalos, próximas revisões e cartões suspensos)</span></span>
            <input type="checkbox" id="anki-progresso" ${comProgresso || suspensos ? 'checked' : ''}>
          </label>
          <label class="interruptor">
            <span>Ignorar cartões repetidos <span class="campo__ajuda">(mesma pergunta já existente na pasta)</span></span>
            <input type="checkbox" id="anki-duplicados" checked>
          </label>

          <details class="previa-anki">
            <summary>Ver os primeiros cartões</summary>
            <div class="tabela-rolagem"><table class="tabela tabela-previa">
              <thead><tr><th>Tipo</th><th>Frente</th><th>Verso</th></tr></thead>
              <tbody>${lido.cartoes.slice(0, 40).map(c => `
                <tr>
                  <td>${esc(Ui.TIPOS_CARTAO[c.tipo].nome)}</td>
                  <td>${c.tipo === 'lacuna' ? Util.lacunaParaHtml(c.frente, 'revelado') : Util.formatar(c.frente)}${c.imagem ? `<span class="selo">${Ui.icone('imagem')} imagem</span>` : ''}</td>
                  <td>${Util.formatar(c.verso)}${c.imgVerso && c.imgVerso.length ? `<span class="selo">${Ui.icone('imagem')} imagem</span>` : ''}</td>
                </tr>`).join('')}</tbody>
            </table></div>
          </details>

          <div class="progresso-anki" id="progresso-anki" hidden>
            <div class="progresso-anki__barra" role="progressbar" aria-label="Importação" aria-valuemin="0" aria-valuemax="100"><span></span></div>
            <p class="painel__nota" id="progresso-anki-texto"></p>
          </div>

          <div class="acoes-linha">
            <button type="submit" class="botao botao--primario botao--grande" id="anki-importar">${Ui.icone('importar')} Importar ${lido.cartoes.length.toLocaleString('pt-BR')} cartões</button>
          </div>
        </form>`;

      desenharPastas();
      const selInicio = $('#anki-inicio'), chkSeparar = $('#anki-separar');
      if (selInicio) selInicio.addEventListener('change', () => {
        niveis.inicio = Number(selInicio.value);
        $('#campo-separar').hidden = profundidade - niveis.inicio <= 3;
        if ($('#campo-separar').hidden) { niveis.separar = false; chkSeparar.checked = false; }
        desenharPastas();
      });
      if (chkSeparar) chkSeparar.addEventListener('change', () => { niveis.separar = chkSeparar.checked; desenharPastas(); });
      ligarFormulario();
    }

    function desenharPastas() {
      const grupos = [...agrupar().values()].sort((a, b) => chaveDe(a).localeCompare(chaveDe(b), 'pt-BR'));
      const conta = campo => new Set(grupos.map(g => campo(g).toLowerCase())).size;
      const nM = conta(g => g.materia), nF = conta(g => `${g.materia}|${g.frente}`), nA = grupos.length;
      $('#contagem-pastas').textContent = `Vai usar ${Util.plural(nM, 'matéria', 'matérias')}, ${Util.plural(nF, 'frente', 'frentes')} e ${nA} ${nA === 1 ? Ui.nivel3().toLowerCase() : Ui.nivel3().toLowerCase() + 's'}:`;
      $('#pastas-anki').innerHTML = grupos.slice(0, 80).map(g => `
        <li>${Ui.icone('pasta')}<span>${esc(g.materia)} <span class="pastas-anki__sep">›</span> ${esc(g.frente)} <span class="pastas-anki__sep">›</span> ${esc(g.assunto)}</span><span class="pastas-anki__n">${g.n}</span></li>`).join('')
        + (grupos.length > 80 ? `<li class="painel__nota">… e mais ${grupos.length - 80} pastas</li>` : '');
    }

    /* ----- Destino quando é "tudo em uma pasta" ----- */
    function ligarFormulario() {
      const f = $('#form-anki');
      const selM = $('#anki-materia'), selA = $('#anki-assunto'), selG = $('#anki-grupo');
      const trocarModo = () => {
        const umLugar = f.modo.value === 'um-lugar';
        $('#destino-anki').hidden = !umLugar;
        $('#niveis-anki').hidden = umLugar;
      };
      f.querySelectorAll('input[name="modo"]').forEach(r => r.addEventListener('change', trocarModo));

      function preencherA() {
        const novaM = selM.value === NOVO;
        $('#anki-campo-nova-materia').hidden = !novaM;
        const as = novaM ? [] : Estado.assuntosDe(selM.value);
        selA.innerHTML = Ui.opcoes(as, (as[0] || {}).id) + `<option value="${NOVO}" ${as.length ? '' : 'selected'}>+ Nova frente…</option>`;
        preencherG();
      }
      function preencherG() {
        const novaA = selA.value === NOVO;
        $('#anki-campo-nova-frente').hidden = !novaA;
        const gs = novaA ? [] : Estado.gruposDe(selA.value);
        selG.innerHTML = Ui.opcoes(gs, '') + `<option value="${NOVO}" selected>+ ${esc(Ui.novoNivel3())}…</option>`;
        $('#anki-campo-novo-grupo').hidden = selG.value !== NOVO;
      }
      selM.addEventListener('change', preencherA);
      selA.addEventListener('change', preencherG);
      selG.addEventListener('change', () => { $('#anki-campo-novo-grupo').hidden = selG.value !== NOVO; });
      preencherA();

      f.addEventListener('submit', async e => {
        e.preventDefault();
        if (ocupado) return;
        const umLugar = f.modo.value === 'um-lugar';
        let destino = null;
        if (umLugar) {
          const nome = id => $(id).value.trim();
          if (selM.value === NOVO && !nome('#anki-nova-materia')) { Util.aviso('Dê um nome à nova matéria.', 'erro'); return $('#anki-nova-materia').focus(); }
          if (selA.value === NOVO && !nome('#anki-nova-frente')) { Util.aviso('Dê um nome à nova frente.', 'erro'); return $('#anki-nova-frente').focus(); }
          if (selG.value === NOVO && !nome('#anki-novo-grupo')) { Util.aviso(`Dê um nome para ${Ui.art3('o')} ${Ui.art3('novo')} ${Ui.nivel3().toLowerCase()}.`, 'erro'); return $('#anki-novo-grupo').focus(); }
          destino = { m: selM.value, mNome: nome('#anki-nova-materia'), a: selA.value, aNome: nome('#anki-nova-frente'), g: selG.value, gNome: nome('#anki-novo-grupo') };
        }
        await importar({ destino, progresso: $('#anki-progresso').checked, ignorarRepetidos: $('#anki-duplicados').checked });
      });
    }

    /* =========================================================
       IMPORTAR
       ========================================================= */
    async function importar({ destino, progresso, ignorarRepetidos }) {
      ocupado = true;
      const botao = $('#anki-importar');
      const caixa = $('#progresso-anki'), barra = caixa.querySelector('span'), texto = $('#progresso-anki-texto');
      botao.disabled = true;
      caixa.hidden = false;
      const passo = (pct, msg) => { barra.style.width = `${Math.round(pct)}%`; caixa.firstElementChild.setAttribute('aria-valuenow', Math.round(pct)); texto.textContent = msg; };
      const respirar = () => new Promise(r => setTimeout(r, 0));

      try {
        // ----- 1. Imagens (comprimidas como as do editor) -----
        const imagens = {};
        const tipoPorExt = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif' };
        let falhas = 0;
        for (let i = 0; i < lido.imagens.length; i++) {
          const nome = lido.imagens[i];
          passo(i / Math.max(1, lido.imagens.length) * 70, `Preparando imagens… ${i + 1} de ${lido.imagens.length}`);
          try {
            const bytes = lido.abrirMidia(nome);
            const ext = (nome.split('.').pop() || '').toLowerCase();
            if (!bytes || !tipoPorExt[ext]) { falhas++; continue; }
            const blob = new Blob([bytes], { type: tipoPorExt[ext] });
            let natural = null;
            try { const bmp = await createImageBitmap(blob); natural = { l: bmp.width, a: bmp.height }; bmp.close && bmp.close(); } catch { /* SVG e outros */ }
            const { dataUrl } = await Util.comprimirImagem(blob);
            const id = Util.gerarId();
            await Banco.salvarImagem(id, dataUrl);
            imagens[nome] = { id, natural };
          } catch (erro) { console.warn('Imagem', nome, erro); falhas++; }
          if (i % 5 === 4) await respirar();
        }

        // ----- 2. Pastas -----
        passo(75, 'Criando as pastas…');
        const cores = Ui.CORES.map(c => c.valor);
        const porNome = (lista, nome) => lista.find(x => normalizar(x.nome) === normalizar(nome));
        const cache = new Map();
        const criadas = { materias: 0, frentes: 0, assuntos: 0 };
        let primeiraMateria = null;
        function pastaPara(baralho) {
          if (destino) {
            if (!cache.has('fixo')) {
              const mId = destino.m === NOVO ? Estado.criarMateria({ nome: destino.mNome, cor: cores[Estado.materias().length % cores.length], dias: [] }).id : destino.m;
              const aId = destino.a === NOVO ? Estado.criarAssunto(mId, destino.aNome).id : destino.a;
              const gId = destino.g === NOVO ? Estado.criarGrupo(aId, destino.gNome).id : destino.g;
              cache.set('fixo', { materiaId: mId, assuntoId: aId, grupoId: gId });
            }
            return cache.get('fixo');
          }
          const p = pastasDoBaralho(baralho, niveis);
          const k = chaveDe(p);
          if (cache.has(k)) return cache.get(k);
          let m = porNome(Estado.materias(), p.materia);
          if (!m) { m = Estado.criarMateria({ nome: p.materia, cor: cores[Estado.materias().length % cores.length], dias: [] }); criadas.materias++; }
          let a = porNome(Estado.assuntosDe(m.id), p.frente);
          if (!a) { a = Estado.criarAssunto(m.id, p.frente); criadas.frentes++; }
          let g = porNome(Estado.gruposDe(a.id), p.assunto);
          if (!g) { g = Estado.criarGrupo(a.id, p.assunto); criadas.assuntos++; }
          const r = { materiaId: m.id, assuntoId: a.id, grupoId: g.id };
          cache.set(k, r);
          return r;
        }

        // ----- 3. Cartões -----
        passo(85, 'Criando os cartões…');
        const existentes = new Map();   // grupoId → perguntas já existentes
        const perguntas = gId => {
          if (!existentes.has(gId)) existentes.set(gId, new Set(Estado.cartoes({ grupoId: gId }).map(c => normalizar(c.frente) + (c.tipo === 'imagem' ? '#imagem' : ''))));
          return existentes.get(gId);
        };
        let repetidos = 0;
        const novos = [];
        for (const c of lido.cartoes) {
          const local = pastaPara(c.baralho);
          primeiraMateria = primeiraMateria || local;
          const chave = normalizar(c.frente) + (c.tipo === 'imagem' ? '#imagem' : '');
          const vistas = perguntas(local.grupoId);
          if (ignorarRepetidos && chave && vistas.has(chave)) { repetidos++; continue; }
          vistas.add(chave);
          const dados = { ...local, tipo: c.tipo, frente: c.frente, verso: c.verso };
          if (c.tipo === 'imagem') {
            const img = imagens[c.imagem];
            if (!img) { // sem a imagem não dá para fazer o cartão de imagem: vira flashcard com o texto
              if (!c.frente) continue;
              dados.tipo = 'basico';
            } else {
              const escala = (v, eixo) => {
                const n = Number(v) || 0;
                // Coordenadas do Anki: frações (0–1) ou pixels da imagem original
                const frac = n > 1.5 && img.natural ? n / img.natural[eixo] : n;
                return Math.max(0, Math.min(100, Math.round(frac * 1000) / 10));
              };
              dados.imagem = {
                id: img.id, alt: c.frente || 'Imagem importada do Anki',
                sobreposicoes: c.formas.map(s => ({ id: Util.gerarId(), x: escala(s.x, 'l'), y: escala(s.y, 'a'), l: escala(s.l, 'l'), a: escala(s.a, 'a'), texto: '' })).filter(s => s.l > 0 && s.a > 0),
              };
            }
          } else if (c.tipo === 'basico' && c.imgVerso && c.imgVerso[0] && imagens[c.imgVerso[0]]) {
            dados.imagemVerso = { id: imagens[c.imgVerso[0]].id, alt: 'Imagem da resposta' };
          }
          if (progresso) { if (c.progresso.rep) dados.rep = c.progresso.rep; if (c.progresso.suspenso) dados.suspenso = true; }
          novos.push(dados);
        }
        const criados = Estado.criarCartoesEmLote(novos);
        await Estado.salvar();
        passo(100, 'Pronto!');

        const partes = [Util.plural(criados.length, 'cartão importado', 'cartões importados')];
        if (repetidos) partes.push(Util.plural(repetidos, 'repetido ignorado', 'repetidos ignorados'));
        if (falhas) partes.push(Util.plural(falhas, 'imagem não pôde ser lida', 'imagens não puderam ser lidas'));
        if (!criados.length && repetidos) Util.aviso(`Nada novo: ${Util.plural(repetidos, 'cartão já estava', 'cartões já estavam')} nas pastas.`, 'info');
        else Util.aviso(partes.join(' · '), 'sucesso');
        if (!destino && criadas.materias > 1) Rotas.ir('#/materias');
        else if (primeiraMateria) Rotas.ir(`#/materia/${primeiraMateria.materiaId}`);
        else Rotas.ir('#/materias');
      } catch (erro) {
        console.error(erro);
        Util.aviso(`Não foi possível importar: ${erro.message}`, 'erro');
        botao.disabled = false;
        caixa.hidden = true;
      } finally {
        ocupado = false;
      }
    }
  }

  return { render, pastasDoBaralho };
})();
