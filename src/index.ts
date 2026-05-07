import cors from "cors";
import "dotenv/config";
import express from "express";
import authRouter from "./routes/authRoutes";
import { connectToDatabase, disconnectFromDatabase, getDatabaseStatus } from "./config/database";
import { env } from "./config/env";
import { logger } from "./config/logger";
import doubleScanReadRouter from "./routes/doubleScanReadRoutes";
import manualReadRouter from "./routes/manualReadRoutes";
import partConfigRouter from "./routes/partConfigRoutes";
import { seedDefaultPartConfigs } from "./services/partConfigService";

const app = express();

const allowedOrigins: string[] = Array.from(new Set([
    ...env.frontendUrls,
    "https://conmedrfidbackend.onrender.com",
]));

const corsOptions = {
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error("No permitido por CORS"));
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-Proxy-Source",
        "X-Forwarded-For",
        "X-Internal-Token",
        "Accept",
        "User-Agent",
    ],
};

app.set("trust proxy", 1);
app.use(cors(corsOptions));

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

app.get("/", (req, res) => {
    res.send("Sistema RFID en funcionamiento");
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        database: getDatabaseStatus(),
    });
});

app.use("/api/manual-reads", manualReadRouter);
app.use("/api/double-scan-reads", doubleScanReadRouter);
app.use("/api/part-configs", partConfigRouter);
app.use("/api/auth", authRouter);

const bootstrap = async (): Promise<void> => {
    try {
        logger.info(`El puerto ${env.port} esta disponible`);
        await connectToDatabase();
        await seedDefaultPartConfigs();

        app.listen(env.port, () => {
            logger.info(`Sistema RFID corriendo en http://localhost:${env.port}`);
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo iniciar el servidor";
        logger.error(message);
        process.exit(1);
    }
};

const gracefulShutdown = async (signal: string): Promise<void> => {
    logger.info(`Cerrando servidor por senal ${signal}`);
    await disconnectFromDatabase();
    process.exit(0);
};

process.on("SIGINT", () => {
    void gracefulShutdown("SIGINT");
});

process.on("SIGTERM", () => {
    void gracefulShutdown("SIGTERM");
});

void bootstrap();
