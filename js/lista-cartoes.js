/* =============================================================
   lista-cartoes.js — Lista de cartões reutilizável
   Usada na pasta de uma frente e na Busca geral.
   • Paginação ("Mostrar mais")
   • Seleção de vários cartões com ações em lote:
     Mover para…, Suspender, Reativar e Excluir
   Uso:
     const lista = ListaCartoes.montar(elemento, { mostrarLocal, aoMudar });
     lista.definir(cartoes);   // troca os cartões exibidos (ex.: ao buscar)
   ============================================================= */
'use strict';

const ListaCartoes = (() => {
  const POR_PAGINA = 60;

  function montar(raiz, { mostrarLocal = false, aoMudar = () => Rotas.recarregar(), vazio = 'Nenhum cartão encontrado.' } = {}) {
    const { esc } = Util;
    let cartoes = [];
    let mostrando = POR_PAGINA;
    const selecionados = new Set();

    raiz.innerHTML = `
      <div class="lote" id="lote" aria-live="polite">
        <label class="lote__todos">
          <input type="checkbox" data-lote="todos" aria-label="Selecionar todos os cartões exibidos">
          <span class="lote__texto">Selecionar</span>
        </label>
        <span class="lote__acoes" hidden>
          <button type="button" class="botao botao--pequeno" data-lote="mover">${Ui.icone('pasta')} Mover para…</button>
          <button type="button" class="botao botao--pequeno" data-lote="suspender">Suspender</button>
          <button type="button" class="botao botao--pequeno" data-lote="reativar">Reativar</button>
          <button type="button" class="botao botao--pequeno botao--perigo" data-lote="excluir">${Ui.icone('lixeira')} Excluir</button>
          <button type="button" class="botao botao--pequeno botao--fantasma" data-lote="limpar">Limpar seleção</button>
        </span>
      </div>
      <ul class="lista lista-cartoes"></ul>
      <div class="lista-mais"></div>`;

    const lote = raiz.querySelector('.lote');
    const listaEl = raiz.querySelector('.lista-cartoes');
    const maisEl = raiz.querySelector('.lista-mais');
    const chkTodos = raiz.querySelector('[data-lote="todos"]');

    function linha(c) {
      const marcado = selecionados.has(c.id);
      return `
        <li class="linha-cartao ${marcado ? 'linha-cartao--marcada' : ''} ${c.suspenso ? 'linha-cartao--suspensa' : ''}">
          <label class="linha-cartao__check">
            <input type="checkbox" data-sel="${c.id}" ${marcado ? 'checked' : ''} aria-label="Selecionar cartão: ${esc(Ui.resumoCartao(c, 60) || 'imagem')}">
          </label>
          <a class="linha-cartao__conteudo" href="#/cartao/${c.id}" aria-label="Editar cartão: ${esc(Ui.resumoCartao(c, 60) || c.imagem?.alt || 'imagem')}">
            <span class="linha-cartao__frente">${c.imagem ? Ui.icone('imagem', 'linha-cartao__img') : ''}${esc(Ui.resumoCartao(c)) || '<em>(somente imagem)</em>'}</span>
            <span class="linha-cartao__verso">${c.tipo === 'lacuna' ? '<span class="selo">Ocultar palavra</span> ' : ''}${c.imagemVerso ? `${Ui.icone('imagem', 'linha-cartao__img')}` : ''}${esc(Ui.resumoVerso(c)) || (c.imagemVerso ? '<em>(imagem)</em>' : '')}</span>
            ${mostrarLocal ? `<span class="linha-cartao__local">${Ui.icone('pasta')} ${esc(Ui.localCartao(c))}</span>` : ''}
          </a>
          <span class="linha-cartao__lado">
            ${Ui.seloCartao(c)}
            <button class="botao botao--fantasma botao--pequeno botao--icone" data-excluir="${c.id}" aria-label="Excluir cartão" title="Excluir">${Ui.icone('lixeira')}</button>
          </span>
        </li>`;
    }

    function desenhar() {
      const visiveis = cartoes.slice(0, mostrando);
      listaEl.innerHTML = visiveis.map(linha).join('') || `<li class="linha-vazia">${esc(vazio)}</li>`;
      const restantes = cartoes.length - visiveis.length;
      maisEl.innerHTML = restantes > 0
        ? `<button class="botao botao--fantasma" data-mais>Mostrar mais (${restantes} restantes)</button>` : '';
      atualizarLote();
    }

    function atualizarLote() {
      // Remove da seleção cartões que não estão mais na lista (ex.: depois de uma busca)
      const ids = new Set(cartoes.map(c => c.id));
      [...selecionados].forEach(id => { if (!ids.has(id)) selecionados.delete(id); });
      const n = selecionados.size;
      lote.hidden = !cartoes.length;
      lote.classList.toggle('lote--ativo', n > 0);
      lote.querySelector('.lote__acoes').hidden = n === 0;
      lote.querySelector('.lote__texto').textContent = n ? `${Util.plural(n, 'selecionado', 'selecionados')}` : 'Selecionar todos';
      const visiveis = cartoes.slice(0, mostrando);
      chkTodos.checked = n > 0 && visiveis.every(c => selecionados.has(c.id));
      chkTodos.indeterminate = n > 0 && !chkTodos.checked;
      const escolhidos = cartoes.filter(c => selecionados.has(c.id));
      lote.querySelector('[data-lote="suspender"]').hidden = !escolhidos.some(c => !c.suspenso);
      lote.querySelector('[data-lote="reativar"]').hidden = !escolhidos.some(c => c.suspenso);
    }

    raiz.addEventListener('change', e => {
      const sel = e.target.closest('[data-sel]');
      if (sel) {
        if (sel.checked) selecionados.add(sel.dataset.sel); else selecionados.delete(sel.dataset.sel);
        sel.closest('.linha-cartao').classList.toggle('linha-cartao--marcada', sel.checked);
        atualizarLote();
      } else if (e.target === chkTodos) {
        const visiveis = cartoes.slice(0, mostrando);
        visiveis.forEach(c => (chkTodos.checked ? selecionados.add(c.id) : selecionados.delete(c.id)));
        desenhar();
      }
    });

    raiz.addEventListener('click', async e => {
      if (e.target.closest('[data-mais]')) { mostrando += POR_PAGINA; desenhar(); return; }

      const excluir = e.target.closest('[data-excluir]');
      if (excluir) {
        // Sem pergunta: o cartão vai para a lixeira e o aviso tem "Desfazer"
        const item = Estado.excluirCartao(excluir.dataset.excluir);
        aoMudar();
        Ui.avisoLixeira(item, 'Cartão excluído', aoMudar);
        return;
      }

      const acao = e.target.closest('[data-lote]')?.dataset.lote;
      if (!acao || acao === 'todos') return;
      const ids = [...selecionados];
      const qtd = Util.plural(ids.length, 'cartão', 'cartões');
      if (acao === 'limpar') { selecionados.clear(); desenhar(); return; }
      if (acao === 'mover') {
        const primeiro = Estado.cartao(ids[0]);
        const destino = await Ui.modalMover(ids.length, primeiro || {});
        if (!destino) return;
        const n = Estado.moverCartoes(ids, destino);
        Util.aviso(`${Util.plural(n, 'cartão movido', 'cartões movidos')} para ${Ui.localCartao(Estado.cartao(ids[0]))}`, 'sucesso');
      } else if (acao === 'suspender') {
        const n = Estado.suspenderCartoes(ids, true);
        Util.aviso(`${Util.plural(n, 'cartão suspenso', 'cartões suspensos')}: ${n === 1 ? 'não aparece' : 'não aparecem'} mais no estudo`, 'sucesso');
      } else if (acao === 'reativar') {
        const n = Estado.suspenderCartoes(ids, false);
        Util.aviso(`${Util.plural(n, 'cartão reativado', 'cartões reativados')}`, 'sucesso');
      } else if (acao === 'excluir') {
        if (!(await Util.confirmar(`Excluir ${qtd}? Vai para a <strong>lixeira</strong>: dá para restaurar por 30 dias.`, { titulo: 'Excluir cartões', botao: 'Excluir' }))) return;
        const item = Estado.excluirCartoes(ids);
        selecionados.clear();
        aoMudar();
        Ui.avisoLixeira(item, `${qtd} excluído${ids.length === 1 ? '' : 's'}`, aoMudar);
        return;
      }
      selecionados.clear();
      aoMudar();
    });

    return {
      definir(lista) { cartoes = lista; mostrando = POR_PAGINA; desenhar(); },
    };
  }

  return { montar };
})();
