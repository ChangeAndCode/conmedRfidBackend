import { AuthTokenPayload } from "../services/authService";

declare global {
    namespace Express {
        interface Request {
            authUser?: AuthTokenPayload;
        }
    }
}

export {};
