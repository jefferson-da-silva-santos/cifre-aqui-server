import { describe, it, expect } from "@jest/globals";
import TransposicaoService from "../src/services/transposicao/TransposicaoService.js";

const service = new TransposicaoService();

describe("TransposicaoService — campo harmônico (seção 5 do produto)", () => {
  it("transpõe uma progressão diatônica simples respeitando o grau funcional", () => {
    const cifra = {
      tom: "C",
      blocos: [
        {
          linhas: [
            {
              acordes: [
                { posicao: 0, nome: "C" },
                { posicao: 1, nome: "Am" },
                { posicao: 2, nome: "F" },
                { posicao: 3, nome: "G" },
              ],
              linhaRitmo: null,
            },
          ],
        },
      ],
    };

    const resultado = service.transporCifra(cifra, 2); // C -> D

    expect(resultado.tom).toBe("D");
    const nomes = resultado.blocos[0].linhas[0].acordes.map((a) => a.nome);
    expect(nomes).toEqual(["D", "Bm", "G", "A"]);
  });

  it("preserva empréstimo modal com deslocamento cromático simples (exemplo da seção 5.5)", () => {
    const cifra = {
      tom: "C",
      blocos: [
        {
          linhas: [
            {
              acordes: [
                { posicao: 0, nome: "F" },
                { posicao: 1, nome: "Fm" },
                { posicao: 2, nome: "C" },
              ],
              linhaRitmo: null,
            },
          ],
        },
      ],
    };

    const resultado = service.transporCifra(cifra, 2); // C -> D
    const nomes = resultado.blocos[0].linhas[0].acordes.map((a) => a.nome);
    expect(nomes).toEqual(["G", "Gm", "D"]);
  });

  it("preserva extensões (7, maj7, 9) ao transpor acordes diatônicos", () => {
    const cifra = {
      tom: "C",
      blocos: [{ linhas: [{ acordes: [{ posicao: 0, nome: "Cmaj7" }], linhaRitmo: null }] }],
    };

    const resultado = service.transporCifra(cifra, 2);
    expect(resultado.blocos[0].linhas[0].acordes[0].nome).toBe("Dmaj7");
  });

  it("não altera nada quando semitons = 0", () => {
    const cifra = { tom: "G", blocos: [] };
    const resultado = service.transporCifra(cifra, 0);
    expect(resultado.tom).toBe("G");
  });

  it("transpõe acordes embutidos entre colchetes na linhaRitmo (texto livre), preservando o resto do texto", () => {
    const cifra = {
      tom: "C",
      blocos: [
        {
          linhas: [
            { acordes: [{ posicao: 0, nome: "C" }], linhaRitmo: ". . [F#o7] |" },
            { acordes: [], linhaRitmo: null },
          ],
        },
      ],
    };

    const resultado = service.transporCifra(cifra, 2); // C -> D
    expect(resultado.blocos[0].linhas[0].linhaRitmo).toBe(". . [G#o7] |");
    expect(resultado.blocos[0].linhas[1].linhaRitmo).toBeNull();
  });
});
