/* =============================================================
   paginas/cronograma.js — Organização da semana
   1. Dias de estudo de cada matéria (cronograma fixo, definido por você)
   2. Plano semanal: quais assuntos estudar em cada semana (e em qual dia)
   Endereço: #/cronograma?semana=AAAA-MM-DD (segunda-feira)
   ============================================================= */
'use strict';

Rotas.registrar('cronograma', {
  titulo: 'Cronograma',

  render(el, params) {
    const { esc } = Util;
    const materias = Estado.materias();
    const nivel3 = Ui.nivel3();
    const semanaAtual = Util.inicioSemana();
    const semana = params.semana ? Util.inicioSemana(params.semana) : semanaAtual;
    const itens = Estado.plano(semana);

    if (!materias.length) {
      el.innerHTML = `${Ui.cabecalho({ titulo: 'Cronograma' })}
        <section class="painel">${Ui.vazio({ icone: 'calendario', titulo: 'Nada para organizar ainda', texto: 'Crie matérias para montar seu cronograma semanal.', acoes: '<a class="botao botao--primario" href="#/materias">Ir para Matérias</a>' })}</section>`;
      return;
    }

    /* ----- Tabela matérias × dias ----- */
    const tabelaDias = `
      <div class="tabela-rolagem">
        <table class="tabela tabela-cronograma">
          <caption class="sr-only">Dias de estudo de cada matéria</caption>
          <thead>
            <tr>
              <th scope="col">Matéria</th>
              ${Util.ORDEM_SEMANA.map(d => `<th scope="col" class="centro"><abbr title="${Util.DIAS_LONGOS[d]}">${Util.DIAS_CURTOS[d]}</abbr></th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${materias.map(m => `
              <tr>
                <th scope="row"><span class="tabela-cronograma__materia">${Ui.pontoCor(m.cor)} ${esc(m.nome)}</span></th>
                ${Util.ORDEM_SEMANA.map(d => `
                  <td class="centro">
                    <label class="marcador-dia">
                      <input type="checkbox" data-materia="${m.id}" data-dia="${d}" ${m.dias.includes(d) ? 'checked' : ''}
                             aria-label="${esc(m.nome)} na ${Util.DIAS_LONGOS[d].toLowerCase()}">
                      <span aria-hidden="true">${Ui.icone('check')}</span>
                    </label>
                  </td>`).join('')}
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Matérias no dia</th>
              ${Util.ORDEM_SEMANA.map(d => `<td class="centro num-dia">${materias.filter(m => m.dias.includes(d)).length}</td>`).join('')}
            </tr>
          </tfoot>
        </table>
      </div>`;

    /* ----- Itens do plano agrupados por dia ----- */
    const linhaItem = item => {
      const a = Estado.assunto(item.assuntoId);
      if (!a) return '';
      const m = Estado.materia(a.materiaId);
      const g = item.grupoId ? Estado.grupo(item.grupoId) : null;
      const n = Estado.cartoes({ assuntoId: a.id, grupoId: g ? g.id : undefined }).length;
      return `
        <li class="item-plano ${item.feito ? 'item-plano--feito' : ''}">
          <label class="item-plano__check">
            <input type="checkbox" data-feito="${item.id}" ${item.feito ? 'checked' : ''}>
            <span class="sr-only">Concluído</span>
          </label>
          <div class="item-plano__textos">
            <span class="item-plano__titulo">${esc(a.nome)}${g ? ` <span class="item-plano__grupo">· ${esc(g.nome)}</span>` : ''}</span>
            <span class="item-plano__meta">${m ? Ui.chipMateria(m) : ''}<span class="painel__nota">${Util.plural(n, 'cartão', 'cartões')}</span></span>
          </div>
          <a class="botao botao--pequeno botao--fantasma botao--icone" href="#/estudar?materia=${a.materiaId}&assunto=${a.id}${g ? `&grupo=${g.id}` : ''}" aria-label="Estudar ${esc(a.nome)}" title="Estudar">${Ui.icone('play')}</a>
          <button class="botao botao--pequeno botao--fantasma botao--icone" data-remover="${item.id}" aria-label="Remover ${esc(a.nome)} do plano" title="Remover">${Ui.icone('fechar')}</button>
        </li>`;
    };

    const grupos = [{ dia: null, nome: 'Qualquer dia da semana' }, ...Util.ORDEM_SEMANA.map(d => ({ dia: d, nome: Util.DIAS_LONGOS[d] }))];
    const listaPlano = grupos.map(gr => {
      const doDia = itens.filter(i => i.dia === gr.dia);
      if (!doDia.length) return '';
      return `<div class="plano-dia"><h3 class="subtitulo-secao">${gr.nome}</h3><ul class="lista">${doDia.map(linhaItem).join('')}</ul></div>`;
    }).join('');

    const feitos = itens.filter(i => i.feito).length;

    el.innerHTML = `
      ${Ui.cabecalho({
        titulo: 'Cronograma',
        subtitulo: 'Defina os dias de cada matéria e planeje as frentes de cada semana.',
        acoes: Estado.atrasados().length
          ? `<a class="botao" href="#/reorganizar">${Ui.icone('calendario')} Reorganizar atrasados (${Estado.atrasados().length})</a>` : '',
      })}

      <section class="painel" aria-labelledby="t-dias">
        <div class="painel__cabecalho">
          <div>
            <h2 class="painel__titulo" id="t-dias">Dias de estudo por matéria</h2>
            <p class="painel__nota">As alterações são salvas na hora.</p>
          </div>
        </div>
        ${tabelaDias}
      </section>

      <section class="painel" aria-labelledby="t-plano">
        <div class="painel__cabecalho">
          <div>
            <h2 class="painel__titulo" id="t-plano">Plano da semana</h2>
            <p class="painel__nota">${itens.length ? `${feitos} de ${itens.length} concluídos` : 'Escolha as frentes que quer estudar nesta semana.'}</p>
          </div>
          <nav class="navegador-semana" aria-label="Escolher semana">
            <a class="botao botao--icone botao--pequeno" href="#/cronograma?semana=${Util.somarDias(semana, -7)}" aria-label="Semana anterior">${Ui.icone('voltar')}</a>
            <span class="navegador-semana__texto" aria-live="polite">${semana === semanaAtual ? 'Esta semana · ' : ''}${esc(Util.textoSemana(semana))}</span>
            <a class="botao botao--icone botao--pequeno" href="#/cronograma?semana=${Util.somarDias(semana, 7)}" aria-label="Próxima semana">${Ui.icone('avancar')}</a>
            ${semana !== semanaAtual ? `<a class="botao botao--pequeno botao--fantasma" href="#/cronograma">Hoje</a>` : ''}
          </nav>
        </div>

        <form class="form-plano" id="form-plano" novalidate>
          <label class="campo"><span class="campo__rotulo">Matéria</span>
            <select id="pl-materia">${Ui.opcoes(materias, materias[0].id)}</select></label>
          <label class="campo"><span class="campo__rotulo">Frente</span>
            <select id="pl-assunto"></select></label>
          <label class="campo"><span class="campo__rotulo">${esc(nivel3)}</span>
            <select id="pl-grupo"></select></label>
          <label class="campo"><span class="campo__rotulo">Dia</span>
            <select id="pl-dia"><option value="">Qualquer dia</option>${Util.ORDEM_SEMANA.map(d => `<option value="${d}">${Util.DIAS_LONGOS[d]}</option>`).join('')}</select></label>
          <button type="submit" class="botao botao--primario">${Ui.icone('mais')} Adicionar</button>
        </form>

        ${itens.length ? listaPlano : `
          <p class="painel__nota plano-vazio">Nenhuma frente nesta semana.
            ${Estado.plano(Util.somarDias(semana, -7)).length ? '<button class="botao botao--pequeno" data-acao="copiar">Copiar plano da semana anterior</button>' : ''}
          </p>`}
      </section>`;

    /* ----- Eventos: cronograma fixo ----- */
    el.querySelectorAll('[data-materia]').forEach(chk => {
      chk.addEventListener('change', () => {
        const m = Estado.materia(chk.dataset.materia);
        const dia = Number(chk.dataset.dia);
        const dias = chk.checked ? [...new Set([...m.dias, dia])] : m.dias.filter(x => x !== dia);
        Estado.atualizarMateria(m.id, { dias });
        // Atualiza só o total da coluna (sem redesenhar a página)
        const indice = Util.ORDEM_SEMANA.indexOf(dia);
        el.querySelectorAll('.num-dia')[indice].textContent = Estado.materias().filter(x => x.dias.includes(dia)).length;
      });
    });

    /* ----- Formulário do plano ----- */
    const selM = el.querySelector('#pl-materia'), selA = el.querySelector('#pl-assunto'), selG = el.querySelector('#pl-grupo');
    function preencherAssuntos() {
      const assuntos = Estado.assuntosDe(selM.value);
      selA.innerHTML = assuntos.length ? Ui.opcoes(assuntos, assuntos[0].id) : '<option value="">— sem frentes —</option>';
      preencherGrupos();
    }
    function preencherGrupos() {
      const gs = selA.value ? Estado.gruposDe(selA.value) : [];
      selG.innerHTML = `<option value="">Frente inteira</option>${Ui.opcoes(gs, '')}`;
    }
    selM.addEventListener('change', preencherAssuntos);
    selA.addEventListener('change', preencherGrupos);
    preencherAssuntos();

    el.querySelector('#form-plano').addEventListener('submit', e => {
      e.preventDefault();
      if (!selA.value) { Util.aviso('Esta matéria ainda não tem frentes.', 'erro'); return; }
      const dia = el.querySelector('#pl-dia').value;
      Estado.adicionarAoPlano(semana, { assuntoId: selA.value, grupoId: selG.value || null, dia: dia === '' ? null : Number(dia) });
      Util.aviso('Adicionado ao plano', 'sucesso');
      Rotas.recarregar();
    });

    /* ----- Itens do plano ----- */
    el.addEventListener('change', e => {
      const id = e.target.dataset && e.target.dataset.feito;
      if (id) { Estado.atualizarItemPlano(semana, id, { feito: e.target.checked }); Rotas.recarregar(); }
    });
    el.addEventListener('click', e => {
      const rem = e.target.closest('[data-remover]');
      if (rem) { Estado.removerItemPlano(semana, rem.dataset.remover); Rotas.recarregar(); return; }
      if (e.target.closest('[data-acao="copiar"]')) {
        const n = Estado.copiarPlano(Util.somarDias(semana, -7), semana);
        Util.aviso(`${Util.plural(n, 'item copiado', 'itens copiados')}`, 'sucesso');
        Rotas.recarregar();
      }
    });
  },
});
