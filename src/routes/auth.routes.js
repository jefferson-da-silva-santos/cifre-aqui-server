import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { authRateLimiter } from "../middlewares/rateLimiter.js";
import { schemaRegisterUser, schemaLoginUser } from "../utils/validations.js";

export default function authRoutes(deps) {
  const router = Router();
  const { authController } = deps;

  // Rate limit agressivo só nas rotas alvo de força bruta — GET /me não deve
  // dividir o mesmo balde (o frontend pode chamá-lo com frequência normal).
  router.post("/registro", authRateLimiter, validate(schemaRegisterUser), authController.register);
  // Alias em inglês — é o nome que o frontend usa; mantemos "/registro"
  // também por retrocompatibilidade com a doc/scripts existentes.
  router.post("/register", authRateLimiter, validate(schemaRegisterUser), authController.register);
  router.post("/login", authRateLimiter, validate(schemaLoginUser), authController.login);
  router.post("/refresh", authRateLimiter, authController.refresh);
  router.post("/logout", authController.logout);
  router.get("/me", auth, authController.me);

  return router;
}
