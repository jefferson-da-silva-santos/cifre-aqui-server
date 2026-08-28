import AbstractRepository from "./AbstractRepository.js";

export default class WebhookEventRepository extends AbstractRepository {
  constructor(prisma) {
    super(prisma, "webhookEvent");
  }

  findByProviderEventId(providerEventId) {
    if (!providerEventId) return null;
    return this.model.findUnique({ where: { providerEventId } });
  }

  markProcessed(id) {
    return this.model.update({ where: { id }, data: { processedAt: new Date() } });
  }
}
