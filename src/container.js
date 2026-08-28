// Injeção de dependência manual e explícita: cada camada recebe suas
// dependências no construtor, montadas uma única vez aqui e propagadas para
// app.js/rotas — mesmo espírito do padrão Factory usado no restante do time.

import UsuarioRepository from "./repositories/UsuarioRepository.js";
import RefreshTokenRepository from "./repositories/RefreshTokenRepository.js";
import CifraRepository from "./repositories/CifraRepository.js";
import AcordeCustomizadoRepository from "./repositories/AcordeCustomizadoRepository.js";
import PagamentoRepository from "./repositories/PagamentoRepository.js";
import ApostilaRepository from "./repositories/ApostilaRepository.js";
import WebhookEventRepository from "./repositories/WebhookEventRepository.js";

import AuditService from "./services/auditoria/AuditService.js";
import AuthService from "./services/auth/AuthService.js";
import CifraService from "./services/cifra/CifraService.js";
import DiffService from "./services/cifra/DiffService.js";
import ApostilaService from "./services/cifra/ApostilaService.js";
import AcordeCustomizadoService from "./services/acordes/AcordeCustomizadoService.js";
import ChordDiagramService from "./services/pdf/ChordDiagramService.js";
import PdfService from "./services/pdf/PdfService.js";
import PaymentProviderAdapter from "./services/billing/PaymentProviderAdapter.js";
import ExportacaoService from "./services/billing/ExportacaoService.js";
import PagamentoService from "./services/billing/PagamentoService.js";
import DashboardService from "./services/dashboard/DashboardService.js";

import AuthController from "./controllers/AuthController.js";
import CifraController from "./controllers/CifraController.js";
import AcordeCustomizadoController from "./controllers/AcordeCustomizadoController.js";
import ExportacaoController from "./controllers/ExportacaoController.js";
import PagamentoController from "./controllers/PagamentoController.js";
import ApostilaController from "./controllers/ApostilaController.js";
import ConfigController from "./controllers/ConfigController.js";
import DashboardController from "./controllers/DashboardController.js";

export function buildContainer(prisma) {
  // Repositories
  const usuarioRepository = new UsuarioRepository(prisma);
  const refreshTokenRepository = new RefreshTokenRepository(prisma);
  const cifraRepository = new CifraRepository(prisma);
  const acordeCustomizadoRepository = new AcordeCustomizadoRepository(prisma);
  const pagamentoRepository = new PagamentoRepository(prisma);
  const apostilaRepository = new ApostilaRepository(prisma);
  const webhookEventRepository = new WebhookEventRepository(prisma);

  // Services transversais
  const auditService = new AuditService(prisma);
  const diffService = new DiffService();
  const paymentProviderAdapter = new PaymentProviderAdapter();
  const chordDiagramService = new ChordDiagramService(acordeCustomizadoRepository);
  const pdfService = new PdfService(chordDiagramService);

  // Services de domínio
  const authService = new AuthService(usuarioRepository, refreshTokenRepository, auditService);
  const cifraService = new CifraService(cifraRepository, acordeCustomizadoRepository, auditService);
  const acordeCustomizadoService = new AcordeCustomizadoService(acordeCustomizadoRepository);

  const exportacaoService = new ExportacaoService({
    cifraService,
    cifraRepository,
    pagamentoRepository,
    usuarioRepository,
    diffService,
    paymentProviderAdapter,
    pdfService,
    auditService,
  });

  const pagamentoService = new PagamentoService({
    pagamentoRepository,
    webhookEventRepository,
    paymentProviderAdapter,
    exportacaoService,
    apostilaRepository,
    pdfService,
    auditService,
  });

  const apostilaService = new ApostilaService({
    apostilaRepository,
    cifraRepository,
    pagamentoRepository,
    usuarioRepository,
    diffService,
    paymentProviderAdapter,
    pdfService,
    auditService,
  });

  const dashboardService = new DashboardService(prisma);

  // Controllers
  const authController = new AuthController(authService);
  const cifraController = new CifraController(cifraService);
  const acordeCustomizadoController = new AcordeCustomizadoController(acordeCustomizadoService);
  const exportacaoController = new ExportacaoController(exportacaoService);
  const pagamentoController = new PagamentoController(pagamentoService, paymentProviderAdapter);
  const apostilaController = new ApostilaController(apostilaService);
  const configController = new ConfigController(paymentProviderAdapter);
  const dashboardController = new DashboardController(dashboardService);

  return {
    // exposto para graceful shutdown (fechar o browser do Puppeteer)
    pdfService,
    controllers: {
      authController,
      cifraController,
      acordeCustomizadoController,
      exportacaoController,
      pagamentoController,
      apostilaController,
      configController,
      dashboardController,
    },
  };
}