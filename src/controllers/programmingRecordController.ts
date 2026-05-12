import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import {
    ProgrammingRecordMode,
    ProgrammingRecordSourceType,
    ProgrammingRecordStatus,
    programmingRecordModes,
    programmingRecordSourceTypes,
    programmingRecordStatuses,
} from "../models/programmingRecord";
import { getProgrammingRecordById, listProgrammingRecords } from "../services/programmingRecordService";
import { normalizeOptionalText } from "../utils/requestNormalization";

const normalizeProgrammingRecordMode = (value: unknown): ProgrammingRecordMode | undefined => {
    const normalized = normalizeOptionalText(value)?.toLowerCase();

    if (!normalized) {
        return undefined;
    }

    if (!programmingRecordModes.includes(normalized as ProgrammingRecordMode)) {
        throw new Error("El campo mode no es valido");
    }

    return normalized as ProgrammingRecordMode;
};

const normalizeProgrammingRecordSourceType = (value: unknown): ProgrammingRecordSourceType | undefined => {
    const normalized = normalizeOptionalText(value)?.toLowerCase();

    if (!normalized) {
        return undefined;
    }

    if (!programmingRecordSourceTypes.includes(normalized as ProgrammingRecordSourceType)) {
        throw new Error("El campo sourceType no es valido");
    }

    return normalized as ProgrammingRecordSourceType;
};

const normalizeProgrammingRecordStatus = (value: unknown): ProgrammingRecordStatus | undefined => {
    const normalized = normalizeOptionalText(value)?.toLowerCase();

    if (!normalized) {
        return undefined;
    }

    if (!programmingRecordStatuses.includes(normalized as ProgrammingRecordStatus)) {
        throw new Error("El campo status no es valido");
    }

    return normalized as ProgrammingRecordStatus;
};

export const listProgrammingRecordsHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const filters: {
            mode?: ProgrammingRecordMode;
            sourceType?: ProgrammingRecordSourceType;
            sourceReadId?: string;
            serviceOrderId?: string;
            serviceOrderFolio?: string;
            partNumber?: string;
            gtin?: string;
            rfidProgram?: string;
            status?: ProgrammingRecordStatus;
        } = {};
        const mode = normalizeProgrammingRecordMode(req.query.mode);
        const sourceType = normalizeProgrammingRecordSourceType(req.query.sourceType);
        const sourceReadId = normalizeOptionalText(req.query.sourceReadId);
        const serviceOrderId = normalizeOptionalText(req.query.serviceOrderId);
        const serviceOrderFolio = normalizeOptionalText(req.query.serviceOrderFolio);
        const partNumber = normalizeOptionalText(req.query.partNumber);
        const gtin = normalizeOptionalText(req.query.gtin);
        const rfidProgram = normalizeOptionalText(req.query.rfidProgram);
        const status = normalizeProgrammingRecordStatus(req.query.status);

        if (mode) {
            filters.mode = mode;
        }

        if (sourceType) {
            filters.sourceType = sourceType;
        }

        if (sourceReadId) {
            filters.sourceReadId = sourceReadId;
        }

        if (serviceOrderId) {
            filters.serviceOrderId = serviceOrderId;
        }

        if (serviceOrderFolio) {
            filters.serviceOrderFolio = serviceOrderFolio;
        }

        if (partNumber) {
            filters.partNumber = partNumber;
        }

        if (gtin) {
            filters.gtin = gtin;
        }

        if (rfidProgram) {
            filters.rfidProgram = rfidProgram;
        }

        if (status) {
            filters.status = status;
        }

        const records = await listProgrammingRecords(filters);

        res.json({
            count: records.length,
            data: records,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudieron listar los programming records";
        res.status(400).json({ message });
    }
};

export const getProgrammingRecordByIdHandler = async (
    req: Request<{ id: string }>,
    res: Response
): Promise<void> => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        res.status(400).json({ message: "El id no es valido" });
        return;
    }

    const record = await getProgrammingRecordById(id);

    if (!record) {
        res.status(404).json({ message: "Programming record no encontrado" });
        return;
    }

    res.json({ data: record });
};
