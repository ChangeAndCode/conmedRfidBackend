import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { ManualRead, ManualReadModel, manualReadStatuses } from "../models/manualRead";

type CreateManualReadBody = {
    serviceOrder?: unknown;
    partNumber?: unknown;
    rfidProgram?: unknown;
    gtin?: unknown;
    lot?: unknown;
    manufactureDate?: unknown;
    filterLabel?: unknown;
    rawReference?: unknown;
    notes?: unknown;
    createdBy?: unknown;
};

const normalizeOptionalText = (value: unknown): string | undefined => {
    if (typeof value !== "string") {
        return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
};

const normalizeRequiredText = (value: unknown, fieldName: string): string => {
    const normalized = normalizeOptionalText(value);

    if (!normalized) {
        throw new Error(`El campo ${fieldName} es obligatorio`);
    }

    return normalized;
};

export const createManualRead = async (
    req: Request<unknown, unknown, CreateManualReadBody>,
    res: Response
): Promise<void> => {
    try {
        const payload: ManualRead = {
            partNumber: normalizeRequiredText(req.body.partNumber, "partNumber").toUpperCase(),
            lot: normalizeRequiredText(req.body.lot, "lot"),
            manufactureDate: normalizeRequiredText(req.body.manufactureDate, "manufactureDate"),
            inputMethod: "manual",
            status: "captured",
        };

        const serviceOrder = normalizeOptionalText(req.body.serviceOrder);
        const rfidProgram = normalizeOptionalText(req.body.rfidProgram)?.toUpperCase();
        const gtin = normalizeOptionalText(req.body.gtin);
        const filterLabel = normalizeOptionalText(req.body.filterLabel);
        const rawReference = normalizeOptionalText(req.body.rawReference);
        const notes = normalizeOptionalText(req.body.notes);
        const createdBy = normalizeOptionalText(req.body.createdBy);

        if (serviceOrder) {
            payload.serviceOrder = serviceOrder;
        }

        if (rfidProgram) {
            payload.rfidProgram = rfidProgram;
        }

        if (gtin) {
            payload.gtin = gtin;
        }

        if (filterLabel) {
            payload.filterLabel = filterLabel;
        }

        if (rawReference) {
            payload.rawReference = rawReference;
        }

        if (notes) {
            payload.notes = notes;
        }

        if (createdBy) {
            payload.createdBy = createdBy;
        }

        const manualRead = await ManualReadModel.create(payload);

        res.status(201).json({
            message: "Lectura manual registrada",
            data: manualRead,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo registrar la lectura manual";
        res.status(400).json({ message });
    }
};

export const listManualReads = async (req: Request, res: Response): Promise<void> => {
    const filters: Record<string, string> = {};
    const status = normalizeOptionalText(req.query.status);
    const partNumber = normalizeOptionalText(req.query.partNumber);
    const serviceOrder = normalizeOptionalText(req.query.serviceOrder);

    if (status && manualReadStatuses.includes(status as (typeof manualReadStatuses)[number])) {
        filters.status = status;
    }

    if (partNumber) {
        filters.partNumber = partNumber.toUpperCase();
    }

    if (serviceOrder) {
        filters.serviceOrder = serviceOrder;
    }

    const manualReads = await ManualReadModel.find(filters).sort({ createdAt: -1 }).limit(100);

    res.json({
        count: manualReads.length,
        data: manualReads,
    });
};

export const getManualReadById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        res.status(400).json({ message: "El id no es valido" });
        return;
    }

    const manualRead = await ManualReadModel.findById(id);

    if (!manualRead) {
        res.status(404).json({ message: "Lectura manual no encontrada" });
        return;
    }

    res.json({ data: manualRead });
};
