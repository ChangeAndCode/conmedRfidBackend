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
import {
    buildRfidPayloadForProgrammingRecord,
    completeProgrammingRecord,
    getProgrammingRecordById,
    listProgrammingRecords,
    resolveProgrammingRecord,
    verifyProgrammingRecord,
} from "../services/programmingRecordService";
import { ProgrammingConnectionMethod, programmingConnectionMethods } from "../models/programmingRecord";
import { normalizeOptionalText, normalizeRequiredText } from "../utils/requestNormalization";

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

type ResolveProgrammingRecordBody = {
    mode?: unknown;
    rawReference?: unknown;
    rawScan?: unknown;
    firstBarcodeRaw?: unknown;
    secondBarcodeRaw?: unknown;
};

type VerifyProgrammingRecordBody = {
    rawReference?: unknown;
    rawScan?: unknown;
    firstBarcodeRaw?: unknown;
    secondBarcodeRaw?: unknown;
    verificationNotes?: unknown;
};

type BuildProgrammingRecordRfidPayloadBody = {
    tagId?: unknown;
};

type BuildProgrammingRecordRfidPayloadQuery = {
    debug?: unknown;
    verbose?: unknown;
};

type CompleteProgrammingRecordBody = {
    authCode?: unknown;
    connectionMethod?: unknown;
    deviceId?: unknown;
    deviceName?: unknown;
    payloadHex?: unknown;
    programmedBy?: unknown;
    programmingNotes?: unknown;
    serialPortPath?: unknown;
    tagId?: unknown;
};

const getResolveInputTypeCount = (input: {
    rawReference?: string | undefined;
    rawScan?: string | undefined;
    firstBarcodeRaw?: string | undefined;
    secondBarcodeRaw?: string | undefined;
}): number => {
    const hasDoubleScanInput = Boolean(input.firstBarcodeRaw || input.secondBarcodeRaw);

    return [
        Boolean(input.rawReference),
        Boolean(input.rawScan),
        hasDoubleScanInput,
    ].filter(Boolean).length;
};

const isEnabledQueryFlag = (value: unknown): boolean => {
    if (Array.isArray(value)) {
        return value.some((item) => isEnabledQueryFlag(item));
    }

    if (typeof value !== "string") {
        return false;
    }

    const normalized = value.trim().toLowerCase();

    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
};

const normalizeProgrammingConnectionMethod = (value: unknown): ProgrammingConnectionMethod => {
    const normalized = normalizeRequiredText(value, "connectionMethod").toLowerCase();

    if (!programmingConnectionMethods.includes(normalized as ProgrammingConnectionMethod)) {
        throw new Error("El campo connectionMethod no es valido");
    }

    return normalized as ProgrammingConnectionMethod;
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

export const buildProgrammingRecordRfidPayloadHandler = async (
    req: Request<{ id: string }, unknown, BuildProgrammingRecordRfidPayloadBody, BuildProgrammingRecordRfidPayloadQuery>,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            res.status(400).json({ message: "El id no es valido" });
            return;
        }

        const payload = await buildRfidPayloadForProgrammingRecord({
            programmingRecordId: id,
            tagId: normalizeRequiredText(req.body.tagId, "tagId"),
            includeDetails: isEnabledQueryFlag(req.query.verbose) || isEnabledQueryFlag(req.query.debug),
        });

        res.json({
            message: "Payload RFID de programming record construido correctamente",
            data: payload,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo construir el payload RFID del programming record";
        res.status(message.includes("no encontrado") ? 404 : 400).json({ message });
    }
};

export const completeProgrammingRecordHandler = async (
    req: Request<{ id: string }, unknown, CompleteProgrammingRecordBody>,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            res.status(400).json({ message: "El id no es valido" });
            return;
        }

        const programmingResult = await completeProgrammingRecord({
            programmingRecordId: id,
            connectionMethod: normalizeProgrammingConnectionMethod(req.body.connectionMethod),
            deviceId: normalizeOptionalText(req.body.deviceId),
            deviceName: normalizeOptionalText(req.body.deviceName),
            serialPortPath: normalizeOptionalText(req.body.serialPortPath),
            tagId: normalizeRequiredText(req.body.tagId, "tagId"),
            payloadHex: normalizeOptionalText(req.body.payloadHex),
            authCode: normalizeOptionalText(req.body.authCode),
            programmingNotes: normalizeOptionalText(req.body.programmingNotes),
            programmedBy: normalizeOptionalText(req.body.programmedBy) ?? req.authUser?.username,
        });

        res.json({
            message: "Programming record marcado como programado correctamente",
            data: programmingResult,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo completar la programacion RFID";
        const statusCode = message.includes("ya fue marcado como programado")
            || message.includes("ya fue verificado")
            || message.includes("no coincide")
            ? 409
            : message.includes("no encontrado")
                ? 404
                : 400;

        res.status(statusCode).json({ message });
    }
};

export const resolveProgrammingRecordHandler = async (
    req: Request<unknown, unknown, ResolveProgrammingRecordBody>,
    res: Response
): Promise<void> => {
    try {
        const requestedMode = normalizeProgrammingRecordMode(req.body.mode);
        const rawReference = normalizeOptionalText(req.body.rawReference);
        const rawScan = normalizeOptionalText(req.body.rawScan);
        const firstBarcodeRaw = normalizeOptionalText(req.body.firstBarcodeRaw);
        const secondBarcodeRaw = normalizeOptionalText(req.body.secondBarcodeRaw);
        const providedInputTypeCount = getResolveInputTypeCount({
            rawReference,
            rawScan,
            firstBarcodeRaw,
            secondBarcodeRaw,
        });

        if (!requestedMode && providedInputTypeCount > 1) {
            throw new Error("Envia un solo tipo de entrada o especifica el campo mode");
        }

        let mode = requestedMode;

        if (!mode) {
            if (firstBarcodeRaw || secondBarcodeRaw) {
                if (!firstBarcodeRaw || !secondBarcodeRaw) {
                    throw new Error("Para doble codigo debes enviar firstBarcodeRaw y secondBarcodeRaw");
                }

                mode = "double_scan";
            } else if (rawScan) {
                mode = "single_scan";
            } else if (rawReference) {
                mode = "manual";
            } else {
                throw new Error("Debes enviar rawReference, rawScan o firstBarcodeRaw y secondBarcodeRaw");
            }
        }

        if (mode === "manual" && !rawReference) {
            throw new Error("El campo rawReference es obligatorio para una verificacion manual");
        }

        if (mode === "single_scan" && !rawScan) {
            throw new Error("El campo rawScan es obligatorio para una verificacion single scan");
        }

        if (mode === "double_scan" && (!firstBarcodeRaw || !secondBarcodeRaw)) {
            throw new Error("Los campos firstBarcodeRaw y secondBarcodeRaw son obligatorios para doble codigo");
        }

        const resolution = await resolveProgrammingRecord({
            mode,
            strictMode: Boolean(requestedMode),
            rawReference,
            rawScan,
            firstBarcodeRaw,
            secondBarcodeRaw,
        });

        const message = resolution.candidateCount === 0
            ? "No se encontraron programaciones coincidentes"
            : resolution.candidateCount === 1
                ? "Programacion resuelta correctamente"
                : "Se encontraron varias programaciones coincidentes";

        res.json({
            message,
            data: resolution,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo resolver la programacion";
        res.status(400).json({ message });
    }
};

export const verifyProgrammingRecordHandler = async (
    req: Request<{ id: string }, unknown, VerifyProgrammingRecordBody>,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            res.status(400).json({ message: "El id no es valido" });
            return;
        }

        const verificationResult = await verifyProgrammingRecord({
            programmingRecordId: id,
            rawReference: normalizeOptionalText(req.body.rawReference),
            rawScan: normalizeOptionalText(req.body.rawScan),
            firstBarcodeRaw: normalizeOptionalText(req.body.firstBarcodeRaw),
            secondBarcodeRaw: normalizeOptionalText(req.body.secondBarcodeRaw),
            verificationNotes: normalizeOptionalText(req.body.verificationNotes),
        });

        res.json({
            message: "Programming record verificado correctamente",
            data: verificationResult,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo verificar el programming record";
        const statusCode = message.includes("ya fue verificado")
            || message.includes("aun no ha sido programado")
            ? 409
            : message.includes("no coincide")
                ? 409
                : message.includes("no encontrado")
                    ? 404
                    : 400;

        res.status(statusCode).json({ message });
    }
};
