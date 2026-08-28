import AbstractRepository from "./AbstractRepository.js";

export default class CifraRepository extends AbstractRepository {
  constructor(prisma) {
    super(prisma, "cifra");
  }

  findByIdAndUsuario(id, usuarioId) {
    return this.model.findFirst({ where: { id, usuarioId } });
  }

  listByUsuario(usuarioId, { where = {}, skip, take, orderBy } = {}) {
    return this.model.findMany({
      where: { usuarioId, ...where },
      skip,
      take,
      orderBy: orderBy ?? { atualizadoEm: "desc" },
    });
  }

  countByUsuario(usuarioId, where = {}) {
    return this.model.count({ where: { usuarioId, ...where } });
  }
}
