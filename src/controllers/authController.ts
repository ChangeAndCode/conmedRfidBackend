import { Request, Response } from "express";
import { env } from "../config/env";
import { UserModel } from "../models/user";
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

export const registerUser = async (
    req: Request<unknown, unknown, RegisterBody>,
    res: Response
): Promise<void> => {
    try {
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
            role: "admin",
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
