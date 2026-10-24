/* =============================================================
   paginas/inicio.js — Tela inicial
   Mostra: resumo do dia, matérias de hoje (pelo cronograma),
   outras matérias com pendências e a semana.
   ============================================================= */
'use strict';

Rotas.registrar('inicio', {
  titulo: 'Início',

  render(el, params = {}) {
    const { esc } = Util;
    const materias = Estado.materias();
    const hojeIso = Util.hoje();
    const diaHoje = Util.diaSemana(hojeIso);
    const dataLonga = Util.deISO(hojeIso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

    /* ----- Primeiro acesso: nenhum dado ainda ----- */
    if (!materias.length) {
      el.innerHTML = `
        ${Ui.cabecalho({ titulo: 'Bons estudos!', subtitulo: esc(dataLonga) })}
        ${Tutoriais.painel()}
        <section class="painel">
          ${Ui.vazio({
            icone: 'livro',
            titulo: 'Comece criando sua primeira matéria',
            texto: 'Organize seus estudos em Matéria → Frente → ' + esc(Ui.nivel3()) + ', defina os dias de cada matéria e adicione flash cards um a um ou colando vários de uma vez.',
            acoes: `
              <button class="botao botao--primario botao--grande" id="btn-nova-materia">${Ui.icone('mais')} Nova matéria</button>
              <a class="botao botao--grande" href="#/configuracoes">Restaurar backup</a>`,
          })}
        </section>`;
      el.querySelector('#btn-nova-materia').addEventListener('click', criarMateria);
      Tutoriais.ligarPainel(el);
      return;
    }

    const cfg0 = () => Estado.config();

    /* ----- Cálculos do dia ----- */
    const deHoje = materias.filter(m => m.dias.includes(diaHoje));
    const pendHoje = Estado.contarPendentes({ materiaIds: deHoje.map(m => m.id) });
    const pendGeral = Estado.contarPendentes();
    const seq = Estado.sequencia();
    const revisoesDia = Estado.revisoesPorDia();
    const feitasHoje = Estado.revisoesHoje(); // inclui a revisão livre se a opção estiver ligada
    const meta = cfg0().metaDiaria || 0;
    const pctMeta = meta ? Math.min(100, Math.round(feitasHoje / meta * 100)) : 0;

    // Matérias fora do cronograma de hoje que têm revisões atrasadas
    const outras = materias
      .filter(m => !m.dias.includes(diaHoje))
      .map(m => ({ m, p: Estado.contarPendentes({ materiaId: m.id }) }))
      .filter(x => x.p.revisar > 0);

    /* ----- Cartões atrasados (venceram antes de hoje) ----- */
    const atrasados = Estado.atrasados();
    const diasAtraso = atrasados.length ? Util.diferencaDias(atrasados[0].rep.vencimento, hojeIso) : 0;

    /* ----- Linha de uma matéria na lista "Hoje" ----- */
    const linhaMateria = (m, p) => `
      <li class="linha-materia">
        <span class="linha-materia__cor" style="--cor:${esc(m.cor)}" aria-hidden="true"></span>
        <a class="linha-materia__nome" href="#/materia/${m.id}">${esc(m.nome)}</a>
        <span class="linha-materia__contagens">
          ${p.revisar ? `<span class="contagem contagem--revisar" title="Para revisar">${p.revisar}<span class="sr-only"> para revisar</span></span>` : ''}
          ${p.novos ? `<span class="contagem contagem--novos" title="Novos">${p.novos}<span class="sr-only"> novos</span></span>` : ''}
          ${!p.total ? `<span class="em-dia">${Ui.icone('check')} Em dia</span>` : ''}
        </span>
        ${p.total
          ? `<a class="botao botao--pequeno" href="#/estudar?materia=${m.id}" aria-label="Estudar ${esc(m.nome)}">${Ui.icone('play')} Estudar</a>`
          : `<a class="botao botao--pequeno botao--fantasma" href="#/estudar?materia=${m.id}&livre=1" aria-label="Revisão livre de ${esc(m.nome)}">Revisão livre</a>`}
      </li>`;

    /* ----- Semana atual ----- */
    const semana = Util.inicioSemana(hojeIso);
    const colunasSemana = Util.ORDEM_SEMANA.map((dia, i) => {
      const data = Util.somarDias(semana, i);
      const ehHoje = data === hojeIso;
      const passado = data < hojeIso;
      const daMateria = materias.filter(m => m.dias.includes(dia));
      const feitas = revisoesDia[data] || 0;
      return `
        <li class="dia-semana ${ehHoje ? 'dia-semana--hoje' : ''} ${passado ? 'dia-semana--passado' : ''}" ${ehHoje ? 'aria-current="date"' : ''}>
          <div class="dia-semana__topo">
            <span class="dia-semana__nome">${Util.DIAS_CURTOS[dia]}</span>
            <span class="dia-semana__data">${Util.deISO(data).getDate()}</span>
          </div>
          <div class="dia-semana__itens">
            ${daMateria.map(m => `<span class="dia-semana__materia" style="--cor:${esc(m.cor)}" title="${esc(m.nome)}">${esc(m.nome)}</span>`).join('')}
            ${!daMateria.length ? '<span class="dia-semana__livre">Livre</span>' : ''}
          </div>
          ${feitas ? `<span class="dia-semana__feitas">${Ui.icone('check')} ${feitas}<span class="sr-only"> revisões feitas</span></span>` : ''}
        </li>`;
    }).join('');

    /* ----- Próximas provas (contagem regressiva) ----- */
    const provas = Estado.provasFuturas();

    /* ----- Cartões respondidos errado (período escolhido na própria tela) ----- */
    const periodoErro = ['7', '30', 'tudo'].includes(params.errados) ? params.errados : '30';

    /* ----- Montagem da página ----- */
    el.innerHTML = `
      ${Ui.cabecalho({
        titulo: 'Bons estudos!',
        subtitulo: esc(dataLonga.charAt(0).toUpperCase() + dataLonga.slice(1)),
        acoes: `<a class="botao" href="#/busca">${Ui.icone('busca')} Buscar</a><a class="botao" href="#/materias">${Ui.icone('livro')} Matérias</a>`,
      })}

      ${atrasados.length ? `
        <div class="faixa faixa--atraso" role="note">
          <p><strong>${Util.plural(atrasados.length, 'cartão atrasado', 'cartões atrasados')}</strong> · o mais antigo venceu há ${Util.plural(diasAtraso, 'dia', 'dias')}. Passe para amanhã ou distribua entre os próximos dias.</p>
          <a class="botao botao--pequeno" href="#/reorganizar">${Ui.icone('calendario')} Reorganizar</a>
        </div>` : ''}

      ${provas.length ? `
        <section class="provas" aria-label="Próximas provas">
          ${provas.map(x => {
            const pct = x.total ? Math.round((x.total - x.novos) / x.total * 100) : 0;
            const novosLimite = Estado.config().novosPorDia;
            return `
              <a class="prova ${x.dias <= 7 ? 'prova--perto' : ''}" href="#/materia/${x.m.id}" style="--cor:${esc(x.m.cor)}">
                <span class="prova__contagem">
                  <span class="prova__numero">${x.dias === 0 ? 'Hoje' : x.dias}</span>
                  <span class="prova__unidade">${x.dias === 0 ? '' : x.dias === 1 ? 'dia' : 'dias'}</span>
                </span>
                <span class="prova__textos">
                  <span class="prova__nome">${Ui.pontoCor(x.m.cor)} Prova de ${esc(x.m.nome)}</span>
                  <span class="prova__data">${esc(Util.formatarData(x.m.prova, { weekday: 'long', day: 'numeric', month: 'long' }))}</span>
                  <span class="prova__barra" aria-hidden="true"><span style="width:${pct}%"></span></span>
                  <span class="prova__info">${x.total
                    ? `${pct}% dos cartões já estudados${x.novos ? ` · faltam ${Util.plural(x.novos, 'novo', 'novos')}${x.dias > 0 ? ` (~${x.porDia} por dia)` : ''}` : ''}${x.porDia > novosLimite && x.dias > 0 ? ' · <strong>aumente o limite de novos por dia em Ajustes</strong>' : ''}`
                    : 'Nenhum cartão nesta matéria ainda'}</span>
                </span>
              </a>`;
          }).join('')}
        </section>` : ''}

      ${Tutoriais.painel()}

      <section class="resumo" aria-label="Resumo do dia">
        <div class="resumo__item resumo__item--destaque">
          <span class="resumo__valor">${pendHoje.total}</span>
          <span class="resumo__rotulo">para hoje no cronograma</span>
        </div>
        ${meta ? `
        <div class="resumo__item resumo__item--meta ${feitasHoje >= meta ? 'resumo__item--batida' : ''}">
          <span class="resumo__valor">${feitasHoje >= meta ? Ui.icone('check', 'resumo__icone resumo__icone--ok') : ''}${feitasHoje}<span class="resumo__de">/${meta}</span></span>
          <span class="resumo__rotulo">${feitasHoje >= meta ? 'meta do dia batida!' : `meta do dia · faltam ${meta - feitasHoje}`}</span>
          <span class="meta-barra" role="progressbar" aria-label="Meta diária" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pctMeta}"><span style="width:${pctMeta}%"></span></span>
        </div>` : `
        <div class="resumo__item">
          <span class="resumo__valor">${feitasHoje}</span>
          <span class="resumo__rotulo">revisões feitas hoje · <a href="#/configuracoes">definir meta</a></span>
        </div>`}
        <div class="resumo__item">
          <span class="resumo__valor">${Ui.icone('fogo', 'resumo__icone')}${seq.atual}</span>
          <span class="resumo__rotulo">${seq.atual === 1 ? 'dia seguido' : 'dias seguidos'}</span>
        </div>
        <div class="resumo__item">
          <span class="resumo__valor">${Estado.totalCartoes().toLocaleString('pt-BR')}</span>
          <span class="resumo__rotulo">cartões no total</span>
        </div>
      </section>

      <div class="inicio-grade inicio-grade--metade">
        ${Ui.painelErrados({ periodo: periodoErro, max: 5, hrefPeriodo: k => `#/inicio?errados=${k}`, verTodos: `#/estatisticas?periodo=${periodoErro}` })}

        <section class="painel" aria-labelledby="titulo-hoje">
          <div class="painel__cabecalho">
            <div>
              <h2 class="painel__titulo" id="titulo-hoje">Hoje · ${Util.DIAS_LONGOS[diaHoje]}</h2>
              <p class="painel__nota">${deHoje.length ? Util.plural(deHoje.length, 'matéria', 'matérias') + ' no cronograma' : 'Nenhuma matéria marcada para hoje'}</p>
            </div>
            ${pendHoje.total ? `<a class="botao botao--primario" href="#/estudar?escopo=hoje">${Ui.icone('play')} Estudar tudo (${pendHoje.total})</a>` : ''}
          </div>
          ${deHoje.length
            ? `<ul class="lista">${deHoje.map(m => linhaMateria(m, Estado.contarPendentes({ materiaId: m.id }))).join('')}</ul>`
            : `<p class="painel__nota">Defina os dias de cada matéria no <a href="#/cronograma">Cronograma</a>.</p>`}

          ${outras.length ? `
            <h3 class="subtitulo-secao">Atrasadas de outros dias</h3>
            <ul class="lista">${outras.map(x => linhaMateria(x.m, x.p)).join('')}</ul>` : ''}

          ${!pendHoje.total && pendGeral.total ? `<p class="painel__nota painel__nota--rodape">Ainda há ${Util.plural(pendGeral.total, 'cartão pendente', 'cartões pendentes')} em outras matérias. <a href="#/estudar?escopo=tudo">Estudar tudo</a></p>` : ''}
        </section>
      </div>

        <section class="painel" aria-labelledby="titulo-semana">
          <div class="painel__cabecalho">
            <div>
              <h2 class="painel__titulo" id="titulo-semana">Sua semana</h2>
              <p class="painel__nota">Matérias do cronograma e revisões feitas</p>
            </div>
            <a class="botao botao--pequeno botao--fantasma" href="#/estatisticas">Histórico ${Ui.icone('avancar')}</a>
          </div>
          <ol class="semana semana--compacta">${colunasSemana}</ol>
        </section>`;

    /* ----- Eventos ----- */
    Ui.ligarPainelErrados(el);
    Tutoriais.ligarPainel(el);

    async function criarMateria() {
      const dados = await Ui.modalMateria();
      if (!dados) return;
      const m = Estado.criarMateria(dados);
      Util.aviso('Matéria criada!', 'sucesso');
      Rotas.ir(`#/materia/${m.id}`);
    }
  },
});
