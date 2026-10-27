# Sistema do Caçador (versão web / iPhone)

Hábitos, missões diárias e tarefas gamificados no estilo das janelas do "Sistema", com portais,
chefes, exército das sombras, loja de cartas e arsenal. Mesmas regras da versão Android.

**Jogar:** https://alissonapodaca10-sudo.github.io/sistema-cacador/

## Instalar no iPhone

1. Abra o link acima no **Safari**.
2. Toque em **Compartilhar** (quadrado com seta para cima).
3. Toque em **Adicionar à Tela de Início** e depois em **Adicionar**.

O ícone abre o app em tela cheia e funciona sem internet depois da primeira abertura.
O progresso fica salvo no próprio aparelho.

## Desenvolvimento

```
npm ci
npm test          # regras do jogo (espelham os testes do Android)
npm run build     # gera dist/
npm run preview   # serve dist/ em http://localhost:4173/sistema-cacador/
node scripts/screens.mjs   # capturas de tela em tamanho de iPhone
```
