// Compara o estado "cobrável" (conteúdo musical) da cifra contra o snapshot do
// último pagamento aprovado. Só o CONTEÚDO conta para cobrança — mudanças puramente
// de formatação de exportação são gratuitas, conforme a recomendação da seção 11.2
// para a pergunta em aberto da seção 16 ("tratar como gratuito, cobrando só por
// mudança de conteúdo: letra/acorde/estrutura/tom, não de formatação").

// Campos de configuracaoPdf considerados "só formatação" — nunca disparam cobrança.
const CAMPOS_FORMATACAO_GRATUITA = new Set([
  "template",
  "colunas",
  "orientacao",
  "mostrarDiagramas",
  "mostrarLegendaDinamica",
  "logoUrl",
  "nomeExibicao",
  "redesSociais",
  "destaqueAcorde",
  "tema",
]);

function extrairEstadoCobravel(cifraJson) {
  return {
    titulo: cifraJson.titulo,
    artista: cifraJson.artista ?? null,
    tom: cifraJson.tom,
    instrumento: cifraJson.instrumento,
    blocos: cifraJson.blocos,
    acordesCustomizadosUsados: [...(cifraJson.acordesCustomizadosUsados ?? [])].sort(),
  };
}

function estruturalmenteIguais(a, b) {
  // Comparação profunda simples via serialização estável (ordenação de chaves).
  return JSON.stringify(ordenarChaves(a)) === JSON.stringify(ordenarChaves(b));
}

function ordenarChaves(valor) {
  if (Array.isArray(valor)) return valor.map(ordenarChaves);
  if (valor && typeof valor === "object") {
    return Object.keys(valor)
      .sort()
      .reduce((acc, key) => {
        acc[key] = ordenarChaves(valor[key]);
        return acc;
      }, {});
  }
  return valor;
}

export default class DiffService {
  /**
   * @returns {{ houveAlteracaoDeConteudo: boolean }}
   */
  comparar(cifraJsonAtual, versaoPagaSnapshot) {
    if (!versaoPagaSnapshot) {
      return { houveAlteracaoDeConteudo: true, primeiraExportacao: true };
    }

    const estadoAtual = extrairEstadoCobravel(cifraJsonAtual);
    const estadoSnapshot = extrairEstadoCobravel(versaoPagaSnapshot);

    const houveAlteracaoDeConteudo = !estruturalmenteIguais(estadoAtual, estadoSnapshot);
    return { houveAlteracaoDeConteudo, primeiraExportacao: false };
  }

  // Exposto para os controllers que precisam listar quais campos de configuracaoPdf
  // são considerados "gratuitos", por transparência na resposta da API.
  camposDeFormatacaoGratuita() {
    return [...CAMPOS_FORMATACAO_GRATUITA];
  }

  /**
   * Diff campo-a-campo para exibição na tela de orçamento (GET /cifras/:id/export-quote).
   * Só entra aqui o que realmente participa da cobrança (ver extrairEstadoCobravel) —
   * mudanças de configuracaoPdf nunca aparecem, pois nunca são cobráveis.
   */
  detalhar(cifraJsonAtual, versaoPagaSnapshot) {
    if (!versaoPagaSnapshot) return [];

    const atual = extrairEstadoCobravel(cifraJsonAtual);
    const anterior = extrairEstadoCobravel(versaoPagaSnapshot);
    const diffs = [];

    const camposSimples = [
      { campo: "titulo", descricao: "Título da música" },
      { campo: "artista", descricao: "Artista" },
      { campo: "tom", descricao: "Tom" },
      { campo: "instrumento", descricao: "Instrumento" },
    ];
    for (const { campo, descricao } of camposSimples) {
      if (!estruturalmenteIguais(atual[campo], anterior[campo])) {
        diffs.push({ campo, descricao, natureza: "conteudo" });
      }
    }

    if (!estruturalmenteIguais(atual.blocos, anterior.blocos)) {
      diffs.push({
        campo: "blocos",
        descricao: "Letra, acordes ou estrutura de blocos",
        natureza: "conteudo",
      });
    }

    if (!estruturalmenteIguais(atual.acordesCustomizadosUsados, anterior.acordesCustomizadosUsados)) {
      diffs.push({
        campo: "acordesCustomizadosUsados",
        descricao: "Acordes customizados vinculados",
        natureza: "conteudo",
      });
    }

    return diffs;
  }
}
