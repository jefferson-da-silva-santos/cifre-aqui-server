import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";

/**
 * Opções do cookie de refresh.
 *
 * `path` continua restrito a `/auth`: o cookie não precisa viajar em nenhuma
 * outra rota, e restringi-lo reduz a superfície de CSRF e de vazamento em log.
 *
 * `sameSite` vem do ambiente porque a resposta certa depende de onde o frontend
 * roda. Em desenvolvimento, `localhost:5173` e `localhost:3000` são o mesmo site
 * (a porta não conta para cookies), então `lax` funciona. Com frontend e API em
 * domínios diferentes em produção, só `none` é enviado — e `none` exige
 * `secure`, ou seja, HTTPS dos dois lados.
 */
const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.COOKIE_SAMESITE === "none" ? true : env.NODE_ENV === "production",
  sameSite: env.COOKIE_SAMESITE,
  path: "/auth",
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
};

export default class AuthController {
  constructor(authService) {
    this.authService = authService;

    this.register = asyncHandler(this.register.bind(this));
    this.login = asyncHandler(this.login.bind(this));
    this.refresh = asyncHandler(this.refresh.bind(this));
    this.logout = asyncHandler(this.logout.bind(this));
    this.me = asyncHandler(this.me.bind(this));
  }

  _enviarSessao(res, sessao, status) {
    // `maxAge` explícito: sem ele o cookie é de sessão e some ao fechar o
    // navegador, o que faz "continuar logado" durar só enquanto a aba viver.
    res.cookie("refreshToken", sessao.refreshToken, {
      ...COOKIE_OPTS,
      maxAge: env.REFRESH_COOKIE_MAX_AGE_MS,
    });
    return ApiResponse.success(res, {
      data: { accessToken: sessao.accessToken, user: sessao.user },
      message: "OK",
      status,
    });
  }

  async register(req, res) {
    const sessao = await this.authService.registrar(
      { nome: req.body.nome, email: req.body.email, senha: req.body.senha },
      { requestId: req.id },
    );
    return this._enviarSessao(res, sessao, 201);
  }

  async login(req, res) {
    const sessao = await this.authService.login(
      { email: req.body.email, senha: req.body.senha },
      { requestId: req.id },
    );
    return this._enviarSessao(res, sessao, 200);
  }

  async refresh(req, res) {
    const tokenBruto = req.cookies?.refreshToken ?? req.body?.refreshToken;
    const sessao = await this.authService.refresh(tokenBruto, { requestId: req.id });
    return this._enviarSessao(res, sessao, 200);
  }

  async logout(req, res) {
    const tokenBruto = req.cookies?.refreshToken ?? req.body?.refreshToken;
    await this.authService.logout(tokenBruto);
    // Limpar exige as MESMAS opções usadas ao gravar — path e domain diferentes
    // criam um segundo cookie em vez de apagar o primeiro, e a sessão "volta".
    res.clearCookie("refreshToken", COOKIE_OPTS);
    return ApiResponse.success(res, { message: "Sessão encerrada." });
  }

  async me(req, res) {
    const user = await this.authService.me(req.user.id);
    return ApiResponse.success(res, { data: user });
  }
}
