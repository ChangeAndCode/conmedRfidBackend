import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { User, UserRole } from "../models/user";

const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BYTES = 64;
const TOKEN_DURATION_HOURS = 12;

type PublicUser = {
    id: string;
    username: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    lastLoginAt?: Date;
};

type AuthTokenPayload = {
    sub: string;
    username: string;
    email: string;
    role: UserRole;
    exp: number;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toBase64Url = (value: string | Buffer): string => {
    const bufferValue = typeof value === "string" ? Buffer.from(value, "utf-8") : value;

    return bufferValue
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
};

const getUserId = (user: User & { _id?: unknown }): string => {
    if (typeof user._id === "string") {
        return user._id;
    }

    if (typeof user._id === "object" && user._id !== null && "toString" in user._id) {
        return user._id.toString();
    }

    return "";
};

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const validateUsername = (username: string): void => {
    if (username.trim().length < 3) {
        throw new Error("El usuario debe tener al menos 3 caracteres");
    }

    if (username.trim().length > 50) {
        throw new Error("El usuario no puede exceder 50 caracteres");
    }
};

export const validateEmail = (email: string): void => {
    if (!emailPattern.test(email)) {
        throw new Error("El correo no es valido");
    }
};

export const validatePassword = (password: string): void => {
    if (password.length < 8) {
        throw new Error("La contraseña debe tener al menos 8 caracteres");
    }

    if (password.length > 72) {
        throw new Error("La contraseña no puede exceder 72 caracteres");
    }
};

export const createPasswordHash = (password: string): string => {
    const salt = randomBytes(PASSWORD_SALT_BYTES).toString("hex");
    const derivedKey = scryptSync(password, salt, PASSWORD_KEY_BYTES);

    return `${salt}:${derivedKey.toString("hex")}`;
};

export const verifyPassword = (password: string, storedPasswordHash: string): boolean => {
    const [salt, storedHash] = storedPasswordHash.split(":");

    if (!salt || !storedHash) {
        return false;
    }

    const derivedKey = scryptSync(password, salt, PASSWORD_KEY_BYTES);
    const storedHashBuffer = Buffer.from(storedHash, "hex");

    if (storedHashBuffer.length !== derivedKey.length) {
        return false;
    }

    return timingSafeEqual(derivedKey, storedHashBuffer);
};

export const toPublicUser = (user: User & { _id?: unknown }): PublicUser => {
    const publicUser: PublicUser = {
        id: getUserId(user),
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
    };

    if (user.createdAt) {
        publicUser.createdAt = user.createdAt;
    }

    if (user.updatedAt) {
        publicUser.updatedAt = user.updatedAt;
    }

    if (user.lastLoginAt) {
        publicUser.lastLoginAt = user.lastLoginAt;
    }

    return publicUser;
};

export const createAuthToken = (user: User & { _id?: unknown }, secret: string): string => {
    const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payloadData: AuthTokenPayload = {
        sub: getUserId(user),
        username: user.username,
        email: user.email,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + TOKEN_DURATION_HOURS * 60 * 60,
    };
    const payload = toBase64Url(JSON.stringify(payloadData));
    const signature = createHmac("sha256", secret)
        .update(`${header}.${payload}`)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");

    return `${header}.${payload}.${signature}`;
};
