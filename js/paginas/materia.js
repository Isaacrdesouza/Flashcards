/* =============================================================
   paginas/materia.js — Navegação em pastas dentro de uma matéria
   Matéria → Assunto → Frente (nome do 3º nível configurável).
   • Na matéria: pastas de assuntos
   • No assunto: pastas de frentes
   • Na frente: os cartões, com busca, edição e exclusão
   Endereço: #/materia/ID?assunto=ID&grupo=ID
   ============================================================= */
'use strict';

Rotas.registrar('materia', {
  titulo: p => {
    const g = p.grupo ? Estado.grupo(p.grupo) : null;
    const a = p.assunto ? Estado.assunto(p.assunto) : null;
    return (g || a || Estado.materia(p.id) || {}).nome || 'Matéria';
  },

  render(el, params) {
    const { esc } = Util;
    const m = Estado.materia(params.id);
    if (!m) {
      el.innerHTML = Ui.cabecalho({ titulo: 'Matéria não encontrada', voltar: '#/materias' });
      return;
    }

    const nivel3 = Ui.nivel3();
    const n3 = nivel3.toLowerCase();

    // Pasta aberta (descarta ids que não pertencem a esta matéria)
    let grupoSel = params.grupo ? Estado.grupo(params.grupo) : null;
    let assuntoSel = params.assunto ? Estado.assunto(params.assunto) : null;
    if (grupoSel && !assuntoSel) assuntoSel = Estado.assunto(grupoSel.assuntoId);
    if (assuntoSel && assuntoSel.materiaId !== m.id) { assuntoSel = null; grupoSel = null; }
    if (grupoSel && (!assuntoSel || grupoSel.assuntoId !== assuntoSel.id)) grupoSel = null;
    const nivel = grupoSel ? 'frente' : assuntoSel ? 'assunto' : 'materia';

    /* ----- Endereços ----- */
    const base = `#/materia/${m.id}`;
    const hrefAssunto = a => `${base}?assunto=${a.id}`;
    const hrefFrente = g => `${base}?assunto=${g.assuntoId}&grupo=${g.id}`;
    const pai = nivel === 'frente' ? hrefAssunto(assuntoSel) : nivel === 'assunto' ? base : '#/materias';

    const filtro = { materiaId: m.id };
    if (assuntoSel) filtro.assuntoId = assuntoSel.id;
    if (grupoSel) filtro.grupoId = grupoSel.id;
    const filtroQS = `materia=${m.id}${assuntoSel ? `&assunto=${assuntoSel.id}` : ''}${grupoSel ? `&grupo=${grupoSel.id}` : ''}`;

    const pend = Estado.contarPendentes(filtro);
    const totalCartoes = Estado.cartoes(filtro).length;
    const suspensos = Estado.cartoes(filtro).filter(c => c.suspenso).length;

    /* ----- Caminho de pastas ----- */
    const trilha = Ui.trilha([
      { nome: 'Matérias', href: '#/materias' },
      { nome: m.nome, href: base },
      ...(assuntoSel ? [{ nome: assuntoSel.nome, href: hrefAssunto(assuntoSel) }] : []),
      ...(grupoSel ? [{ nome: grupoSel.nome, href: hrefFrente(grupoSel) }] : []),
    ]);

    /* ----- Cabeçalho (título e ações da pasta aberta) ----- */
    const atual = grupoSel || assuntoSel || m;
    const tipoAtual = nivel === 'frente' ? n3 : nivel === 'assunto' ? 'frente' : 'matéria';
    const resumo = [];
    if (nivel === 'materia') resumo.push(Util.plural(Estado.assuntosDe(m.id).length, 'frente', 'frentes'));
    if (nivel === 'assunto') resumo.push(`${Estado.gruposDe(assuntoSel.id).length} ${Estado.gruposDe(assuntoSel.id).length === 1 ? n3 : plural3(n3)}`);
    resumo.push(Util.plural(totalCartoes, 'cartão', 'cartões'));
    if (pend.total) resumo.push(`${pend.total} para hoje`);

    const acoesCabecalho = `
      ${pend.total ? `<a class="botao botao--primario" href="#/estudar?${filtroQS}">${Ui.icone('play')} Estudar (${pend.total})</a>` : ''}
      ${Estado.atrasados({ materiaId: m.id }).length ? `<a class="botao botao--fantasma" href="#/reorganizar?materia=${m.id}" title="Reorganizar cartões atrasados desta matéria">${Ui.icone('calendario')} Atrasados (${Estado.atrasados({ materiaId: m.id }).length})</a>` : ''}
      ${totalCartoes ? `<a class="botao botao--fantasma" href="#/estudar?${filtroQS}&livre=1" title="Revisa todos sem alterar a agenda">${Ui.icone('repetir')} Revisão livre</a>` : ''}
      ${nivel === 'materia'
        ? `<button class="botao" data-acao="editar-materia">${Ui.icone('editar')} Editar</button>
           <button class="botao botao--perigo botao--icone" data-acao="excluir-materia" aria-label="Excluir matéria" title="Excluir matéria">${Ui.icone('lixeira')}</button>`
        : `<button class="botao" data-acao="${nivel === 'frente' ? 'renomear-grupo' : 'renomear-assunto'}" data-id="${atual.id}">${Ui.icone('editar')} Renomear</button>
           <button class="botao botao--perigo botao--icone" data-acao="${nivel === 'frente' ? 'excluir-grupo' : 'excluir-assunto'}" data-id="${atual.id}" aria-label="Excluir ${esc(tipoAtual)}" title="Excluir ${esc(tipoAtual)}">${Ui.icone('lixeira')}</button>`}`;

    const cabecalho = Ui.cabecalho({
      voltar: pai,
      titulo: `${Ui.pasta(m.cor, 'pasta-icone--titulo')} ${esc(atual.nome)}`,
      subtitulo: `${nivel === 'materia' ? Ui.diasMini(m.dias) : ''} <span class="subtitulo-texto">${resumo.join(' · ')}</span> ${Ui.seloProva(m)}`,
      acoes: acoesCabecalho,
    });

    /* ----- Conteúdo da pasta ----- */
    let corpo;
    if (nivel === 'materia') corpo = painelPastas({
      titulo: 'Frentes',
      itens: Estado.assuntosDe(m.id),
      href: hrefAssunto,
      meta: a => {
        const nf = Estado.gruposDe(a.id).length;
        return `${nf} ${nf === 1 ? n3 : plural3(n3)} · ${Util.plural(Estado.cartoes({ assuntoId: a.id }).length, 'cartão', 'cartões')}`;
      },
      pendentes: a => Estado.contarPendentes({ assuntoId: a.id }).total,
      acaoNova: 'novo-assunto', rotuloNova: 'Nova frente',
      acaoRenomear: 'renomear-assunto', acaoExcluir: 'excluir-assunto',
      vazio: Ui.vazio({ icone: 'pasta', titulo: 'Nenhuma frente ainda', texto: `Crie a primeira frente desta matéria. Dentro dela você cria as pastas de ${esc(plural3(n3))}.`, acoes: '<button class="botao botao--primario" data-acao="novo-assunto">Nova frente</button>' }),
    });
    else if (nivel === 'assunto') corpo = painelPastas({
      titulo: plural3(nivel3),
      itens: Estado.gruposDe(assuntoSel.id),
      href: hrefFrente,
      meta: g => Util.plural(Estado.cartoes({ grupoId: g.id }).length, 'cartão', 'cartões'),
      pendentes: g => Estado.contarPendentes({ grupoId: g.id }).total,
      acaoNova: 'novo-grupo', rotuloNova: Ui.novoNivel3(),
      acaoRenomear: 'renomear-grupo', acaoExcluir: 'excluir-grupo',
      vazio: Ui.vazio({ icone: 'pasta', titulo: `${Ui.art3('nenhum').replace(/^./, x => x.toUpperCase())} ${esc(n3)} ainda`, texto: `Os cartões ficam dentro de ${Ui.art3('um')} ${esc(n3)}. Crie ${Ui.art3('o')} ${Ui.art3('primeiro')} para começar.`, acoes: `<button class="botao botao--primario" data-acao="novo-grupo">${esc(Ui.novoNivel3())}</button>` }),
    });
    else corpo = `
      <section class="painel" aria-labelledby="titulo-cartoes">
        <div class="painel__cabecalho">
          <div>
            <h2 class="painel__titulo" id="titulo-cartoes">Cartões</h2>
            <p class="painel__nota">${Util.plural(totalCartoes, 'cartão', 'cartões')}${pend.total ? ` · ${pend.revisar} para revisar · ${pend.novos} novos hoje` : ''}${suspensos ? ` · ${Util.plural(suspensos, 'suspenso', 'suspensos')}` : ''}</p>
          </div>
          <div class="painel__acoes">
            <a class="botao botao--primario botao--pequeno" href="#/cartao/novo?${filtroQS}">${Ui.icone('mais')} Cartão</a>
            <a class="botao botao--pequeno" href="#/importar?${filtroQS}">${Ui.icone('importar')} Colar vários</a>
          </div>
        </div>
        ${totalCartoes ? `
          <label class="busca">
            ${Ui.icone('busca')}
            <span class="sr-only">Buscar cartões</span>
            <input type="search" class="entrada" id="busca-cartoes" placeholder="Buscar na frente ou no verso…" autocomplete="off">
          </label>
          <div id="lista-cartoes"></div>`
        : Ui.vazio({ icone: 'cartoes', titulo: 'Nenhum cartão aqui', texto: 'Adicione cartões um a um ou cole vários de uma vez.', acoes: `<a class="botao botao--primario" href="#/cartao/novo?${filtroQS}">${Ui.icone('mais')} Novo cartão</a><a class="botao" href="#/importar?${filtroQS}">Colar vários</a>` })}
      </section>`;

    el.innerHTML = `${trilha}${cabecalho}${corpo}`;

    /** Plural simples do nome do 3º nível ("frente" → "frentes", "capítulo" → "capítulos") */
    function plural3(nome) {
      return /[aeiouáéíóú]$/i.test(nome) ? `${nome}s` : /r$|z$/i.test(nome) ? `${nome}es` : `${nome}s`;
    }

    /** Grade de pastas (assuntos ou frentes) com botão de criar */
    function painelPastas({ titulo, itens, href, meta, pendentes, acaoNova, rotuloNova, acaoRenomear, acaoExcluir, vazio }) {
      return `
        <section class="painel" aria-labelledby="titulo-pastas">
          <div class="painel__cabecalho">
            <h2 class="painel__titulo" id="titulo-pastas">${esc(titulo)}</h2>
            <button class="botao botao--pequeno" data-acao="${acaoNova}">${Ui.icone('mais')} ${esc(rotuloNova)}</button>
          </div>
          ${itens.length ? `
            <ul class="grade-pastas" role="list">
              ${itens.map(item => {
                const p = pendentes(item);
                return `
                  <li class="pasta">
                    <a class="pasta__link" href="${href(item)}">
                      ${Ui.pasta(m.cor)}
                      <span class="pasta__textos">
                        <span class="pasta__nome" title="${esc(item.nome)}">${esc(item.nome)}</span>
                        <span class="pasta__meta">${meta(item)}</span>
                        ${p ? `<span class="selo selo--vencido pasta__selo">${p} para hoje</span>` : ''}
                      </span>
                    </a>
                    <span class="pasta__acoes">
                      <button class="botao botao--fantasma botao--pequeno botao--icone" data-acao="${acaoRenomear}" data-id="${item.id}" aria-label="Renomear ${esc(item.nome)}" title="Renomear">${Ui.icone('editar')}</button>
                      <button class="botao botao--fantasma botao--pequeno botao--icone" data-acao="${acaoExcluir}" data-id="${item.id}" aria-label="Excluir ${esc(item.nome)}" title="Excluir">${Ui.icone('lixeira')}</button>
                    </span>
                  </li>`;
              }).join('')}
            </ul>` : vazio}
        </section>`;
    }

    /* ----- Lista de cartões (só dentro de uma frente): busca, seleção e ações em lote ----- */
    if (nivel === 'frente' && totalCartoes) {
      const todos = Estado.cartoes(filtro).sort((a, b) => b.criadoEm - a.criadoEm);
      const lista = ListaCartoes.montar(el.querySelector('#lista-cartoes'));
      lista.definir(todos);
      const busca = el.querySelector('#busca-cartoes');
      busca.addEventListener('input', Util.adiar(() => {
        const termo = Util.normalizar(busca.value.trim());
        lista.definir(termo ? todos.filter(c => Util.normalizar(textoBusca(c)).includes(termo)) : todos);
      }, 200));
    }

    /** Todo o texto pesquisável de um cartão */
    function textoBusca(c) {
      return Util.semFormatacao(`${c.frente} ${c.verso} ${(c.imagem?.sobreposicoes || []).map(s => s.texto).join(' ')}`).replace(/\{\{|\}\}/g, '');
    }

    /* ----- Ações (um único "ouvinte" para todos os botões) ----- */
    el.addEventListener('click', async evento => {
      const btn = evento.target.closest('[data-acao]');
      if (!btn) return;
      const id = btn.dataset.id;

      switch (btn.dataset.acao) {
        case 'editar-materia': {
          const dados = await Ui.modalMateria(m);
          if (dados) {
            const ajustados = Estado.atualizarMateria(m.id, dados);
            Util.aviso(ajustados ? `Matéria atualizada · ${Util.plural(ajustados, 'cartão reagendado', 'cartões reagendados')} para antes da prova` : 'Matéria atualizada', 'sucesso');
            Rotas.recarregar();
          }
          break;
        }
        case 'excluir-materia': {
          const n = Estado.cartoes({ materiaId: m.id }).length;
          if (await Util.confirmar(`Excluir <strong>${esc(m.nome)}</strong> com todas as frentes, ${esc(plural3(n3))} e ${Util.plural(n, 'cartão', 'cartões')}? Vai para a <strong>lixeira</strong>: dá para restaurar por 30 dias.`, { titulo: 'Excluir matéria', botao: 'Excluir' })) {
            const item = Estado.excluirMateria(m.id);
            Rotas.ir('#/materias');
            Ui.avisoLixeira(item, `Matéria "${m.nome}"`);
          }
          break;
        }
        case 'novo-assunto': {
          const nome = await Ui.modalNome({ titulo: 'Nova frente', rotulo: 'Nome da frente', confirmar: 'Criar' });
          if (nome) { const a = Estado.criarAssunto(m.id, nome); Rotas.ir(hrefAssunto(a)); }
          break;
        }
        case 'renomear-assunto': {
          const a = Estado.assunto(id);
          const nome = await Ui.modalNome({ titulo: 'Renomear frente', rotulo: 'Nome da frente', valor: a.nome });
          if (nome) { Estado.renomearAssunto(id, nome); Rotas.recarregar(); }
          break;
        }
        case 'excluir-assunto': {
          const a = Estado.assunto(id);
          const n = Estado.cartoes({ assuntoId: id }).length;
          if (await Util.confirmar(`Excluir a frente <strong>${esc(a.nome)}</strong> com suas pastas de ${esc(plural3(n3))} e ${Util.plural(n, 'cartão', 'cartões')}? Vai para a <strong>lixeira</strong>: dá para restaurar por 30 dias.`, { titulo: 'Excluir frente', botao: 'Excluir' })) {
            const item = Estado.excluirAssunto(id);
            if (assuntoSel && assuntoSel.id === id) Rotas.ir(base); else Rotas.recarregar();
            Ui.avisoLixeira(item, `Frente "${a.nome}"`);
          }
          break;
        }
        case 'novo-grupo': {
          const nome = await Ui.modalNome({ titulo: `${Ui.novoNivel3()} em "${assuntoSel.nome}"`, rotulo: 'Nome', confirmar: 'Criar' });
          if (nome) { const g = Estado.criarGrupo(assuntoSel.id, nome); Rotas.ir(hrefFrente(g)); }
          break;
        }
        case 'renomear-grupo': {
          const g = Estado.grupo(id);
          const nome = await Ui.modalNome({ titulo: `Renomear ${n3}`, rotulo: 'Nome', valor: g.nome });
          if (nome) { Estado.renomearGrupo(id, nome); Rotas.recarregar(); }
          break;
        }
        case 'excluir-grupo': {
          const g = Estado.grupo(id);
          const n = Estado.cartoes({ grupoId: id }).length;
          if (await Util.confirmar(`Excluir <strong>${esc(g.nome)}</strong> e ${Util.plural(n, 'cartão', 'cartões')}? Vai para a <strong>lixeira</strong>: dá para restaurar por 30 dias.`, { titulo: `Excluir ${n3}`, botao: 'Excluir' })) {
            const item = Estado.excluirGrupo(id);
            if (grupoSel && grupoSel.id === id) Rotas.ir(hrefAssunto(assuntoSel)); else Rotas.recarregar();
            Ui.avisoLixeira(item, `"${g.nome}"`);
          }
          break;
        }
      }
    });
  },
});
