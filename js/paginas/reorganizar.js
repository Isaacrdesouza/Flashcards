/* =============================================================
   paginas/reorganizar.js — Reorganizar cartões atrasados
   Cartões cuja revisão venceu antes de hoje podem ser:
   • passados todos para amanhã, ou
   • distribuídos entre os dias que a pessoa escolher (até 14 dias à frente).
   Na distribuição, os mais atrasados vão primeiro e cada cartão vai para o
   dia escolhido que tiver menos revisões (contando as já agendadas).
   Endereço: #/reorganizar?materia=ID (matéria opcional)
   ============================================================= */
'use strict';

Rotas.registrar('reorganizar', {
  titulo: 'Reorganizar atrasados',

  render(el, params) {
    const { esc } = Util;
    const hojeIso = Util.hoje();
    const amanha = Util.somarDias(hojeIso, 1);
    const DIAS_A_FRENTE = 14;
    const proximosDias = Array.from({ length: DIAS_A_FRENTE + 1 }, (_, i) => Util.somarDias(hojeIso, i)); // hoje + 14

    let materiaId = params.materia && Estado.materia(params.materia) ? params.materia : '';
    let modo = 'amanha';                 // 'amanha' | 'distribuir'
    let escolhidos = new Set(proximosDias.slice(1, 4)); // padrão: próximos 3 dias

    const filtro = () => (materiaId ? { materiaId } : {});
    const nomeDia = iso => iso === hojeIso ? 'Hoje' : iso === amanha ? 'Amanhã' : Util.DIAS_CURTOS[Util.diaSemana(iso)];
    const dataCurta = iso => Util.formatarData(iso, { day: 'numeric', month: 'short' });
    const dataLonga = iso => Util.formatarData(iso, { weekday: 'long', day: 'numeric', month: 'long' });

    const materias = Estado.materias();
    const totalGeral = Estado.atrasados().length;

    el.innerHTML = `
      ${Ui.cabecalho({ voltar: '#/inicio', titulo: 'Reorganizar atrasados', subtitulo: 'Escolha para quando vão os cartões que ficaram para trás.' })}
      <div id="reorganizar"></div>`;
    const area = el.querySelector('#reorganizar');

    if (!totalGeral) {
      area.innerHTML = `<section class="painel">${Ui.vazio({ icone: 'check', titulo: 'Nenhum cartão atrasado', texto: 'Suas revisões estão em dia.', acoes: '<a class="botao botao--primario" href="#/inicio">Voltar ao início</a>' })}</section>`;
      return;
    }

    /** Distribui os cartões atrasados entre os dias de destino */
    function calcularPlano() {
      const lista = Estado.atrasados(filtro(), hojeIso);
      const destinos = modo === 'amanha' ? [amanha] : proximosDias.filter(d => escolhidos.has(d));
      const agendados = Estado.revisoesAgendadasPorDia(filtro());
      const carga = Object.fromEntries(destinos.map(d => [d, agendados[d] || 0]));
      const novos = Object.fromEntries(destinos.map(d => [d, 0]));
      const datas = {};
      if (destinos.length) {
        for (const c of lista) {
          // Dia com menos revisões; em caso de empate, o mais cedo
          let melhor = destinos[0];
          for (const d of destinos) if (carga[d] < carga[melhor]) melhor = d;
          datas[c.id] = melhor;
          carga[melhor]++;
          novos[melhor]++;
        }
      }
      return { lista, destinos, agendados, novos, datas };
    }

    function desenhar() {
      const p = calcularPlano();
      const maisAntigo = p.lista[0];
      const diasAtraso = maisAntigo ? Util.diferencaDias(maisAntigo.rep.vencimento, hojeIso) : 0;
      const maxBarra = Math.max(1, ...p.destinos.map(d => (p.agendados[d] || 0) + p.novos[d]));

      area.innerHTML = `
        <section class="painel" aria-labelledby="t-quais">
          <h2 class="painel__titulo painel__titulo--margem" id="t-quais">1. Quais cartões</h2>
          <div class="grade-campos">
            <label class="campo">
              <span class="campo__rotulo">Matéria</span>
              <select id="re-materia">
                <option value="">Todas as matérias (${totalGeral})</option>
                ${materias.map(m => {
                  const n = Estado.atrasados({ materiaId: m.id }, hojeIso).length;
                  return `<option value="${m.id}" ${m.id === materiaId ? 'selected' : ''} ${n ? '' : 'disabled'}>${esc(m.nome)} (${n})</option>`;
                }).join('')}
              </select>
            </label>
          </div>
          <p class="re-resumo" aria-live="polite">
            <strong>${Util.plural(p.lista.length, 'cartão atrasado', 'cartões atrasados')}</strong>
            ${maisAntigo ? ` · o mais antigo venceu há ${Util.plural(diasAtraso, 'dia', 'dias')} (${esc(dataCurta(maisAntigo.rep.vencimento))})` : ''}
          </p>
        </section>

        <section class="painel" aria-labelledby="t-quando">
          <h2 class="painel__titulo painel__titulo--margem" id="t-quando">2. Para quando</h2>
          <div class="re-opcoes" role="radiogroup" aria-labelledby="t-quando">
            <label class="re-opcao ${modo === 'amanha' ? 're-opcao--ativa' : ''}">
              <input type="radio" name="re-modo" value="amanha" ${modo === 'amanha' ? 'checked' : ''}>
              <span class="re-opcao__textos">
                <span class="re-opcao__titulo">Passar todos para amanhã</span>
                <span class="re-opcao__nota">${esc(dataLonga(amanha))}</span>
              </span>
            </label>
            <label class="re-opcao ${modo === 'distribuir' ? 're-opcao--ativa' : ''}">
              <input type="radio" name="re-modo" value="distribuir" ${modo === 'distribuir' ? 'checked' : ''}>
              <span class="re-opcao__textos">
                <span class="re-opcao__titulo">Distribuir entre os dias que eu escolher</span>
                <span class="re-opcao__nota">Os mais atrasados vão primeiro; dias com menos revisões recebem mais cartões.</span>
              </span>
            </label>
          </div>

          ${modo === 'distribuir' ? `
            <div class="re-dias">
              <div class="re-dias__atalhos">
                <button type="button" class="botao botao--pequeno" data-atalho="3">Próximos 3 dias</button>
                <button type="button" class="botao botao--pequeno" data-atalho="7">Próximos 7 dias</button>
                <button type="button" class="botao botao--pequeno" data-atalho="cronograma" title="Dias marcados no Cronograma">Dias do cronograma</button>
                <button type="button" class="botao botao--pequeno botao--fantasma" data-atalho="limpar">Limpar</button>
              </div>
              <fieldset class="re-dias__grade">
                <legend class="sr-only">Dias para receber os cartões</legend>
                ${proximosDias.map(d => `
                  <label class="re-dia ${escolhidos.has(d) ? 're-dia--marcado' : ''}">
                    <input type="checkbox" value="${d}" ${escolhidos.has(d) ? 'checked' : ''} aria-label="${esc(dataLonga(d))}${p.agendados[d] ? `, ${p.agendados[d]} já agendados` : ''}">
                    <span class="re-dia__nome" aria-hidden="true">${esc(nomeDia(d))}</span>
                    <span class="re-dia__data" aria-hidden="true">${Util.deISO(d).getDate()}</span>
                    <span class="re-dia__qtd" aria-hidden="true">${p.agendados[d] ? `${p.agendados[d]} agend.` : 'livre'}</span>
                  </label>`).join('')}
              </fieldset>
            </div>` : ''}
        </section>

        <section class="painel" aria-labelledby="t-previa">
          <div class="painel__cabecalho">
            <div>
              <h2 class="painel__titulo" id="t-previa">3. Prévia</h2>
              <p class="painel__nota">${p.destinos.length
                ? `${Util.plural(p.lista.length, 'cartão', 'cartões')} em ${Util.plural(p.destinos.length, 'dia', 'dias')}`
                : 'Escolha pelo menos um dia acima.'}</p>
            </div>
            <button type="button" class="botao botao--primario botao--grande" data-acao="aplicar" ${p.destinos.length && p.lista.length ? '' : 'disabled'}>${Ui.icone('check')} Reorganizar</button>
          </div>
          ${p.destinos.length ? `
            <ul class="re-previa" role="list">
              ${p.destinos.map(d => {
                const ja = p.agendados[d] || 0, novos = p.novos[d];
                return `
                  <li class="re-previa__linha">
                    <span class="re-previa__dia"><strong>${esc(nomeDia(d))}</strong> ${esc(dataCurta(d))}</span>
                    <span class="re-previa__barra" aria-hidden="true">
                      <span class="re-previa__ja" style="width:${ja / maxBarra * 100}%"></span><span class="re-previa__novos" style="width:${novos / maxBarra * 100}%"></span>
                    </span>
                    <span class="re-previa__numeros">${novos ? `<strong>+${novos}</strong> ${novos === 1 ? 'atrasado' : 'atrasados'}` : 'nenhum atrasado'}${ja ? ` · ${ja} já agendados` : ''}</span>
                  </li>`;
              }).join('')}
            </ul>
            <p class="re-legenda" aria-hidden="true"><span class="re-legenda__novos"></span> atrasados movidos <span class="re-legenda__ja"></span> já agendados</p>` : ''}
        </section>`;
    }

    desenhar();

    /* ----- Eventos (delegação: a área é redesenhada a cada mudança) ----- */
    area.addEventListener('change', e => {
      if (e.target.id === 're-materia') materiaId = e.target.value;
      else if (e.target.name === 're-modo') modo = e.target.value;
      else if (e.target.type === 'checkbox') {
        if (e.target.checked) escolhidos.add(e.target.value); else escolhidos.delete(e.target.value);
      } else return;
      const foco = e.target.type === 'checkbox' ? `input[value="${e.target.value}"]` : e.target.id ? `#${e.target.id}` : `input[name="re-modo"][value="${modo}"]`;
      desenhar();
      area.querySelector(foco)?.focus();
    });

    area.addEventListener('click', e => {
      const atalho = e.target.closest('[data-atalho]');
      if (atalho) {
        const tipo = atalho.dataset.atalho;
        if (tipo === 'limpar') escolhidos = new Set();
        else if (tipo === 'cronograma') {
          const dias = new Set((materiaId ? [Estado.materia(materiaId)] : materias).flatMap(m => m.dias));
          escolhidos = new Set(proximosDias.slice(1).filter(d => dias.has(Util.diaSemana(d))));
          if (!escolhidos.size) Util.aviso('Nenhum dia marcado no Cronograma para esta escolha.', 'erro');
        } else escolhidos = new Set(proximosDias.slice(1, 1 + Number(tipo)));
        desenhar();
        area.querySelector(`[data-atalho="${tipo}"]`)?.focus();
        return;
      }
      if (e.target.closest('[data-acao="aplicar"]')) {
        const p = calcularPlano();
        if (!p.lista.length || !p.destinos.length) return;
        const n = Estado.reagendarCartoes(p.datas);
        Util.aviso(modo === 'amanha'
          ? `${Util.plural(n, 'cartão passado', 'cartões passados')} para amanhã`
          : `${Util.plural(n, 'cartão distribuído', 'cartões distribuídos')} em ${Util.plural(p.destinos.length, 'dia', 'dias')}`, 'sucesso');
        Rotas.ir('#/inicio');
      }
    });
  },
});
