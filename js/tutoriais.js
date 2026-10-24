/* =============================================================
   tutoriais.js — Conteúdo dos tutoriais (o motor fica em tutorial.js)
   • boas-vindas: apresentação no primeiro acesso
   • menu: tour pelos itens do menu
   • um tutorial para cada página (abre sozinho na 1ª visita e pelo botão ?)
   • missões dos "Primeiros passos" (guiam a pessoa fazendo de verdade)
   Textos neutros: nada de matérias ou conteúdos de exemplo.
   ============================================================= */
'use strict';

const Tutoriais = (() => {
  const { esc } = Util;
  const n3 = () => esc(Ui.nivel3());
  const n3m = () => esc(Ui.nivel3().toLowerCase());
  const a3 = palavra => Ui.art3(palavra);   // "um assunto" / "uma aula"…
  const d = () => Estado.bruto();
  const q = sel => document.querySelector(sel);
  const ultimo = lista => lista[lista.length - 1];

  /* =========================================================
     BOAS-VINDAS
     ========================================================= */
  Tutorial.registrar('boas-vindas', {
    titulo: 'Boas-vindas',
    passos: () => [
      {
        largo: true,
        titulo: 'Boas-vindas ao Flash Cards!',
        texto: `
          <div class="tour-ilustra tour-ilustra--cartoes" aria-hidden="true">
            <span class="tour-mini tour-mini--frente"><b>Pergunta</b><i></i><i></i></span>
            <span class="tour-mini tour-mini--verso"><b>Resposta</b><i></i><i></i></span>
          </div>
          <p>Aqui você cria <strong>cartões de pergunta e resposta</strong> e o site mostra cada um
          <strong>na hora certa de revisar</strong>, um pouco antes de você esquecer.</p>
          <p>Leva menos de um minuto para conhecer o básico.</p>`,
        rotuloProximo: 'Vamos lá',
      },
      {
        largo: true,
        titulo: 'Tudo organizado em pastas',
        texto: () => `
          <ol class="tour-pastas" aria-label="Organização das pastas">
            <li>${Ui.pasta('#7c8cff')}<span><b>Matéria</b>a pasta principal</span></li>
            <li>${Ui.pasta('#5aa9ff')}<span><b>Frente</b>divide a matéria</span></li>
            <li>${Ui.pasta('#4cc38a')}<span><b>${n3()}</b>agrupa os cartões</span></li>
            <li><span class="tour-pastas__cartao">${Ui.icone('cartoes')}</span><span><b>Cartões</b>o que você estuda</span></li>
          </ol>
          <p>O nome do 3º nível (“${n3()}”) pode ser trocado em <strong>Ajustes</strong>.</p>`,
      },
      {
        largo: true,
        titulo: 'Estude e diga como foi',
        texto: `
          <p>No estudo você lê a pergunta, vira o cartão e responde:</p>
          <ul class="tour-respostas">
            <li class="resposta--errei"><b>Errei</b>volta ainda nesta sessão</li>
            <li class="resposta--dificil"><b>Difícil</b>volta logo</li>
            <li class="resposta--bom"><b>Bom</b>intervalo normal</li>
            <li class="resposta--facil"><b>Fácil</b>demora mais para voltar</li>
          </ul>
          <p>Com isso o site monta a sua agenda de revisões sozinho. A tela <strong>Início</strong> mostra o que estudar a cada dia.</p>`,
      },
      {
        largo: true,
        titulo: 'Salvo na sua conta',
        texto: `
          <ul class="tour-lista">
            <li>${Ui.icone('nuvem')}<span>Os cartões ficam na sua conta e aparecem no PC, no tablet e no celular.</span></li>
            <li>${Ui.icone('check')}<span>Funciona sem internet: as mudanças são enviadas quando a conexão voltar.</span></li>
            <li>${Ui.icone('ajuda')}<span>Dúvida em alguma tela? Toque no botão <strong>?</strong> no topo da página.</span></li>
          </ul>`,
      },
      {
        largo: true,
        titulo: 'Por onde começar?',
        texto: '<p>Conheça o menu em poucos passos ou vá direto criar a sua primeira matéria com a ajuda dos <strong>Primeiros passos</strong>.</p>',
        botoes: [
          { rotulo: 'Conhecer o menu', primario: true, acao: () => Tutorial.iniciar('menu') },
          { rotulo: 'Criar minha primeira matéria', acao: () => Tutorial.iniciar('m-materia') },
          { rotulo: 'Explorar sozinho', fantasma: true },
        ],
      },
    ],
  });

  /* =========================================================
     MENU
     ========================================================= */
  const item = rota => `.navegacao__item[href="#/${rota}"]`;
  Tutorial.registrar('menu', {
    titulo: 'Menu',
    passos: () => [
      { alvo: item('inicio'), lado: 'dir', titulo: 'Início', texto: 'Seu painel do dia: quantos cartões revisar hoje, a meta diária, os cartões que você errou, a semana e a contagem para as provas.' },
      { alvo: item('materias'), lado: 'dir', titulo: 'Matérias', texto: `É aqui que você cria e organiza tudo em pastas: Matéria → Frente → ${n3()} → cartões.` },
      { alvo: item('busca'), lado: 'dir', titulo: 'Buscar', texto: 'Procura um cartão em todas as matérias pelo texto da frente ou do verso. Atalho: tecla <kbd>/</kbd>.' },
      { alvo: item('cronograma'), lado: 'dir', titulo: 'Cronograma', texto: 'Escolha em quais dias da semana estudar cada matéria e monte o plano da semana com as frentes de cada dia.' },
      { alvo: item('importar'), lado: 'dir', titulo: 'Importar', texto: 'Cria muitos cartões de uma vez: cole uma lista com pergunta e resposta em cada linha ou traga um arquivo do <strong>Anki</strong> (.apkg) com imagens e progresso.' },
      { alvo: item('estatisticas'), lado: 'dir', titulo: 'Estatísticas', texto: 'Acompanhe as revisões de cada dia, a sequência de dias estudando, a taxa de acerto por matéria e os cartões que você errou.' },
      { alvo: item('configuracoes'), lado: 'dir', titulo: 'Ajustes', texto: 'Tema claro ou escuro, meta diária, limite de cartões novos por dia, lixeira, backup, sua conta e estes tutoriais.' },
      { alvo: '#nuvem-menu', lado: 'dir', titulo: 'Sincronização', texto: 'Mostra se seus cartões já foram enviados para a nuvem. Toque para ver a conta.' },
      {
        titulo: 'Pronto!', largo: true, semNumero: true,
        texto: '<p>Agora é só começar. Os <strong>Primeiros passos</strong> no Início guiam você do zero até o primeiro estudo.</p><p>Em qualquer tela, o botão <strong>?</strong> no topo explica o que cada parte faz.</p>',
        botoes: [
          { rotulo: 'Ver os primeiros passos', primario: true, acao: () => { location.hash = '#/inicio'; setTimeout(() => q('#primeiros-passos')?.scrollIntoView({ block: 'center' }), 400); } },
          { rotulo: 'Fechar', fantasma: true },
        ],
      },
    ],
  });

  /* =========================================================
     TUTORIAIS DE CADA PÁGINA
     ========================================================= */
  const pagina = (id, nome, titulo, passos) => Tutorial.registrar(id, { titulo, pagina: nome, passos });

  pagina('inicio', 'inicio', 'Início', () => [
    { alvo: '#primeiros-passos', titulo: 'Primeiros passos', texto: 'Uma lista do que fazer para começar. Toque em <strong>Mostrar como</strong> e o site guia você em cada etapa.' },
    { alvo: '.resumo', titulo: 'Resumo do dia', texto: 'Quantos cartões o cronograma pede hoje, a meta diária (defina em Ajustes), quantos dias seguidos você estudou e o total de cartões.' },
    { alvo: '.provas, .prova', titulo: 'Provas', texto: 'Contagem regressiva das provas cadastradas nas matérias e quanto do conteúdo já foi estudado.' },
    { alvo: '.painel-errados', titulo: 'Cartões que você errou', texto: 'Os cartões que você errou nos últimos dias. Toque em um para respondê-lo de novo; quando acertar, ele sai da lista.' },
    { alvo: '[aria-labelledby="titulo-hoje"]', titulo: 'Hoje', texto: 'As matérias marcadas para hoje no cronograma, com o número de cartões <span class="contagem contagem--revisar">para revisar</span> e <span class="contagem contagem--novos">novos</span>. Toque em <strong>Estudar</strong> para começar.' },
    { alvo: '[aria-labelledby="titulo-plano"]', titulo: 'Plano da semana', texto: 'As frentes que você planejou para cada dia no Cronograma. Marque a caixinha quando terminar.' },
    { alvo: '[aria-labelledby="titulo-semana"]', titulo: 'Sua semana', texto: 'As matérias de cada dia e quantas revisões você fez em cada um.' },
  ]);

  pagina('materias', 'materias', 'Matérias', () => [
    { alvo: '[data-acao="nova"]', titulo: 'Nova matéria', texto: 'Cria uma pasta principal. Você escolhe o nome, uma cor e os dias da semana em que vai estudar.' },
    { alvo: '.cartao-materia', titulo: 'Suas matérias', texto: 'Cada matéria mostra quantos cartões e frentes tem, os dias de estudo e quantos cartões estão para hoje. Toque para abrir.' },
    { alvo: '.pagina-cabecalho a[href="#/busca"]', titulo: 'Buscar', texto: 'Procura um cartão em todas as matérias.' },
  ]);

  pagina('pastas', 'materia', 'Pastas', () => [
    { alvo: '.trilha', titulo: 'Onde você está', texto: 'O caminho das pastas abertas. Toque em um nome para voltar para ela.' },
    { alvo: '.grade-pastas, #conteudo .vazio', titulo: 'Pastas', texto: () => (q('[data-acao="novo-grupo"]')
      ? `As pastas de ${n3m()} desta frente. Os cartões ficam dentro delas.`
      : `As frentes desta matéria. Dentro de cada frente ficam as pastas de ${n3m()}, e dentro delas os cartões.`) },
    { alvo: '.painel__cabecalho [data-acao="novo-assunto"], .painel__cabecalho [data-acao="novo-grupo"]', titulo: 'Criar pasta', texto: 'Cria uma pasta nova neste nível.' },
    { alvo: '.pasta__acoes', titulo: 'Renomear e excluir', texto: 'Cada pasta tem botões para renomear e excluir. O que você exclui vai para a lixeira por 30 dias.' },
    { alvo: '.pagina-cabecalho a[href*="#/estudar"]:not([href*="livre=1"])', titulo: 'Estudar', texto: 'Estuda os cartões desta pasta que estão para hoje (revisões e novos).' },
    { alvo: '.pagina-cabecalho a[href*="livre=1"]', titulo: 'Revisão livre', texto: 'Revê todos os cartões da pasta sem mudar a agenda. Bom para revisar antes de uma prova.' },
    { alvo: '[data-acao="editar-materia"]', titulo: 'Editar matéria', texto: 'Muda nome, cor, dias de estudo e a <strong>data da prova</strong>. Com a data definida, o site garante que todos os cartões sejam revistos antes dela.' },
  ]);

  pagina('frente', 'materia', 'Cartões', () => [
    { alvo: '.trilha', titulo: 'Onde você está', texto: `Matéria › Frente › ${n3()}. Toque em um nome para voltar.` },
    { alvo: '.painel__acoes a[href^="#/cartao/novo"], #conteudo .vazio a[href^="#/cartao/novo"]', titulo: 'Novo cartão', texto: 'Cria um cartão: Flashcard (pergunta e resposta), Ocultação de palavras ou Cartão de imagem.' },
    { alvo: '.painel__acoes a[href^="#/importar"]', titulo: 'Colar vários', texto: 'Cria muitos cartões de uma vez a partir de uma lista.' },
    { alvo: '#busca-cartoes', titulo: 'Buscar nesta pasta', texto: 'Filtra os cartões pelo texto.' },
    { alvo: '#lista-cartoes', titulo: 'Seus cartões', texto: 'Toque em um cartão para editar. Marque as caixinhas para <strong>mover</strong>, <strong>suspender</strong> ou <strong>excluir</strong> vários de uma vez.' },
    { alvo: '.pagina-cabecalho a[href*="#/estudar"]:not([href*="livre=1"])', titulo: 'Estudar', texto: 'Estuda os cartões desta pasta que estão para hoje.' },
  ]);

  pagina('cartao-tipos', 'cartao', 'Novo cartão', () => [
    { alvo: '.tipos-cartao', titulo: 'Escolha o tipo de cartão', texto: `
      <ul class="tour-lista tour-lista--compacta">
        <li>${Ui.icone('cartoes')}<span><b>Flashcard</b>: pergunta na frente, resposta no verso (pode ter imagem).</span></li>
        <li>${Ui.icone('texto')}<span><b>Ocultação de palavras</b>: escreva uma frase e esconda as palavras que quer lembrar.</span></li>
        <li>${Ui.icone('imagem')}<span><b>Cartão de imagem</b>: cubra partes de uma imagem e revele cada uma no estudo.</span></li>
      </ul>` },
  ]);

  pagina('cartao-editor', 'cartao', 'Editor', () => [
    { alvo: '[aria-labelledby="t-local"]', titulo: 'Onde guardar', texto: () => `A matéria, a frente e ${a3('o')} ${n3m()} do cartão. O <strong>+</strong> cria uma pasta nova sem sair daqui.` },
    { alvo: () => q('#campo-frente, #campo-frase, #area-imagem')?.closest('.painel'), titulo: 'Conteúdo', texto: () => (q('#campo-frase')
      ? 'Escreva a frase e <strong>toque nas palavras</strong> da prévia para escondê-las. No estudo elas aparecem como [...].'
      : q('#area-imagem') ? 'Escolha uma imagem (ou cole com Ctrl + V) e arraste sobre ela para cobrir o que deve ficar escondido.'
        : 'Escreva a pergunta na <strong>Frente</strong> e a resposta no <strong>Verso</strong>. A resposta também pode ter uma imagem.') },
    { alvo: '.barra-formato', titulo: 'Formatação', texto: 'Negrito, itálico, sublinhado, marca-texto, listas e cores. Selecione o trecho e toque no botão. A prévia mostra como vai ficar.' },
    { alvo: '.barra-acoes', titulo: 'Salvar', texto: '<strong>Salvar</strong> volta para a pasta. <strong>Salvar e criar outro</strong> limpa os campos para o próximo cartão. Atalho: <kbd>Ctrl</kbd> + <kbd>Enter</kbd>.' },
  ]);

  pagina('estudar', 'estudar', 'Estudo', () => [
    { alvo: '#palco-estudo', titulo: 'O cartão', texto: 'Leia a pergunta e tente lembrar a resposta. Depois toque no cartão (ou aperte <kbd>Espaço</kbd>) para virar.' },
    { alvo: '#acoes-estudo', titulo: 'Responder', texto: 'Depois de virar, diga como foi: <strong>Errei</strong>, <strong>Difícil</strong>, <strong>Bom</strong> ou <strong>Fácil</strong>. Cada botão mostra quando o cartão volta. Teclas <kbd>1</kbd> a <kbd>4</kbd>; no tablet, deslize ← para Errei e → para Bom.' },
    { alvo: '#contadores', titulo: 'Quanto falta', texto: 'Os cartões que ainda faltam nesta sessão: novos, para reaprender e para revisar.' },
    { alvo: '#ferramentas', titulo: 'Ferramentas', texto: '<strong>Anterior</strong> volta ao cartão anterior e desfaz a resposta. <strong>Editar</strong> corrige o cartão sem sair. <strong>Suspender</strong> tira o cartão do estudo sem apagar.' },
    { alvo: '.estudo__topo a', titulo: 'Encerrar', texto: 'Sai do estudo a qualquer momento. O que você já respondeu fica salvo.' },
  ]);

  pagina('cronograma', 'cronograma', 'Cronograma', () => [
    { alvo: '[aria-labelledby="t-dias"]', titulo: 'Dias de estudo', texto: 'Marque em quais dias da semana estudar cada matéria. O Início mostra as matérias do dia.' },
    { alvo: '#form-plano', titulo: 'Plano da semana', texto: () => `Escolha uma frente (e, se quiser, ${a3('o')} ${n3m()}) e o dia para estudá-la. Ele aparece no calendário do Início.` },
    { alvo: '.navegador-semana', titulo: 'Outras semanas', texto: 'Planeje semanas seguintes ou veja as anteriores.' },
    { alvo: '.pagina-cabecalho a[href="#/reorganizar"]', titulo: 'Cartões atrasados', texto: 'Ficou dias sem estudar? Passe os atrasados para amanhã ou distribua entre os próximos dias.' },
  ]);

  pagina('importar-anki', 'importar', 'Importar do Anki', () => [
    { alvo: '.abas--importar', titulo: 'Duas formas de importar', texto: '<strong>Colar texto</strong> para listas simples, ou <strong>Arquivo do Anki</strong> para trazer baralhos inteiros.' },
    { alvo: '#zona-anki', titulo: 'Escolha o arquivo', texto: 'Toque para escolher o arquivo <strong>.apkg</strong> exportado pelo Anki, ou arraste e solte aqui. Nada é salvo antes de você confirmar.' },
    { alvo: '.ajuda-anki', titulo: 'Como exportar', texto: 'O passo a passo para gerar o arquivo no Anki, com as imagens e o progresso.' },
  ]);

  pagina('importar', 'importar', 'Importar', () => [
    { alvo: '.abas--importar', titulo: 'Duas formas de importar', texto: 'Cole uma lista aqui ou use a aba <strong>Arquivo do Anki</strong> para trazer um arquivo .apkg.' },
    { alvo: '[aria-labelledby="t-destino"]', titulo: 'Para onde vão os cartões', texto: () => `Escolha a matéria, a frente e ${a3('o')} ${n3m()}. Dá para criar uma frente ou ${a3('um')} ${n3m()} ${a3('novo')} aqui mesmo.` },
    { alvo: '#imp-texto', titulo: 'Cole a lista', texto: 'Uma linha por cartão: a pergunta, um separador e a resposta. Linhas começando com # são ignoradas. Para ocultar palavras, escreva entre chaves duplas: {{assim}}.' },
    { alvo: '#imp-separador', titulo: 'Separador', texto: 'O que separa a pergunta da resposta: ponto e vírgula, barra vertical ou Tab (para colunas copiadas de uma planilha).' },
    { alvo: '[aria-labelledby="t-previa"]', titulo: 'Prévia', texto: 'Confira os cartões antes de importar. Linhas com problema e repetidas aparecem marcadas.' },
  ]);

  pagina('estatisticas', 'estatisticas', 'Estatísticas', () => [
    { alvo: '.resumo', titulo: 'Resumo', texto: 'Dias seguidos estudando, revisões de hoje, taxa de acerto dos últimos 30 dias e o total de revisões.' },
    { alvo: '[aria-labelledby="t-30"]', titulo: 'Revisões por dia', texto: 'Quantas respostas você deu em cada dia. Passe o dedo ou o mouse nas barras para ver os números.' },
    { alvo: '[aria-labelledby="t-14"]', titulo: 'Revisões previstas', texto: 'Quantos cartões vão vencer em cada um dos próximos dias, para você se planejar.' },
    { alvo: '[aria-labelledby="t-acerto"]', titulo: 'Taxa de acerto', texto: 'O quanto você acerta em cada matéria e frente. Escolha o período no topo do quadro.' },
    { alvo: '.painel-errados', titulo: 'Cartões errados', texto: 'Os cartões que você errou no período, para revisar de novo.' },
    { alvo: '[aria-labelledby="t-situacao"]', titulo: 'Situação dos cartões', texto: 'Quantos são novos, estão sendo aprendidos, em revisão ou suspensos.' },
  ]);

  pagina('configuracoes', 'configuracoes', 'Ajustes', () => [
    { alvo: '[aria-labelledby="t-tema"]', titulo: 'Aparência', texto: 'Tema escuro, claro ou automático (segue o aparelho). Fica salvo em cada aparelho.' },
    { alvo: '[aria-labelledby="t-pref"]', titulo: 'Preferências de estudo', texto: `O nome do 3º nível das pastas (hoje “${n3()}”), a meta diária de revisões e o limite de cartões novos por dia.` },
    { alvo: '[aria-labelledby="t-tutoriais"]', titulo: 'Tutoriais', texto: 'Reveja as boas-vindas e o tour pelo menu, ligue ou desligue as dicas automáticas e mostre de novo os primeiros passos.' },
    { alvo: '[aria-labelledby="t-nuvem"]', titulo: 'Conta e nuvem', texto: 'Situação da sincronização, trocar a senha e sair da conta.' },
    { alvo: '[aria-labelledby="t-lixeira"]', titulo: 'Lixeira', texto: 'O que você exclui fica aqui por 30 dias e pode ser restaurado.' },
    { alvo: '[aria-labelledby="t-backup"]', titulo: 'Backup', texto: 'Baixe uma cópia de tudo em um arquivo, por segurança, ou restaure uma cópia antiga.' },
  ]);

  pagina('busca', 'busca', 'Buscar', () => [
    { alvo: '#busca-geral', titulo: 'Buscar', texto: 'Digite parte da pergunta ou da resposta. A busca ignora acentos e maiúsculas.' },
    { alvo: () => q('#bf-materia')?.closest('.busca-filtros, .grade-campos, form, div'), titulo: 'Filtros', texto: 'Limite a busca a uma matéria, a um tipo de cartão ou à situação (novos, para revisar, suspensos).' },
    { alvo: '#busca-resultados', titulo: 'Resultados', texto: 'Toque em um cartão para editar, ou marque vários para mover, suspender ou excluir.' },
  ]);

  pagina('lixeira', 'lixeira', 'Lixeira', () => [
    { alvo: '#conteudo .pagina-cabecalho', titulo: 'Lixeira', texto: 'Matérias, frentes, pastas e cartões excluídos ficam aqui por 30 dias. <strong>Restaurar</strong> devolve para o mesmo lugar.' },
  ]);

  pagina('reorganizar', 'reorganizar', 'Reorganizar', () => [
    { alvo: '#conteudo .pagina-cabecalho', titulo: 'Cartões atrasados', texto: 'Escolha entre passar todos para amanhã ou distribuir entre os dias que você marcar, para não acumular revisões num dia só.' },
  ]);

  pagina('conta', 'conta', 'Conta', () => [
    { alvo: '.conta__topo', titulo: 'Sua conta', texto: 'O e-mail da conta e a situação da sincronização com a nuvem.' },
    { alvo: '.conta .acoes-linha', titulo: 'Ações', texto: '<strong>Sincronizar agora</strong> envia e busca as mudanças na hora. Também dá para alterar a senha e sair da conta.' },
  ]);

  // Qual tutorial pertence a cada página
  Tutorial.paginas({
    inicio: () => (Estado.materias().length ? 'inicio' : null),
    materias: () => 'materias',
    materia: p => (p.grupo ? 'frente' : 'pastas'),
    cartao: p => (p.id === 'novo' && !p.tipo ? 'cartao-tipos' : 'cartao-editor'),
    estudar: () => (q('#palco-estudo') ? 'estudar' : null),
    cronograma: () => (Estado.materias().length ? 'cronograma' : null),
    importar: p => (p.modo === 'anki' ? 'importar-anki' : Estado.materias().length ? 'importar' : null),
    estatisticas: () => 'estatisticas',
    configuracoes: () => 'configuracoes',
    busca: () => 'busca',
    lixeira: () => 'lixeira',
    reorganizar: () => 'reorganizar',
    conta: () => 'conta',
  });

  /* =========================================================
     PRIMEIROS PASSOS (missões guiadas)
     ========================================================= */
  const feitoMsg = (titulo, texto, proxima) => ({
    titulo, texto, largo: true, semNumero: true,
    botoes: proxima
      ? [{ rotulo: 'Continuar', primario: true, acao: () => Tutorial.iniciar(proxima) }, { rotulo: 'Depois', fantasma: true }]
      : [{ rotulo: 'Fechar', primario: true }],
  });

  // Escolhe a pasta onde continuar (a mais recente que ainda está vazia)
  const materiaAlvo = () => { const ms = d().materias; return ms.find(m => !d().assuntos.some(a => a.materiaId === m.id)) || ultimo(ms); };
  const assuntoAlvo = () => { const as = d().assuntos; return as.find(a => !d().grupos.some(g => g.assuntoId === a.id)) || ultimo(as); };
  const grupoAlvo = () => { const gs = d().grupos; return gs.find(g => !d().cartoes.some(c => c.grupoId === g.id)) || ultimo(gs); };
  const hrefGrupo = g => { const a = Estado.assunto(g.assuntoId); return `#/materia/${a.materiaId}?assunto=${a.id}&grupo=${g.id}`; };

  Tutorial.registrar('m-materia', {
    titulo: 'Primeiros passos', missao: true,
    passos: () => {
      const antes = d().materias.length;
      return [
        { ir: '#/materias', alvo: '[data-acao="nova"]', clique: true, concluido: () => d().materias.length > antes,
          titulo: 'Crie uma matéria', texto: 'Toque em <strong>Nova matéria</strong>. Na janela, escreva o nome, escolha uma cor e os dias da semana em que vai estudar. Depois toque em <strong>Salvar</strong>.' },
        feitoMsg('Matéria criada!', '<p>Agora vamos dividir a matéria em <strong>frentes</strong>.</p>', 'm-assunto'),
      ];
    },
  });

  Tutorial.registrar('m-assunto', {
    titulo: 'Primeiros passos', missao: true,
    passos: () => {
      const antes = d().assuntos.length;
      const m = materiaAlvo();
      if (!m) return [];
      return [
        { ir: `#/materia/${m.id}`, alvo: '.painel__cabecalho [data-acao="novo-assunto"], #conteudo .vazio [data-acao="novo-assunto"]', clique: true, concluido: () => d().assuntos.length > antes,
          titulo: 'Crie uma frente', texto: `Você está dentro da matéria <strong>${esc(m.nome)}</strong>. Toque em <strong>Nova frente</strong>, escreva o nome e salve.` },
        feitoMsg('Frente criada!', `<p>Dentro da frente ficam as pastas de <strong>${n3m()}</strong>, onde os cartões são guardados.</p>`, 'm-frente'),
      ];
    },
  });

  Tutorial.registrar('m-frente', {
    titulo: 'Primeiros passos', missao: true,
    passos: () => {
      const antes = d().grupos.length;
      const a = assuntoAlvo();
      if (!a) return [];
      return [
        { ir: `#/materia/${a.materiaId}?assunto=${a.id}`, alvo: '.painel__cabecalho [data-acao="novo-grupo"], #conteudo .vazio [data-acao="novo-grupo"]', clique: true, concluido: () => d().grupos.length > antes,
          titulo: `Crie ${a3('um')} ${n3m()}`, texto: `Você está na frente <strong>${esc(a.nome)}</strong>. Toque em <strong>${esc(Ui.novoNivel3())}</strong>, escreva o nome e salve.` },
        feitoMsg('Pasta criada!', '<p>Agora a melhor parte: criar o seu <strong>primeiro cartão</strong>.</p>', 'm-cartao'),
      ];
    },
  });

  Tutorial.registrar('m-cartao', {
    titulo: 'Primeiros passos', missao: true,
    passos: () => {
      const antes = d().cartoes.length;
      const g = grupoAlvo();
      if (!g) return [];
      return [
        { ir: hrefGrupo(g), alvo: '.painel__acoes a[href^="#/cartao/novo"], #conteudo .vazio a[href^="#/cartao/novo"]', clique: true,
          titulo: 'Novo cartão', texto: `Esta é a pasta <strong>${esc(g.nome)}</strong>. Toque em <strong>Cartão</strong>.` },
        { alvo: '.tipos-cartao', clique: true, dicaClique: 'Toque em um dos tipos para continuar.',
          titulo: 'Escolha o tipo', texto: 'Para começar, o <strong>Flashcard (Padrão)</strong> é o mais simples: pergunta na frente e resposta no verso.' },
        { alvo: () => q('#campo-frente, #campo-frase, #area-imagem')?.closest('.painel'), livre: true, rotuloProximo: 'Já escrevi',
          titulo: 'Escreva o cartão', texto: () => (q('#campo-frase')
            ? 'Escreva uma frase e toque nas palavras da prévia que devem ficar escondidas.'
            : q('#area-imagem') ? 'Escolha uma imagem e arraste sobre ela para cobrir as partes que devem ficar escondidas.'
              : 'Escreva a pergunta na <strong>Frente</strong> e a resposta no <strong>Verso</strong>.') },
        { alvo: 'button[data-salvar="voltar"]', clique: true, concluido: () => d().cartoes.length > antes,
          titulo: 'Salvar', texto: 'Toque em <strong>Salvar</strong>. Se faltar alguma coisa, o site avisa o que corrigir.' },
        feitoMsg('Primeiro cartão criado!', '<p>Crie quantos quiser. Quando estiver pronto, faça o primeiro estudo.</p>', 'm-estudar'),
      ];
    },
  });

  Tutorial.registrar('m-estudar', {
    titulo: 'Primeiros passos', missao: true,
    depois: () => Tutorial.iniciar('estudar'),
    passos: () => {
      const c = d().cartoes.find(x => !x.suspenso) || ultimo(d().cartoes);
      if (!c) return [];
      const g = Estado.grupo(c.grupoId);
      return [
        { ir: g ? hrefGrupo(g) : `#/materia/${c.materiaId}`, alvo: '.pagina-cabecalho a[href*="#/estudar"]:not([href*="livre=1"]), .pagina-cabecalho a[href*="livre=1"]', clique: true,
          titulo: 'Hora de estudar', texto: 'Toque em <strong>Estudar</strong> para começar a sessão. Vamos mostrar como responder.' },
      ];
    },
  });

  Tutorial.registrar('m-cronograma', {
    titulo: 'Primeiros passos', missao: true,
    passos: () => [
      { ir: '#/cronograma', alvo: '[aria-labelledby="t-dias"]', livre: true, rotuloProximo: 'Pronto',
        titulo: 'Escolha os dias', texto: 'Marque os dias da semana de cada matéria. As alterações são salvas na hora. O Início passa a mostrar as matérias de cada dia.' },
      { alvo: '[aria-labelledby="t-plano"]', titulo: 'Plano da semana (opcional)', texto: 'Se quiser, escolha quais frentes estudar em cada dia desta semana.', rotuloFim: 'Concluir' },
    ],
  });

  const PASSOS = [
    { id: 'materia', titulo: 'Crie uma matéria', texto: 'A pasta principal dos seus estudos.', feito: () => d().materias.length > 0, missao: 'm-materia' },
    { id: 'assunto', titulo: 'Crie uma frente', texto: 'Divide a matéria em partes.', feito: () => d().assuntos.length > 0, requer: 'materia', missao: 'm-assunto' },
    { id: 'frente', titulo: () => `Crie ${a3('um')} ${n3m()}`, texto: 'A pasta onde os cartões ficam.', feito: () => d().grupos.length > 0, requer: 'assunto', missao: 'm-frente' },
    { id: 'cartao', titulo: 'Crie o primeiro cartão', texto: 'Pergunta e resposta, palavras ocultas ou imagem.', feito: () => d().cartoes.length > 0, requer: 'frente', missao: 'm-cartao' },
    { id: 'estudar', titulo: 'Estude pela primeira vez', texto: 'Vire o cartão e diga como foi.', feito: () => d().historico.length > 0, requer: 'cartao', missao: 'm-estudar' },
    { id: 'cronograma', titulo: 'Escolha os dias de estudo', texto: 'Para o Início mostrar o que estudar a cada dia.', feito: () => d().materias.some(m => m.dias.length), requer: 'materia', missao: 'm-cronograma' },
  ];
  const valor = v => (typeof v === 'function' ? v() : v);

  /** Quadro "Primeiros passos" do Início ('' quando escondido) */
  function painel() {
    const p = Tutorial.prefs();
    if (!p || p.primeirosPassos === false) return '';
    const feitos = PASSOS.filter(x => x.feito()).length;
    const todos = feitos === PASSOS.length;
    const proximo = PASSOS.find(x => !x.feito() && (!x.requer || PASSOS.find(y => y.id === x.requer).feito()));
    const pct = Math.round(feitos / PASSOS.length * 100);
    return `
      <section class="painel primeiros-passos ${todos ? 'primeiros-passos--fim' : ''}" id="primeiros-passos" aria-labelledby="t-primeiros">
        <div class="painel__cabecalho">
          <div>
            <h2 class="painel__titulo" id="t-primeiros">${todos ? `${Ui.icone('check')} Tudo pronto!` : 'Primeiros passos'}</h2>
            <p class="painel__nota">${todos ? 'Você já sabe o essencial. Bons estudos!' : `${feitos} de ${PASSOS.length} concluídos`}</p>
          </div>
          <span class="painel__acoes">
            <button class="botao botao--pequeno botao--fantasma" data-pp="tour">${Ui.icone('ajuda')} Tour pelo menu</button>
            <button class="botao botao--pequeno botao--fantasma" data-pp="esconder">${todos ? 'Fechar' : 'Esconder'}</button>
          </span>
        </div>
        <div class="primeiros-passos__barra" role="progressbar" aria-label="Primeiros passos" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
        ${todos ? '' : `
        <ol class="primeiros-passos__lista">
          ${PASSOS.map((x, n) => {
            const feito = x.feito();
            const ehProximo = proximo && proximo.id === x.id;
            const bloqueado = !feito && x.requer && !PASSOS.find(y => y.id === x.requer).feito();
            return `
              <li class="passo-inicial ${feito ? 'passo-inicial--feito' : ''} ${ehProximo ? 'passo-inicial--proximo' : ''} ${bloqueado ? 'passo-inicial--bloqueado' : ''}">
                <span class="passo-inicial__marca" aria-hidden="true">${feito ? Ui.icone('check') : n + 1}</span>
                <span class="passo-inicial__textos">
                  <span class="passo-inicial__titulo">${esc(valor(x.titulo))}<span class="sr-only">${feito ? ' (concluído)' : ''}</span></span>
                  <span class="passo-inicial__texto">${esc(x.texto)}</span>
                </span>
                ${!feito && !bloqueado ? `<button class="botao botao--pequeno ${ehProximo ? 'botao--primario' : ''}" data-pp-missao="${x.missao}">Mostrar como</button>` : ''}
              </li>`;
          }).join('')}
        </ol>`}
      </section>`;
  }

  function ligarPainel(el) {
    const caixa = el.querySelector('#primeiros-passos');
    if (!caixa) return;
    caixa.addEventListener('click', e => {
      const missao = e.target.closest('[data-pp-missao]')?.dataset.ppMissao;
      const acao = e.target.closest('[data-pp]')?.dataset.pp;
      if (missao) Tutorial.iniciar(missao);
      else if (acao === 'tour') Tutorial.iniciar('menu');
      else if (acao === 'esconder') {
        Tutorial.gravar({ primeirosPassos: false });
        Util.aviso('Primeiros passos escondidos. Dá para mostrar de novo em Ajustes → Tutoriais.');
        Rotas.recarregar();
      }
    });
  }

  return { painel, ligarPainel };
})();
