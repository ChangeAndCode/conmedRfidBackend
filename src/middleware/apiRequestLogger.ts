import { NextFunction, Request, RequestHandler, Response } from "express";
import { logger } from "../config/logger";

type ApiLogLocals = {
    logAction?: string;
    logFallbackMessage?: string;
    logMessage?: string;
};

const sanitizeLogValue = (value: string): string => value.replace(/[\r\n\t]+/g, " ").replace(/"/g, "'");

const getLogLevel = (statusCode: number): "info" | "warn" | "error" => {
    if (statusCode >= 500) {
        return "error";
    }

    if (statusCode >= 400) {
        return "warn";
    }

    return "info";
};

const readMessageFromBody = (body: unknown): string | undefined => {
    if (typeof body !== "object" || body === null || !("message" in body)) {
        return undefined;
    }

    const { message } = body as { message?: unknown };
    return typeof message === "string" ? message : undefined;
};

export const setApiAction = (action: string, fallbackMessage?: string): RequestHandler => {
    return (_req: Request, res: Response, next: NextFunction): void => {
        const locals = res.locals as ApiLogLocals;
        locals.logAction = action;

        if (fallbackMessage) {
            locals.logFallbackMessage = fallbackMessage;
        } else {
            delete locals.logFallbackMessage;
        }

        next();
    };
};

export const apiRequestLogger: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint();
    const originalJson = res.json.bind(res);

    res.json = ((body: unknown) => {
        const responseMessage = readMessageFromBody(body);

        if (responseMessage) {
            (res.locals as ApiLogLocals).logMessage = responseMessage;
        }

        return originalJson(body);
    }) as Response["json"];

    res.on("finish", () => {
        const locals = res.locals as ApiLogLocals;

        if (!locals.logAction) {
            return;
        }

        const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
        const level = getLogLevel(res.statusCode);
        const message = locals.logMessage ?? locals.logFallbackMessage ?? "Solicitud procesada";
        const output = [
            `action="${sanitizeLogValue(locals.logAction)}"`,
            req.method,
            String(res.statusCode),
            `${durationMs}ms`,
            `message="${sanitizeLogValue(message)}"`,
        ].join(" ");

        logger[level](output);
    });

    next();
};
