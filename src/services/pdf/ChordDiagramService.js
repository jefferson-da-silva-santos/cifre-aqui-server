// Origem dos diagramas padrão: em produção, isto consulta o dataset
// `@tombatossals/chords-db` (seção 6.1 do produto) pelo nome do acorde
// reconhecido. Aqui embutimos um subconjunto representativo dos acordes
// abertos mais comuns para violão como fallback/exemplo funcional; o pacote
// completo pode ser plugado substituindo `buscarNoDatasetPadrao`.
const DATASET_PADRAO_VIOLAO = {
  C: { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], barres: [], capo: false },
  D: { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], barres: [], capo: false },
  E: { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], barres: [], capo: false },
  F: { frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barres: [1], capo: false },
  G: { frets: [3, 2, 0, 0, 0, 3], fingers: [3, 2, 0, 0, 0, 4], barres: [], capo: false },
  A: { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0], barres: [], capo: false },
  B: { frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], barres: [2], capo: false },
  Am: { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], barres: [], capo: false },
  Dm: { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1], barres: [], capo: false },
  Em: { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], barres: [], capo: false },
  Bm: { frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barres: [2], capo: false },
  Fm: { frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], barres: [1], capo: false },
};

function buscarNoDatasetPadrao(nomeAcorde, instrumento) {
  if (instrumento !== "violao" && instrumento !== "guitarra") return null;
  return DATASET_PADRAO_VIOLAO[nomeAcorde] ?? null;
}

/**
 * Componente único de renderização (SVG) — usado tanto para diagramas padrão
 * quanto customizados, exatamente como no frontend (doc 2, seção 6.2):
 * só a origem dos dados muda, nunca a lógica de desenho.
 */
function renderizarDiagramaSvg(nomeExibicao, { frets, fingers, barres = [], capo }) {
  const cordas = frets.length;
  const largura = 90;
  const altura = 110;
  const margem = 14;
  const passoX = (largura - margem * 2) / (cordas - 1);
  const casas = 5;
  const passoY = (altura - margem * 2) / casas;

  let svg = `<svg width="${largura}" height="${altura + 16}" viewBox="0 0 ${largura} ${altura + 16}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<text x="${largura / 2}" y="10" text-anchor="middle" font-size="10" font-weight="bold">${nomeExibicao}</text>`;

  for (let i = 0; i < cordas; i++) {
    const x = margem + i * passoX;
    svg += `<line x1="${x}" y1="${margem + 14}" x2="${x}" y2="${altura - margem + 14}" stroke="#333" stroke-width="1"/>`;
  }
  for (let c = 0; c <= casas; c++) {
    const y = margem + 14 + c * passoY;
    svg += `<line x1="${margem}" y1="${y}" x2="${largura - margem}" y2="${y}" stroke="#333" stroke-width="${c === 0 ? 2.5 : 1}"/>`;
  }

  for (const casaBarre of barres) {
    const y = margem + 14 + (casaBarre - 0.5) * passoY;
    svg += `<line x1="${margem}" y1="${y}" x2="${largura - margem}" y2="${y}" stroke="#555" stroke-width="5" stroke-linecap="round" opacity="0.6"/>`;
  }

  frets.forEach((casa, i) => {
    const x = margem + i * passoX;
    if (casa === -1) {
      svg += `<text x="${x}" y="${margem + 10}" text-anchor="middle" font-size="9">✕</text>`;
    } else if (casa === 0) {
      svg += `<circle cx="${x}" cy="${margem + 6}" r="3.5" fill="none" stroke="#333"/>`;
    } else {
      const y = margem + 14 + (casa - 0.5) * passoY;
      svg += `<circle cx="${x}" cy="${y}" r="5" fill="#1D6FA4"/>`;
      const dedo = fingers?.[i];
      if (dedo) svg += `<text x="${x}" y="${y + 3}" text-anchor="middle" font-size="7" fill="#fff">${dedo}</text>`;
    }
  });

  if (capo) svg += `<text x="${largura / 2}" y="${altura + 14}" text-anchor="middle" font-size="8">Capotraste</text>`;

  svg += "</svg>";
  return svg;
}

export default class ChordDiagramService {
  constructor(acordeCustomizadoRepository) {
    this.acordeCustomizadoRepository = acordeCustomizadoRepository;
  }

  /**
   * Resolve todos os diagramas necessários para uma cifra: primeiro tenta o
   * diagrama customizado vinculado ao nome do acorde (se o usuário criou um),
   * senão cai para o dataset padrão do instrumento.
   */
  async resolverDiagramas({ nomesAcordes, instrumento, acordesCustomizadosUsados }) {
    const customizados = acordesCustomizadosUsados?.length
      ? await this.acordeCustomizadoRepository.findManyByIds(acordesCustomizadosUsados)
      : [];

    const porNomeVinculado = new Map(
      customizados.filter((c) => c.nomeAcordeVinculado).map((c) => [c.nomeAcordeVinculado, c]),
    );

    const diagramas = {};
    for (const nome of new Set(nomesAcordes)) {
      const custom = porNomeVinculado.get(nome);
      if (custom) {
        diagramas[nome] = renderizarDiagramaSvg(custom.nomeExibicao, custom);
        continue;
      }
      const padrao = buscarNoDatasetPadrao(nome, instrumento);
      diagramas[nome] = padrao ? renderizarDiagramaSvg(nome, padrao) : null;
    }
    return diagramas;
  }
}
