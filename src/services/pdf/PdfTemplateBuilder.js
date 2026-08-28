const LEGENDA_DINAMICA = {
  calmaria: { cor: "#3B82C4", label: "Calmaria — clima, instrumentação reduzida" },
  crescendo: { cor: "#E0B23A", label: "Crescendo — tensão build-up" },
  climax: { cor: "#D9534F", label: "Clímax — banda completa, ponto alto" },
  break: { cor: "#6C757D", label: "Break — silêncio estratégico, corte seco" },
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
function renderizarLinha(linha, destaqueAcorde) {
  const { letra, acordes = [] } = linha;
  const classeAcorde = `acorde acorde--${destaqueAcorde}`;

  let html = `<div class="linha-acordes">`;
  let cursor = 0;
  const ordenados = [...acordes].sort((a, b) => a.posicao - b.posicao);
  for (const acorde of ordenados) {
    const espacamento = letra.slice(cursor, acorde.posicao).length;
    html += `<span class="acorde-slot" style="min-width:${Math.max(espacamento, 1) * 0.55}em">`;
    html += `<span class="${classeAcorde}">${escapeHtml(acorde.nome)}</span></span>`;
    cursor = acorde.posicao;
  }
  html += `</div>`;
  html += `<div class="linha-letra">${escapeHtml(letra) || "&nbsp;"}</div>`;
  return html;
}

function renderizarLinhaRitmo(linhaRitmo) {
  if (!linhaRitmo) return "";
  return `<div class="linha-ritmo">${escapeHtml(linhaRitmo)}</div>`;
}

function renderizarBloco(bloco, config) {
  const marcador = bloco.dinamica ? LEGENDA_DINAMICA[bloco.dinamica] : null;
  const estiloBorda = marcador ? `border-left: 5px solid ${marcador.cor};` : "";

  let html = `<div class="bloco" style="${estiloBorda}">`;
  html += `<div class="bloco-titulo">${escapeHtml(bloco.tipo)}</div>`;

  for (const linha of bloco.linhas ?? []) {
    // A linha de ritmo e a linha de letra formam uma unidade rígida que nunca
    // é quebrada entre páginas (seção 4.4) — garantido via CSS break-inside.
    html += `<div class="unidade-linha">`;
    html += renderizarLinhaRitmo(linha.linhaRitmo);
    html += renderizarLinha(linha, config.destaqueAcorde);
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
  .conteudo { column-count: ${colunas}; column-gap: 24px; }
  .bloco { break-inside: avoid; margin-bottom: 14px; padding-left: 8px; }
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
  </div>
</body>
</html>`;
}

// Modo Professor (seção 8.3): insere cabeçalho extra com professor/data/tonalidade.
export function cabecalhoModoProfessor() {
  const data = new Date().toLocaleDateString("pt-BR");
  return `<br/>Professor: ____________________<br/>Data: ${data}`;
}
