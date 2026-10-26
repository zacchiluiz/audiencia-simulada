# Gestor de Campanhas

Site para organizar suas ofertas, campanhas, vendas, custos e lucro. Funciona como uma "Utmify" de organização, só que **sem trackeamento**: você lança os números e ele calcula tudo.

- Não precisa de servidor nem login. A internet só é usada para buscar apps na App Store, no Swipe de ofertas.
- Os dados ficam salvos **somente no seu navegador**.
- Não depende de nenhuma biblioteca externa.

## Como usar

1. Baixe o repositório (botão **Code → Download ZIP** no GitHub) e extraia a pasta.
2. Abra o arquivo `index.html` no Chrome, Edge ou Firefox.
3. Dica: adicione a página aos favoritos para abrir rápido.

> ⚠️ **Faça backup com frequência** em *Configurações → Baixar backup*. Se você limpar os dados do navegador ou trocar de PC, os dados não vão junto. Para levar seus dados a outro computador, é só restaurar o arquivo `.json` lá.

Quer testar antes? No Dashboard, clique em **"Ver com dados de exemplo"**. Depois é só apagar tudo em Configurações.

## O que tem

| Página | O que faz |
|---|---|
| **Dashboard** | Lucro líquido, faturamento, gasto, ROAS, ROI, margem, CPA, ticket médio, reembolsos e pendentes, todos comparados com o período anterior. Também tem o gráfico diário, a meta do mês com projeção, a composição do resultado, o lucro por oferta, por fonte de tráfego e por forma de pagamento, além de um calendário de lucro por dia. |
| **Campanhas** | Cadastro por fonte de tráfego (Meta, Google, TikTok, Kwai…), com orçamento, conta/BM, status e tags. Mostra as métricas de cada campanha e um detalhe com os registros por dia (CTR, CPC, CPM, IC, custo por IC, conversão). Dá para duplicar, pausar ou ativar e exportar em CSV. |
| **Lançamento do dia** (tecla `N`) | Gasto, impressões, cliques, checkouts, vendas, faturamento e reembolsos em um formulário só, com uma prévia de lucro, ROAS e CPA. Se você lançar de novo a mesma campanha no mesmo dia, ele **edita** o lançamento em vez de duplicar. O botão **"Lançar todas"** abre uma grade com todas as campanhas ativas. |
| **Minhas ofertas** | Plataforma, modelo (produtor ou afiliado), preço, comissão, taxas da plataforma e custo do produto. A "unidade econômica" mostra o **CPA máximo** (ponto de empate) e o **ROAS de empate**. |
| **Espionagem** | Quadro kanban (Nova → Observando → Escalando → Para modelar → Modelada → Descartada) em que você arrasta os cards entre as colunas. Guarda o histórico de anúncios ativos, para ver se a oferta está escalando, além de links da biblioteca, página e checkout, criativos, nota de potencial e anotações. Um botão transforma a oferta espionada em uma oferta sua. |
| **Swipe de ofertas** (tecla `S`) | Seu arquivo de referências com anúncios da **Biblioteca de Anúncios do Facebook** e apps da **App Store**. Em **Garimpar** você busca apps por palavra-chave ali mesmo (nota, nº de avaliações, preço) e salva com um clique. Também abre a biblioteca do Facebook já filtrada por país, formato e anúncios ativos. Para anúncios, cole o link e o ID é preenchido sozinho; depois anote gancho, copy, CTA, início da veiculação e nº de anúncios ativos. Para apps, cole o link e clique em *Buscar dados do app* para trazer ícone, telas, descrição, categoria e nota. Tem filtros (fonte, nicho, favoritos, "só validados" = no ar há 30+ dias ou 1.000+ avaliações), ordenação por tempo no ar, anúncios ou avaliações, exportação em CSV e um botão para mandar o item para a Espionagem. |
| **Vendas** | Vendas avulsas com status (aprovada, pendente, reembolsada, chargeback), forma de pagamento, cliente e item (upsell, order bump). Exporta em CSV. |
| **Custos extras** | Ferramentas, domínios, criativos, freelancers… Podem ser únicos ou mensais (assinaturas) e entram no lucro líquido. |
| **Configurações** | Imposto sobre o faturamento, imposto sobre o gasto em anúncios, meta mensal, moeda e tema claro/escuro. Também é onde você faz o backup e a restauração. |

## Como o lucro é calculado

```
Lucro líquido = Faturamento aprovado
              − taxas da plataforma
              − imposto sobre faturamento
              − custo do produto (por unidade)
              − gasto em anúncios (+ imposto sobre anúncios)
              − custos extras
ROAS = faturamento ÷ gasto   ·   ROI = lucro ÷ gasto   ·   CPA = gasto ÷ vendas
```

Se você deixar o campo de taxas vazio, ele é calculado pela oferta (% + valor fixo por venda).

## Atalhos

`N` lançamento do dia · `V` registrar venda · `E` nova oferta espionada · `S` garimpar ofertas (swipe) · `1`–`8` navegar entre as páginas · `Esc` fechar janela

## Estrutura

```
index.html
assets/styles.css
assets/js/utils.js      formatação, datas, ícones
assets/js/store.js      dados (localStorage), backup, exemplos
assets/js/metrics.js    cálculos
assets/js/charts.js     gráficos SVG
assets/js/ui.js         modais, formulários, tabelas
assets/js/pages/*.js    cada página
assets/js/app.js        rotas e navegação
```
