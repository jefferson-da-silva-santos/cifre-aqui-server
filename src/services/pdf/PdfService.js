import puppeteer from "puppeteer";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { construirHtmlCifra, cabecalhoModoProfessor } from "./PdfTemplateBuilder.js";

const OUTPUT_DIR = path.resolve(process.cwd(), "storage", "pdfs");

export default class PdfService {
  constructor(chordDiagramService) {
    this.chordDiagramService = chordDiagramService;
    this._browserPromise = null;
  }

  // Reaproveita uma única instância do Chromium headless entre requisições —
  // subir o browser é o passo mais caro do processo.
  async _getBrowser() {
    if (!this._browserPromise) {
      this._browserPromise = puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }
    return this._browserPromise;
  }

  /**
   * Gera o PDF de UMA cifra a partir do JSON estruturado (não do estado
   * possivelmente já editado no banco — sempre a partir do snapshot congelado
   * no momento do pagamento, seção 11.3).
   * @returns {Promise<{ filePath: string, fileName: string }>}
   */
  async gerarPdfCifra(cifraSnapshot) {
    const nomesAcordes = [
      ...new Set(
        (cifraSnapshot.blocos ?? []).flatMap((b) =>
          (b.linhas ?? []).flatMap((l) => (l.acordes ?? []).map((a) => a.nome)),
        ),
      ),
    ];

    const diagramasSvg = cifraSnapshot.configuracaoPdf.mostrarDiagramas
      ? await this.chordDiagramService.resolverDiagramas({
          nomesAcordes,
          instrumento: cifraSnapshot.instrumento,
          acordesCustomizadosUsados: cifraSnapshot.acordesCustomizadosUsados ?? [],
        })
      : {};

    const cabecalhoExtra =
      cifraSnapshot.configuracaoPdf.template === "professor" ? cabecalhoModoProfessor() : null;

    const html = construirHtmlCifra(cifraSnapshot, { diagramasSvg, cabecalhoExtra });
    return this._renderizarHtmlParaPdf(html, `cifra-${cifraSnapshot.id ?? Date.now()}`);
  }

  /**
   * Modo Apostila (seção 8.4): concatena múltiplas cifras num único PDF, com
   * sumário automático no início contendo título + número de página.
   */
  async gerarPdfApostila(titulo, cifrasSnapshots) {
    const paginasHtml = [];
    let numeroPaginaEstimado = 2; // página 1 é o sumário

    const sumarioItens = cifrasSnapshots.map((c) => {
      const item = { titulo: c.titulo, pagina: numeroPaginaEstimado };
      numeroPaginaEstimado += 1; // estimativa simples: 1 página por cifra
      return item;
    });

    for (const cifra of cifrasSnapshots) {
      const nomesAcordes = [
        ...new Set(
          (cifra.blocos ?? []).flatMap((b) =>
            (b.linhas ?? []).flatMap((l) => (l.acordes ?? []).map((a) => a.nome)),
          ),
        ),
      ];
      const diagramasSvg = cifra.configuracaoPdf.mostrarDiagramas
        ? await this.chordDiagramService.resolverDiagramas({
            nomesAcordes,
            instrumento: cifra.instrumento,
            acordesCustomizadosUsados: cifra.acordesCustomizadosUsados ?? [],
          })
        : {};
      paginasHtml.push(
        `<div style="break-before: page;">${construirHtmlBlocoInterno(cifra, diagramasSvg)}</div>`,
      );
    }

    const htmlSumario = `
      <div>
        <h1 style="font-size:22px;">${escapeHtmlLocal(titulo)}</h1>
        <ol style="font-size:13px; line-height:2;">
          ${sumarioItens.map((i) => `<li>${escapeHtmlLocal(i.titulo)} — pág. ${i.pagina}</li>`).join("")}
        </ol>
      </div>`;

    const htmlCompleto = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
      <style>@page{size:A4;margin:16mm 14mm;} body{font-family:Arial,sans-serif;}</style>
      </head><body>${htmlSumario}${paginasHtml.join("")}</body></html>`;

    return this._renderizarHtmlParaPdf(htmlCompleto, `apostila-${Date.now()}`);
  }

  async _renderizarHtmlParaPdf(html, nomeBase) {
    const browser = await this._getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: "networkidle0", timeout: env.PDF_TIMEOUT_MS });
      const buffer = await page.pdf({ printBackground: true, preferCSSPageSize: true });

      await mkdir(OUTPUT_DIR, { recursive: true });
      const fileName = `${nomeBase}-${Date.now()}.pdf`;
      const filePath = path.join(OUTPUT_DIR, fileName);
      await writeFile(filePath, buffer);

      return { filePath, fileName };
    } catch (err) {
      logger.error({ err }, "Falha ao gerar PDF via Puppeteer");
      throw err;
    } finally {
      await page.close();
    }
  }

  async fechar() {
    if (this._browserPromise) {
      const browser = await this._browserPromise;
      await browser.close();
    }
  }
}

// Helpers locais para o modo apostila reaproveitarem o mesmo template de bloco
// sem duplicar o HTML de cabeçalho de página completa (que só entra uma vez).
function construirHtmlBlocoInterno(cifra, diagramasSvg) {
  const htmlCompleto = construirHtmlCifra(cifra, { diagramasSvg });
  const match = htmlCompleto.match(/<body>([\s\S]*)<\/body>/);
  return match ? match[1] : htmlCompleto;
}

function escapeHtmlLocal(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
