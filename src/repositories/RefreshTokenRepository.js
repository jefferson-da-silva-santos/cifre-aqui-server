import AbstractRepository from "./AbstractRepository.js";

export default class RefreshTokenRepository extends AbstractRepository {
  constructor(prisma) {
    super(prisma, "refreshToken");
  }

  findValidByHash(tokenHash) {
    return this.model.findUnique({ where: { tokenHash } });
  }

  revoke(id) {
    return this.model.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  revokeAllForUsuario(usuarioId) {
    return this.model.updateMany({
      where: { usuarioId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
