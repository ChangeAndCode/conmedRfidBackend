import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { doubleScanPartCatalog, getDoubleScanPartConfig } from "../config/doubleScanCatalog";
import { DoubleScanRead, DoubleScanReadModel, doubleScanReadStatuses } from "../models/doubleScanRead";
import { parseDoubleScanReading } from "../services/gs1Parser";
import { normalizeOptionalText, normalizeRequiredText } from "../utils/requestNormalization";

type CreateDoubleScanReadBody = {
    serviceOrder?: unknown;
    partNumber?: unknown;
    firstBarcodeRaw?: unknown;
    secondBarcodeRaw?: unknown;
    notes?: unknown;
    createdBy?: unknown;
};

export const listDoubleScanConfigs = async (req: Request, res: Response): Promise<void> => {
    res.json({
        count: doubleScanPartCatalog.length,
        data: doubleScanPartCatalog,
    });
};

export const createDoubleScanRead = async (
    req: Request<unknown, unknown, CreateDoubleScanReadBody>,
    res: Response
): Promise<void> => {
    try {
        const partNumber = normalizeRequiredText(req.body.partNumber, "partNumber").toUpperCase();
        const firstBarcodeRaw = normalizeRequiredText(req.body.firstBarcodeRaw, "firstBarcodeRaw");
        const secondBarcodeRaw = normalizeRequiredText(req.body.secondBarcodeRaw, "secondBarcodeRaw");
        const serviceOrder = normalizeOptionalText(req.body.serviceOrder);
        const notes = normalizeOptionalText(req.body.notes);
        const createdBy = normalizeOptionalText(req.body.createdBy);

        const partConfig = getDoubleScanPartConfig(partNumber);

        if (!partConfig) {
            throw new Error("El numero de parte no esta configurado para doble lectura");
        }

        const parsedReading = parseDoubleScanReading(partConfig, firstBarcodeRaw, secondBarcodeRaw);
        const payload: DoubleScanRead = {
            partNumber,
            rfidProgram: partConfig.rfidProgram,
            firstBarcodeRaw: parsedReading.firstBarcodeRaw,
            secondBarcodeRaw: parsedReading.secondBarcodeRaw,
            firstScanFields: parsedReading.firstScanFields,
            secondScanFields: parsedReading.secondScanFields,
            gtin: parsedReading.gtin,
            lot: parsedReading.lot,
            manufactureDate: parsedReading.manufactureDate,
            rulesApplied: parsedReading.rulesApplied,
            inputMethod: "double_scan",
            status: "captured",
        };

        if (serviceOrder) {
            payload.serviceOrder = serviceOrder;
        }

        if (partConfig.filterLabel) {
            payload.filterLabel = partConfig.filterLabel;
        }

        if (notes) {
            payload.notes = notes;
        }

        if (createdBy) {
            payload.createdBy = createdBy;
        }

        const doubleScanRead = await DoubleScanReadModel.create(payload);

        res.status(201).json({
            message: "Lectura doble registrada",
            data: doubleScanRead,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo registrar la lectura doble";
        res.status(400).json({ message });
    }
};

export const listDoubleScanReads = async (req: Request, res: Response): Promise<void> => {
    const filters: Record<string, string> = {};
    const status = normalizeOptionalText(req.query.status);
    const partNumber = normalizeOptionalText(req.query.partNumber);
    const serviceOrder = normalizeOptionalText(req.query.serviceOrder);

    if (status && doubleScanReadStatuses.includes(status as (typeof doubleScanReadStatuses)[number])) {
        filters.status = status;
    }

    if (partNumber) {
        filters.partNumber = partNumber.toUpperCase();
    }

    if (serviceOrder) {
        filters.serviceOrder = serviceOrder;
    }

    const doubleScanReads = await DoubleScanReadModel.find(filters).sort({ createdAt: -1 }).limit(100);

    res.json({
        count: doubleScanReads.length,
        data: doubleScanReads,
    });
};

export const getDoubleScanReadById = async (
    req: Request<{ id: string }>,
    res: Response
): Promise<void> => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        res.status(400).json({ message: "El id no es valido" });
        return;
    }

    const doubleScanRead = await DoubleScanReadModel.findById(id);

    if (!doubleScanRead) {
        res.status(404).json({ message: "Lectura doble no encontrada" });
        return;
    }

    res.json({ data: doubleScanRead });
};
