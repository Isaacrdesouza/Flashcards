/* =============================================================
   paginas/busca.js — Busca geral em todas as matérias
   • Procura na frente, no verso, nas frases de ocultar palavra e
     nos textos das áreas de imagem (sem diferenciar acentos/maiúsculas)
   • Filtros: matéria, tipo de cartão e situação
   • Resultados com o caminho da pasta e ações em lote (mover, suspender…)
   Endereço: #/busca?q=texto
   ============================================================= */
'use strict';

Rotas.registrar('busca', {
  titulo: 'Buscar cartões',

  render(el, params) {
    const { esc } = Util;
    const materias = Estado.materias();

    el.innerHTML = `
      ${Ui.cabecalho({ titulo: 'Buscar cartões', subtitulo: 'Procure em todas as matérias de uma vez.' })}
      <section class="painel">
        <label class="busca busca--grande">
          ${Ui.icone('busca')}
          <span class="sr-only">Texto para buscar</span>
          <input type="search" class="entrada" id="busca-geral" value="${esc(params.q || '')}" autocomplete="off" enterkeyhint="search">
        </label>
        <div class="busca-filtros">
          <label class="campo"><span class="campo__rotulo">Matéria</span>
            <select id="bf-materia"><option value="">Todas</option>${Ui.opcoes(materias, params.materia || '')}</select></label>
          <label class="campo"><span class="campo__rotulo">Tipo</span>
            <select id="bf-tipo">
              <option value="">Todos</option>
              ${Object.entries(Ui.TIPOS_CARTAO).map(([k, t]) => `<option value="${k}">${esc(t.nome)}</option>`).join('')}
            </select></label>
          <label class="campo"><span class="campo__rotulo">Situação</span>
            <select id="bf-situacao">
              <option value="">Todas</option>
              <option value="novo">Novos</option>
              <option value="revisar">Para revisar hoje</option>
              <option value="atrasado">Atrasados</option>
              <option value="suspenso">Suspensos</option>
            </select></label>
        </div>
        <p class="painel__nota busca-resumo" id="busca-resumo" aria-live="polite"></p>
        <div id="busca-resultados"></div>
      </section>`;

    const campo = el.querySelector('#busca-geral');
    const selM = el.querySelector('#bf-materia'), selT = el.querySelector('#bf-tipo'), selS = el.querySelector('#bf-situacao');
    const resumo = el.querySelector('#busca-resumo');
    const lista = ListaCartoes.montar(el.querySelector('#busca-resultados'), {
      mostrarLocal: true,
      aoMudar: () => buscar(),
      vazio: 'Nenhum cartão encontrado com esses filtros.',
    });

    const tipoDe = c => (c.tipo === 'lacuna' ? 'lacuna' : (c.tipo === 'imagem' || c.imagem) ? 'imagem' : 'basico');
    const textoDe = c => Util.normalizar(Util.semFormatacao(
      `${c.frente} ${c.verso} ${(c.imagem?.sobreposicoes || []).map(s => s.texto).join(' ')} ${c.imagem?.alt || ''} ${c.imagemVerso?.alt || ''}`
    ).replace(/\{\{|\}\}/g, ''));

    function buscar() {
      const termo = campo.value.trim();
      const palavras = Util.normalizar(termo).split(/\s+/).filter(Boolean);
      const h = Util.hoje();
      const filtrosAtivos = selM.value || selT.value || selS.value;
      // Atualiza o endereço sem recarregar (assim "voltar" do editor mantém a busca)
      history.replaceState(null, '', `#/busca${termo ? `?q=${encodeURIComponent(termo)}` : ''}`);

      if (!palavras.length && !filtrosAtivos) {
        resumo.textContent = `Digite uma palavra ou escolha um filtro. ${Util.plural(Estado.totalCartoes(), 'cartão', 'cartões')} no total.`;
        lista.definir([]);
        el.querySelector('#busca-resultados').hidden = true;
        return;
      }
      el.querySelector('#busca-resultados').hidden = false;

      const achados = Estado.cartoes(selM.value ? { materiaId: selM.value } : {}).filter(c => {
        if (selT.value && tipoDe(c) !== selT.value) return false;
        if (selS.value === 'suspenso' && !c.suspenso) return false;
        if (selS.value && selS.value !== 'suspenso' && c.suspenso) return false;
        if (selS.value === 'novo' && c.rep.estado !== 'novo') return false;
        if (selS.value === 'revisar' && !Estado.estaVencido(c, h)) return false;
        if (selS.value === 'atrasado' && !(c.rep.estado !== 'novo' && c.rep.vencimento && c.rep.vencimento < h)) return false;
        if (!palavras.length) return true;
        const texto = textoDe(c);
        return palavras.every(p => texto.includes(p)); // todas as palavras, em qualquer ordem
      }).sort((a, b) => b.criadoEm - a.criadoEm);

      resumo.textContent = `${Util.plural(achados.length, 'cartão encontrado', 'cartões encontrados')}`;
      lista.definir(achados);
    }

    campo.addEventListener('input', Util.adiar(buscar, 200));
    [selM, selT, selS].forEach(s => s.addEventListener('change', buscar));
    buscar();
    setTimeout(() => { campo.focus(); campo.setSelectionRange(campo.value.length, campo.value.length); }, 0);
  },
});
