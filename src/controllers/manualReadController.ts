import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { ManualRead, ManualReadModel, manualReadStatuses } from "../models/manualRead";
import { getPartConfigByPartNumber } from "../services/partConfigService";
import { createProgrammingRecordFromManualRead } from "../services/programmingRecordService";
import {
    getDocumentId,
    isServiceOrderProgrammingCapacityExceededError,
    validateManualServiceOrderForProgramming,
} from "../services/serviceOrderService";
import { normalizeOptionalText, normalizeRequiredText } from "../utils/requestNormalization";

type CreateManualReadBody = {
    serviceOrderId?: unknown;
    serviceOrder?: unknown;
    partNumber?: unknown;
    rfidProgram?: unknown;
    gtin?: unknown;
    lot?: unknown;
    manufactureDate?: unknown;
    rawReference?: unknown;
    notes?: unknown;
    createdBy?: unknown;
};

export const createManualRead = async (
    req: Request<unknown, unknown, CreateManualReadBody>,
    res: Response
): Promise<void> => {
    try {
        const serviceOrderId = normalizeRequiredText(req.body.serviceOrderId, "serviceOrderId");
        const partNumber = normalizeRequiredText(req.body.partNumber, "partNumber").toUpperCase();
        const partConfig = await getPartConfigByPartNumber(partNumber, "manual", true);

        if (!partConfig) {
            throw new Error("El numero de parte no esta configurado para lectura manual");
        }

        const payload: ManualRead = {
            serviceOrderId,
            partNumber,
            inputMethod: "manual",
            status: "captured",
        };

        const lot = normalizeOptionalText(req.body.lot);
        const manufactureDate = normalizeOptionalText(req.body.manufactureDate);
        const requestRfidProgram = normalizeOptionalText(req.body.rfidProgram)?.toUpperCase();
        const requestGtin = normalizeOptionalText(req.body.gtin);
        const rawReference = normalizeOptionalText(req.body.rawReference);
        const notes = normalizeOptionalText(req.body.notes);
        const createdBy = normalizeOptionalText(req.body.createdBy);
        const rfidProgram = partConfig.rfidProgram ?? requestRfidProgram;
        const gtin = partConfig.expectedGtin ?? requestGtin;

        const serviceOrder = await validateManualServiceOrderForProgramming(serviceOrderId, {
            partNumber,
            rfidProgram,
        });

        payload.serviceOrder = serviceOrder.folio;
        payload.rawReference = rawReference && rawReference.toLowerCase() !== "manual"
            ? rawReference
            : serviceOrder.folio;

        if (lot) {
            payload.lot = lot;
        }

        if (manufactureDate) {
            payload.manufactureDate = manufactureDate;
        }

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

        const manualRead = await ManualReadModel.create(payload);
        let programmingRecordId = "";
        let programmingRecordStatus = manualRead.status;

        try {
            const programmingRecord = await createProgrammingRecordFromManualRead(
                manualRead as typeof manualRead & { _id?: unknown }
            );
            programmingRecordId = getDocumentId(programmingRecord as typeof programmingRecord & { _id?: unknown });
            programmingRecordStatus = programmingRecord.status;
        } catch (error) {
            await ManualReadModel.findByIdAndDelete(getDocumentId(manualRead as typeof manualRead & { _id?: unknown }));
            throw error;
        }

        res.status(201).json({
            message: "Lectura manual registrada",
            data: manualRead,
            programmingRecord: {
                id: programmingRecordId,
                mode: "manual",
                status: programmingRecordStatus,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo registrar la lectura manual";
        res.status(isServiceOrderProgrammingCapacityExceededError(error) ? 409 : 400).json({ message });
    }
};

export const listManualReads = async (req: Request, res: Response): Promise<void> => {
    const filters: Record<string, string> = {};
    const status = normalizeOptionalText(req.query.status);
    const partNumber = normalizeOptionalText(req.query.partNumber);
    const serviceOrder = normalizeOptionalText(req.query.serviceOrder);
    const serviceOrderId = normalizeOptionalText(req.query.serviceOrderId);

    if (status && manualReadStatuses.includes(status as (typeof manualReadStatuses)[number])) {
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
