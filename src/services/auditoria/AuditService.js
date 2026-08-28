import { logger } from "../../utils/logger.js";

export default class AuditService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  log(event, entity, entityId, payload = {}, ctx = {}) {
    return this.prisma.auditLog
      .create({
        data: {
          event,
          entity,
          entityId,
          usuarioId: ctx.usuarioId ?? null,
          ip: ctx.ip ?? null,
          requestId: ctx.requestId ?? null,
          payload,
        },
      })
      .catch((err) => logger.error({ err }, "Falha ao gravar audit log"));
  }
}

// Eventos de negócio auditados neste sistema:
// usuario.registrado, usuario.login, auth.refresh_reuse_detected,
// cifra.criada, cifra.editada, cifra.excluida, cifra.transposta,
// pagamento.criado, pagamento.aprovado, pagamento.rejeitado,
// pdf.gerado, apostila.criada, webhook.recebido, webhook.duplicado
