import { ApiError } from "../../utils/ApiError.js";
import {
  CAMPO_HARMONICO_MAIOR,
  CAMPO_HARMONICO_MENOR,
  isTomMenor,
  fundamentalDoTom,
  notaPorSemitons,
} from "./harmonicFields.js";
import {
  parseAcorde,
  separarQualidadeBase,
  decomporEntradaCampo,
  montarNomeAcorde,
  mesmaNota,
} from "./acordeUtils.js";

function encontrarCampoMaior(fundamental) {
  const chave = Object.keys(CAMPO_HARMONICO_MAIOR).find((k) => mesmaNota(k, fundamental));
  return chave ? { chave, campo: CAMPO_HARMONICO_MAIOR[chave] } : null;
}

function encontrarObjetoMenor(fundamental) {
  const chave = Object.keys(CAMPO_HARMONICO_MENOR).find((k) =>
    mesmaNota(k.slice(0, -1), fundamental),
  );
  return chave ? { chave, variantes: CAMPO_HARMONICO_MENOR[chave] } : null;
}

/**
 * Procura o acorde (fundamental + qualidadeBase) dentro de um array de campo
 * harmônico. Retorna o índice do grau (0-6) ou -1 se não for diatônico.
 */
function encontrarGrau(fundamental, qualidadeBase, campoArray) {
  return campoArray.findIndex((entrada) => {
    const dec = decomporEntradaCampo(entrada);
    return mesmaNota(dec.fundamental, fundamental) && dec.qualidadeBase === qualidadeBase;
  });
}

/**
 * Identifica, para um acorde da música, se ele é diatônico ao tom original —
 * testando, no caso de tom menor, contra as variantes natural / harmônica / melódica
 * disponíveis (seção 5.6: basta bater com qualquer uma delas para ser diatônico).
 */
function classificarAcordeNoTom({ fundamental, qualidadeBase, tomInfo }) {
  if (tomInfo.tipo === "maior") {
    const grau = encontrarGrau(fundamental, qualidadeBase, tomInfo.campoMaior.campo);
    if (grau === -1) return { diatonico: false };
    return { diatonico: true, grau, variante: null };
  }

  for (const variante of ["natural", "harmonico", "melodico"]) {
    const campoArray = tomInfo.objetoMenor.variantes[variante];
    if (!campoArray) continue;
    const grau = encontrarGrau(fundamental, qualidadeBase, campoArray);
    if (grau !== -1) return { diatonico: true, grau, variante };
  }
  return { diatonico: false };
}

function resolverTomInfo(tom) {
  const fundamentalOriginal = fundamentalDoTom(tom);
  if (isTomMenor(tom)) {
    const objetoMenor = encontrarObjetoMenor(fundamentalOriginal);
    if (!objetoMenor) {
      throw ApiError.badRequest(
        `O tom "${tom}" não possui campo harmônico menor cadastrado no sistema no momento.`,
      );
    }
    return { tipo: "menor", fundamentalOriginal, objetoMenor };
  }

  const campoMaior = encontrarCampoMaior(fundamentalOriginal);
  if (!campoMaior) {
    throw ApiError.badRequest(`O tom "${tom}" não possui campo harmônico maior cadastrado.`);
  }
  return { tipo: "maior", fundamentalOriginal, campoMaior };
}

function calcularTomDestino(tomInfo, semitons) {
  const novaFundamental = notaPorSemitons(tomInfo.fundamentalOriginal, semitons);

  if (tomInfo.tipo === "maior") {
    const destino = encontrarCampoMaior(novaFundamental);
    if (!destino) {
      throw ApiError.badRequest(
        `Não foi possível transpor: o tom de destino (${novaFundamental}) não está cadastrado.`,
      );
    }
    return { tipo: "maior", campoMaior: destino, nomeTom: destino.chave };
  }

  const destino = encontrarObjetoMenor(novaFundamental);
  if (!destino) {
    throw ApiError.badRequest(
      `Não foi possível transpor: o campo harmônico do tom menor de destino (${novaFundamental}m) ` +
        `ainda não está cadastrado no sistema (dataset cobre apenas os tons menores mais comuns).`,
    );
  }
  return { tipo: "menor", objetoMenor: destino, nomeTom: destino.chave };
}

/**
 * Transpõe um único nome de acorde, dado o resultado de classificação (diatônico
 * ou não) e o tom de destino já resolvido — seção 5.2, passo 4.
 */
function transporAcorde(nomeAcorde, semitons, tomInfo, tomDestinoInfo) {
  const parsed = parseAcorde(nomeAcorde);
  if (!parsed) {
    // Acorde não reconhecido pelo validador (seção 4.3): não bloqueia a
    // transposição, mas também não conseguimos recalculá-lo com segurança —
    // ele é preservado como está.
    return nomeAcorde;
  }

  const { qualidadeBase, extensao } = separarQualidadeBase(parsed.resto);
  const classificacao = classificarAcordeNoTom({
    fundamental: parsed.fundamental,
    qualidadeBase,
    tomInfo,
  });

  let novoFundamental;
  let novoResto;
  const novoBaixo = parsed.baixo ? notaPorSemitons(parsed.baixo, semitons) : null;

  if (classificacao.diatonico) {
    // Acorde diatônico: busca o mesmo grau funcional no tom de destino e
    // reconstrói com a qualidade do grau de destino + extensões originais
    // preservadas (7, 9, maj7, sus4, tensões...) — só a fundamental (e, quando
    // aplicável, a qualidade básica do grau) é recalculada (seção 5.2, passo 5).
    const campoDestinoArray =
      tomDestinoInfo.tipo === "maior"
        ? tomDestinoInfo.campoMaior.campo
        : tomDestinoInfo.objetoMenor.variantes[classificacao.variante] ??
          tomDestinoInfo.objetoMenor.variantes.natural;

    const entradaDestino = campoDestinoArray[classificacao.grau];
    const destParsed = parseAcorde(entradaDestino);
    novoFundamental = destParsed.fundamental;
    novoResto = destParsed.resto + extensao;
  } else {
    // Empréstimo modal / não diatônico: desloca cromaticamente, preservando a
    // mesma distância em relação à tônica, extensões intactas (seção 5.2, passo 4).
    novoFundamental = notaPorSemitons(parsed.fundamental, semitons);
    novoResto = parsed.resto;
  }

  return montarNomeAcorde({ fundamental: novoFundamental, resto: novoResto, baixo: novoBaixo });
}

const ACORDE_ENTRE_COLCHETES = /\[([^\]]+)\]/g;

/**
 * `linhaRitmo` é texto livre (ex: ". . [F#o7] |") — os acordes embutidos entre
 * colchetes são recalculados como qualquer outro acorde da música; o resto do
 * texto (pontos, barras, símbolos de contratempo) é preservado como está.
 */
function transporLinhaRitmoTexto(texto, semitons, tomInfo, tomDestinoInfo) {
  if (!texto) return texto;
  return texto.replace(ACORDE_ENTRE_COLCHETES, (match, nomeAcorde) => {
    const transposto = transporAcorde(nomeAcorde, semitons, tomInfo, tomDestinoInfo);
    return `[${transposto}]`;
  });
}

export default class TransposicaoService {
  /**
   * @param {object} cifraJson - JSON completo da cifra (com blocos/linhas/acordes)
   * @param {number} semitons - quantidade de semitons (positivo = subir, negativo = descer)
   * @returns {{ tom: string, blocos: object[] }}
   */
  transporCifra(cifraJson, semitons) {
    if (semitons === 0) return { tom: cifraJson.tom, blocos: cifraJson.blocos };

    const tomInfo = resolverTomInfo(cifraJson.tom);
    const tomDestinoInfo = calcularTomDestino(tomInfo, semitons);

    const blocosTranspostos = cifraJson.blocos.map((bloco) => ({
      ...bloco,
      linhas: bloco.linhas.map((linha) => ({
        ...linha,
        acordes: linha.acordes.map((acorde) => ({
          ...acorde,
          nome: transporAcorde(acorde.nome, semitons, tomInfo, tomDestinoInfo),
        })),
        linhaRitmo: transporLinhaRitmoTexto(linha.linhaRitmo, semitons, tomInfo, tomDestinoInfo),
      })),
    }));

    return { tom: tomDestinoInfo.nomeTom, blocos: blocosTranspostos };
  }
}
