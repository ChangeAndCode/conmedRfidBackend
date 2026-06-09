import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { getPartConfigByPartNumber } from "../services/partConfigService";
import { SingleScanRead, SingleScanReadModel, singleScanReadStatuses } from "../models/singleScanRead";
import { createProgrammingRecordFromSingleScanRead } from "../services/programmingRecordService";
import { parseSingleScanReading } from "../services/gs1Parser";
import {
    getDocumentId,
    isServiceOrderProgrammingCapacityExceededError,
    listOpenServiceOrdersByGtin,
    validateSingleScanServiceOrderForProgramming,
} from "../services/serviceOrderService";
import { normalizeOptionalText, normalizeRequiredText } from "../utils/requestNormalization";

type CreateSingleScanReadBody = {
    serviceOrderId?: unknown;
    serviceOrder?: unknown;
    partNumber?: unknown;
    rawScan?: unknown;
    rfidProgram?: unknown;
    gtin?: unknown;
    lot?: unknown;
    manufactureDate?: unknown;
    notes?: unknown;
    createdBy?: unknown;
};

type ResolveSingleScanReadBody = {
    rawScan?: unknown;
};

export const resolveSingleScanRead = async (
    req: Request<unknown, unknown, ResolveSingleScanReadBody>,
    res: Response
): Promise<void> => {
    try {
        const rawScan = normalizeRequiredText(req.body.rawScan, "rawScan");
        const resolvedScan = parseSingleScanReading(rawScan);
        const matchingServiceOrders = await listOpenServiceOrdersByGtin(resolvedScan.gtin, "single_scan");

        res.json({
            message: "Lectura single scan resuelta",
            data: {
                rawScan: resolvedScan.rawScan,
                gtin: resolvedScan.gtin,
                lot: resolvedScan.lot,
                manufactureDate: resolvedScan.manufactureDate,
                matchingServiceOrders,
                serviceOrderCount: matchingServiceOrders.length,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo resolver la lectura single scan";
        res.status(400).json({ message });
    }
};

export const createSingleScanRead = async (
    req: Request<unknown, unknown, CreateSingleScanReadBody>,
    res: Response
): Promise<void> => {
    try {
        const serviceOrderId = normalizeRequiredText(req.body.serviceOrderId, "serviceOrderId");
        const partNumber = normalizeRequiredText(req.body.partNumber, "partNumber").toUpperCase();
        const rawScan = normalizeRequiredText(req.body.rawScan, "rawScan");
        const partConfig = await getPartConfigByPartNumber(partNumber, "single_scan", true);

        if (!partConfig) {
            throw new Error("El numero de parte no esta configurado para single scan");
        }

        const validationConfig: {
            expectedGtin?: string;
            expectedLotLength?: number;
        } = {};

        if (partConfig.expectedGtin) {
            validationConfig.expectedGtin = partConfig.expectedGtin;
        }

        if (partConfig.expectedLotLength) {
            validationConfig.expectedLotLength = partConfig.expectedLotLength;
        }

        const resolvedScan = parseSingleScanReading(rawScan, validationConfig);

        const payload: SingleScanRead = {
            serviceOrderId,
            partNumber,
            rawScan: resolvedScan.rawScan,
            inputMethod: "single_scan",
            status: "captured",
        };

        const requestRfidProgram = normalizeOptionalText(req.body.rfidProgram)?.toUpperCase();
        const notes = normalizeOptionalText(req.body.notes);
        const createdBy = normalizeOptionalText(req.body.createdBy);
        const rfidProgram = partConfig.rfidProgram ?? requestRfidProgram;
        const gtin = partConfig.expectedGtin ?? resolvedScan.gtin;

        const serviceOrder = await validateSingleScanServiceOrderForProgramming(serviceOrderId, {
            partNumber,
            rfidProgram,
            gtin: resolvedScan.gtin,
        });

        payload.serviceOrder = serviceOrder.folio;
        payload.lot = resolvedScan.lot;
        payload.manufactureDate = resolvedScan.manufactureDate;

        if (rfidProgram) {
            payload.rfidProgram = rfidProgram;
        }

        if (gtin) {
            payload.gtin = gtin;
        }

        if (notes) {
            payload.notes = notes;
        }

        if (createdBy) {
            payload.createdBy = createdBy;
        }

        const singleScanRead = await SingleScanReadModel.create(payload);
        let programmingRecordId = "";
        let programmingRecordStatus = singleScanRead.status;

        try {
            const programmingRecord = await createProgrammingRecordFromSingleScanRead(
                singleScanRead as typeof singleScanRead & { _id?: unknown }
            );
            programmingRecordId = getDocumentId(programmingRecord as typeof programmingRecord & { _id?: unknown });
            programmingRecordStatus = programmingRecord.status;
        } catch (error) {
            await SingleScanReadModel.findByIdAndDelete(
                getDocumentId(singleScanRead as typeof singleScanRead & { _id?: unknown })
            );
            throw error;
        }

        res.status(201).json({
            message: "Lectura single scan registrada",
            data: singleScanRead,
            programmingRecord: {
                id: programmingRecordId,
                mode: "single_scan",
                status: programmingRecordStatus,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo registrar la lectura single scan";
        res.status(isServiceOrderProgrammingCapacityExceededError(error) ? 409 : 400).json({ message });
    }
};

export const listSingleScanReads = async (req: Request, res: Response): Promise<void> => {
    const filters: Record<string, string> = {};
    const status = normalizeOptionalText(req.query.status);
    const partNumber = normalizeOptionalText(req.query.partNumber);
    const serviceOrder = normalizeOptionalText(req.query.serviceOrder);
    const serviceOrderId = normalizeOptionalText(req.query.serviceOrderId);
    const rawScan = normalizeOptionalText(req.query.rawScan);

    if (status && singleScanReadStatuses.includes(status as (typeof singleScanReadStatuses)[number])) {
        filters.status = status;
    }

    if (partNumber) {
        filters.partNumber = partNumber.toUpperCase();
    }

    if (serviceOrder) {
        filters.serviceOrder = serviceOrder;
    }

    if (serviceOrderId) {
        filters.serviceOrderId = serviceOrderId;
    }

    if (rawScan) {
        filters.rawScan = rawScan;
    }

    const singleScanReads = await SingleScanReadModel.find(filters).sort({ createdAt: -1 }).limit(100);

    res.json({
        count: singleScanReads.length,
        data: singleScanReads,
    });
};

export const getSingleScanReadById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        res.status(400).json({ message: "El id no es valido" });
        return;
    }

    const singleScanRead = await SingleScanReadModel.findById(id);

    if (!singleScanRead) {
        res.status(404).json({ message: "Lectura single scan no encontrada" });
        return;
    }

    res.json({ data: singleScanRead });
};
