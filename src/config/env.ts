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

export const env = {
    port: parsePort(),
    mongoUri: getRequiredEnvVar("MONGODB_URI"),
    mongoDbName: process.env.MONGODB_DB_NAME?.trim() || "conmed-rfid",
    frontendUrl: process.env.FRONTEND_URL?.trim() || "http://localhost:5173",
    authTokenSecret: process.env.AUTH_TOKEN_SECRET?.trim() || "conmed-rfid-dev-secret",
};
