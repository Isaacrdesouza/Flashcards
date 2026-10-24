# Flash Cards · Estudos

Manual de uso do site de estudos com flash cards e repetição espaçada.
A apresentação do projeto está no [README.md](README.md).
Os cartões ficam guardados na sua conta e sincronizam entre computador, tablet e celular.
Depois do primeiro acesso, o site também funciona sem internet.

---

## Como abrir

- **Pela internet:** acesse o endereço publicado do site e entre com a sua conta.
- **No computador, sem publicar:** abra a pasta do projeto e dê dois cliques em `index.html`
  (recomendado: Google Chrome ou Microsoft Edge).
- No celular ou tablet, use **Adicionar à tela inicial** no navegador para abrir como aplicativo.

> ℹ️ **Sobre os dados**
> - Com a conta conectada, os cartões ficam guardados na **nuvem** e aparecem em todos os aparelhos.
> - Uma cópia fica também no navegador, para abrir rápido e funcionar sem internet.
> - Se quiser uma cópia em arquivo, use **Ajustes → Baixar backup** (e **Restaurar backup** para recuperar).

---

## Como usar

> Ordem das pastas: **Matéria → Frente → Assunto → cartões**. O nome do 3º nível (Assunto) pode ser trocado em Ajustes.

| Tarefa | Onde |
|---|---|
| Criar matéria, escolher cor e dias da semana | **Matérias → Nova matéria** |
| Organizar em pastas: Matéria → Frente → Assunto | Abra a matéria e clique nas pastas; o caminho no topo leva de volta (botões **Nova frente** e **Novo assunto**) |
| Renomear o 3º nível (Assunto, Aula, Capítulo…) | **Ajustes → Nome das pastas do 3º nível** |
| Criar um cartão | Dentro de um assunto → **+ Cartão** → escolha o tipo: **Flashcard (Padrão)**, **Ocultação de palavras** ou **Cartão de imagem** |
| Criar muitos cartões de uma vez | **Importar** (ou **Colar vários** na matéria) |
| Trazer baralhos do Anki (.apkg) | **Importar → Arquivo do Anki (.apkg)** |
| Definir dias de estudo e planejar a semana | **Cronograma** |
| Estudar | **Início → Estudar tudo** ou o botão **Estudar** de cada matéria, frente ou assunto |
| Ver histórico e desempenho | **Estatísticas** |
| Ver taxa de acerto por matéria/frente e os cartões que você errou | **Estatísticas** (escolha 7 dias, 30 dias ou Tudo) → **Revisar estes cartões** |
| Revisar rapidamente os cartões que você errou | **Início → Cartões que você errou** (7 dias, 30 dias ou Tudo) |
| Buscar em todas as matérias | **Buscar** no menu (ou tecla `/`); no celular, botão **Buscar** no Início e em Matérias |
| Mover, suspender ou excluir vários cartões | Marque as caixinhas na lista de cartões (pasta ou busca) → **Mover para…**, **Suspender**, **Excluir** |
| Definir a meta diária de revisões | **Ajustes → Meta diária de revisões** (0 = sem meta) |
| Contar a revisão livre (e a dos errados) na meta | **Ajustes → Contar a revisão livre na meta diária** |
| Definir a data da prova de uma matéria | Página da matéria → **Editar** → **Data da prova** |
| Recuperar algo excluído | **Ajustes → Abrir lixeira** → **Restaurar** (fica 30 dias) ou o botão **Desfazer** do aviso |
| Trocar entre tema escuro, claro ou automático (segue o aparelho) | **Ajustes → Aparência** |
| Reorganizar cartões atrasados (passar para amanhã ou distribuir entre dias escolhidos) | Aviso em **Início → Reorganizar**, ou **Cronograma → Reorganizar atrasados** |
| Entrar, criar conta ou recuperar a senha | Tela de entrada (aparece ao abrir o site) |
| Entender o que cada parte da tela faz | Botão **?** no topo de cada página |
| Rever as boas-vindas, o tour pelo menu ou ligar/desligar as dicas | **Ajustes → Tutoriais e ajuda** |
| Ver a sincronização, alterar a senha ou sair | **Ajustes → Conta e nuvem** (ou o indicador no rodapé do menu) |

### Importar em massa
Uma linha por cartão, separando pergunta e resposta com `;` (ou `|`, ou Tab):

```
O que é um protocolo? ; Conjunto de regras de comunicação
Camada 3 do modelo OSI ; Rede
# linhas que começam com # são ignoradas
Resposta em duas linhas ; primeira linha\nsegunda linha
```
Do Excel: pergunta na coluna A, resposta na coluna B → copie as duas colunas e escolha **Tabulação**.
A pré-visualização mostra linhas com problema e repetidas antes de confirmar.

### Importar do Anki (.apkg)
Em **Importar → Arquivo do Anki (.apkg)**, escolha (ou arraste) o arquivo exportado pelo Anki
(**Arquivo → Exportar → Pacote de baralhos do Anki**, com **Incluir mídia** marcado). Antes de gravar, o site
mostra quantos cartões, baralhos e imagens vieram e a prévia dos primeiros cartões.
- **Pastas**: Baralho › Sub-baralho › Sub-sub-baralho viram Matéria › Frente › Assunto (ou tudo em uma pasta escolhida).
  Em **A matéria começa no** dá para pular o 1º nível quando ele é só uma "caixa" (ex.: um baralho que guarda
  todas as matérias). Sub-baralhos mais fundos que o 3º nível entram no Assunto de cima, a menos que você
  ligue **Criar pastas separadas para os sub-baralhos mais fundos**. A lista mostra as pastas antes de importar.
- **Tipos**: Básico e Invertido viram Flashcard; Omissão de palavras (Cloze) vira Ocultação de palavras;
  Image Occlusion vira Cartão de imagem com as áreas ocultas; imagem na frente vira Cartão de imagem.
- **Formatação**: negrito, itálico, sublinhado, marca-texto, cores e listas são mantidos. Áudios ficam de fora.
- **Progresso** (opcional): intervalos, próximas revisões e cartões suspensos do Anki.
- **Repetidos**: importar o mesmo arquivo de novo não duplica os cartões.
Funciona com o formato novo do Anki (2.1.50+) e o antigo. Arquivos grandes também: milhares de cartões em segundos.

### Ocultar palavra (lacuna)
Em **+ Cartão**, escolha **Ocultação de palavras**, escreva a frase e **toque na palavra** que deve ficar
escondida (ou selecione um trecho e use **Ocultar seleção**). No estudo a palavra aparece como **[…]**;
ao virar o cartão, a frase completa é mostrada com a palavra destacada. A observação do verso é opcional.

Na importação, basta escrever a palavra entre chaves duplas, sem separador:
`A camada 3 do modelo OSI é a camada de {{rede}}.`

### Imagens com áreas ocultas (como o *Image Occlusion* do Anki)
Em **+ Cartão**, escolha **Cartão de imagem**, escolha uma imagem (ou cole com **Ctrl + V**) e:
- **arraste** sobre a imagem para cobrir a parte que deve ficar escondida (ou **toque** para criar uma área padrão);
- arraste a área para mover; use o **canto inferior direito** para redimensionar.

A resposta é a própria imagem: no estudo, cada área aparece como **?** e, ao tocar, some e mostra
o que estava por baixo. No verso do cartão todas as áreas aparecem reveladas.

### Imagem na resposta
No **Flashcard (Padrão)**, embaixo do campo Verso há **Anexar imagem**: escolha um arquivo, arraste ou
cole com **Ctrl + V**. A imagem aparece só no verso, junto com o texto da resposta (o texto vira
opcional quando há imagem). Dá para trocar ou remover no editor do cartão.

### Formatação do texto
Nos campos de texto do cartão há uma barra com **N** (negrito), *I* (itálico), S (sublinhado),
M (marca-texto), listas e quatro cores. Selecione o trecho e toque no botão (ou use **Ctrl + B / I / U**).
Embaixo do campo aparece uma prévia de como vai ficar. Por baixo, o texto fica assim:
`**negrito**`, `*itálico*`, `__sublinhado__`, `==marca-texto==`, `[vermelho]texto[/vermelho]`
(também `azul`, `verde`, `laranja`), linhas começando com `- ` (lista) ou `1. ` (lista numerada).

### Durante o estudo
- **Anterior** (tecla `Z`): volta ao cartão anterior e desfaz a resposta dada.
- **Editar** (tecla `E`): corrige o texto do cartão sem sair da sessão.
- **Suspender**: tira o cartão do estudo sem apagar (reative depois na lista ou no editor do cartão).
- A **meta diária** aparece no topo quando definida em Ajustes.

### Data da prova
Com a data definida, nenhum cartão da matéria é agendado para depois da véspera da prova: todos são
revistos pelo menos uma vez antes do dia. Os que já estavam marcados para depois são espalhados entre
amanhã e a véspera. O Início mostra a contagem regressiva, quanto da matéria já foi estudado e quantos
cartões novos faltam por dia. Depois da prova, os intervalos voltam ao normal.

### Lixeira
Excluir uma matéria, frente, assunto ou cartão manda tudo para a **lixeira** (Ajustes → Abrir lixeira).
Lá dá para **Restaurar** (volta para o mesmo lugar, junto com a pasta de origem se ela também foi
excluída) ou apagar de vez. Depois de 30 dias o item é apagado sozinho.

### Tutoriais (primeiro acesso)
Uma conta nova é recebida com as **boas-vindas** (o que é o site, as pastas e como responder) e pode
fazer o **tour pelo menu**. No Início aparecem os **Primeiros passos**: criar matéria, frente, assunto,
o primeiro cartão, estudar e escolher os dias. Em cada um, **Mostrar como** leva até a tela certa e
destaca o botão a tocar; o tutorial espera você fazer a ação de verdade e segue para a próxima.

Na primeira visita a cada página aparece uma dica explicando cada parte (dá para fechar com **Esc**).
O botão **?** no topo de cada página mostra a explicação de novo a qualquer momento.
O que já foi visto fica guardado na conta, então não se repete no tablet.
Em **Ajustes → Tutoriais e ajuda** dá para desligar as dicas, mostrar de novo os primeiros passos e
recomeçar tudo. Contas que já tinham cartões não recebem as dicas automáticas, só um aviso.

### Conta e nuvem (Supabase)
O site abre na **tela de entrada**: é preciso entrar (ou **Criar conta**) para ver os cartões.
Lá também ficam **Esqueci a senha** e o botão do olho para mostrar a senha. Depois de entrar uma vez,
o aparelho lembra a conta e abre direto, inclusive **sem internet**.

- Cada conta tem a sua própria cópia no navegador: duas pessoas no mesmo PC não misturam cartões.
- Cartões criados antes de existir conta: na primeira entrada o site pergunta se quer levá-los para
  a conta.
- Cada mudança vai para a nuvem sozinha alguns segundos depois, ao voltar para o site e a cada minuto.
  Sem internet, as mudanças ficam guardadas e vão quando a conexão voltar.
- No tablet ou em outro computador, abra o site e entre com o mesmo e-mail.
- Se o mesmo cartão for mudado em dois aparelhos ao mesmo tempo, vale a última versão enviada.
- **Ajustes → Conta e nuvem**: situação da sincronização, **Alterar senha** e **Sair da conta**
  (com a opção de apagar a cópia deste aparelho, para computador compartilhado).

O indicador no rodapé do menu mostra **Sincronizado**, **Sincronizando…**, **Sem internet** ou **Erro na nuvem**.
O **tema** (escuro/claro) fica separado em cada aparelho. **Apagar todos os dados** e **Restaurar backup**
também valem para a nuvem.

**Esqueci a senha com o site aberto direto do disco (`index.html`)**: o link do e-mail só volta para o
site quando ele está publicado na internet. Para usar um código no lugar do link, no Supabase abra
**Authentication → Emails → Reset Password** e acrescente ao texto do e-mail: `Código: {{ .Token }}`.
Na tela "Verifique seu e-mail", toque em **O e-mail trouxe um código de 6 dígitos?** e digite o código.

Configuração do banco (feita uma vez): no Supabase, abra **SQL Editor**, cole o conteúdo de
`supabase/01-esquema.sql` e clique em **Run**. Ele cria as tabelas, as regras de segurança (cada conta
só enxerga os próprios dados) e a pasta privada das imagens. Pode rodar de novo sem problema.

> 🔒 No site vai só a chave **publishable** (pública por natureza). Nunca coloque no site a chave
> **secret / service_role** nem a senha do banco.

### Repetição espaçada
Depois de virar o cartão, responda:

| Botão | Tecla | Efeito |
|---|---|---|
| Errei | `1` | O cartão volta no fim da sessão e reinicia o intervalo |
| Difícil | `2` | Intervalo cresce pouco |
| Bom | `3` | Intervalo normal (1 dia → 6 dias → ×2,5…) |
| Fácil | `4` | Intervalo maior |

Cada botão mostra quando o cartão vai aparecer de novo. No tablet, **deslize ←** para *Errei* e
**deslize →** para *Bom*. **Revisão livre** revisa tudo sem alterar a agenda.
O limite de **cartões novos por dia** fica em **Ajustes**.

---

## Estrutura de pastas

```
flashcards/
├── index.html                 Página única + biblioteca de ícones SVG
├── README.md                  Apresentação do projeto
├── LEIAME.md                  Este manual
├── LICENSE                    Direitos autorais
├── assets/
│   └── icone.svg              Ícone do site
├── supabase/
│   └── 01-esquema.sql         Tabelas, segurança e armazenamento de imagens (rodar no SQL Editor)
├── css/
│   ├── base.css               Cores (temas escuro e claro), tipografia, layout e navegação
│   ├── componentes.css        Botões, campos, painéis, modal, avisos, gráficos
│   ├── paginas.css            Estilos de cada página
│   ├── estudo.css             Sessão de estudo: cartão 3D, gestos e respostas
│   └── tutorial.css           Tutoriais (destaque e balão) e Primeiros passos
└── js/
    ├── util.js                Datas, textos, avisos, modal, arquivos, compressão de imagem
    ├── banco.js               Armazenamento local (IndexedDB, com plano B em localStorage)
    ├── nuvem.js               Conta e sincronização com o Supabase
    ├── vendor/
    │   ├── supabase.js        Biblioteca oficial do Supabase (cópia local, licença MIT)
    │   ├── fflate.js, fzstd.js, sql-wasm*.js   Leitura do .apkg (zip, zstd e SQLite; só carregam ao importar)
    ├── repeticao.js           Algoritmo de repetição espaçada (SM-2 simplificado)
    ├── estado.js              Modelo de dados: matérias, frentes (no código: assuntos), assuntos (no código: grupos), cartões, histórico, planos
    ├── componentes.js         Pedaços de interface reutilizáveis
    ├── rotas.js               Navegação entre páginas (#/endereço)
    ├── lista-cartoes.js       Lista de cartões com seleção e ações em lote
    ├── acesso.js              Tela de entrada: entrar, criar conta, esqueci a senha
    ├── tutorial.js            Motor dos tutoriais (destaque, balão, passos com clique)
    ├── tutoriais.js           Conteúdo dos tutoriais e dos Primeiros passos
    ├── anki.js                Leitura de pacotes do Anki (.apkg): cartões, imagens e progresso
    ├── app.js                 Inicialização
    └── paginas/
        ├── inicio.js          Tela inicial: resumo do dia e semana
        ├── materias.js        Lista de matérias
        ├── materia.js         Navegação em pastas (frentes → assuntos) e lista de cartões
        ├── editor-cartao.js   Criar/editar cartão e áreas ocultas na imagem
        ├── importar.js        Importação em massa (colar texto)
        ├── importar-anki.js   Importação de arquivos do Anki
        ├── estudar.js         Sessão de estudo animada
        ├── cronograma.js      Dias por matéria e plano semanal
        ├── reorganizar.js     Reorganizar cartões atrasados
        ├── busca.js           Busca geral em todas as matérias
        ├── lixeira.js         Itens excluídos: restaurar ou apagar de vez
        ├── conta.js           Situação da nuvem, alterar senha e sair
        ├── estatisticas.js    Gráficos e histórico
        └── configuracoes.js   Ajustes, backup e restauração
```

## Decisões do projeto
- **Carregamento rápido**: nenhum arquivo de fora do site, fontes do próprio sistema, scripts com `defer`, imagens comprimidas (WebP, até 1600 px).
- **Acessibilidade**: contraste alto nos temas escuro e claro, foco visível, navegação por teclado, link "Pular para o conteúdo", texto alternativo obrigatório nas imagens, rótulos para leitores de tela, tabela alternativa nos gráficos e respeito à opção "reduzir movimento" do sistema.
- **Responsivo** com prioridade para tablet (barra lateral compacta e alvos de toque de 44 px); barra inferior no celular.

## Segurança dos dados na nuvem
- Cada tabela tem **RLS** (Row Level Security): o banco só devolve linhas da conta que fez login.
- As imagens ficam num *bucket* privado, cada conta numa pasta própria.
- Exclusões são marcadas e propagadas para os outros aparelhos; a lixeira continua valendo 30 dias.
- A senha nunca fica guardada no site; o aparelho guarda só a sessão (um "passe" que o Supabase renova).
