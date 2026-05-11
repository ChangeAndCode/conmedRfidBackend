import { Request, Response } from "express";
import { env } from "../config/env";
import { UserModel, UserRole, userRoles } from "../models/user";
import {
    createAuthToken,
    createPasswordHash,
    normalizeEmail,
    toPublicUser,
    validateEmail,
    validatePassword,
    validateUsername,
    verifyPassword,
} from "../services/authService";
import { normalizeRequiredText } from "../utils/requestNormalization";

type RegisterBody = {
    username?: unknown;
    email?: unknown;
    password?: unknown;
    role?: unknown;
};

type LoginBody = {
    email?: unknown;
    password?: unknown;
};

const isDuplicateKeyError = (error: unknown): boolean => {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
};

const getDuplicateField = (error: unknown): string | undefined => {
    if (!isDuplicateKeyError(error)) {
        return undefined;
    }

    if (
        typeof error === "object" &&
        error !== null &&
        "keyPattern" in error &&
        typeof error.keyPattern === "object" &&
        error.keyPattern !== null
    ) {
        if ("email" in error.keyPattern) {
            return "email";
        }

        if ("username" in error.keyPattern) {
            return "username";
        }
    }

    return undefined;
};

const normalizeRole = (value: unknown, required = false): UserRole | undefined => {
    if (value === undefined || value === null) {
        if (required) {
            throw new Error("El campo role es obligatorio");
        }

        return undefined;
    }

    if (typeof value !== "string") {
        throw new Error("El campo role no es valido");
    }

    const normalized = value.trim().toLowerCase();

    if (!userRoles.includes(normalized as UserRole)) {
        throw new Error("El campo role no es valido");
    }

    return normalized as UserRole;
};

const getCurrentUser = async (req: Pick<Request, "authUser">) => {
    if (!req.authUser?.sub) {
        return null;
    }

    return UserModel.findOne({
        _id: req.authUser.sub,
        isActive: true,
    });
};

export const registerUser = async (
    req: Request<unknown, unknown, RegisterBody>,
    res: Response
): Promise<void> => {
    try {
        const usersCount = await UserModel.countDocuments();
        const requestedRole = normalizeRole(req.body.role) ?? "admin";

        if (usersCount > 0) {
            const currentUser = await getCurrentUser(req);

            if (!currentUser || currentUser.role !== "admin") {
                res.status(403).json({
                    message: "Solo un administrador autenticado puede crear usuarios",
                });
                return;
            }
        }

        const username = normalizeRequiredText(req.body.username, "username");
        const email = normalizeEmail(normalizeRequiredText(req.body.email, "email"));
        const password = normalizeRequiredText(req.body.password, "password");

        validateUsername(username);
        validateEmail(email);
        validatePassword(password);

        const user = await UserModel.create({
            username,
            email,
            passwordHash: createPasswordHash(password),
            role: usersCount === 0 ? "admin" : requestedRole,
            isActive: true,
        });

        res.status(201).json({
            message: "Usuario registrado correctamente",
            data: {
                user: toPublicUser(user),
            },
        });
    } catch (error) {
        const duplicateField = getDuplicateField(error);

        if (duplicateField === "email") {
            res.status(409).json({ message: "El correo ya esta registrado" });
            return;
        }

        if (duplicateField === "username") {
            res.status(409).json({ message: "El usuario ya esta registrado" });
            return;
        }

        const message = error instanceof Error ? error.message : "No se pudo registrar el usuario";
        res.status(400).json({ message });
    }
};

export const getAuthenticatedProfile = async (req: Request, res: Response): Promise<void> => {
    const currentUser = await getCurrentUser(req);

    if (!currentUser) {
        res.status(401).json({ message: "No se encontro una sesion valida" });
        return;
    }

    res.json({
        data: {
            user: toPublicUser(currentUser),
        },
    });
};

export const loginUser = async (
    req: Request<unknown, unknown, LoginBody>,
    res: Response
): Promise<void> => {
    try {
        const email = normalizeEmail(normalizeRequiredText(req.body.email, "email"));
        const password = normalizeRequiredText(req.body.password, "password");

        validateEmail(email);

        const user = await UserModel.findOne({ email, isActive: true });

        if (!user || !verifyPassword(password, user.passwordHash)) {
            res.status(401).json({ message: "Correo o contraseña incorrectos" });
            return;
        }

        user.lastLoginAt = new Date();
        await user.save();

        res.json({
            message: "Inicio de sesion correcto",
            data: {
                token: createAuthToken(user, env.authTokenSecret),
                user: toPublicUser(user),
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo iniciar sesion";
        res.status(400).json({ message });
    }
};
