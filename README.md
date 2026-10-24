# Flash Cards

Site de estudos com **flash cards e repetição espaçada**: você organiza o conteúdo em pastas,
estuda os cartões e o site agenda cada revisão para o momento certo, um pouco antes de você esquecer.
Pensado para quem estuda para uma prova com data marcada.

## Funcionalidades

- **Pastas em três níveis:** Matéria → Frente → Assunto → cartões (o nome do 3º nível é configurável).
- **Três tipos de cartão:** pergunta e resposta, ocultação de palavras e imagem com áreas ocultas.
- **Repetição espaçada** com quatro respostas (Errei, Difícil, Bom, Fácil) e intervalos que crescem a cada acerto.
- **Data da prova:** todos os cartões da matéria são revistos antes da véspera, com contagem regressiva no Início.
- **Cronograma** com os dias de estudo de cada matéria e reorganização de cartões atrasados.
- **Estatísticas:** revisões por dia, sequência de dias, taxa de acerto por matéria e cartões errados.
- **Importação** de listas coladas (inclusive de planilhas) e de arquivos do **Anki (.apkg)**, com imagens,
  formatação e progresso.
- **Conta e nuvem:** os dados sincronizam entre computador, tablet e celular e continuam disponíveis sem internet.
- **Tutoriais interativos** para o primeiro acesso, busca geral, lixeira, backup, temas claro e escuro.

## Tecnologias

- HTML, CSS e JavaScript puros, sem framework e sem etapa de build.
- [Supabase](https://supabase.com) para contas, banco de dados (PostgreSQL com Row Level Security) e armazenamento de imagens.
- IndexedDB para a cópia local, que permite usar o site sem internet.
- Bibliotecas de terceiros em `js/vendor/`, cada uma com a sua licença: supabase-js, fflate, fzstd e sql.js.

## Como rodar

1. Abra `index.html` no navegador (Chrome ou Edge recomendados) ou publique a pasta em qualquer hospedagem
   de site estático, como o GitHub Pages.
2. Para usar o seu próprio projeto no Supabase:
   - rode `supabase/01-esquema.sql` no **SQL Editor** do Supabase;
   - troque o endereço do projeto e a chave **publishable** no início de `js/nuvem.js`;
   - em **Authentication → URL Configuration**, informe o endereço onde o site está publicado.

> A chave que fica no site é a **publishable**, feita para ser pública. A segurança está nas regras do banco:
> cada conta só acessa os próprios dados.

O guia completo de uso está no [LEIAME.md](LEIAME.md).

## Autor

Desenvolvido por **[@Isaacrdesouza](https://github.com/Isaacrdesouza)**.

## Licença

© 2026 Isaacrdesouza. Todos os direitos reservados. Veja [LICENSE](LICENSE).
As bibliotecas em `js/vendor/` seguem as próprias licenças.
