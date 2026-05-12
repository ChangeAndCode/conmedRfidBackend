import { isValidObjectId } from "mongoose";
import { getActiveGtinByValue } from "./gtinService";
import { getActiveRfidProgramByValue } from "./rfidProgramService";
import { getPartConfigByPartNumber, listActivePartConfigsByExpectedGtin } from "./partConfigService";
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
