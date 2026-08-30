import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "crypto";
import ms from "../../utils/ms.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";

const SALT_ROUNDS = 12;

/**
 * Janela de tolerância da rotação, em milissegundos.
 *
 * Um refresh token recém-rotacionado continua aceito por este intervalo, e a
 * resposta repete a sessão que a rotação original emitiu. Sem isso, qualquer
 * chamada duplicada ao /auth/refresh derrubava TODAS as sessões do usuário — e
 * chamada duplicada é o caso comum, não a exceção:
 *
 *   - React em StrictMode monta cada efeito duas vezes em desenvolvimento, e o
 *     SessionGate dispara dois refresh no mesmo instante;
 *   - duas abas abertas recarregam juntas e usam o mesmo cookie;
 *   - o interceptor de 401 pode enfileirar mais de um refresh sob concorrência;
 *   - a requisição falha na rede depois de o servidor já ter rotacionado, e o
 *     cliente repete com o token antigo, que agora está revogado.
 *
 * A detecção de roubo continua existindo: reutilizar um token revogado FORA da
 * janela, ou um que já não tem sucessor rastreável, ainda encerra tudo.
 */
const JANELA_ROTACAO_MS = 30_000;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export default class AuthService {
  constructor(usuarioRepository, refreshTokenRepository, auditService) {
    this.usuarioRepository = usuarioRepository;
    this.refreshTokenRepository = refreshTokenRepository;
    this.auditService = auditService;

    /**
     * Sessões emitidas recentemente, por hash do token CONSUMIDO.
     *
     * Guarda em memória o `accessToken` e o `refreshToken` em claro que uma
     * rotação produziu, para que a chamada duplicada receba exatamente a mesma
     * resposta. Em claro só aqui e por 30s: o banco continua guardando apenas o
     * hash, então um dump do banco nunca expõe token utilizável.
     *
     * Em memória basta porque a janela é curta e a duplicata chega em
     * milissegundos. Num deploy com várias instâncias sem sessão fixa, troque
     * este Map por Redis com TTL — a interface é a mesma.
     */
    this._sessoesRecentes = new Map();
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
   * Rotação de refresh token.
   *
   * A cada uso o token antigo é invalidado e um novo é emitido, para que um
   * token vazado tenha vida curta. Reutilizar um token já revogado é sinal de
   * roubo e encerra todas as sessões — exceto dentro da janela de tolerância
   * acima, onde a reutilização é quase sempre o próprio cliente repetindo a
   * chamada.
   */
  async refresh(refreshTokenBruto, ctx = {}) {
    if (!refreshTokenBruto) throw ApiError.unauthorized("Refresh token ausente.");

    const tokenHash = hashToken(refreshTokenBruto);

    // Resposta memorizada: devolve a MESMA sessão da rotação original, em vez de
    // emitir mais uma. Emitir outra deixaria o cliente com dois refresh tokens
    // vivos e o próximo uso de um deles pareceria replay.
    const memorizada = this._lerSessaoRecente(tokenHash);
    if (memorizada) return memorizada;

    const registro = await this.refreshTokenRepository.findValidByHash(tokenHash);
    if (!registro) throw ApiError.unauthorized("Refresh token inválido.");

    if (registro.revokedAt) {
      const idadeMs = Date.now() - new Date(registro.revokedAt).getTime();

      /*
       * Dentro da janela e com sucessor conhecido: é retry, não roubo. O cliente
       * recebe 401 com uma mensagem que pede a repetição — o token sucessor está
       * no cookie que a rotação original já devolveu, então repetir resolve.
       * Não devolvemos o sucessor aqui porque em claro ele não existe mais (só o
       * hash), e reemitir criaria o segundo token vivo que queremos evitar.
       */
      if (idadeMs <= JANELA_ROTACAO_MS && registro.replacedByTokenHash) {
        await this.auditService.log(
          "auth.refresh_retry_tolerado",
          "usuario",
          registro.usuarioId,
          { idadeMs },
          { usuarioId: registro.usuarioId, requestId: ctx.requestId },
        );
        throw ApiError.unauthorized("Refresh concorrente — repita a requisição.");
      }

      await this.refreshTokenRepository.revokeAllForUsuario(registro.usuarioId);
      await this.auditService.log(
        "auth.refresh_reuse_detected",
        "usuario",
        registro.usuarioId,
        { idadeMs },
        { usuarioId: registro.usuarioId, requestId: ctx.requestId },
      );
      throw ApiError.unauthorized(
        "Sessão inválida detectada. Por segurança, todas as sessões foram encerradas — faça login novamente.",
      );
    }

    if (registro.expiresAt < new Date()) {
      throw ApiError.unauthorized("Refresh token expirado.");
    }

    const usuario = await this.usuarioRepository.findById(registro.usuarioId);
    if (!usuario) throw ApiError.unauthorized("Usuário não encontrado.");

    const sessao = await this._emitirSessao(usuario);

    // Revoga DEPOIS de emitir: se a emissão falhar, o token antigo continua
    // válido e o usuário tenta de novo, em vez de ficar sem sessão nenhuma.
    await this.refreshTokenRepository.revoke(registro.id, hashToken(sessao.refreshToken));
    this._memorizarSessao(tokenHash, sessao);

    return sessao;
  }

  async logout(refreshTokenBruto) {
    if (!refreshTokenBruto) return;
    const tokenHash = hashToken(refreshTokenBruto);
    this._sessoesRecentes.delete(tokenHash);
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

  _memorizarSessao(tokenHashConsumido, sessao) {
    this._sessoesRecentes.set(tokenHashConsumido, { sessao, em: Date.now() });
    setTimeout(() => this._sessoesRecentes.delete(tokenHashConsumido), JANELA_ROTACAO_MS).unref?.();
  }

  _lerSessaoRecente(tokenHash) {
    const registro = this._sessoesRecentes.get(tokenHash);
    if (!registro) return null;
    if (Date.now() - registro.em > JANELA_ROTACAO_MS) {
      this._sessoesRecentes.delete(tokenHash);
      return null;
    }
    return registro.sessao;
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
