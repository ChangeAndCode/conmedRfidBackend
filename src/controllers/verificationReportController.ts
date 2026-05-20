import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import {
    VerificationReportStatus,
    verificationReportStatuses,
} from "../models/verificationReport";
import {
    createVerificationReport,
    getVerificationReportById,
    isVerificationReportAlreadyExistsError,
    isVerificationReportNotFoundError,
    listVerificationReports,
    markVerificationReportAsPrinted,
    markVerificationReportPrintInterrupted,
    reprintVerificationReport,
} from "../services/verificationReportService";
import { normalizeOptionalText, normalizeRequiredText } from "../utils/requestNormalization";

type VerificationReportBody = {
    serviceOrderId?: unknown;
    manufacturingRepresentativeName?: unknown;
    qualityRepresentativeName?: unknown;
};

type VerificationReportPrintActionBody = {
    notes?: unknown;
};

const normalizeVerificationReportStatus = (value: unknown): VerificationReportStatus | undefined => {
    const normalized = normalizeOptionalText(value)?.toLowerCase();

    if (!normalized) {
        return undefined;
    }

    if (!verificationReportStatuses.includes(normalized as VerificationReportStatus)) {
        throw new Error("El campo status no es valido");
    }

    return normalized as VerificationReportStatus;
};

const resolveActor = (req: Pick<Request, "authUser">): { userId?: string; username?: string } | undefined => {
    if (!req.authUser) {
        return undefined;
    }

    return {
        userId: req.authUser.sub,
        username: req.authUser.username,
    };
};

const resolveVerificationReportStatusCode = (message: string): number => {
    if (
        message.includes("ya tiene un reporte")
        || message.includes("debe estar cerrada")
        || message.includes("aun no completa")
        || message.includes("no coincide con la cantidad")
        || message.includes("multiples numeros de parte")
        || message.includes("ya se encuentra marcado")
        || message.includes("ya fue marcado como impreso")
        || message.includes("aun no tiene un intento previo")
    ) {
        return 409;
    }

    if (
        message.includes("no encontrada")
        || message.includes("no encontrado")
        || message.includes("no existe")
    ) {
        return 404;
    }

    return 400;
};

export const listVerificationReportsHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const status = normalizeVerificationReportStatus(req.query.status);
        const serviceOrderId = normalizeOptionalText(req.query.serviceOrderId);
        const serviceOrderFolio = normalizeOptionalText(req.query.serviceOrderFolio);
        const filters: {
            status?: VerificationReportStatus;
            serviceOrderId?: string;
            serviceOrderFolio?: string;
        } = {};

        if (status) {
            filters.status = status;
        }

        if (serviceOrderId) {
            filters.serviceOrderId = serviceOrderId;
        }

        if (serviceOrderFolio) {
            filters.serviceOrderFolio = serviceOrderFolio;
        }

        const reports = await listVerificationReports(filters);

        res.json({
            count: reports.length,
            data: reports,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudieron listar los reportes de verificacion";
        res.status(400).json({ message });
    }
};

export const getVerificationReportByIdHandler = async (
    req: Request<{ id: string }>,
    res: Response
): Promise<void> => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        res.status(400).json({ message: "El id no es valido" });
        return;
    }

    const verificationReport = await getVerificationReportById(id);

    if (!verificationReport) {
        res.status(404).json({ message: "Reporte de verificacion no encontrado" });
        return;
    }

    res.json({ data: verificationReport });
};

export const createVerificationReportHandler = async (
    req: Request<unknown, unknown, VerificationReportBody>,
    res: Response
): Promise<void> => {
    try {
        const input: {
            serviceOrderId: string;
            manufacturingRepresentativeName: string;
            qualityRepresentativeName: string;
            actor?: { userId?: string; username?: string };
        } = {
            serviceOrderId: normalizeRequiredText(req.body.serviceOrderId, "serviceOrderId"),
            manufacturingRepresentativeName: normalizeRequiredText(
                req.body.manufacturingRepresentativeName,
                "manufacturingRepresentativeName"
            ),
            qualityRepresentativeName: normalizeRequiredText(
                req.body.qualityRepresentativeName,
                "qualityRepresentativeName"
            ),
        };
        const actor = resolveActor(req);

        if (actor) {
            input.actor = actor;
        }

        const verificationReport = await createVerificationReport(input);

        res.status(201).json({
            message: "Reporte de verificacion generado",
            data: verificationReport,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo generar el reporte de verificacion";
        const statusCode = isVerificationReportAlreadyExistsError(error)
            ? 409
            : resolveVerificationReportStatusCode(message);

        res.status(statusCode).json({ message });
    }
};

export const markVerificationReportPrintInterruptedHandler = async (
    req: Request<{ id: string }, unknown, VerificationReportPrintActionBody>,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            res.status(400).json({ message: "El id no es valido" });
            return;
        }

        const input: {
            verificationReportId: string;
            notes?: string;
            actor?: { userId?: string; username?: string };
        } = {
            verificationReportId: id,
        };
        const notes = normalizeOptionalText(req.body.notes);
        const actor = resolveActor(req);

        if (notes) {
            input.notes = notes;
        }

        if (actor) {
            input.actor = actor;
        }

        const verificationReport = await markVerificationReportPrintInterrupted(input);

        res.json({
            message: "Reporte marcado con impresion interrumpida",
            data: verificationReport,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo actualizar el reporte";
        const statusCode = isVerificationReportNotFoundError(error)
            ? 404
            : resolveVerificationReportStatusCode(message);

        res.status(statusCode).json({ message });
    }
};

export const markVerificationReportPrintedHandler = async (
    req: Request<{ id: string }, unknown, VerificationReportPrintActionBody>,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            res.status(400).json({ message: "El id no es valido" });
            return;
        }

        const input: {
            verificationReportId: string;
            notes?: string;
            actor?: { userId?: string; username?: string };
        } = {
            verificationReportId: id,
        };
        const notes = normalizeOptionalText(req.body.notes);
        const actor = resolveActor(req);

        if (notes) {
            input.notes = notes;
        }

        if (actor) {
            input.actor = actor;
        }

        const verificationReport = await markVerificationReportAsPrinted(input);

        res.json({
            message: "Reporte marcado como impreso",
            data: verificationReport,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo actualizar el reporte";
        const statusCode = isVerificationReportNotFoundError(error)
            ? 404
            : resolveVerificationReportStatusCode(message);

        res.status(statusCode).json({ message });
    }
};

export const reprintVerificationReportHandler = async (
    req: Request<{ id: string }, unknown, VerificationReportPrintActionBody>,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            res.status(400).json({ message: "El id no es valido" });
            return;
        }

        const input: {
            verificationReportId: string;
            notes?: string;
            actor?: { userId?: string; username?: string };
        } = {
            verificationReportId: id,
        };
        const notes = normalizeOptionalText(req.body.notes);
        const actor = resolveActor(req);

        if (notes) {
            input.notes = notes;
        }

        if (actor) {
            input.actor = actor;
        }

        const verificationReport = await reprintVerificationReport(input);

        res.json({
            message: "Reporte reimpreso",
            data: verificationReport,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo reimprimir el reporte";
        const statusCode = isVerificationReportNotFoundError(error)
            ? 404
            : resolveVerificationReportStatusCode(message);

        res.status(statusCode).json({ message });
    }
};
