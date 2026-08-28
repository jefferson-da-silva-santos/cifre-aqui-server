import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { schemaDashboardQuery } from "../utils/validations.js";

export default function dashboardRoutes(deps) {
  const router = Router();
  const { dashboardController } = deps;

  router.use(auth);
  router.get("/usuario", validate(schemaDashboardQuery, "query"), dashboardController.usuario);

  return router;
}
