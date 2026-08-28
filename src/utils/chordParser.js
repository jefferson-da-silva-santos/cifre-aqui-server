// Parser de sintaxe inline estilo ChordPro: "O [G]amor é como o [D]vento"
// Extrai cada ocorrência [Acorde], remove os colchetes do texto visível e
// registra a posição do caractere onde o acorde deve flutuar.
//
// Também valida o nome do acorde contra um reconhecedor de nomenclatura musical
// (fundamental válida + qualidade + extensões), sem nunca bloquear a digitação —
// acordes não reconhecidos apenas ficam marcados como tal (seção 4.3).

const NOTA_REGEX = "[A-G](?:#|b)?";
// qualidade + tensões + baixo invertido (slash), cobre: C, C#, Db, C7, Cmaj7, C9,
// C7(9), Cm7(b5), D/F#, Bdim, C+, Cdim, Caug, Csus2, Csus4 etc.
const ACORDE_NOME_REGEX = new RegExp(
  `^(${NOTA_REGEX})` + // fundamental
    `(maj7|maj9|maj11|maj13|m7b5|m7|m9|m11|m13|mM7|m6|m|dim7|dim|aug|sus2|sus4|add9|add11|6|7|9|11|13|\\+|°)?` + // qualidade
    `(\\(?(b5|#5|b9|#9|#11|b13)\\)?)*` + // tensões alteradas
    `(\\/(${NOTA_REGEX}))?$`, // baixo invertido
);

export function isAcordeReconhecido(nome) {
  if (!nome || typeof nome !== "string") return false;
  return ACORDE_NOME_REGEX.test(nome.trim());
}

/**
 * @param {string} linhaChordPro - ex: "O [G]amor é como o [D]vento"
 * @returns {{ letra: string, acordes: Array<{ posicao: number, nome: string, reconhecido: boolean }> }}
 */
export function parseLinhaChordPro(linhaChordPro) {
  const regexColchetes = /\[([^\]]+)\]/g;
  let match;
  let letra = "";
  let cursor = 0;
  const acordes = [];

  while ((match = regexColchetes.exec(linhaChordPro)) !== null) {
    const textoAntes = linhaChordPro.slice(cursor, match.index);
    letra += textoAntes;
    const nomeAcorde = match[1].trim();
    acordes.push({
      posicao: letra.length,
      nome: nomeAcorde,
      reconhecido: isAcordeReconhecido(nomeAcorde),
    });
    cursor = match.index + match[0].length;
  }
  letra += linhaChordPro.slice(cursor);

  return { letra, acordes };
}

/**
 * Reconstrói a sintaxe ChordPro a partir da estrutura JSON (usado para reexibição
 * no editor ou depuração), reinserindo os colchetes na posição correta.
 */
export function montarLinhaChordPro({ letra, acordes = [] }) {
  const ordenados = [...acordes].sort((a, b) => a.posicao - b.posicao);
  let resultado = "";
  let cursor = 0;
  for (const acorde of ordenados) {
    resultado += letra.slice(cursor, acorde.posicao) + `[${acorde.nome}]`;
    cursor = acorde.posicao;
  }
  resultado += letra.slice(cursor);
  return resultado;
}
