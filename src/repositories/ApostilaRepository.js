import AbstractRepository from "./AbstractRepository.js";

export default class ApostilaRepository extends AbstractRepository {
  constructor(prisma) {
    super(prisma, "apostila");
  }

  findByIdAndUsuario(id, usuarioId) {
    return this.model.findFirst({
      where: { id, usuarioId },
      include: { itens: { include: { cifra: true }, orderBy: { ordem: "asc" } } },
    });
  }
}
