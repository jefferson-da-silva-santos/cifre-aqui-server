// Dataset estático de campos harmônicos, embutido no sistema conforme decisão
// da seção 16 ("a definir" -> optamos por JSON estático versionado no código).
//
// Cada grau é indexado por posição: [I, ii, iii, IV, V, vi, vii°] para maiores,
// e [i, ii, III, iv, V, VI, vii°] (mais as variantes harmônica/melódica) para menores.

export const GRAUS_MAIOR = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
export const GRAUS_MENOR = ["i", "ii", "III", "iv", "V", "VI", "vii°"];

// Seção 5.3 — Campos Harmônicos Maiores
export const CAMPO_HARMONICO_MAIOR = {
  C: ["C", "Dm", "Em", "F", "G", "Am", "Bdim"],
  G: ["G", "Am", "Bm", "C", "D", "Em", "F#dim"],
  D: ["D", "Em", "F#m", "G", "A", "Bm", "C#dim"],
  A: ["A", "Bm", "C#m", "D", "E", "F#m", "G#dim"],
  E: ["E", "F#m", "G#m", "A", "B", "C#m", "D#dim"],
  B: ["B", "C#m", "D#m", "E", "F#", "G#m", "A#dim"],
  "F#": ["F#", "G#m", "A#m", "B", "C#", "D#m", "E#dim"],
  F: ["F", "Gm", "Am", "Bb", "C", "Dm", "Edim"],
  Bb: ["Bb", "Cm", "Dm", "Eb", "F", "Gm", "Adim"],
  Eb: ["Eb", "Fm", "Gm", "Ab", "Bb", "Cm", "Ddim"],
  Ab: ["Ab", "Bbm", "Cm", "Db", "Eb", "Fm", "Gdim"],
  Db: ["Db", "Ebm", "Fm", "Gb", "Ab", "Bbm", "Cdim"],
};

// Seção 5.4 — Campos Harmônicos Menores (natural / harmônico / melódico)
// grau: [i, ii, III, iv, V, VI, vii°]  (ii e III variam entre dim/maior conforme o tipo)
export const CAMPO_HARMONICO_MENOR = {
  Am: {
    natural: ["Am", "Bdim", "C", "Dm", "Em", "F", "G"],
    harmonico: ["Am", "Bdim", "C+", "Dm", "E", "F", "G#dim"],
    melodico: ["Am", "Bm", "C+", "D", "E", "F#dim", "G#dim"],
  },
  Em: {
    natural: ["Em", "F#dim", "G", "Am", "Bm", "C", "D"],
    harmonico: ["Em", "F#dim", "G+", "Am", "B", "C", "D#dim"],
    melodico: ["Em", "F#m", "G+", "A", "B", "C#dim", "D#dim"],
  },
  Bm: {
    natural: ["Bm", "C#dim", "D", "Em", "F#m", "G", "A"],
    harmonico: ["Bm", "C#dim", "D+", "Em", "F#", "G", "A#dim"],
    melodico: ["Bm", "C#m", "D+", "E", "F#", "G#dim", "A#dim"],
  },
  "F#m": {
    natural: ["F#m", "G#dim", "A", "Bm", "C#m", "D", "E"],
    harmonico: ["F#m", "G#dim", "A+", "Bm", "C#", "D", "E#dim"],
  },
  "C#m": {
    natural: ["C#m", "D#dim", "E", "F#m", "G#m", "A", "B"],
    harmonico: ["C#m", "D#dim", "E+", "F#m", "G#", "A", "B#dim"],
  },
  Gm: {
    natural: ["Gm", "Adim", "Bb", "Cm", "Dm", "Eb", "F"],
    harmonico: ["Gm", "Adim", "Bb+", "Cm", "D", "Eb", "F#dim"],
  },
  Dm: {
    natural: ["Dm", "Edim", "F", "Gm", "Am", "Bb", "C"],
    harmonico: ["Dm", "Edim", "F+", "Gm", "A", "Bb", "C#dim"],
  },
  Cm: {
    natural: ["Cm", "Ddim", "Eb", "Fm", "Gm", "Ab", "Bb"],
    harmonico: ["Cm", "Ddim", "Eb+", "Fm", "G", "Ab", "Bdim"],
  },
};

// Escala cromática usada para deslocamento simples (empréstimos modais / acordes
// não diatônicos) e para calcular o tom de destino a partir de N semitons.
export const ESCALA_CROMATICA = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

// Enarmonias equivalentes (bemol -> sustenido) para normalizar índice na escala cromática
const ENARMONIA = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
  Fb: "E",
  Cb: "B",
  "E#": "F",
  "B#": "C",
};

export function normalizarNota(nota) {
  return ENARMONIA[nota] ?? nota;
}

export function indiceCromatico(nota) {
  const normalizada = normalizarNota(nota);
  const idx = ESCALA_CROMATICA.indexOf(normalizada);
  if (idx === -1) throw new Error(`Nota inválida: ${nota}`);
  return idx;
}

export function notaPorSemitons(notaOrigem, semitons) {
  const idx = indiceCromatico(notaOrigem);
  const novoIdx = ((idx + semitons) % 12 + 12) % 12;
  return ESCALA_CROMATICA[novoIdx];
}

export function isTomMenor(tom) {
  return tom.endsWith("m") && !tom.endsWith("dim");
}

export function fundamentalDoTom(tom) {
  return isTomMenor(tom) ? tom.slice(0, -1) : tom;
}
