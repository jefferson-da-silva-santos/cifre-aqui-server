/*
 * Tintas da dinamica.
 *
 * `barra` marca, `linha` delimita e `bg` tinge — tres pesos diferentes da mesma
 * matiz. Sao os mesmos valores do preview do editor (`dinamicas.ts` no frontend),
 * porque o preview promete ser o que sai na folha; divergir aqui quebraria essa
 * promessa exatamente onde ela e verificavel.
 *
 * Todas continuam legiveis impressas em escala de cinza.
 */
const LEGENDA_DINAMICA = {
  calmaria: { cor: "#5B7FC7", linha: "#C7D4EE", bg: "#F2F5FC", label: "Calmaria — clima, instrumentação reduzida" },
  crescendo: { cor: "#C08A2A", linha: "#EBD9B4", bg: "#FCF7EE", label: "Crescendo — tensão build-up" },
  climax: { cor: "#C0453C", linha: "#EFC9C5", bg: "#FDF2F1", label: "Clímax — banda completa, ponto alto" },
  break: { cor: "#9A9793", linha: "#DCDAD7", bg: "#F5F5F4", label: "Break — silêncio estratégico, corte seco" },
};

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Renderiza uma linha de letra com acordes flutuando na posição do caractere
// correspondente — mesma técnica usada no preview do editor (frontend).
/**
 * Uma linha de cifra: acordes flutuando sobre o caractere correspondente.
 *
 * Duas correcoes de espacamento:
 *
 * 1. **Bloco sem letra** (Intro, Solo, Instrumental) cai num caminho proprio. A
 *    largura de cada acorde vinha de `letra.slice(cursor, posicao)`, que numa
 *    linha vazia e SEMPRE string vazia — todos recebiam a largura minima e
 *    saiam grudados ("GmF/AbBb..."). Sem letra nao ha o que alinhar, entao a
 *    sequencia e renderizada com espaco fixo entre os acordes.
 *
 * 2. **Com letra**, o cursor avancava so ate a posicao do acorde, ignorando o
 *    tamanho do proprio nome. Um "C#m7(b5)" invadia o acorde seguinte. Agora o
 *    slot reserva o maior entre a distancia na letra e o nome escrito.
 */
function renderizarLinha(linha, destaqueAcorde) {
  const { letra, acordes = [] } = linha;
  const classeAcorde = `acorde acorde--${destaqueAcorde}`;
  const ordenados = [...acordes].sort((a, b) => a.posicao - b.posicao);

  if (!letra.trim()) {
    if (ordenados.length === 0) return "";
    const chips = ordenados
      .map((a) => `<span class="${classeAcorde}">${escapeHtml(a.nome)}</span>`)
      .join("");
    return `<div class="sequencia-acordes">${chips}</div>`;
  }

  let html = `<div class="linha-acordes">`;
  let cursor = 0;
  for (const acorde of ordenados) {
    const distancia = Math.max(acorde.posicao - cursor, 0);
    // 0.55em por caractere da letra; o nome do acorde ocupa ~0.62em por
    // caractere na fonte em negrito, mais uma folga de um caractere.
    const larguraNome = (acorde.nome.length + 1) * 0.62;
    const largura = Math.max(distancia * 0.55, larguraNome);
    html += `<span class="acorde-slot" style="min-width:${largura.toFixed(2)}em">`;
    html += `<span class="${classeAcorde}">${escapeHtml(acorde.nome)}</span></span>`;
    cursor = acorde.posicao;
  }
  html += `</div>`;
  html += `<div class="linha-letra">${escapeHtml(letra) || "&nbsp;"}</div>`;
  return html;
}

/**
 * Linha de ritmo/contratempo.
 *
 * Forma unidade rigida com a letra (secao 4.4): as duas nunca sao separadas
 * entre paginas, porque o ritmo sozinho no topo de uma folha nao diz nada.
 */
function renderizarLinhaRitmo(linhaRitmo) {
  if (!linhaRitmo) return "";
  return `<div class="linha-ritmo">${escapeHtml(linhaRitmo)}</div>`;
}

/**
 * Observacoes gerais do hino, no pe da folha.
 *
 * Depois dos diagramas e fora do fluxo dos blocos: nao pertencem a nenhuma secao
 * da musica. Quem toca le a cifra de cima a baixo e consulta isto uma vez, no
 * comeco do ensaio.
 */
function renderizarObservacoes(observacoes) {
  const texto = (observacoes ?? "").trim();
  if (!texto) return "";
  return `<div class="observacoes">
    <div class="observacoes-rotulo">Observacoes</div>
    <p class="observacoes-texto">${escapeHtml(texto)}</p>
  </div>`;
}

function renderizarBloco(bloco, config) {
  const marcador = bloco.dinamica ? LEGENDA_DINAMICA[bloco.dinamica] : null;
  /*
   * A dinamica envolve o bloco INTEIRO, nao so a margem esquerda.
   *
   * Uma barra de 5px na lateral marca onde a secao comeca, mas nao diz ate onde
   * ela vai — com dois blocos seguidos, as barras viram uma regua continua e a
   * cor deixa de delimitar coisa alguma. Contorno completo mais um fundo levissimo
   * (os sufixos 59 e 14 sao o canal alfa em hex, ~35% e ~8%) mostram a extensao da
   * secao sem tirar contraste da letra, que continua sendo o que se le.
   */
  const estiloDinamica = marcador
    ? `border: 1px solid ${marcador.linha}; background: ${marcador.bg}; border-left: 3px solid ${marcador.cor};`
    : "";

  let html = `<div class="bloco${marcador ? " bloco--dinamica" : ""}" style="${estiloDinamica}">`;
  const corTitulo = marcador ? ` style="color:${marcador.cor}"` : "";
  html += `<div class="bloco-titulo"${corTitulo}>${escapeHtml(bloco.tipo)}</div>`;

  for (const linha of bloco.linhas ?? []) {
    // A linha de ritmo e a linha de letra formam uma unidade rígida que nunca
    // é quebrada entre páginas (seção 4.4) — garantido via CSS break-inside.
    html += `<div class="unidade-linha">`;
    html += renderizarLinhaRitmo(linha.linhaRitmo);
    html += renderizarLinha(linha, config.destaqueAcorde);
    // A nota entra DENTRO da unidade rigida: separada da linha a que se refere,
    // ela vira uma frase solta no topo da pagina seguinte, sem contexto nenhum.
    if (linha.nota) {
      html += `<div class="nota-linha">${escapeHtml(linha.nota)}</div>`;
    }
    html += `</div>`;
  }

  for (const anotacao of bloco.anotacoes ?? []) {
    html += `<div class="anotacao">(${escapeHtml(anotacao.instrumento)}: ${escapeHtml(anotacao.texto)})</div>`;
  }

  html += `</div>`;
  return html;
}

function renderizarLegenda(blocos) {
  const usados = new Set(blocos.map((b) => b.dinamica).filter(Boolean));
  if (usados.size === 0) return "";

  let html = `<div class="legenda-dinamica">`;
  for (const chave of usados) {
    const info = LEGENDA_DINAMICA[chave];
    html += `<span class="legenda-item"><span class="legenda-cor" style="background:${info.cor}"></span>${escapeHtml(info.label)}</span>`;
  }
  html += `</div>`;
  return html;
}

function renderizarDiagramas(nomesAcordesOrdenados, diagramasSvg) {
  const disponiveis = nomesAcordesOrdenados.filter((n) => diagramasSvg[n]);
  if (disponiveis.length === 0) return "";
  let html = `<div class="area-diagramas"><div class="diagramas-titulo">Diagramas de acordes</div><div class="diagramas-grid">`;
  for (const nome of disponiveis) {
    html += `<div class="diagrama-item">${diagramasSvg[nome]}</div>`;
  }
  html += `</div></div>`;
  return html;
}

const TEMAS_CSS = {
  minimalista: `--cor-fundo:#fff; --cor-texto:#1a1a1a; --cor-acorde:#1D6FA4; --fonte: 'Helvetica Neue', Arial, sans-serif;`,
  vintage: `--cor-fundo:#FBF3E7; --cor-texto:#3B2A1A; --cor-acorde:#A3492A; --fonte: Georgia, 'Times New Roman', serif;`,
  cifra_igreja: `--cor-fundo:#fff; --cor-texto:#1a1a1a; --cor-acorde:#7A1F1F; --fonte: 'Helvetica Neue', Arial, sans-serif;`,
};

export function construirHtmlCifra(cifra, { diagramasSvg = {}, cabecalhoExtra = null } = {}) {
  const config = cifra.configuracaoPdf;
  const colunas = config.colunas === 2 ? 2 : 1;
  const orientacaoCss = config.orientacao === "paisagem" ? "landscape" : "portrait";
  const nomesAcordes = [
    ...new Set(
      (cifra.blocos ?? []).flatMap((b) =>
        (b.linhas ?? []).flatMap((l) => (l.acordes ?? []).map((a) => a.nome)),
      ),
    ),
  ];

  const temaCss = TEMAS_CSS[config.tema] ?? TEMAS_CSS.minimalista;
  const caixaDestaqueIgreja =
    config.tema === "cifra_igreja"
      ? `.bloco-titulo { background:#F2E4E4; padding:2px 8px; border-radius:4px; display:inline-block; }`
      : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<style>
  @page { size: A4 ${orientacaoCss}; margin: 16mm 14mm; }
  :root { ${temaCss} }
  * { box-sizing: border-box; }
  body { font-family: var(--fonte); color: var(--cor-texto); background: var(--cor-fundo); font-size: 12px; }
  .cabecalho { display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
  .cabecalho img { max-height: 48px; }
  .titulo-musica { font-size: 20px; font-weight: 700; margin: 0; }
  .artista { font-size: 13px; color: #666; margin: 2px 0 0; }
  .info-extra { font-size: 11px; color:#666; text-align:right; }
  /* column-fill fica no padrao (balance), nao auto: com auto a coluna esquerda
     enche ate o fim da pagina antes de passar para a direita, e numa cifra curta
     isso deixa metade da folha vazia. Balanceado, as duas colunas ficam com a
     mesma altura — cifra curta fica simetrica, cifra longa continua caindo na
     direita, que e o objetivo de duas paginas em uma folha.
     Nao se declara altura: em midia paginada a propria pagina e o fragmentainer,
     e uma altura em mm brigaria com a margem da regra @page. */
  .conteudo { column-count: ${colunas}; column-gap: 24px; ${colunas === 2 ? "column-rule: 1px solid #e3e3e3;" : ""} }
  .bloco { break-inside: avoid; margin-bottom: 14px; padding-left: 8px; }
  /* Com dinamica o bloco vira uma caixa: precisa de respiro interno para o texto
     nao encostar no contorno, e de raio para nao competir com a moldura da folha. */
  .bloco--dinamica { padding: 8px 10px; border-radius: 5px; }
  .bloco-titulo { font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: .04em; color:#555; margin-bottom: 4px; }
  ${caixaDestaqueIgreja}
  .unidade-linha { break-inside: avoid; margin-bottom: 2px; }
  .linha-acordes { display:flex; height: 14px; white-space: nowrap; }
  .linha-letra { white-space: pre-wrap; line-height: 1.5; }
  .linha-ritmo { font-family: monospace; font-size: 11px; color: #888; }
  .acorde-slot { display:inline-block; }
  .acorde { font-weight: 700; color: var(--cor-acorde); }
  .acorde--negrito { font-weight: 800; }
  .acorde--cor { color: var(--cor-acorde); }
  .acorde--sublinhado { text-decoration: underline; }
  .anotacao { font-style: italic; font-size: 10.5px; color: #777; margin-top: 2px; }
  /* Sequencia de bloco sem letra: espaco real entre os acordes, em vez do
     alinhamento por caractere que so faz sentido quando existe letra embaixo. */
  .sequencia-acordes { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 2px 0 4px; }
  /* Nota de linha: discreta e recuada, para se ler como margem do caderno e
     nao competir com a letra nem com os acordes. */
  .nota-linha { font-size: 9.5px; font-style: italic; color: #8a8a8a; margin: 1px 0 4px 14px; }
  /* Observacoes do hino: no pe da folha, depois de toda a cifra. */
  .observacoes { break-inside: avoid; margin-top: 16px; padding-top: 8px; border-top: 1px solid #ddd; }
  .observacoes-rotulo { font-size: 9px; letter-spacing: 1.2px; text-transform: uppercase; color: #999; }
  .observacoes-texto { font-size: 10.5px; line-height: 1.5; color: #666; white-space: pre-wrap; margin: 3px 0 0; }
  .legenda-dinamica { break-inside: avoid; display:flex; flex-wrap:wrap; gap: 10px; font-size: 10px; margin-bottom: 12px; padding: 6px 8px; background:#fafafa; border-radius: 4px; }
  .legenda-item { display:flex; align-items:center; gap:4px; }
  .legenda-cor { width:9px; height:9px; border-radius:2px; display:inline-block; }
  .area-diagramas { break-before: auto; margin-top: 16px; border-top: 1px solid #ddd; padding-top: 8px; column-span: all; }
  .diagramas-titulo { font-weight:700; font-size: 11px; margin-bottom: 6px; }
  .diagramas-grid { display:flex; flex-wrap:wrap; gap: 6px; }
</style>
</head>
<body>
  <div class="cabecalho">
    <div style="display:flex; align-items:center; gap:10px;">
      ${config.logoUrl ? `<img src="${escapeHtml(config.logoUrl)}" />` : ""}
      <div>
        <p class="titulo-musica">${escapeHtml(cifra.titulo)}</p>
        ${cifra.artista && config.mostrarCabecalhoArtista !== false ? `<p class="artista">${escapeHtml(cifra.artista)}</p>` : ""}
      </div>
    </div>
    <div class="info-extra">
      Tom: <strong>${escapeHtml(cifra.tom)}</strong><br/>
      ${config.nomeExibicao ? escapeHtml(config.nomeExibicao) : ""}
      ${cabecalhoExtra ?? ""}
    </div>
  </div>

  ${config.mostrarLegendaDinamica ? renderizarLegenda(cifra.blocos) : ""}

  <div class="conteudo">
    ${(cifra.blocos ?? []).map((b) => renderizarBloco(b, config)).join("")}
    ${config.mostrarDiagramas ? renderizarDiagramas(nomesAcordes, diagramasSvg) : ""}
    ${renderizarObservacoes(cifra.observacoes)}
  </div>
</body>
</html>`;
}

// Modo Professor (seção 8.3): insere cabeçalho extra com professor/data/tonalidade.
export function cabecalhoModoProfessor() {
  const data = new Date().toLocaleDateString("pt-BR");
  return `<br/>Professor: ____________________<br/>Data: ${data}`;
}
