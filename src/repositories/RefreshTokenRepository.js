import AbstractRepository from "./AbstractRepository.js";

export default class RefreshTokenRepository extends AbstractRepository {
  constructor(prisma) {
    super(prisma, "refreshToken");
  }

  findValidByHash(tokenHash) {
    return this.model.findUnique({ where: { tokenHash } });
  }

  /**
   * Revoga marcando QUEM substituiu o token.
   *
   * Guardar o sucessor é o que permite distinguir dois casos que hoje eram
   * tratados como um só: o retry legítimo (mesma aba, requisição repetida) e o
   * replay de um token roubado. Sem essa coluna, a única informação disponível
   * era "este token está revogado" — e retry legítimo e roubo são exatamente
   * isso, o que fazia todo retry derrubar a sessão inteira do usuário.
   */
  revoke(id, replacedByTokenHash = null) {
    return this.model.update({
      where: { id },
      data: { revokedAt: new Date(), replacedByTokenHash },
    });
  }

  revokeAllForUsuario(usuarioId) {
    return this.model.updateMany({
      where: { usuarioId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Limpeza: tokens expirados há mais de 30 dias não servem nem para auditoria. */
  removerExpirados() {
    const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.model.deleteMany({ where: { expiresAt: { lt: limite } } });
  }
}
