/* =============================================================
   rotas.js — Navegação entre páginas sem recarregar (via #hash)

   Formato dos endereços:  #/pagina/id?param=valor
     #/inicio · #/materias · #/materia/ID · #/cartao/novo?materia=ID
     #/cartao/ID · #/importar · #/estudar?escopo=hoje · #/cronograma
     #/estatisticas · #/configuracoes

   Cada página se registra com:
     Rotas.registrar('nome', { titulo, render(container, params) })
   render() pode devolver uma função de limpeza (ex.: remover atalhos
   de teclado), executada ao sair da página.
   ============================================================= */
'use strict';

const Rotas = (() => {
  const paginas = {};
  let limpezaAtual = null;

  function registrar(nome, pagina) { paginas[nome] = pagina; }

  /** Lê o endereço atual e separa nome da página, id e parâmetros */
  function rotaAtual() {
    const hash = location.hash.replace(/^#\/?/, '') || 'inicio';
    const [caminho, consulta = ''] = hash.split('?');
    const [nome, id] = caminho.split('/');
    const params = Object.fromEntries(new URLSearchParams(consulta));
    return { nome: nome || 'inicio', id: id ? decodeURIComponent(id) : undefined, params };
  }

  /** Desenha a página correspondente ao endereço atual */
  function renderizar({ manterRolagem = false } = {}) {
    const { nome, id, params } = rotaAtual();
    const pagina = paginas[nome] || paginas.inicio;
    const container = document.getElementById('conteudo');
    const rolagem = window.scrollY;

    // Executa a limpeza da página anterior
    if (typeof limpezaAtual === 'function') limpezaAtual();
    limpezaAtual = null;
    document.body.classList.remove('modo-estudo');

    // Cada página ganha um elemento novo: assim os "ouvintes" de eventos
    // da página anterior são descartados junto com ela.
    const area = document.createElement('div');
    area.className = `pagina pagina--${nome}`;
    container.replaceChildren(area);
    limpezaAtual = pagina.render(area, { id, ...params }) || null;

    // Título da aba e item ativo do menu
    const titulo = typeof pagina.titulo === 'function' ? pagina.titulo({ id, ...params }) : pagina.titulo;
    document.title = `${titulo} · Flash Cards`;
    document.querySelectorAll('.navegacao__item').forEach(a => {
      const ativo = a.dataset.rota.split(' ').includes(nome);
      if (ativo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });

    // Tutoriais: botão "?" da página e dicas na primeira visita (js/tutorial.js)
    if (typeof Tutorial !== 'undefined') { try { Tutorial.aoRenderizar(nome, { id, ...params }); } catch (e) { console.error(e); } }

    if (manterRolagem) {
      window.scrollTo(0, rolagem);
    } else {
      window.scrollTo(0, 0);
      // Leva o foco ao título da nova página (leitores de tela anunciam a mudança)
      const h1 = container.querySelector('h1');
      if (h1 && document.activeElement !== document.body) h1.focus({ preventScroll: true });
    }
  }

  /** Vai para outro endereço (ex.: Rotas.ir('#/materias')) */
  function ir(hash) {
    if (location.hash === hash) renderizar();
    else location.hash = hash;
  }

  /** Redesenha a página atual mantendo a posição da rolagem (após alterações) */
  const recarregar = () => renderizar({ manterRolagem: true });

  function iniciar() {
    window.addEventListener('hashchange', () => renderizar());
    renderizar();
  }

  return { registrar, rotaAtual, ir, recarregar, iniciar };
})();
