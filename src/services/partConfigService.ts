import { defaultPartConfigs } from "../config/defaultPartConfigs";
import { logger } from "../config/logger";
import { PartConfig, PartConfigModel, ReadingMode } from "../models/partConfig";
import {
    resolveLegacyRfidPartMapping,
    ResolvedLegacyRfidPartMapping,
} from "./rfid/legacyTagMapping";

type PartConfigQuery = {
    partNumber?: string;
    readingMode?: ReadingMode;
    isActive?: boolean;
};

type DoubleScanResolvedConfig = PartConfig & {
    rfidProgram: string;
    expectedGtin: string;
    expectedLotLength: number;
};

export const listPartConfigs = async (filters: PartConfigQuery = {}): Promise<PartConfig[]> => {
    const query: Record<string, string | boolean> = {};

    if (filters.partNumber) {
        query.partNumber = filters.partNumber.toUpperCase();
    }

    if (filters.readingMode) {
        query.readingMode = filters.readingMode;
    }

    if (typeof filters.isActive === "boolean") {
        query.isActive = filters.isActive;
    }

    return PartConfigModel.find(query).sort({ partNumber: 1 });
};

export const getPartConfigByPartNumber = async (
    partNumber: string,
    readingMode?: ReadingMode,
    isActive?: boolean
): Promise<PartConfig | null> => {
    const query: Record<string, string | boolean> = {
        partNumber: partNumber.toUpperCase(),
    };

    if (readingMode) {
        query.readingMode = readingMode;
    }

    if (typeof isActive === "boolean") {
        query.isActive = isActive;
    }

    return PartConfigModel.findOne(query);
};

export const listDoubleScanPartConfigsByGtin = async (expectedGtin: string): Promise<PartConfig[]> => {
    return PartConfigModel.find({
        expectedGtin,
        readingMode: "double_scan",
        isActive: true,
    }).sort({ partNumber: 1 });
};

export const listActivePartConfigsByExpectedGtin = async (
    expectedGtin: string,
    readingMode?: ReadingMode
): Promise<PartConfig[]> => {
    const query: Record<string, string | boolean> = {
        expectedGtin,
        isActive: true,
    };

    if (readingMode) {
        query.readingMode = readingMode;
    }

    return PartConfigModel.find(query).sort({ partNumber: 1 });
};

export const getActiveDoubleScanPartConfigById = async (id: string): Promise<PartConfig | null> => {
    return PartConfigModel.findOne({
        _id: id,
        readingMode: "double_scan",
        isActive: true,
    });
};

export const validateDoubleScanPartConfig = (partConfig: PartConfig): DoubleScanResolvedConfig => {
    if (!partConfig.rfidProgram) {
        throw new Error("La configuracion del numero de parte no tiene RFID program");
    }

    if (!partConfig.expectedGtin) {
        throw new Error("La configuracion del numero de parte no tiene GTIN esperado");
    }

    if (!partConfig.expectedLotLength) {
        throw new Error("La configuracion del numero de parte no tiene longitud de lote esperada");
    }

    return partConfig as DoubleScanResolvedConfig;
};

const getDocumentId = (value: { _id?: unknown }): string | undefined => {
    if (typeof value._id === "string") {
        return value._id;
    }

    if (typeof value._id === "object" && value._id !== null && "toString" in value._id) {
        return value._id.toString();
    }

    return undefined;
};

export const resolveLegacyRfidPartMappingByBackendPartNumber = async (
    backendPartNumber: string
): Promise<ResolvedLegacyRfidPartMapping> => {
    const partConfig = await getPartConfigByPartNumber(backendPartNumber, undefined, true);

    if (!partConfig) {
        throw new Error("El numero de parte no tiene una configuracion activa para construir payload RFID legado");
    }

    return resolveLegacyRfidPartMapping({
        backendPartNumber: partConfig.partNumber,
        legacyRfidPartNumber: partConfig.legacyRfidPartNumber,
        partConfigId: getDocumentId(partConfig as typeof partConfig & { _id?: unknown }),
        readingMode: partConfig.readingMode,
        usesLegacyRfidPayload: partConfig.usesLegacyRfidPayload,
    });
};

export const seedDefaultPartConfigs = async (): Promise<void> => {
    const result = await PartConfigModel.bulkWrite(
        defaultPartConfigs.map((config) => ({
            updateOne: {
                filter: { partNumber: config.partNumber },
                update: { $setOnInsert: config },
                upsert: true,
            },
        }))
    );

    const insertedCount = result.upsertedCount ?? 0;

    if (insertedCount > 0) {
        logger.info(`Se insertaron ${insertedCount} configuraciones iniciales de numero de parte`);
    }
};
