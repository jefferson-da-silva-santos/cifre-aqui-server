import AbstractRepository from "./AbstractRepository.js";

export default class AcordeCustomizadoRepository extends AbstractRepository {
  constructor(prisma) {
    super(prisma, "acordeCustomizado");
  }

  findByIdAndUsuario(id, usuarioId) {
    return this.model.findFirst({ where: { id, usuarioId } });
  }

  listByUsuario(usuarioId) {
    return this.model.findMany({ where: { usuarioId }, orderBy: { createdAt: "desc" } });
  }

  findManyByIds(ids) {
    return this.model.findMany({ where: { id: { in: ids } } });
  }
}
