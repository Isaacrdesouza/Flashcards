/* =============================================================
   paginas/estatisticas.js — Desempenho e histórico de estudos
   • Resumo (sequência, revisões, acerto, situação dos cartões)
   • Revisões dos últimos 30 dias e previsão dos próximos 14
   • Acerto por matéria e por assunto (7 dias, 30 dias ou tudo)
   • Cartões que você mais errou, com botão para revisar só eles
   • Histórico semanal: o que foi estudado em cada dia
   Endereço: #/estatisticas?semana=AAAA-MM-DD&periodo=7|30|tudo
   ============================================================= */
'use strict';

Rotas.registrar('estatisticas', {
  titulo: 'Estatísticas',

  render(el, params) {
    const { esc } = Util;
    const hojeIso = Util.hoje();
    const historico = Estado.historico();
    const porDia = Estado.revisoesPorDia();
    const seq = Estado.sequencia();
    const cartoes = Estado.cartoes();

    if (!historico.length && !cartoes.length) {
      el.innerHTML = `${Ui.cabecalho({ titulo: 'Estatísticas' })}
        <section class="painel">${Ui.vazio({ icone: 'grafico', titulo: 'Ainda não há dados', texto: 'Suas estatísticas aparecem aqui depois das primeiras revisões.' })}</section>`;
      return;
    }

    /* ----- Números gerais ----- */
    const inicio30 = Util.somarDias(hojeIso, -29);
    const ultimos30 = historico.filter(r => r.data >= inicio30);
    const acerto30 = ultimos30.length ? Math.round(ultimos30.filter(r => r.resposta > 1).length / ultimos30.length * 100) : null;
    const situacao = { novo: 0, aprendendo: 0, jovem: 0, maduro: 0 };
    cartoes.forEach(c => {
      if (c.rep.estado === 'novo') situacao.novo++;
      else if (c.rep.estado === 'aprendendo') situacao.aprendendo++;
      else if (Repeticao.ehMaduro(c.rep)) situacao.maduro++;
      else situacao.jovem++;
    });

    /* ----- Gráfico: últimos 30 dias ----- */
    const dados30 = [];
    for (let i = 29; i >= 0; i--) {
      const data = Util.somarDias(hojeIso, -i);
      dados30.push({ rotulo: Util.formatarData(data), valor: porDia[data] || 0, destaque: data === hojeIso });
    }

    /* ----- Gráfico: previsão dos próximos 14 dias ----- */
    const previsao = {};
    cartoes.forEach(c => {
      if (c.suspenso || c.rep.estado === 'novo' || !c.rep.vencimento) return;
      const data = c.rep.vencimento < hojeIso ? hojeIso : c.rep.vencimento; // atrasados contam para hoje
      previsao[data] = (previsao[data] || 0) + 1;
    });
    const dados14 = [];
    for (let i = 0; i < 14; i++) {
      const data = Util.somarDias(hojeIso, i);
      dados14.push({ rotulo: i === 0 ? 'Hoje' : Util.formatarData(data, { weekday: 'short', day: 'numeric' }), valor: previsao[data] || 0, destaque: i === 0 });
    }

    /* ----- Acerto por matéria e por assunto (período escolhido) ----- */
    const PERIODOS = { 7: '7 dias', 30: '30 dias', tudo: 'Tudo' };
    const periodo = PERIODOS[params.periodo] ? params.periodo : '30';
    const desde = Estado.inicioPeriodo(periodo);
    const doPeriodo = historico.filter(r => r.data >= desde);
    const taxa = lista => lista.length ? Math.round(lista.filter(r => r.resposta > 1).length / lista.length * 100) : null;
    const porMateria = Estado.materias().map(m => {
      const resp = doPeriodo.filter(r => r.materiaId === m.id);
      // Por assunto: usa o assunto atual do cartão (cartões excluídos ficam fora do detalhe)
      const porAssunto = {};
      resp.forEach(r => {
        const c = Estado.cartao(r.cartaoId);
        if (!c) return;
        (porAssunto[c.assuntoId] = porAssunto[c.assuntoId] || []).push(r);
      });
      const assuntos = Object.entries(porAssunto)
        .map(([aid, lista]) => ({ a: Estado.assunto(aid), total: lista.length, erros: lista.filter(r => r.resposta === 1).length, taxa: taxa(lista) }))
        .filter(x => x.a)
        .sort((x, y) => x.taxa - y.taxa);
      return { m, total: resp.length, erros: resp.filter(r => r.resposta === 1).length, taxa: taxa(resp), assuntos };
    }).filter(x => x.total > 0).sort((x, y) => x.taxa - y.taxa);
    const corTaxa = t => (t >= 85 ? 'boa' : t >= 65 ? 'media' : 'baixa');

    /* ----- Cartões respondidos errado no período ----- */
    const qsPeriodo = p => `#/estatisticas?periodo=${p}${params.semana ? `&semana=${params.semana}` : ''}`;

    /* ----- Histórico semanal ----- */
    const semanaAtual = Util.inicioSemana();
    const semana = params.semana ? Util.inicioSemana(params.semana) : semanaAtual;
    const diasHist = Util.ORDEM_SEMANA.map((_, i) => {
      const data = Util.somarDias(semana, i);
      const doDia = historico.filter(r => r.data === data);
      const contagem = {};
      doDia.forEach(r => { contagem[r.materiaId] = (contagem[r.materiaId] || 0) + 1; });
      const acertos = doDia.filter(r => r.resposta > 1).length;
      return { data, total: doDia.length, acertos, contagem };
    });
    const totalSemana = diasHist.reduce((s, d) => s + d.total, 0);

    el.innerHTML = `
      ${Ui.cabecalho({ titulo: 'Estatísticas', subtitulo: 'Seu ritmo de estudos e o que vem pela frente.' })}

      <section class="resumo" aria-label="Resumo geral">
        <div class="resumo__item resumo__item--destaque">
          <span class="resumo__valor">${Ui.icone('fogo', 'resumo__icone')}${seq.atual}</span>
          <span class="resumo__rotulo">dias seguidos (recorde: ${seq.maior})</span>
        </div>
        <div class="resumo__item">
          <span class="resumo__valor">${(porDia[hojeIso] || 0).toLocaleString('pt-BR')}</span>
          <span class="resumo__rotulo">revisões hoje</span>
        </div>
        <div class="resumo__item">
          <span class="resumo__valor">${acerto30 === null ? '—' : acerto30 + '%'}</span>
          <span class="resumo__rotulo">de acerto (30 dias)</span>
        </div>
        <div class="resumo__item">
          <span class="resumo__valor">${historico.length.toLocaleString('pt-BR')}</span>
          <span class="resumo__rotulo">revisões no total</span>
        </div>
      </section>

      <div class="estatisticas-grade">
        <section class="painel" aria-labelledby="t-30">
          <div class="painel__cabecalho">
            <h2 class="painel__titulo" id="t-30">Revisões nos últimos 30 dias</h2>
            <span class="painel__nota">${ultimos30.length.toLocaleString('pt-BR')} no período</span>
          </div>
          ${Ui.graficoBarras(dados30, { titulo: 'Revisões por dia nos últimos 30 dias' })}
        </section>

        <section class="painel" aria-labelledby="t-14">
          <div class="painel__cabecalho">
            <h2 class="painel__titulo" id="t-14">Revisões previstas</h2>
            <span class="painel__nota">próximos 14 dias</span>
          </div>
          ${Ui.graficoBarras(dados14, { titulo: 'Revisões previstas nos próximos 14 dias', unidade: 'cartões' })}
        </section>
      </div>

      <nav class="periodo" aria-label="Período das estatísticas de acerto">
        <span class="periodo__rotulo">Acertos e erros:</span>
        ${Object.entries(PERIODOS).map(([k, nome]) => `<a class="periodo__opcao" href="${qsPeriodo(k)}" ${k === periodo ? 'aria-current="true"' : ''}>${nome}</a>`).join('')}
      </nav>

      <div class="estatisticas-grade">
        <section class="painel" aria-labelledby="t-acerto">
          <div class="painel__cabecalho">
            <h2 class="painel__titulo" id="t-acerto">Taxa de acerto por matéria</h2>
            <span class="painel__nota">${periodo === 'tudo' ? 'todo o histórico' : `últimos ${periodo} dias`}</span>
          </div>
          ${porMateria.length ? `
            <ul class="acerto-materias" role="list">
              ${porMateria.map(x => `
                <li>
                  <details class="acerto-materia">
                    <summary>
                      <span class="acerto-materia__nome">${Ui.pontoCor(x.m.cor)}<span>${esc(x.m.nome)}</span></span>
                      <span class="acerto-materia__trilho" aria-hidden="true"><span class="acerto-materia__barra acerto--${corTaxa(x.taxa)}" style="width:${x.taxa}%"></span></span>
                      <span class="acerto-materia__taxa acerto-texto--${corTaxa(x.taxa)}">${x.taxa}%</span>
                      <span class="acerto-materia__meta">${Util.plural(x.total, 'resposta', 'respostas')} · ${Util.plural(x.erros, 'erro', 'erros')}</span>
                    </summary>
                    ${x.assuntos.length ? `
                      <ul class="acerto-assuntos" role="list">
                        ${x.assuntos.map(y => `
                          <li>
                            <span class="acerto-assuntos__nome">${esc(y.a.nome)}</span>
                            <span class="acerto-assuntos__meta">${y.total} resp. · ${Util.plural(y.erros, 'erro', 'erros')}</span>
                            <span class="acerto-assuntos__taxa acerto-texto--${corTaxa(y.taxa)}">${y.taxa}%</span>
                          </li>`).join('')}
                      </ul>` : '<p class="painel__nota">Sem detalhes por frente.</p>'}
                  </details>
                </li>`).join('')}
            </ul>
            <p class="painel__nota painel__nota--rodape">Toque em uma matéria para ver o acerto de cada frente. As piores aparecem primeiro.</p>`
          : `<p class="painel__nota">Sem respostas ${periodo === 'tudo' ? 'ainda' : `nos últimos ${periodo} dias`}.</p>`}
        </section>

        <section class="painel" aria-labelledby="t-situacao">
          <div class="painel__cabecalho">
            <h2 class="painel__titulo" id="t-situacao">Situação dos cartões</h2>
            <span class="painel__nota">${Util.plural(cartoes.length, 'cartão', 'cartões')}</span>
          </div>
          <dl class="situacao">
            <div><dt><span class="selo selo--novo">Novos</span></dt><dd>${situacao.novo}</dd><dd class="situacao__ajuda">nunca estudados</dd></div>
            <div><dt><span class="selo selo--aprendendo">Reaprender</span></dt><dd>${situacao.aprendendo}</dd><dd class="situacao__ajuda">erros recentes</dd></div>
            <div><dt><span class="selo">Jovens</span></dt><dd>${situacao.jovem}</dd><dd class="situacao__ajuda">intervalo &lt; 21 dias</dd></div>
            <div><dt><span class="selo selo--vencido">Maduros</span></dt><dd>${situacao.maduro}</dd><dd class="situacao__ajuda">intervalo ≥ 21 dias</dd></div>
          </dl>
        </section>
      </div>

      ${Ui.painelErrados({ periodo, max: 40, de: 'estatisticas' })}

      <section class="painel" aria-labelledby="t-hist">
        <div class="painel__cabecalho">
          <div>
            <h2 class="painel__titulo" id="t-hist">Histórico da semana</h2>
            <p class="painel__nota">${Util.plural(totalSemana, 'revisão', 'revisões')} nesta semana</p>
          </div>
          <nav class="navegador-semana" aria-label="Escolher semana do histórico">
            <a class="botao botao--icone botao--pequeno" href="#/estatisticas?semana=${Util.somarDias(semana, -7)}&periodo=${periodo}" aria-label="Semana anterior">${Ui.icone('voltar')}</a>
            <span class="navegador-semana__texto">${semana === semanaAtual ? 'Esta semana · ' : ''}${esc(Util.textoSemana(semana))}</span>
            <a class="botao botao--icone botao--pequeno" href="#/estatisticas?semana=${Util.somarDias(semana, 7)}&periodo=${periodo}" aria-label="Próxima semana">${Ui.icone('avancar')}</a>
          </nav>
        </div>
        <ol class="historico-semana">
          ${diasHist.map(d => `
            <li class="historico-dia ${d.data === hojeIso ? 'historico-dia--hoje' : ''} ${!d.total ? 'historico-dia--vazio' : ''}">
              <div class="historico-dia__cabecalho">
                <span class="historico-dia__nome">${Util.DIAS_LONGOS[Util.diaSemana(d.data)]}</span>
                <span class="historico-dia__data">${Util.formatarData(d.data)}</span>
              </div>
              ${d.total ? `
                <p class="historico-dia__total"><strong>${d.total}</strong> ${d.total === 1 ? 'revisão' : 'revisões'} · ${Math.round(d.acertos / d.total * 100)}% acertos</p>
                <ul class="historico-dia__materias">
                  ${Object.entries(d.contagem).map(([mid, n]) => {
                    const m = Estado.materia(mid);
                    return `<li>${m ? Ui.chipMateria(m) : '<span class="chip-materia">Matéria excluída</span>'} <span class="painel__nota">${n}</span></li>`;
                  }).join('')}
                </ul>` : `<p class="painel__nota">${d.data > hojeIso ? '—' : 'Sem estudo'}</p>`}
            </li>`).join('')}
        </ol>
      </section>`;
    Ui.ligarPainelErrados(el);
  },
});
