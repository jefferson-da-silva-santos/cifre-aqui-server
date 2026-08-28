import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "crypto";
import ms from "../../utils/ms.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";

const SALT_ROUNDS = 12;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export default class AuthService {
  constructor(usuarioRepository, refreshTokenRepository, auditService) {
    this.usuarioRepository = usuarioRepository;
    this.refreshTokenRepository = refreshTokenRepository;
    this.auditService = auditService;
  }

  async registrar({ nome, email, senha }, ctx = {}) {
    const existente = await this.usuarioRepository.findByEmail(email);
    if (existente) throw ApiError.conflict("Já existe uma conta com este e-mail.");

    const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
    const usuario = await this.usuarioRepository.create({ nome, email, senhaHash });

    await this.auditService.log("usuario.registrado", "usuario", usuario.id, {}, {
      usuarioId: usuario.id,
      requestId: ctx.requestId,
    });

    return this._emitirSessao(usuario);
  }

  async login({ email, senha }, ctx = {}) {
    const usuario = await this.usuarioRepository.findByEmail(email);
    if (!usuario) throw ApiError.unauthorized("E-mail ou senha inválidos.");

    const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaValida) throw ApiError.unauthorized("E-mail ou senha inválidos.");

    await this.auditService.log("usuario.login", "usuario", usuario.id, {}, {
      usuarioId: usuario.id,
      requestId: ctx.requestId,
    });

    return this._emitirSessao(usuario);
  }

  /**
   * Rotação de refresh token: a cada uso, o token antigo é invalidado e um novo
   * é emitido (mitigação de replay attack). Se um token JÁ revogado for
   * reutilizado, é sinal de roubo — revogamos TODOS os tokens do usuário.
   */
  async refresh(refreshTokenBruto, ctx = {}) {
    if (!refreshTokenBruto) throw ApiError.unauthorized("Refresh token ausente.");

    const tokenHash = hashToken(refreshTokenBruto);
    const registro = await this.refreshTokenRepository.findValidByHash(tokenHash);

    if (!registro) throw ApiError.unauthorized("Refresh token inválido.");

    if (registro.revokedAt) {
      await this.refreshTokenRepository.revokeAllForUsuario(registro.usuarioId);
      await this.auditService.log(
        "auth.refresh_reuse_detected",
        "usuario",
        registro.usuarioId,
        {},
        { usuarioId: registro.usuarioId, requestId: ctx.requestId },
      );
      throw ApiError.unauthorized(
        "Sessão inválida detectada. Por segurança, todas as sessões foram encerradas — faça login novamente.",
      );
    }

    if (registro.expiresAt < new Date()) {
      throw ApiError.unauthorized("Refresh token expirado.");
    }

    await this.refreshTokenRepository.revoke(registro.id);

    const usuario = await this.usuarioRepository.findById(registro.usuarioId);
    if (!usuario) throw ApiError.unauthorized("Usuário não encontrado.");

    return this._emitirSessao(usuario);
  }

  async logout(refreshTokenBruto) {
    if (!refreshTokenBruto) return;
    const tokenHash = hashToken(refreshTokenBruto);
    const registro = await this.refreshTokenRepository.findValidByHash(tokenHash);
    if (registro && !registro.revokedAt) {
      await this.refreshTokenRepository.revoke(registro.id);
    }
  }

  /** GET /auth/me — não existe sessão nova aqui, só relê o usuário atual do banco. */
  async me(usuarioId) {
    const usuario = await this.usuarioRepository.findById(usuarioId);
    if (!usuario) throw ApiError.unauthorized("Usuário não encontrado.");
    return this._sanitizarUsuario(usuario);
  }

  _sanitizarUsuario(usuario) {
    const base = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
    };
    if (usuario.preferenciasPdfPadrao) {
      base.preferencias = usuario.preferenciasPdfPadrao;
    }
    return base;
  }

  async _emitirSessao(usuario) {
    const accessToken = jwt.sign({ sub: usuario.id }, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    });

    const refreshTokenBruto = randomBytes(48).toString("hex");
    const tokenHash = hashToken(refreshTokenBruto);

    await this.refreshTokenRepository.create({
      tokenHash,
      usuarioId: usuario.id,
      expiresAt: new Date(Date.now() + ms(env.JWT_REFRESH_EXPIRES_IN)),
    });

    return {
      accessToken,
      refreshToken: refreshTokenBruto,
      user: this._sanitizarUsuario(usuario),
    };
  }
}
