import { Router } from "express";
import { loginUser, registerUser } from "../controllers/authController";
import { setApiAction } from "../middleware/apiRequestLogger";

const authRouter = Router();

authRouter.post("/register", setApiAction("user_register"), registerUser);
authRouter.post("/login", setApiAction("user_login"), loginUser);

export default authRouter;
