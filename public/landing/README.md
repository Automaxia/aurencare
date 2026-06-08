# Ilustrações da landing (sketches de figura humana)

Solte aqui os **sketches de linha** (estilo gesto / croqui) em **PNG transparente**.
Enquanto o arquivo não existir, o slot fica invisível — não quebra o layout.

A landing aplica automaticamente um leve tom sépia + baixa opacidade para integrar
à atmosfera da marca (ajustável por slot no `page.tsx`).

## Arquivos esperados (nomes fixos usados no código)

| Arquivo                | Onde aparece            | Sugestão de conteúdo                          |
|------------------------|-------------------------|-----------------------------------------------|
| `conversa.png`         | Hero (grande, à direita)| Duas pessoas em conversa (sessão)             |
| `figura-1.png`         | Continuidade (esquerda) | Uma pessoa sentada, refletindo                |
| `figura-2.png`         | Modo Presença (direita) | Pessoa em escuta / acolhimento                |
| `figura-3.png`         | Privacidade (esquerda)  | Figura serena / em pé                         |

> Ideia de "percorrer o site": as figuras podem ser uma **sequência de movimento**
> (em pé → sentando → conversando), criando a sensação de jornada ao rolar a página.

## Formato recomendado
- PNG transparente (ou SVG), traço escuro sobre fundo transparente.
- Largura ~800–1400px (nitidez em telas retina).
- Proporção livre; o slot usa `background-size: contain`.
