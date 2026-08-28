import AbstractRepository from "./AbstractRepository.js";

export default class PagamentoRepository extends AbstractRepository {
  constructor(prisma) {
    super(prisma, "pagamento");
  }

  findByExternalReference(externalReference) {
    return this.model.findUnique({ where: { externalReference } });
  }

  findByProviderPaymentId(providerPaymentId) {
    return this.model.findFirst({ where: { providerPaymentId } });
  }

  findManyByProviderPaymentId(providerPaymentId) {
    return this.model.findMany({ where: { providerPaymentId } });
  }

  listByUsuario(usuarioId, { where = {}, ...opts } = {}) {
    return this.model.findMany({
      where: { usuarioId, ...where },
      orderBy: { criadoEm: "desc" },
      ...opts,
    });
  }
}
