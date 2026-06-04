import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { DoubleScanRead, DoubleScanReadModel, doubleScanReadStatuses } from "../models/doubleScanRead";
import {
    getActiveDoubleScanPartConfigById,
    listDoubleScanPartConfigsByGtin,
    listPartConfigs,
    validateDoubleScanPartConfig,
} from "../services/partConfigService";
import { createProgrammingRecordFromDoubleScanRead } from "../services/programmingRecordService";
import { parseDoubleScanReading, parseFirstScanBarcode } from "../services/gs1Parser";
import {
    getDocumentId,
    isServiceOrderProgrammingCapacityExceededError,
    validateDoubleScanServiceOrderForProgramming,
} from "../services/serviceOrderService";
import { normalizeOptionalText, normalizeRequiredText } from "../utils/requestNormalization";

type CreateDoubleScanReadBody = {
    serviceOrderId?: unknown;
    partConfigId?: unknown;
    serviceOrder?: unknown;
    firstBarcodeRaw?: unknown;
    secondBarcodeRaw?: unknown;
    notes?: unknown;
    createdBy?: unknown;
};

type ResolveFirstDoubleScanBody = {
    firstBarcodeRaw?: unknown;
};

type PartConfigOption = {
    id: string;
    partNumber: string;
    description?: string;
    rfidProgram?: string;
    filterLabel?: string;
    expectedGtin?: string;
    expectedLotLength?: number;
};

const getPartConfigId = (partConfig: { _id?: unknown }): string => {
    if (typeof partConfig._id === "string") {
        return partConfig._id;
    }

    if (typeof partConfig._id === "object" && partConfig._id !== null && "toString" in partConfig._id) {
        return partConfig._id.toString();
    }

    return "";
};

const toPartConfigOption = (partConfig: {
    _id?: unknown;
    partNumber: string;
    description?: string;
    rfidProgram?: string;
    filterLabel?: string;
    expectedGtin?: string;
    expectedLotLength?: number;
}): PartConfigOption => {
    const option: PartConfigOption = {
        id: getPartConfigId(partConfig),
        partNumber: partConfig.partNumber,
    };

    if (partConfig.description) {
        option.description = partConfig.description;
    }

    if (partConfig.rfidProgram) {
        option.rfidProgram = partConfig.rfidProgram;
    }

    if (partConfig.filterLabel) {
        option.filterLabel = partConfig.filterLabel;
    }

    if (partConfig.expectedGtin) {
        option.expectedGtin = partConfig.expectedGtin;
    }

    if (partConfig.expectedLotLength) {
        option.expectedLotLength = partConfig.expectedLotLength;
    }

    return option;
};

export const listDoubleScanConfigs = async (req: Request, res: Response): Promise<void> => {
    const configs = await listPartConfigs({
        readingMode: "double_scan",
        isActive: true,
    });

    res.json({
        count: configs.length,
        data: configs,
    });
};

export const resolveFirstDoubleScan = async (
    req: Request<unknown, unknown, ResolveFirstDoubleScanBody>,
    res: Response
): Promise<void> => {
    try {
        const firstBarcodeRaw = normalizeRequiredText(req.body.firstBarcodeRaw, "firstBarcodeRaw");
        const resolvedFirstScan = parseFirstScanBarcode(firstBarcodeRaw);
        const matchingConfigs = await listDoubleScanPartConfigsByGtin(resolvedFirstScan.gtin);

        if (matchingConfigs.length === 0) {
            res.status(404).json({
                message: "No hay numeros de parte activos configurados para el GTIN leido",
                data: {
                    firstBarcodeRaw: resolvedFirstScan.firstBarcodeRaw,
                    gtin: resolvedFirstScan.gtin,
                    options: [],
                    autoSelectedPartConfigId: null,
                },
            });
            return;
        }

        const options = matchingConfigs.map((config) =>
            toPartConfigOption(config as typeof config & { _id?: unknown })
        );
        const firstOption = options[0];
        const autoSelectedPartConfigId = options.length === 1 && firstOption ? firstOption.id : null;

        res.json({
            message: "Primer codigo resuelto correctamente",
            data: {
                firstBarcodeRaw: resolvedFirstScan.firstBarcodeRaw,
                gtin: resolvedFirstScan.gtin,
                options,
                autoSelectedPartConfigId,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo resolver el primer codigo";
        res.status(400).json({ message });
    }
};

export const createDoubleScanRead = async (
    req: Request<unknown, unknown, CreateDoubleScanReadBody>,
    res: Response
): Promise<void> => {
    try {
        const serviceOrderId = normalizeRequiredText(req.body.serviceOrderId, "serviceOrderId");
        const partConfigId = normalizeRequiredText(req.body.partConfigId, "partConfigId");
        const firstBarcodeRaw = normalizeRequiredText(req.body.firstBarcodeRaw, "firstBarcodeRaw");
        const secondBarcodeRaw = normalizeRequiredText(req.body.secondBarcodeRaw, "secondBarcodeRaw");
        const notes = normalizeOptionalText(req.body.notes);
        const createdBy = normalizeOptionalText(req.body.createdBy);

        if (!isValidObjectId(serviceOrderId)) {
            throw new Error("El serviceOrderId no es valido");
        }

        if (!isValidObjectId(partConfigId)) {
            throw new Error("El partConfigId no es valido");
        }

        const partConfig = await getActiveDoubleScanPartConfigById(partConfigId);

        if (!partConfig) {
            throw new Error("La configuracion seleccionada no existe o no esta activa para doble lectura");
        }

        const resolvedPartConfig = validateDoubleScanPartConfig(partConfig);
        const parsedReading = parseDoubleScanReading(resolvedPartConfig, firstBarcodeRaw, secondBarcodeRaw);
        const serviceOrder = await validateDoubleScanServiceOrderForProgramming(serviceOrderId, {
            gtin: parsedReading.gtin,
            rfidProgram: resolvedPartConfig.rfidProgram,
        });
        const payload: DoubleScanRead = {
            serviceOrderId,
            partConfigId,
            partNumber: resolvedPartConfig.partNumber,
            rfidProgram: resolvedPartConfig.rfidProgram,
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

        payload.serviceOrder = serviceOrder.folio;

        if (resolvedPartConfig.filterLabel) {
            payload.filterLabel = resolvedPartConfig.filterLabel;
        }

        if (notes) {
            payload.notes = notes;
        }

        if (createdBy) {
            payload.createdBy = createdBy;
        }

        const doubleScanRead = await DoubleScanReadModel.create(payload);
        let programmingRecordId = "";
        let programmingRecordStatus = doubleScanRead.status;

        try {
            const programmingRecord = await createProgrammingRecordFromDoubleScanRead(
                doubleScanRead as typeof doubleScanRead & { _id?: unknown }
            );
            programmingRecordId = getDocumentId(programmingRecord as typeof programmingRecord & { _id?: unknown });
            programmingRecordStatus = programmingRecord.status;
        } catch (error) {
            await DoubleScanReadModel.findByIdAndDelete(
                getDocumentId(doubleScanRead as typeof doubleScanRead & { _id?: unknown })
            );
            throw error;
        }

        res.status(201).json({
            message: "Lectura doble registrada",
            data: doubleScanRead,
            programmingRecord: {
                id: programmingRecordId,
                mode: "double_scan",
                status: programmingRecordStatus,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo registrar la lectura doble";
        res.status(isServiceOrderProgrammingCapacityExceededError(error) ? 409 : 400).json({ message });
    }
};

export const listDoubleScanReads = async (req: Request, res: Response): Promise<void> => {
    const filters: Record<string, string> = {};
    const status = normalizeOptionalText(req.query.status);
    const partNumber = normalizeOptionalText(req.query.partNumber);
    const serviceOrder = normalizeOptionalText(req.query.serviceOrder);
    const serviceOrderId = normalizeOptionalText(req.query.serviceOrderId);

    if (status && doubleScanReadStatuses.includes(status as (typeof doubleScanReadStatuses)[number])) {
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
