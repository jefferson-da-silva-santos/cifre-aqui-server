import AbstractRepository from "./AbstractRepository.js";

export default class UsuarioRepository extends AbstractRepository {
  constructor(prisma) {
    super(prisma, "usuario");
  }

  findByEmail(email) {
    return this.model.findUnique({ where: { email } });
  }
}
