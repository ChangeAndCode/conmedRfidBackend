import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";

const connectionStateLabels: Record<number, string> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
};

export const getDatabaseStatus = (): string => {
    return connectionStateLabels[mongoose.connection.readyState] || "unknown";
};

export const connectToDatabase = async (): Promise<void> => {
    if (mongoose.connection.readyState === 1) {
        return;
    }

    await mongoose.connect(env.mongoUri, {
        dbName: env.mongoDbName,
    });

    logger.info(`Mongo conectado a la base ${env.mongoDbName}`);
};

export const disconnectFromDatabase = async (): Promise<void> => {
    if (mongoose.connection.readyState === 0) {
        return;
    }

    await mongoose.disconnect();
    logger.info("Mongo desconectado");
};
