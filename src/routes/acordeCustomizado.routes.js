import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import {
  schemaCreateAcordeCustomizado,
  schemaUpdateAcordeCustomizado,
} from "../utils/validations.js";

export default function acordeCustomizadoRoutes(deps) {
  const router = Router();
  const { acordeCustomizadoController } = deps;

  router.use(auth);

  router.post("/", validate(schemaCreateAcordeCustomizado), acordeCustomizadoController.criar);
  router.get("/", acordeCustomizadoController.listar);
  router.patch(
    "/:id",
    validate(schemaUpdateAcordeCustomizado),
    acordeCustomizadoController.atualizar,
  );
  router.delete("/:id", acordeCustomizadoController.excluir);

  return router;
}
