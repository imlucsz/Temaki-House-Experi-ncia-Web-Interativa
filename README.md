# Temaki House

Site estático da Temaki House. Abra **index.html** no navegador. Não exige instalação de dependências nem compilação. Mantenha a pasta `assets` junto do HTML ao copiar ou publicar o site.

## Organização

```text
index.html                    Estrutura da página e metadados
assets/
  css/
    base.css                Estilos básicos do documento
    styles.css              Layout, temas, responsividade e animações
  js/
    init.js                 Preparação da abertura antes de exibir a página
    main.js                 Interações, animações, galeria e renderização 3D
  images/
    prato-1.jpg             Fotos extraídas do CSS original, sem recompressão
    prato-2.jpg
    prato-3.jpg
    prato-4.jpg
```

Os estilos antes presentes em atributos `style` estão no final de `styles.css`, em classes com nomes descritivos. Os comentários de seção existentes no CSS e JavaScript foram mantidos. A ordem dos estilos e dos scripts foi preservada; `init.js` executa no cabeçalho, e `main.js` ao final da página.

O JSON-LD continua no HTML por ser um metadado estruturado do restaurante. Os SVGs usados na estrutura, nos filtros e nos elementos animados também permanecem no HTML para preservar suas referências por ID. A pequena textura SVG do CSS permanece como uma URL de dados.

## Tecnologias existentes

| Tecnologia | Uso |
| --- | --- |
| HTML5 | Estrutura semântica, navegação, botões e diálogo da galeria |
| CSS3 | Grid, Flexbox, variáveis, temas claro/escuro, responsividade, transições e efeitos visuais |
| JavaScript nativo | Eventos, estado da interface, animações com `requestAnimationFrame` e controles da página |
| WebGL e GLSL | Renderização e shaders da montagem do temaki em 3D |
| Canvas 2D | Efeitos e animações desenhados no navegador |
| SVG | Ilustrações, gradientes e filtros visuais |
| APIs do navegador | `IntersectionObserver`, `matchMedia`, Pointer Events e `localStorage` para preferência de tema |
| Google Fonts | Shippori Mincho, Yuji Boku e Zen Kaku Gothic New |
| JSON-LD / Schema.org | Dados estruturados do restaurante |
| Links do WhatsApp | Abertura da conversa para pedidos via `wa.me` |

O projeto não tem framework, backend, banco de dados ou processo de build. Os pedidos usam links do WhatsApp. O carregamento das fontes do Google e a abertura do WhatsApp dependem de internet.

## Verificação da reorganização

Comparação no Chrome em 1440 × 900 e 390 × 844: textos, IDs, links e geometria das principais seções iguais ao original; WebGL ativo, alternância de tema e de modo funcionando e nenhum erro de JavaScript. Os dois scripts foram comparados após a mesma formatação, e as quatro fotos foram verificadas byte a byte contra os dados originais.

Também foram conferidos o carregamento das quatro fotos, o botão para pular a abertura, a abertura/navegação/fechamento da galeria e o modo leve automático com a preferência de movimento reduzido.
