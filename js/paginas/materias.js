/* =============================================================
   paginas/materias.js — Lista de todas as matérias
   ============================================================= */
'use strict';

Rotas.registrar('materias', {
  titulo: 'Matérias',

  render(el) {
    const { esc } = Util;
    const materias = Estado.materias();
    const botaoNova = `<button class="botao botao--primario" data-acao="nova">${Ui.icone('mais')} Nova matéria</button>`;
    const botaoBuscar = `<a class="botao" href="#/busca">${Ui.icone('busca')} Buscar</a>`;

    if (!materias.length) {
      el.innerHTML = `
        ${Ui.cabecalho({ titulo: 'Matérias' })}
        <section class="painel">
          ${Ui.vazio({ icone: 'livro', titulo: 'Nenhuma matéria ainda', texto: 'Crie uma matéria para começar a adicionar frentes e flash cards.', acoes: botaoNova })}
        </section>`;
    } else {
      el.innerHTML = `
        ${Ui.cabecalho({ titulo: 'Matérias', subtitulo: Util.plural(materias.length, 'matéria', 'matérias'), acoes: botaoBuscar + botaoNova })}
        <ul class="grade-materias">
          ${materias.map(m => {
            const p = Estado.contarPendentes({ materiaId: m.id });
            const nAssuntos = Estado.assuntosDe(m.id).length;
            return `
              <li>
                <a class="cartao-materia" href="#/materia/${m.id}" style="--cor:${esc(m.cor)}">
                  <span class="cartao-materia__faixa" aria-hidden="true"></span>
                  <span class="cartao-materia__topo">${Ui.pasta(m.cor)}<span class="cartao-materia__nome">${esc(m.nome)}</span></span>
                  <span class="cartao-materia__dados">
                    ${Util.plural(p.cartoes, 'cartão', 'cartões')} · ${Util.plural(nAssuntos, 'frente', 'frentes')}
                  </span>
                  <span class="cartao-materia__rodape">
                    ${Ui.diasMini(m.dias)}
                    ${Ui.seloProva(m)}
                    ${p.total ? `<span class="selo selo--vencido">${p.total} para hoje</span>` : '<span class="selo">Em dia</span>'}
                  </span>
                </a>
              </li>`;
          }).join('')}
        </ul>`;
    }

    el.querySelector('[data-acao="nova"]').addEventListener('click', async () => {
      const dados = await Ui.modalMateria();
      if (!dados) return;
      const m = Estado.criarMateria(dados);
      Util.aviso('Matéria criada!', 'sucesso');
      Rotas.ir(`#/materia/${m.id}`);
    });
  },
});
