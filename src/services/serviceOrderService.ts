import { isValidObjectId } from "mongoose";
import { getActiveGtinByValue } from "./gtinService";
import { getActiveRfidProgramByValue } from "./rfidProgramService";
import { getPartConfigByPartNumber, listActivePartConfigsByExpectedGtin } from "./partConfigService";
import { ProgrammingRecordModel } from "../models/programmingRecord";
import {
    ServiceOrder,
    ServiceOrderReadingMode,
    ServiceOrderModel,
    ServiceOrderStatus,
} from "../models/serviceOrder";
import { ServiceOrderChangeRequestModel } from "../models/serviceOrderChangeRequest";

export type PartNumberBasedServiceOrderReadingMode = Extract<ServiceOrderReadingMode, "manual" | "single_scan">;
export type GtinBasedServiceOrderReadingMode = Extract<ServiceOrderReadingMode, "single_scan" | "double_scan">;

type ServiceOrderFilters = {
    folio?: string;
    gtin?: string;
    partNumber?: string;
    readingMode?: ServiceOrderReadingMode;
    status?: ServiceOrderStatus;
};

export type ServiceOrderProgress = {
    programmedCount: number;
    verifiedCount: number;
    remainingToProgram: number;
    remainingToVerify: number;
};

export const serviceOrderProgrammingCapacityExceededMessage = (
    "La orden de servicio seleccionada ya alcanzo la cantidad objetivo de programacion"
);

export const isServiceOrderProgrammingCapacityExceededError = (error: unknown): boolean => {
    return error instanceof Error && error.message === serviceOrderProgrammingCapacityExceededMessage;
};

type ServiceOrderProgressCount = {
    _id: string;
    programmedCount: number;
    verifiedCount: number;
};

const serviceOrderFolioPrefixByReadingMode: Record<ServiceOrderReadingMode, string> = {
    manual: "ML",
    single_scan: "LS",
    double_scan: "DL",
};

const serviceOrderFolioFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
});

type DoubleScanServiceOrderReadingMatch = {
    gtin: string;
    rfidProgram: string;
};

type ManualServiceOrderReadingMatch = {
    partNumber: string;
    rfidProgram?: string | undefined;
};

type SingleScanServiceOrderReadingMatch = ManualServiceOrderReadingMatch & {
    gtin?: string | undefined;
};

type ServiceOrderCatalogValidationInput = {
    readingMode: ServiceOrderReadingMode;
    gtin?: string | undefined;
    rfidProgram?: string | undefined;
    partNumber?: string | undefined;
};

type ServiceOrderCatalogValidationResult = {
    readingMode: ServiceOrderReadingMode;
    gtin?: string | undefined;
    rfidProgram?: string | undefined;
    partNumber?: string | undefined;
};

export const getDocumentId = (value: { _id?: unknown }): string => {
    if (typeof value._id === "string") {
        return value._id;
    }

    if (typeof value._id === "object" && value._id !== null && "toString" in value._id) {
        return value._id.toString();
    }

    return "";
};

const isDuplicateKeyError = (error: unknown): boolean => {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
};

const formatServiceOrderFolioTimestamp = (date: Date): string => {
    const parts = serviceOrderFolioFormatter.formatToParts(date);
    const values: Record<string, string> = {};

    for (const part of parts) {
        if (part.type !== "literal") {
            values[part.type] = part.value;
        }
    }

    return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
};

const buildServiceOrderFolio = (readingMode: ServiceOrderReadingMode, date: Date): string => {
    return `${serviceOrderFolioPrefixByReadingMode[readingMode]}${formatServiceOrderFolioTimestamp(date)}`;
};

export const createServiceOrderWithGeneratedFolio = async (
    payload: Omit<ServiceOrder, "folio">
): Promise<ServiceOrder> => {
    let currentDate = new Date();

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const folio = buildServiceOrderFolio(payload.readingMode, currentDate);

        try {
            return await ServiceOrderModel.create({
                ...payload,
                folio,
            });
        } catch (error) {
            if (!isDuplicateKeyError(error)) {
                throw error;
            }

            currentDate = new Date(currentDate.getTime() + 1000);
        }
    }

    throw new Error("No se pudo generar un folio unico para la orden de servicio");
};

const createServiceOrderProgress = (
    quantity: number,
    programmedCount: number,
    verifiedCount: number
): ServiceOrderProgress => {
    return {
        programmedCount,
        verifiedCount,
        remainingToProgram: Math.max(quantity - programmedCount, 0),
        remainingToVerify: Math.max(quantity - verifiedCount, 0),
    };
};

const aggregateServiceOrderProgressCounts = async (
    serviceOrderIds: string[]
): Promise<ServiceOrderProgressCount[]> => {
    if (serviceOrderIds.length === 0) {
        return [];
    }

    return ProgrammingRecordModel.aggregate<ServiceOrderProgressCount>([
        {
            $match: {
                serviceOrderId: {
                    $in: serviceOrderIds,
                },
            },
        },
        {
            $group: {
                _id: "$serviceOrderId",
                programmedCount: {
                    $sum: {
                        $cond: [
                            {
                                $in: ["$status", ["programmed", "verified"]],
                            },
                            1,
                            0,
                        ],
                    },
                },
                verifiedCount: {
                    $sum: {
                        $cond: [
                            {
                                $eq: ["$status", "verified"],
                            },
                            1,
                            0,
                        ],
                    },
                },
            },
        },
    ]);
};

export const getServiceOrderProgress = async (
    serviceOrderId: string,
    quantity: number
): Promise<ServiceOrderProgress> => {
    const [counts] = await aggregateServiceOrderProgressCounts([serviceOrderId]);

    return createServiceOrderProgress(
        quantity,
        counts?.programmedCount ?? 0,
        counts?.verifiedCount ?? 0
    );
};

export const hasServiceOrderProgrammingCapacity = async (
    serviceOrderId: string,
    quantity: number
): Promise<boolean> => {
    const progress = await getServiceOrderProgress(serviceOrderId, quantity);
    return progress.programmedCount < quantity;
};

export const getServiceOrderProgressMap = async (
    serviceOrders: Array<ServiceOrder & { _id?: unknown }>
): Promise<Record<string, ServiceOrderProgress>> => {
    const serviceOrderIds = serviceOrders
        .map((serviceOrder) => getDocumentId(serviceOrder))
        .filter(Boolean);
    const counts = await aggregateServiceOrderProgressCounts(serviceOrderIds);
    const countsById = new Map(counts.map((count) => [count._id, count]));
    const progressById: Record<string, ServiceOrderProgress> = {};

    for (const serviceOrder of serviceOrders) {
        const serviceOrderId = getDocumentId(serviceOrder);

        if (!serviceOrderId) {
            continue;
        }

        const resolvedCounts = countsById.get(serviceOrderId);

        progressById[serviceOrderId] = createServiceOrderProgress(
            serviceOrder.quantity,
            resolvedCounts?.programmedCount ?? 0,
            resolvedCounts?.verifiedCount ?? 0
        );
    }

    return progressById;
};

export const listServiceOrders = async (filters: ServiceOrderFilters = {}): Promise<ServiceOrder[]> => {
    const query: Record<string, string> = {};

    if (filters.folio) {
        query.folio = filters.folio;
    }

    if (filters.gtin) {
        query.gtin = filters.gtin;
    }

    if (filters.partNumber) {
        query.partNumber = filters.partNumber.toUpperCase();
    }

    if (filters.readingMode) {
        query.readingMode = filters.readingMode;
    }

    if (filters.status) {
        query.status = filters.status;
    }

    return ServiceOrderModel.find(query).sort({ createdAt: -1, folio: 1 });
};

export const listOpenServiceOrdersByGtin = async (
    gtin: string,
    readingMode: GtinBasedServiceOrderReadingMode = "double_scan"
): Promise<ServiceOrder[]> => {
    if (readingMode === "double_scan") {
        return ServiceOrderModel.find({
            gtin,
            readingMode,
            status: "open",
        }).sort({ createdAt: -1, folio: 1 });
    }

    const partConfigs = await listActivePartConfigsByExpectedGtin(gtin, "single_scan");
    const partNumbers = [...new Set(partConfigs.map((partConfig) => partConfig.partNumber))];
    const query: Record<string, unknown> = {
        readingMode: "single_scan",
        status: "open",
        $or: [
            { gtin },
            ...(partNumbers.length > 0 ? [{ partNumber: { $in: partNumbers } }] : []),
        ],
    };

    return ServiceOrderModel.find(query).sort({ createdAt: -1, folio: 1 });
};

export const listOpenServiceOrdersByPartNumber = async (
    partNumber: string,
    readingMode: PartNumberBasedServiceOrderReadingMode = "manual"
): Promise<ServiceOrder[]> => {
    return ServiceOrderModel.find({
        partNumber: partNumber.toUpperCase(),
        readingMode,
        status: "open",
    }).sort({ createdAt: -1, folio: 1 });
};

export const getServiceOrderById = async (id: string): Promise<ServiceOrder | null> => {
    return ServiceOrderModel.findById(id);
};

export const hasPendingServiceOrderChangeRequest = async (serviceOrderId: string): Promise<boolean> => {
    const pendingCount = await ServiceOrderChangeRequestModel.countDocuments({
        serviceOrderId,
        status: "pending",
    });

    return pendingCount > 0;
};

export const validateServiceOrderCatalogReferences = async (
    input: ServiceOrderCatalogValidationInput
): Promise<ServiceOrderCatalogValidationResult> => {
    if (input.readingMode === "manual") {
        const partNumber = input.partNumber?.trim().toUpperCase();

        if (!partNumber) {
            throw new Error("El numero de parte es obligatorio para una orden manual");
        }

        const partConfig = await getPartConfigByPartNumber(partNumber, "manual", true);

        if (!partConfig) {
            throw new Error("El numero de parte no existe o no esta activo para lectura manual");
        }

        return {
            readingMode: "manual",
            partNumber,
            rfidProgram: partConfig.rfidProgram,
        };
    }

    if (input.readingMode === "single_scan") {
        const partNumber = input.partNumber?.trim().toUpperCase();

        if (!partNumber) {
            throw new Error("El numero de parte es obligatorio para una orden single scan");
        }

        const partConfig = await getPartConfigByPartNumber(partNumber, "single_scan", true);

        if (!partConfig) {
            throw new Error("El numero de parte no existe o no esta activo para lectura single scan");
        }

        if (!partConfig.expectedGtin) {
            throw new Error("El numero de parte single scan no tiene GTIN esperado configurado");
        }

        return {
            readingMode: "single_scan",
            partNumber,
            gtin: partConfig.expectedGtin,
            rfidProgram: partConfig.rfidProgram,
        };
    }

    const gtin = input.gtin?.trim();
    const rfidProgram = input.rfidProgram?.trim().toUpperCase();

    if (!gtin) {
        throw new Error("El GTIN es obligatorio para una orden de doble codigo");
    }

    if (!rfidProgram) {
        throw new Error("El RFID program es obligatorio para una orden de doble codigo");
    }

    const [gtinRecord, rfidProgramRecord] = await Promise.all([
        getActiveGtinByValue(gtin),
        getActiveRfidProgramByValue(rfidProgram),
    ]);

    if (!gtinRecord) {
        throw new Error("El GTIN seleccionado no existe o no esta activo");
    }

    if (!rfidProgramRecord) {
        throw new Error("El RFID program seleccionado no existe o no esta activo");
    }

    return {
        readingMode: "double_scan",
        gtin,
        rfidProgram,
    };
};

const validateOpenServiceOrder = async (serviceOrderId: string): Promise<ServiceOrder> => {
    if (!isValidObjectId(serviceOrderId)) {
        throw new Error("El serviceOrderId no es valido");
    }

    const serviceOrder = await getServiceOrderById(serviceOrderId);

    if (!serviceOrder) {
        throw new Error("La orden de servicio seleccionada no existe");
    }

    if (serviceOrder.status !== "open") {
        throw new Error("La orden de servicio seleccionada no esta disponible para programacion");
    }

    if (await hasPendingServiceOrderChangeRequest(serviceOrderId)) {
        throw new Error("La orden de servicio seleccionada tiene una solicitud pendiente");
    }

    if (!(await hasServiceOrderProgrammingCapacity(serviceOrderId, serviceOrder.quantity))) {
        throw new Error(serviceOrderProgrammingCapacityExceededMessage);
    }

    return serviceOrder;
};

export const validateDoubleScanServiceOrderForProgramming = async (
    serviceOrderId: string,
    readingData: DoubleScanServiceOrderReadingMatch
): Promise<ServiceOrder> => {
    const serviceOrder = await validateOpenServiceOrder(serviceOrderId);

    if (serviceOrder.readingMode !== "double_scan") {
        throw new Error("La orden de servicio seleccionada no pertenece al flujo de doble codigo");
    }

    if (serviceOrder.gtin !== readingData.gtin) {
        throw new Error("El GTIN del producto no coincide con la orden de servicio");
    }

    if (serviceOrder.rfidProgram !== readingData.rfidProgram.trim().toUpperCase()) {
        throw new Error("El RFID program del producto no coincide con la orden de servicio");
    }

    return serviceOrder;
};

export const validateManualServiceOrderForProgramming = async (
    serviceOrderId: string,
    readingData: ManualServiceOrderReadingMatch
): Promise<ServiceOrder> => {
    const serviceOrder = await validateOpenServiceOrder(serviceOrderId);

    if (serviceOrder.readingMode !== "manual") {
        throw new Error("La orden de servicio seleccionada no pertenece al flujo manual");
    }

    if (serviceOrder.partNumber !== readingData.partNumber.trim().toUpperCase()) {
        throw new Error("El numero de parte no coincide con la orden de servicio");
    }

    if (
        serviceOrder.rfidProgram
        && readingData.rfidProgram
        && serviceOrder.rfidProgram !== readingData.rfidProgram.trim().toUpperCase()
    ) {
        throw new Error("El RFID program del producto no coincide con la orden de servicio");
    }

    return serviceOrder;
};

export const validateSingleScanServiceOrderForProgramming = async (
    serviceOrderId: string,
    readingData: SingleScanServiceOrderReadingMatch
): Promise<ServiceOrder> => {
    const serviceOrder = await validateOpenServiceOrder(serviceOrderId);

    if (serviceOrder.readingMode !== "single_scan") {
        throw new Error("La orden de servicio seleccionada no pertenece al flujo single scan");
    }

    if (serviceOrder.partNumber !== readingData.partNumber.trim().toUpperCase()) {
        throw new Error("El numero de parte no coincide con la orden de servicio");
    }

    if (
        serviceOrder.rfidProgram
        && readingData.rfidProgram
        && serviceOrder.rfidProgram !== readingData.rfidProgram.trim().toUpperCase()
    ) {
        throw new Error("El RFID program del producto no coincide con la orden de servicio");
    }

    if (
        serviceOrder.gtin
        && readingData.gtin
        && serviceOrder.gtin !== readingData.gtin.trim()
    ) {
        throw new Error("El GTIN del producto no coincide con la orden de servicio");
    }

    return serviceOrder;
};
