import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { User, UserRole, userRoles } from "../models/user";

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

export type AuthTokenPayload = {
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

const fromBase64Url = (value: string): Buffer => {
    const normalized = value
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    const paddingLength = (4 - (normalized.length % 4)) % 4;

    return Buffer.from(`${normalized}${"=".repeat(paddingLength)}`, "base64");
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

const verifyAuthTokenPayload = (payload: unknown): AuthTokenPayload => {
    if (typeof payload !== "object" || payload === null) {
        throw new Error("El token no contiene un payload valido");
    }

    const { sub, username, email, role, exp } = payload as Partial<AuthTokenPayload>;

    if (typeof sub !== "string" || typeof username !== "string" || typeof email !== "string") {
        throw new Error("El token no contiene datos de usuario validos");
    }

    if (typeof exp !== "number" || !Number.isFinite(exp)) {
        throw new Error("El token no contiene una expiracion valida");
    }

    if (!userRoles.includes(role as UserRole)) {
        throw new Error("El token no contiene un rol valido");
    }

    if (exp <= Math.floor(Date.now() / 1000)) {
        throw new Error("El token ha expirado");
    }

    return {
        sub,
        username,
        email,
        role: role as UserRole,
        exp,
    };
};

export const verifyAuthToken = (token: string, secret: string): AuthTokenPayload => {
    const [header, payload, signature] = token.split(".");

    if (!header || !payload || !signature) {
        throw new Error("El token no tiene un formato valido");
    }

    const expectedSignature = createHmac("sha256", secret)
        .update(`${header}.${payload}`)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
    const signatureBuffer = Buffer.from(signature, "utf-8");
    const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf-8");

    if (signatureBuffer.length !== expectedSignatureBuffer.length) {
        throw new Error("La firma del token no es valida");
    }

    if (!timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) {
        throw new Error("La firma del token no es valida");
    }

    const payloadJson = fromBase64Url(payload).toString("utf-8");

    try {
        return verifyAuthTokenPayload(JSON.parse(payloadJson));
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }

        throw new Error("No se pudo validar el token");
    }
};
