import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/auth",
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
    res.cookie("refreshToken", sessao.refreshToken, COOKIE_OPTS);
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
    res.clearCookie("refreshToken", COOKIE_OPTS);
    return ApiResponse.success(res, { message: "Sessão encerrada." });
  }

  async me(req, res) {
    const user = await this.authService.me(req.user.id);
    return ApiResponse.success(res, { data: user });
  }
}
