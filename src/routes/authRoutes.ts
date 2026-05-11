import { Router } from "express";
import { getAuthenticatedProfile, loginUser, registerUser } from "../controllers/authController";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { setApiAction } from "../middleware/apiRequestLogger";

const authRouter = Router();

authRouter.post("/register", optionalAuth, setApiAction("user_register"), registerUser);
authRouter.post("/login", setApiAction("user_login"), loginUser);
authRouter.get("/me", requireAuth, setApiAction("user_me", "Perfil autenticado consultado"), getAuthenticatedProfile);

export default authRouter;
