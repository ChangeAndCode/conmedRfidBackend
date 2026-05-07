const getRequiredEnvVar = (name: string): string => {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`La variable de entorno ${name} es obligatoria`);
    }

    return value;
};

const parsePort = (): number => {
    const port = Number(getRequiredEnvVar("PORT"));

    if (!Number.isInteger(port) || port <= 0) {
        throw new Error("PORT no esta definido o no es valido");
    }

    return port;
};

const defaultFrontendUrls = [
    "http://localhost:5173",
    "https://conmedrfidfrontend-1.onrender.com",
];

const parseFrontendUrls = (): string[] => {
    const rawOrigins = process.env.FRONTEND_URLS?.trim() || process.env.FRONTEND_URL?.trim() || "";
    const configuredOrigins = rawOrigins
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    return Array.from(new Set([...defaultFrontendUrls, ...configuredOrigins]));
};

export const env = {
    port: parsePort(),
    mongoUri: getRequiredEnvVar("MONGODB_URI"),
    mongoDbName: process.env.MONGODB_DB_NAME?.trim() || "conmed-rfid",
    frontendUrls: parseFrontendUrls(),
    authTokenSecret: process.env.AUTH_TOKEN_SECRET?.trim() || "conmed-rfid-dev-secret",
};
