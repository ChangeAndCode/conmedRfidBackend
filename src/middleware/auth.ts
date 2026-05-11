import { NextFunction, Request, RequestHandler, Response } from "express";
import { env } from "../config/env";
import { UserRole } from "../models/user";
import { verifyAuthToken } from "../services/authService";

const getBearerToken = (authorizationHeader: string | undefined): string | undefined => {
    if (!authorizationHeader) {
        return undefined;
    }

    const normalized = authorizationHeader.trim();

    if (!normalized.toLowerCase().startsWith("bearer ")) {
        return undefined;
    }

    const token = normalized.slice(7).trim();
    return token.length > 0 ? token : undefined;
};

const assignAuthenticatedUser = (req: Request): void => {
    const token = getBearerToken(req.header("Authorization"));

    if (!token) {
        throw new Error("No se proporciono un token Bearer valido");
    }

    req.authUser = verifyAuthToken(token, env.authTokenSecret);
};

const handleUnauthorized = (res: Response, message: string): void => {
    res.status(401).json({ message });
};

export const optionalAuth: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
    const token = getBearerToken(req.header("Authorization"));

    if (!token) {
        next();
        return;
    }

    try {
        req.authUser = verifyAuthToken(token, env.authTokenSecret);
        next();
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo validar la sesion";
        handleUnauthorized(res, message);
    }
};

export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
    try {
        assignAuthenticatedUser(req);
        next();
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo validar la sesion";
        handleUnauthorized(res, message);
    }
};

export const requireRoles = (...allowedRoles: UserRole[]): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.authUser) {
            handleUnauthorized(res, "No se encontro una sesion valida");
            return;
        }

        if (!allowedRoles.includes(req.authUser.role)) {
            res.status(403).json({ message: "No tienes permisos para realizar esta accion" });
            return;
        }

        next();
    };
};
