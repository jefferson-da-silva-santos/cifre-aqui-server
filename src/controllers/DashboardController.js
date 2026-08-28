import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export default class DashboardController {
  constructor(dashboardService) {
    this.dashboardService = dashboardService;
    this.usuario = asyncHandler(this.usuario.bind(this));
  }

  async usuario(req, res) {
    const dados = await this.dashboardService.usuario(req.user.id, req.query.periodo);
    return ApiResponse.success(res, { data: dados });
  }
}
