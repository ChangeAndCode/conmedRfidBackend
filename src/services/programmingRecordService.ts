import { DoubleScanRead } from "../models/doubleScanRead";
import { ManualRead } from "../models/manualRead";
import {
    ProgrammingRecord,
    ProgrammingRecordMode,
    ProgrammingRecordModel,
    ProgrammingRecordSourceType,
    ProgrammingRecordStatus,
} from "../models/programmingRecord";
import { SingleScanRead } from "../models/singleScanRead";
import { getDocumentId } from "./serviceOrderService";

type ProgrammingRecordQuery = {
    mode?: ProgrammingRecordMode;
    sourceType?: ProgrammingRecordSourceType;
    sourceReadId?: string;
    serviceOrderId?: string;
    serviceOrderFolio?: string;
    partNumber?: string;
    gtin?: string;
    rfidProgram?: string;
    status?: ProgrammingRecordStatus;
};

const listQueryValue = (value: string | undefined): string | undefined => {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : undefined;
};

export const listProgrammingRecords = async (filters: ProgrammingRecordQuery = {}): Promise<ProgrammingRecord[]> => {
    const query: Record<string, string> = {};

    if (filters.mode) {
        query.mode = filters.mode;
    }

    if (filters.sourceType) {
        query.sourceType = filters.sourceType;
    }

    if (filters.sourceReadId) {
        query.sourceReadId = filters.sourceReadId;
    }

    if (filters.serviceOrderId) {
        query.serviceOrderId = filters.serviceOrderId;
    }

    if (filters.serviceOrderFolio) {
        query.serviceOrderFolio = filters.serviceOrderFolio;
    }

    if (filters.partNumber) {
        query.partNumber = filters.partNumber.toUpperCase();
    }

    if (filters.gtin) {
        query.gtin = filters.gtin;
    }

    if (filters.rfidProgram) {
        query.rfidProgram = filters.rfidProgram.toUpperCase();
    }

    if (filters.status) {
        query.status = filters.status;
    }

    return ProgrammingRecordModel.find(query).sort({ createdAt: -1 }).limit(100);
};

export const getProgrammingRecordById = async (id: string): Promise<ProgrammingRecord | null> => {
    return ProgrammingRecordModel.findById(id);
};

export const createProgrammingRecordFromManualRead = async (
    read: ManualRead & { _id?: unknown }
): Promise<ProgrammingRecord> => {
    const payload: ProgrammingRecord = {
        mode: "manual",
        sourceType: "manual_read",
        sourceReadId: getDocumentId(read),
        partNumber: read.partNumber,
        rawSourceData: {},
        status: read.status,
    };

    const serviceOrderId = listQueryValue(read.serviceOrderId);
    const serviceOrderFolio = listQueryValue(read.serviceOrder);
    const rfidProgram = listQueryValue(read.rfidProgram);
    const gtin = listQueryValue(read.gtin);
    const lot = listQueryValue(read.lot);
    const manufactureDate = listQueryValue(read.manufactureDate);
    const filterLabel = listQueryValue(read.filterLabel);
    const rawReference = listQueryValue(read.rawReference);
    const notes = listQueryValue(read.notes);
    const createdBy = listQueryValue(read.createdBy);

    if (serviceOrderId) {
        payload.serviceOrderId = serviceOrderId;
    }

    if (serviceOrderFolio) {
        payload.serviceOrderFolio = serviceOrderFolio;
    }

    if (rfidProgram) {
        payload.rfidProgram = rfidProgram;
    }

    if (gtin) {
        payload.gtin = gtin;
    }

    if (lot) {
        payload.lot = lot;
    }

    if (manufactureDate) {
        payload.manufactureDate = manufactureDate;
    }

    if (filterLabel) {
        payload.filterLabel = filterLabel;
    }

    if (rawReference) {
        payload.rawSourceData.rawReference = rawReference;
    }

    if (notes) {
        payload.notes = notes;
    }

    if (createdBy) {
        payload.createdBy = createdBy;
    }

    return ProgrammingRecordModel.create(payload);
};

export const createProgrammingRecordFromSingleScanRead = async (
    read: SingleScanRead & { _id?: unknown }
): Promise<ProgrammingRecord> => {
    const payload: ProgrammingRecord = {
        mode: "single_scan",
        sourceType: "single_scan_read",
        sourceReadId: getDocumentId(read),
        partNumber: read.partNumber,
        rawSourceData: {
            rawScan: read.rawScan.trim(),
        },
        status: read.status,
    };

    const serviceOrderId = listQueryValue(read.serviceOrderId);
    const serviceOrderFolio = listQueryValue(read.serviceOrder);
    const rfidProgram = listQueryValue(read.rfidProgram);
    const gtin = listQueryValue(read.gtin);
    const lot = listQueryValue(read.lot);
    const manufactureDate = listQueryValue(read.manufactureDate);
    const filterLabel = listQueryValue(read.filterLabel);
    const notes = listQueryValue(read.notes);
    const createdBy = listQueryValue(read.createdBy);

    if (serviceOrderId) {
        payload.serviceOrderId = serviceOrderId;
    }

    if (serviceOrderFolio) {
        payload.serviceOrderFolio = serviceOrderFolio;
    }

    if (rfidProgram) {
        payload.rfidProgram = rfidProgram;
    }

    if (gtin) {
        payload.gtin = gtin;
    }

    if (lot) {
        payload.lot = lot;
    }

    if (manufactureDate) {
        payload.manufactureDate = manufactureDate;
    }

    if (filterLabel) {
        payload.filterLabel = filterLabel;
    }

    if (notes) {
        payload.notes = notes;
    }

    if (createdBy) {
        payload.createdBy = createdBy;
    }

    return ProgrammingRecordModel.create(payload);
};

export const createProgrammingRecordFromDoubleScanRead = async (
    read: DoubleScanRead & { _id?: unknown }
): Promise<ProgrammingRecord> => {
    const payload: ProgrammingRecord = {
        mode: "double_scan",
        sourceType: "double_scan_read",
        sourceReadId: getDocumentId(read),
        partNumber: read.partNumber,
        rawSourceData: {
            firstBarcodeRaw: read.firstBarcodeRaw.trim(),
            secondBarcodeRaw: read.secondBarcodeRaw.trim(),
        },
        status: read.status,
    };

    const serviceOrderId = listQueryValue(read.serviceOrderId);
    const serviceOrderFolio = listQueryValue(read.serviceOrder);
    const partConfigId = listQueryValue(read.partConfigId);
    const rfidProgram = listQueryValue(read.rfidProgram);
    const gtin = listQueryValue(read.gtin);
    const lot = listQueryValue(read.lot);
    const manufactureDate = listQueryValue(read.manufactureDate);
    const filterLabel = listQueryValue(read.filterLabel);
    const notes = listQueryValue(read.notes);
    const createdBy = listQueryValue(read.createdBy);

    if (serviceOrderId) {
        payload.serviceOrderId = serviceOrderId;
    }

    if (serviceOrderFolio) {
        payload.serviceOrderFolio = serviceOrderFolio;
    }

    if (partConfigId) {
        payload.partConfigId = partConfigId;
    }

    if (rfidProgram) {
        payload.rfidProgram = rfidProgram;
    }

    if (gtin) {
        payload.gtin = gtin;
    }

    if (lot) {
        payload.lot = lot;
    }

    if (manufactureDate) {
        payload.manufactureDate = manufactureDate;
    }

    if (filterLabel) {
        payload.filterLabel = filterLabel;
    }

    if (notes) {
        payload.notes = notes;
    }

    if (createdBy) {
        payload.createdBy = createdBy;
    }

    return ProgrammingRecordModel.create(payload);
};
