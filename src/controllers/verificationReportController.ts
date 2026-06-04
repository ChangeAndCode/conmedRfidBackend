import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import {
    VerificationReport,
    VerificationReportStatus,
    verificationReportStatuses,
} from "../models/verificationReport";
import { getDocumentId } from "../services/serviceOrderService";
import {
    createVerificationReport,
    getVerificationReportAvailableActions,
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
    interruptionId?: unknown;
    notes?: unknown;
};

type VerificationReportPrintActionInput = {
    verificationReportId: string;
    printInterruptionId?: string;
    notes?: string;
    actor?: { userId?: string; username?: string };
};

const publicStationActor = {
    username: "estacion-verificacion",
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
        || message.includes("ya fue reimpreso")
        || message.includes("debe marcarse como impreso")
        || message.includes("no puede marcarse")
        || message.includes("aun no tiene un intento previo")
        || message.includes("estado valido")
        || message.includes("debe completarse desde el dashboard del supervisor")
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

const toVerificationReportResponse = (
    verificationReport: VerificationReport & {
        _id?: unknown;
        toObject?: () => Record<string, unknown>;
    }
): Record<string, unknown> => {
    const base = typeof verificationReport.toObject === "function"
        ? verificationReport.toObject()
        : { ...verificationReport };

    return {
        ...base,
        _id: getDocumentId(verificationReport),
        availableActions: getVerificationReportAvailableActions(verificationReport.status),
    };
};

const buildVerificationReportPrintActionInput = (
    verificationReportId: string,
    body: VerificationReportPrintActionBody,
    actor?: { userId?: string; username?: string }
): VerificationReportPrintActionInput => {
    const input: VerificationReportPrintActionInput = {
        verificationReportId,
    };
    const interruptionId = normalizeOptionalText(body.interruptionId);
    const notes = normalizeOptionalText(body.notes);

    if (interruptionId) {
        if (!isValidObjectId(interruptionId)) {
            throw new Error("El interruptionId no es valido");
        }

        input.printInterruptionId = interruptionId;
    }

    if (notes) {
        input.notes = notes;
    }

    if (actor) {
        input.actor = actor;
    }

    return input;
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
            data: reports.map((report) =>
                toVerificationReportResponse(report as VerificationReport & {
                    _id?: unknown;
                    toObject?: () => Record<string, unknown>;
                })
            ),
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

    res.json({
        data: toVerificationReportResponse(verificationReport as VerificationReport & {
            _id?: unknown;
            toObject?: () => Record<string, unknown>;
        }),
    });
};

export const createVerificationReportHandler = async (
    req: Request<unknown, unknown, VerificationReportBody>,
    res: Response
): Promise<void> => {
    try {
        const input: {
            serviceOrderId: string;
            manufacturingRepresentativeName?: string;
            qualityRepresentativeName?: string;
            actor?: { userId?: string; username?: string };
        } = {
            serviceOrderId: normalizeRequiredText(req.body.serviceOrderId, "serviceOrderId"),
        };
        const manufacturingRepresentativeName = normalizeOptionalText(req.body.manufacturingRepresentativeName);
        const qualityRepresentativeName = normalizeOptionalText(req.body.qualityRepresentativeName);
        const actor = resolveActor(req);

        if (manufacturingRepresentativeName) {
            input.manufacturingRepresentativeName = manufacturingRepresentativeName;
        }

        if (qualityRepresentativeName) {
            input.qualityRepresentativeName = qualityRepresentativeName;
        }

        if (actor) {
            input.actor = actor;
        }

        const verificationReport = await createVerificationReport(input);

        res.status(201).json({
            message: "Reporte de verificacion generado",
            data: toVerificationReportResponse(verificationReport as VerificationReport & {
                _id?: unknown;
                toObject?: () => Record<string, unknown>;
            }),
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

        const input = buildVerificationReportPrintActionInput(id, req.body, resolveActor(req));

        const verificationReport = await markVerificationReportPrintInterrupted(input);

        res.json({
            message: "Reporte marcado con impresion interrumpida",
            data: toVerificationReportResponse(verificationReport as VerificationReport & {
                _id?: unknown;
                toObject?: () => Record<string, unknown>;
            }),
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

        const input = buildVerificationReportPrintActionInput(id, req.body, resolveActor(req));

        const verificationReport = await markVerificationReportAsPrinted(input);

        res.json({
            message: "Reporte marcado como impreso",
            data: toVerificationReportResponse(verificationReport as VerificationReport & {
                _id?: unknown;
                toObject?: () => Record<string, unknown>;
            }),
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

        const input = buildVerificationReportPrintActionInput(id, req.body, resolveActor(req));

        const verificationReport = await reprintVerificationReport(input);

        res.json({
            message: "Reporte reimpreso",
            data: toVerificationReportResponse(verificationReport as VerificationReport & {
                _id?: unknown;
                toObject?: () => Record<string, unknown>;
            }),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo reimprimir el reporte";
        const statusCode = isVerificationReportNotFoundError(error)
            ? 404
            : resolveVerificationReportStatusCode(message);

        res.status(statusCode).json({ message });
    }
};

export const publicMarkVerificationReportPrintInterruptedHandler = async (
    req: Request<{ id: string }, unknown, VerificationReportPrintActionBody>,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            res.status(400).json({ message: "El id no es valido" });
            return;
        }

        const input = buildVerificationReportPrintActionInput(id, req.body, publicStationActor);
        const verificationReport = await markVerificationReportPrintInterrupted(input);

        res.json({
            message: "Reporte marcado con impresion interrumpida",
            data: toVerificationReportResponse(verificationReport as VerificationReport & {
                _id?: unknown;
                toObject?: () => Record<string, unknown>;
            }),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo actualizar el reporte";
        const statusCode = isVerificationReportNotFoundError(error)
            ? 404
            : resolveVerificationReportStatusCode(message);

        res.status(statusCode).json({ message });
    }
};

export const publicMarkVerificationReportPrintedHandler = async (
    req: Request<{ id: string }, unknown, VerificationReportPrintActionBody>,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            res.status(400).json({ message: "El id no es valido" });
            return;
        }

        const input = buildVerificationReportPrintActionInput(id, req.body, publicStationActor);
        const verificationReport = await markVerificationReportAsPrinted({
            ...input,
            source: "public-station",
        });

        res.json({
            message: "Reporte marcado como impreso",
            data: toVerificationReportResponse(verificationReport as VerificationReport & {
                _id?: unknown;
                toObject?: () => Record<string, unknown>;
            }),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo actualizar el reporte";
        const statusCode = isVerificationReportNotFoundError(error)
            ? 404
            : resolveVerificationReportStatusCode(message);

        res.status(statusCode).json({ message });
    }
};
