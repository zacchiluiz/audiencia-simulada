# Canal de futebol: guia de operação

Canal de **futebol geral organizado em subnichos**. Na fase 1 ele é sem rosto (cards, carrosséis e Reels com narração). Na fase 2 ganha rosto e entrevistas.

## 1. Editorias (os formatos fixos do canal)

Cada tópico vira uma editoria com nome, cor e template próprios. O seguidor reconhece o post antes de ler.

| Editoria | Tópico | Formato principal |
|---|---|---|
| MERCADO DA BOLA | Transferências | Card com selo CONFIRMADO ou RUMOR |
| PLACAR | Resultados | Card de placar logo após o jogo |
| MANO A MANO | Estatísticas e comparações | Card ou carrossel X vs Y |
| TRETA | Polêmicas | Card com a frase da declaração e Reels narrado |
| VIDA DE BOLEIRO | Bastidores e lifestyle | Carrossel em lista |
| POR ONDE ANDA? | Nostalgia | Card e Reels de antes e hoje |
| VOCÊ DECIDE | Enquetes | Card com 4 opções e story com enquete |
| (sem template) | Memes e torcida | Prints e legendas, feitos à mão |

## 2. Subnichos (a etiqueta no canto do card)

O canal fala de tudo, mas cada post pertence a um subnicho. Assim dá para ver quais subnichos crescem mais e dobrar a aposta neles.

- **Brasileiros pelo mundo**: Arábia, Europa, MLS, Japão. Aqui estão as primeiras entrevistas.
- **Brasileirão**: os clubes grandes trazem volume.
- **Seleção Brasileira**
- **Champions e Europa**
- **Promessas da base**: joias de 16 a 20 anos.
- **Lendas e anos 2000**: nostalgia.
- **Arbitragem e VAR**
- **Futebol feminino**: nicho em alta e com pouca concorrência.

> A cada 30 dias, veja os 3 subnichos com mais alcance e salvamentos e aumente a frequência deles.

## 3. Calendário base (3 a 5 posts por dia)

| Dia | Destaques |
|---|---|
| Seg | PLACAR da rodada, TRETA do fim de semana |
| Ter | MERCADO, MANO A MANO |
| Qua | PLACAR (Champions/Libertadores), VOCÊ DECIDE |
| Qui | MERCADO, POR ONDE ANDA? |
| Sex | VIDA DE BOLEIRO, VOCÊ DECIDE (palpites) |
| Sáb/Dom | PLACAR ao vivo, memes da rodada |

O MERCADO DA BOLA entra todo dia que houver notícia, e nas janelas de transferências vira a editoria principal.

## 4. Rotina com o Claude Code

1. **Pauta:** peça "monte a pauta de hoje" e mande os links ou notícias que você viu. O Claude organiza por editoria e subnicho.
2. **Confira:** toda notícia precisa de fonte confiável. Rumor leva selo de RUMOR.
3. **Cards:** o Claude preenche o `posts.json`. Depois rode `node gerar.js` e os PNGs saem na pasta `saida/`.
4. **Textos:** peça legenda, hashtags e roteiro de Reels (gancho nos 3 primeiros segundos, desenvolvimento e pergunta no final).
5. **Reels sem rosto:** narração com voz de IA (a mesma voz sempre), edição no CapCut com legenda automática.

## 5. Regras

- Não use voz ou rosto de jogador gerados por IA e não crie fotos falsas.
- Não poste vídeo de transmissão de jogo, porque gera denúncia de direitos autorais.
- Use fotos com crédito, de preferência das redes oficiais dos clubes.
- Nunca poste um "furo" sem fonte.

## 6. Como usar o gerador de cards

```bash
npm install playwright   # só na primeira vez, se não tiver
npx playwright install chromium
node gerar.js
```

- `marca.json`: nome, @ e cores do canal. Troque aqui e todos os cards mudam.
- `posts.json`: os posts do dia, com um exemplo de cada tipo (`mercado`, `resultado`, `comparacao`, `polemica`, `lifestyle`, `nostalgia`, `enquete`).
- `foto`: caminho de uma imagem (ex.: `fotos/jogador.jpg`) ou URL. Opcional.
