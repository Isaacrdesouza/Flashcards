/* =============================================================
   paginas/importar.js — Criar muitos cartões colando texto
   (a aba "Arquivo do Anki" fica em paginas/importar-anki.js)
   Formato: uma linha por cartão →  pergunta ; resposta
   • Separador configurável ( ;  |  Tab )
   • Só a PRIMEIRA ocorrência do separador divide frente e verso
   • Linhas vazias e linhas começando com # são ignoradas
   • \n dentro do texto vira quebra de linha
   Endereço: #/importar?materia=ID&assunto=ID&grupo=ID
   ============================================================= */
'use strict';

Rotas.registrar('importar', {
  titulo: 'Importar cartões',

  render(el, params) {
    const { esc } = Util;
    const materias = Estado.materias();
    const nivel3 = Ui.nivel3();

    /* ----- Duas formas de importar: colar texto ou arquivo do Anki ----- */
    const modo = params.modo === 'anki' ? 'anki' : 'texto';
    const qsPasta = ['materia', 'assunto', 'grupo'].filter(k => params[k]).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
    const voltar = params.materia ? `#/materia/${params.materia}${params.assunto ? `?assunto=${params.assunto}${params.grupo ? `&grupo=${params.grupo}` : ''}` : ''}` : '';
    const abas = `
      <nav class="abas abas--importar" aria-label="Como importar">
        <a class="abas__aba" href="#/importar${qsPasta ? `?${qsPasta}` : ''}" ${modo === 'texto' ? 'aria-current="page"' : ''}>${Ui.icone('texto')} Colar texto</a>
        <a class="abas__aba" href="#/importar?modo=anki${qsPasta ? `&${qsPasta}` : ''}" ${modo === 'anki' ? 'aria-current="page"' : ''}>${Ui.icone('cartoes')} Arquivo do Anki (.apkg)</a>
      </nav>`;
    if (modo === 'anki') {
      el.innerHTML = `
        ${Ui.cabecalho({ titulo: 'Importar cartões', subtitulo: 'Traga seus baralhos do Anki com imagens, formatação e progresso.', voltar })}
        ${abas}
        <div class="importar" id="area-anki"></div>`;
      ImportarAnki.render(el.querySelector('#area-anki'), params);
      return;
    }

    if (!materias.length) {
      el.innerHTML = `${Ui.cabecalho({ titulo: 'Importar cartões' })}
        ${abas}
        <section class="painel">${Ui.vazio({ icone: 'importar', titulo: 'Crie uma matéria primeiro', texto: 'Os cartões colados são guardados dentro de uma matéria, de uma frente e de ' + Ui.art3('um') + ' ' + Util.esc(Ui.nivel3().toLowerCase()) + '. Um arquivo do Anki cria as pastas sozinho.', acoes: '<a class="botao botao--primario" href="#/materias">Ir para Matérias</a><a class="botao" href="#/importar?modo=anki">Importar do Anki</a>' })}</section>`;
      return;
    }

    let materiaId = params.materia && Estado.materia(params.materia) ? params.materia : materias[0].id;
    let assuntoId = params.assunto || '';
    let grupoId = params.grupo || '';
    const NOVO = '__novo__';

    const SEPARADORES = { ';': 'Ponto e vírgula ( ; )', '|': 'Barra vertical ( | )', '\t': 'Tabulação (colado do Excel)' };

    el.innerHTML = `
      ${Ui.cabecalho({
        titulo: 'Importar cartões',
        subtitulo: 'Crie dezenas de cartões de uma vez: uma linha por cartão.',
        voltar,
      })}
      ${abas}

      <form class="importar" id="form-importar" novalidate>
        <section class="painel" aria-labelledby="t-destino">
          <h2 class="painel__titulo painel__titulo--margem" id="t-destino">1. Destino</h2>
          <div class="grade-campos">
            <label class="campo"><span class="campo__rotulo">Matéria</span>
              <select id="imp-materia">${Ui.opcoes(materias, materiaId)}</select></label>
            <label class="campo"><span class="campo__rotulo">Frente</span>
              <select id="imp-assunto"></select></label>
            <label class="campo" id="campo-novo-assunto" hidden><span class="campo__rotulo">Nome da nova frente</span>
              <input type="text" id="imp-novo-assunto" maxlength="80" autocomplete="off"></label>
            <label class="campo"><span class="campo__rotulo">${esc(nivel3)}</span>
              <select id="imp-grupo"></select></label>
            <label class="campo" id="campo-novo-grupo" hidden><span class="campo__rotulo">Nome — ${esc(Ui.novoNivel3().toLowerCase())}</span>
              <input type="text" id="imp-novo-grupo" maxlength="80" autocomplete="off"></label>
          </div>
        </section>

        <section class="painel" aria-labelledby="t-texto">
          <div class="painel__cabecalho">
            <h2 class="painel__titulo" id="t-texto">2. Cole o texto</h2>
            <label class="campo campo--linha">
              <span class="campo__rotulo">Separador</span>
              <select id="imp-separador">
                ${Object.entries(SEPARADORES).map(([v, r]) => `<option value="${esc(v)}">${esc(r)}</option>`).join('')}
              </select>
            </label>
          </div>
          <label class="campo">
            <span class="sr-only">Texto dos cartões</span>
            <textarea id="imp-texto" class="texto-importar" rows="12" spellcheck="false"></textarea>
          </label>
          <p class="campo__ajuda">Formato: <code>pergunta ; resposta</code>, uma linha por cartão. Linhas que começam com <code>#</code> são ignoradas. No Excel, deixe a pergunta na coluna A e a resposta na coluna B, copie as duas colunas e escolha "Tabulação". Use <code>\\n</code> para quebrar linha dentro do cartão. Para ocultar uma palavra, escreva a frase com a palavra entre chaves duplas: <code>{{palavra}}</code> (não precisa de separador).</p>
          <label class="interruptor interruptor--compacto">
            <span>Ignorar cartões repetidos (mesma pergunta já existente na pasta)</span>
            <input type="checkbox" id="imp-duplicados" checked>
          </label>
        </section>

        <section class="painel" aria-labelledby="t-previa">
          <div class="painel__cabecalho">
            <div>
              <h2 class="painel__titulo" id="t-previa">3. Pré-visualização</h2>
              <p class="painel__nota" id="imp-resumo" aria-live="polite">Cole o texto acima para ver os cartões.</p>
            </div>
            <button type="submit" class="botao botao--primario botao--grande" id="imp-confirmar" disabled>${Ui.icone('importar')} Importar</button>
          </div>
          <div class="tabela-rolagem"><table class="tabela tabela-previa" id="imp-tabela" hidden>
            <thead><tr><th class="num">#</th><th>Frente</th><th>Verso</th><th>Situação</th></tr></thead>
            <tbody></tbody>
          </table></div>
        </section>
      </form>`;

    const $ = s => el.querySelector(s);
    const selMateria = $('#imp-materia'), selAssunto = $('#imp-assunto'), selGrupo = $('#imp-grupo');
    const texto = $('#imp-texto'), selSep = $('#imp-separador'), chkDup = $('#imp-duplicados');
    let linhasValidas = [];

    /* ----- Selects de destino ----- */
    function preencherAssuntos() {
      const assuntos = Estado.assuntosDe(materiaId);
      if (assuntoId !== NOVO && !assuntos.find(a => a.id === assuntoId)) assuntoId = assuntos[0] ? assuntos[0].id : NOVO;
      selAssunto.innerHTML = Ui.opcoes(assuntos, assuntoId) + `<option value="${NOVO}" ${assuntoId === NOVO ? 'selected' : ''}>+ Nova frente…</option>`;
      $('#campo-novo-assunto').hidden = assuntoId !== NOVO;
      preencherGrupos();
    }
    function preencherGrupos() {
      const grupos = assuntoId && assuntoId !== NOVO ? Estado.gruposDe(assuntoId) : [];
      // Toda carta fica dentro de uma frente: sem frentes, a opção é criar uma nova
      if (grupoId !== NOVO && !grupos.find(g => g.id === grupoId)) grupoId = grupos[0] ? grupos[0].id : NOVO;
      if (!grupos.length) grupoId = NOVO;
      selGrupo.innerHTML = `${Ui.opcoes(grupos, grupoId)}<option value="${NOVO}" ${grupoId === NOVO ? 'selected' : ''}>+ ${esc(Ui.novoNivel3())}…</option>`;
      $('#campo-novo-grupo').hidden = grupoId !== NOVO;
      atualizarPrevia();
    }
    selMateria.addEventListener('change', () => { materiaId = selMateria.value; preencherAssuntos(); });
    selAssunto.addEventListener('change', () => {
      assuntoId = selAssunto.value;
      $('#campo-novo-assunto').hidden = assuntoId !== NOVO;
      preencherGrupos();
      if (assuntoId === NOVO) $('#imp-novo-assunto').focus();
    });
    selGrupo.addEventListener('change', () => { grupoId = selGrupo.value; $('#campo-novo-grupo').hidden = grupoId !== NOVO; if (grupoId === NOVO) $('#imp-novo-grupo').focus(); });

    /* ----- Interpretação do texto colado ----- */
    function interpretar() {
      const sep = selSep.value;
      const existentes = new Set(
        assuntoId && assuntoId !== NOVO
          ? Estado.cartoes({ assuntoId }).map(c => c.frente.trim().toLowerCase())
          : []
      );
      const vistos = new Set();
      const quebra = s => s.replace(/\\n/g, '\n').trim();

      return texto.value.split(/\r?\n/).map((linha, i) => {
        const bruto = linha.trim();
        if (!bruto || bruto.startsWith('#')) return null;
        const pos = linha.indexOf(sep);
        // Frase com {{palavra}} vira cartão de ocultar palavra (o verso é opcional)
        const frente = quebra(pos === -1 ? linha : linha.slice(0, pos));
        const verso = pos === -1 ? '' : quebra(linha.slice(pos + sep.length));
        const tipo = Util.temLacuna(frente) ? 'lacuna' : 'basico';
        if (tipo === 'basico' && pos === -1) return { n: i + 1, frente: bruto, verso: '', tipo, situacao: 'sem-separador' };
        if (!frente || (tipo === 'basico' && !verso)) return { n: i + 1, frente, verso, tipo, situacao: 'incompleto' };
        const chave = frente.toLowerCase();
        const repetido = existentes.has(chave) || vistos.has(chave);
        vistos.add(chave);
        return { n: i + 1, frente, verso, tipo, situacao: repetido ? 'repetido' : 'ok' };
      }).filter(Boolean);
    }

    const ROTULOS = {
      ok: '<span class="selo selo--vencido">OK</span>',
      repetido: '<span class="selo selo--aprendendo">Repetido</span>',
      'sem-separador': '<span class="selo selo--aprendendo">Sem separador</span>',
      incompleto: '<span class="selo selo--aprendendo">Falta frente ou verso</span>',
    };

    function atualizarPrevia() {
      const linhas = interpretar();
      const ignorarDup = chkDup.checked;
      linhasValidas = linhas.filter(l => l.situacao === 'ok' || (l.situacao === 'repetido' && !ignorarDup));
      const problemas = linhas.filter(l => l.situacao === 'sem-separador' || l.situacao === 'incompleto').length;
      const repetidos = linhas.filter(l => l.situacao === 'repetido').length;

      const tabela = $('#imp-tabela');
      tabela.hidden = !linhas.length;
      const MAX = 200;
      tabela.querySelector('tbody').innerHTML = linhas.slice(0, MAX).map(l => `
        <tr class="${l.situacao === 'ok' || (l.situacao === 'repetido' && !ignorarDup) ? '' : 'linha-ignorada'}">
          <td class="num">${l.n}</td>
          <td>${l.tipo === 'lacuna' ? Util.lacunaParaHtml(l.frente, 'revelado') : Util.textoParaHtml(l.frente)}</td>
          <td>${Util.textoParaHtml(l.verso)}</td>
          <td>${l.situacao === 'repetido' && !ignorarDup ? ROTULOS.ok : ROTULOS[l.situacao]}</td>
        </tr>`).join('') + (linhas.length > MAX ? `<tr><td colspan="4" class="painel__nota">… e mais ${linhas.length - MAX} linhas</td></tr>` : '');

      $('#imp-resumo').textContent = linhas.length
        ? `${Util.plural(linhasValidas.length, 'cartão será criado', 'cartões serão criados')}` +
          (problemas ? ` · ${Util.plural(problemas, 'linha com problema', 'linhas com problema')}` : '') +
          (repetidos && ignorarDup ? ` · ${Util.plural(repetidos, 'repetido ignorado', 'repetidos ignorados')}` : '')
        : 'Cole o texto acima para ver os cartões.';

      const botao = $('#imp-confirmar');
      botao.disabled = !linhasValidas.length;
      botao.innerHTML = `${Ui.icone('importar')} Importar ${linhasValidas.length || ''}`;
    }

    texto.addEventListener('input', Util.adiar(atualizarPrevia, 200));
    selSep.addEventListener('change', atualizarPrevia);
    chkDup.addEventListener('change', atualizarPrevia);

    // Se o texto colado tiver tabulações, já sugere esse separador
    texto.addEventListener('paste', () => setTimeout(() => {
      if (texto.value.includes('\t') && !texto.value.includes(';')) { selSep.value = '\t'; atualizarPrevia(); }
    }, 0));

    preencherAssuntos();

    /* ----- Confirmar importação ----- */
    $('#form-importar').addEventListener('submit', e => {
      e.preventDefault();
      if (!linhasValidas.length) return;

      // Confere os nomes antes de criar qualquer pasta
      const nomeAssunto = $('#imp-novo-assunto').value.trim();
      const nomeGrupo = $('#imp-novo-grupo').value.trim();
      if (assuntoId === NOVO && !nomeAssunto) { Util.aviso('Dê um nome à nova frente.', 'erro'); $('#imp-novo-assunto').focus(); return; }
      if ((grupoId === NOVO || !grupoId) && !nomeGrupo) {
        Util.aviso(`Dê um nome para ${Ui.art3('o')} ${Ui.art3('novo')} ${nivel3.toLowerCase()}.`, 'erro');
        $('#imp-novo-grupo').focus();
        return;
      }

      // Cria assunto / frente novos, se escolhidos
      const aId = assuntoId === NOVO ? Estado.criarAssunto(materiaId, nomeAssunto).id : assuntoId;
      const gId = grupoId === NOVO || !grupoId ? Estado.criarGrupo(aId, nomeGrupo).id : grupoId;

      const criados = Estado.criarCartoesEmLote(linhasValidas.map(l => ({
        materiaId, assuntoId: aId, grupoId: gId, tipo: l.tipo, frente: l.frente, verso: l.verso,
      })));
      Util.aviso(`${Util.plural(criados.length, 'cartão importado', 'cartões importados')}!`, 'sucesso');
      Rotas.ir(`#/materia/${materiaId}?assunto=${aId}&grupo=${gId}`);
    });
  },
});
