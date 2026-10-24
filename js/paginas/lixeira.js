/* =============================================================
   paginas/lixeira.js — Itens excluídos (restauráveis por 30 dias)
   • Restaurar: volta para o lugar de origem (a pasta de origem é
     restaurada junto, se também estiver na lixeira)
   • Excluir definitivamente / Esvaziar lixeira
   Endereço: #/lixeira
   ============================================================= */
'use strict';

Rotas.registrar('lixeira', {
  titulo: 'Lixeira',

  render(el) {
    const { esc } = Util;
    const itens = Estado.lixeira();
    const TIPOS = {
      materia: { nome: 'Matéria', icone: 'livro' },
      assunto: { nome: 'Frente', icone: 'pasta' },
      grupo: { nome: Ui.nivel3(), icone: 'pasta' },
      cartao: { nome: 'Cartão', icone: 'cartoes' },
      cartoes: { nome: 'Cartões', icone: 'cartoes' },
    };

    const conteudo = dd => [
      dd.materias.length && Util.plural(dd.materias.length, 'matéria', 'matérias'),
      dd.assuntos.length && Util.plural(dd.assuntos.length, 'frente', 'frentes'),
      dd.grupos.length && Util.plural(dd.grupos.length, Ui.nivel3().toLowerCase(), Ui.nivel3().toLowerCase() + 's'),
      dd.cartoes.length && Util.plural(dd.cartoes.length, 'cartão', 'cartões'),
    ].filter(Boolean).join(' · ');

    const quando = ts => {
      const dias = Util.diferencaDias(Util.dataISO(new Date(ts)), Util.hoje());
      return dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`;
    };
    const restam = ts => Math.max(0, Estado.DIAS_LIXEIRA - Math.floor((Date.now() - ts) / 86400000));

    el.innerHTML = `
      ${Ui.cabecalho({
        titulo: 'Lixeira',
        voltar: '#/configuracoes',
        subtitulo: `O que você excluir fica aqui por ${Estado.DIAS_LIXEIRA} dias e depois é apagado de vez.`,
        acoes: itens.length ? `<button class="botao botao--perigo" data-acao="esvaziar">${Ui.icone('lixeira')} Esvaziar lixeira</button>` : '',
      })}
      <section class="painel">
        ${itens.length ? `
          <ul class="lista lista-lixeira" role="list">
            ${itens.map(x => {
              const t = TIPOS[x.tipo] || TIPOS.cartao;
              const r = restam(x.excluidoEm);
              return `
                <li class="linha-lixeira">
                  <span class="linha-lixeira__icone" aria-hidden="true">${Ui.icone(t.icone)}</span>
                  <span class="linha-lixeira__textos">
                    <span class="linha-lixeira__nome"><span class="selo">${esc(t.nome)}</span> ${esc(x.nome)}</span>
                    <span class="linha-lixeira__meta">${x.origem ? `${esc(x.origem)} · ` : ''}${esc(conteudo(x.dados))} · excluído ${quando(x.excluidoEm)}</span>
                    <span class="linha-lixeira__prazo ${r <= 3 ? 'linha-lixeira__prazo--perto' : ''}">${r === 0 ? 'Será apagado hoje' : `Apagado de vez em ${Util.plural(r, 'dia', 'dias')}`}</span>
                  </span>
                  <span class="linha-lixeira__acoes">
                    <button class="botao botao--pequeno botao--primario" data-acao="restaurar" data-id="${x.id}">${Ui.icone('repetir')} Restaurar</button>
                    <button class="botao botao--pequeno botao--fantasma botao--icone" data-acao="definitivo" data-id="${x.id}" aria-label="Excluir definitivamente" title="Excluir definitivamente">${Ui.icone('lixeira')}</button>
                  </span>
                </li>`;
            }).join('')}
          </ul>`
        : Ui.vazio({ icone: 'lixeira', titulo: 'A lixeira está vazia', texto: 'Matérias, pastas e cartões excluídos aparecem aqui e podem ser restaurados.' })}
      </section>`;

    el.addEventListener('click', async e => {
      const b = e.target.closest('[data-acao]');
      if (!b) return;
      const id = b.dataset.id;
      if (b.dataset.acao === 'restaurar') {
        let r = Estado.restaurar(id);
        if (!r.ok && r.precisaDestino) {
          Util.aviso(r.motivo, 'erro');
          const item = itens.find(x => x.id === id);
          const destino = await Ui.modalMover(item.dados.cartoes.length);
          if (!destino) return;
          r = Estado.restaurar(id, destino);
        }
        Util.aviso(r.ok ? 'Restaurado para o lugar de origem' : r.motivo, r.ok ? 'sucesso' : 'erro');
        Rotas.recarregar();
      } else if (b.dataset.acao === 'definitivo') {
        if (await Util.confirmar('Apagar este item de vez? Isso não pode ser desfeito.', { titulo: 'Excluir definitivamente', botao: 'Apagar de vez' })) {
          Estado.excluirDefinitivo(id);
          Util.aviso('Apagado definitivamente');
          Rotas.recarregar();
        }
      } else if (b.dataset.acao === 'esvaziar') {
        if (await Util.confirmar(`Apagar de vez os ${Util.plural(itens.length, 'item', 'itens')} da lixeira? Isso não pode ser desfeito.`, { titulo: 'Esvaziar lixeira', botao: 'Esvaziar' })) {
          Estado.esvaziarLixeira();
          Util.aviso('Lixeira esvaziada');
          Rotas.recarregar();
        }
      }
    });
  },
});
