import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import {
    ServiceOrder,
    ServiceOrderReadingMode,
    ServiceOrderModel,
    ServiceOrderStatus,
    serviceOrderReadingModes,
    serviceOrderStatuses,
} from "../models/serviceOrder";
import {
    getPartConfigByPartNumber,
    listActivePartConfigsByExpectedGtin,
} from "../services/partConfigService";
import {
    assertServiceOrderQuantityCanBeUpdated,
    createServiceOrderWithGeneratedFolio,
    getDocumentId,
    getServiceOrderById,
    getServiceOrdersAvailableForProgramming,
    getServiceOrderProgress,
    getServiceOrderProgressMap,
    hasPendingServiceOrderChangeRequest,
    GtinBasedServiceOrderReadingMode,
    isServiceOrderQuantityBelowProgressError,
    listOpenServiceOrdersByGtin,
    listOpenServiceOrdersByPartNumber,
    PartNumberBasedServiceOrderReadingMode,
    ServiceOrderProgress,
    listServiceOrders,
    validateServiceOrderCatalogReferences,
} from "../services/serviceOrderService";
import {
    normalizeOptionalPositiveInteger,
    normalizeOptionalText,
    normalizeRequiredText,
} from "../utils/requestNormalization";
import { gtinValuePattern, rfidProgramMaxLength } from "../utils/catalogValidation";

type ServiceOrderBody = {
    folio?: unknown;
    readingMode?: unknown;
    partNumber?: unknown;
    gtin?: unknown;
    quantity?: unknown;
    rfidProgram?: unknown;
    status?: unknown;
    notes?: unknown;
};

type ServiceOrderFilters = {
    folio?: string;
    readingMode?: ServiceOrderReadingMode;
    partNumber?: string;
    gtin?: string;
    status?: ServiceOrderStatus;
};

type ServiceOrderAuditFields = Pick<
    ServiceOrder,
    "createdByUserId" | "createdByUsername" | "updatedByUserId" | "updatedByUsername"
>;

const hasOwn = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

const normalizeServiceOrderStatus = (value: unknown, required = false): ServiceOrderStatus | undefined => {
    const normalized = required
        ? normalizeRequiredText(value, "status").toLowerCase()
        : normalizeOptionalText(value)?.toLowerCase();

    if (!normalized) {
        return undefined;
    }

    if (!serviceOrderStatuses.includes(normalized as ServiceOrderStatus)) {
        throw new Error("El campo status no es valido");
    }

    return normalized as ServiceOrderStatus;
};

const normalizeServiceOrderReadingMode = (
    value: unknown,
    required = false
): ServiceOrderReadingMode | undefined => {
    const normalized = required
        ? normalizeRequiredText(value, "readingMode").toLowerCase()
        : normalizeOptionalText(value)?.toLowerCase();

    if (!normalized) {
        return undefined;
    }

    if (!serviceOrderReadingModes.includes(normalized as ServiceOrderReadingMode)) {
        throw new Error("El campo readingMode no es valido");
    }

    return normalized as ServiceOrderReadingMode;
};

const normalizePartNumberResolutionReadingMode = (
    value: unknown
): PartNumberBasedServiceOrderReadingMode | undefined => {
    const normalized = normalizeOptionalText(value)?.toLowerCase();

    if (!normalized) {
        return undefined;
    }

    if (normalized !== "manual" && normalized !== "single_scan") {
        throw new Error("El campo readingMode solo permite manual o single_scan en esta consulta");
    }

    return normalized as PartNumberBasedServiceOrderReadingMode;
};

const normalizeGtinResolutionReadingMode = (
    value: unknown
): GtinBasedServiceOrderReadingMode | undefined => {
    const normalized = normalizeOptionalText(value)?.toLowerCase();

    if (!normalized) {
        return undefined;
    }

    if (normalized !== "double_scan" && normalized !== "single_scan") {
        throw new Error("El campo readingMode solo permite double_scan o single_scan en esta consulta");
    }

    return normalized as GtinBasedServiceOrderReadingMode;
};

const normalizeGtin = (value: unknown, required = false): string | undefined => {
    const normalized = required ? normalizeRequiredText(value, "gtin") : normalizeOptionalText(value);

    if (!normalized) {
        return undefined;
    }

    if (!gtinValuePattern.test(normalized)) {
        throw new Error("El GTIN debe contener exactamente 14 digitos numericos");
    }

    return normalized;
};

const normalizeRfidProgram = (value: unknown, required = false): string | undefined => {
    const normalized = required ? normalizeRequiredText(value, "rfidProgram") : normalizeOptionalText(value);

    if (!normalized) {
        return undefined;
    }

    const uppercased = normalized.toUpperCase();

    if (uppercased.length > rfidProgramMaxLength) {
        throw new Error(`El RFID program no debe exceder ${rfidProgramMaxLength} caracteres`);
    }

    return uppercased;
};

const normalizePartNumber = (value: unknown, required = false): string | undefined => {
    const normalized = required ? normalizeRequiredText(value, "partNumber") : normalizeOptionalText(value);

    if (!normalized) {
        return undefined;
    }

    return normalized.toUpperCase();
};

const normalizeQuantity = (value: unknown, required = false): number | undefined => {
    const normalized = normalizeOptionalPositiveInteger(value, "quantity");

    if (typeof normalized === "number") {
        return normalized;
    }

    if (required) {
        throw new Error("El campo quantity es obligatorio");
    }

    return undefined;
};

const applyAuditFields = (serviceOrder: ServiceOrderAuditFields): void => {
    delete serviceOrder.updatedByUserId;
    delete serviceOrder.updatedByUsername;
};

const assignAuditFields = (
    serviceOrder: ServiceOrderAuditFields,
    req: Pick<Request, "authUser">,
    isCreate = false
): void => {
    const authUser = req.authUser;

    if (!authUser) {
        applyAuditFields(serviceOrder);
        return;
    }

    serviceOrder.updatedByUserId = authUser.sub;
    serviceOrder.updatedByUsername = authUser.username;

    if (isCreate) {
        serviceOrder.createdByUserId = authUser.sub;
        serviceOrder.createdByUsername = authUser.username;
    }
};

const toPartConfigOption = (partConfig: {
    _id?: unknown;
    partNumber: string;
    description?: string;
    readingMode: string;
    rfidProgram?: string;
    filterLabel?: string;
    expectedLotLength?: number;
}): Record<string, string | number | undefined> => {
    return {
        id: getDocumentId(partConfig),
        partNumber: partConfig.partNumber,
        description: partConfig.description,
        readingMode: partConfig.readingMode,
        rfidProgram: partConfig.rfidProgram,
        filterLabel: partConfig.filterLabel,
        expectedLotLength: partConfig.expectedLotLength,
    };
};

const toServiceOrderResponse = (
    serviceOrder: ServiceOrder & { _id?: unknown; toObject?: () => Record<string, unknown> },
    progress: ServiceOrderProgress
): Record<string, unknown> => {
    const base = typeof serviceOrder.toObject === "function"
        ? serviceOrder.toObject()
        : { ...serviceOrder };

    return {
        ...base,
        programmedCount: progress.programmedCount,
        verifiedCount: progress.verifiedCount,
        remainingToProgram: progress.remainingToProgram,
        remainingToVerify: progress.remainingToVerify,
    };
};

const toOpenServiceOrderProgrammingResponse = (
    serviceOrder: ServiceOrder & { _id?: unknown },
    progress: ServiceOrderProgress
): Record<string, unknown> => {
    return {
        _id: getDocumentId(serviceOrder),
        folio: serviceOrder.folio,
        readingMode: serviceOrder.readingMode,
        partNumber: serviceOrder.partNumber,
        gtin: serviceOrder.gtin,
        rfidProgram: serviceOrder.rfidProgram,
        quantity: serviceOrder.quantity,
        status: serviceOrder.status,
        programmedCount: progress.programmedCount,
        verifiedCount: progress.verifiedCount,
        remainingToProgram: progress.remainingToProgram,
        remainingToVerify: progress.remainingToVerify,
    };
};

const isDuplicateKeyError = (error: unknown): boolean => {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
};

export const listServiceOrdersHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const filters: ServiceOrderFilters = {};
        const folio = normalizeOptionalText(req.query.folio);
        const readingMode = normalizeServiceOrderReadingMode(req.query.readingMode);
        const partNumber = normalizePartNumber(req.query.partNumber);
        const gtin = normalizeGtin(req.query.gtin);
        const status = normalizeServiceOrderStatus(req.query.status);

        if (folio) {
            filters.folio = folio;
        }

        if (readingMode) {
            filters.readingMode = readingMode;
        }

        if (partNumber) {
            filters.partNumber = partNumber;
        }

        if (gtin) {
            filters.gtin = gtin;
        }

        if (status) {
            filters.status = status;
        }

        const serviceOrders = await listServiceOrders(filters);
        const progressById = await getServiceOrderProgressMap(serviceOrders as Array<ServiceOrder & { _id?: unknown }>);

        res.json({
            count: serviceOrders.length,
            data: serviceOrders.map((serviceOrder) => {
                const typedServiceOrder = serviceOrder as ServiceOrder & {
                    _id?: unknown;
                    toObject?: () => Record<string, unknown>;
                };
                const serviceOrderId = getDocumentId(typedServiceOrder);
                const progress = serviceOrderId && progressById[serviceOrderId]
                    ? progressById[serviceOrderId]
                    : {
                        programmedCount: 0,
                        verifiedCount: 0,
                        remainingToProgram: serviceOrder.quantity,
                        remainingToVerify: serviceOrder.quantity,
                    };

                return toServiceOrderResponse(typedServiceOrder, progress);
            }),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudieron listar las ordenes de servicio";
        res.status(400).json({ message });
    }
};

export const getServiceOrderByIdHandler = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        res.status(400).json({ message: "El id no es valido" });
        return;
    }

    const serviceOrder = await ServiceOrderModel.findById(id);

    if (!serviceOrder) {
        res.status(404).json({ message: "Orden de servicio no encontrada" });
        return;
    }

    const progress = await getServiceOrderProgress(id, serviceOrder.quantity);

    res.json({
        data: toServiceOrderResponse(
            serviceOrder as ServiceOrder & { _id?: unknown; toObject?: () => Record<string, unknown> },
            progress
        ),
    });
};

export const createServiceOrder = async (
    req: Request<unknown, unknown, ServiceOrderBody>,
    res: Response
): Promise<void> => {
    try {
        const readingMode = normalizeServiceOrderReadingMode(req.body.readingMode, true) as ServiceOrderReadingMode;
        const resolvedCatalog = await validateServiceOrderCatalogReferences({
            readingMode,
            partNumber: normalizePartNumber(req.body.partNumber),
            gtin: normalizeGtin(req.body.gtin),
            rfidProgram: normalizeRfidProgram(req.body.rfidProgram),
        });
        const payload: Omit<ServiceOrder, "folio"> = {
            readingMode,
            quantity: normalizeQuantity(req.body.quantity, true) as number,
            status: "open",
        };
        const notes = normalizeOptionalText(req.body.notes);

        if (resolvedCatalog.partNumber) {
            payload.partNumber = resolvedCatalog.partNumber;
        }

        if (resolvedCatalog.gtin) {
            payload.gtin = resolvedCatalog.gtin;
        }

        if (resolvedCatalog.rfidProgram) {
            payload.rfidProgram = resolvedCatalog.rfidProgram;
        }

        if (notes) {
            payload.notes = notes;
        }

        assignAuditFields(payload, req, true);

        const serviceOrder = await createServiceOrderWithGeneratedFolio(payload);

        res.status(201).json({
            message: "Orden de servicio creada",
            data: serviceOrder,
        });
    } catch (error) {
        const message = isDuplicateKeyError(error)
            ? "Ya existe una orden de servicio con ese folio"
            : error instanceof Error
                ? error.message
                : "No se pudo crear la orden de servicio";
        res.status(400).json({ message });
    }
};

export const updateServiceOrder = async (
    req: Request<{ id: string }, unknown, ServiceOrderBody>,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            res.status(400).json({ message: "El id no es valido" });
            return;
        }

        const serviceOrder = await ServiceOrderModel.findById(id);

        if (!serviceOrder) {
            res.status(404).json({ message: "Orden de servicio no encontrada" });
            return;
        }

        if (serviceOrder.status === "blocked" && await hasPendingServiceOrderChangeRequest(id)) {
            res.status(409).json({
                message: "La orden tiene una solicitud pendiente; debe resolverse desde el modulo de cambios",
            });
            return;
        }

        const nextReadingMode = hasOwn(req.body, "readingMode")
            ? normalizeServiceOrderReadingMode(req.body.readingMode, true)
            : serviceOrder.readingMode;
        const nextPartNumber = hasOwn(req.body, "partNumber")
            ? normalizePartNumber(req.body.partNumber)
            : serviceOrder.partNumber;
        const nextGtin = hasOwn(req.body, "gtin")
            ? normalizeGtin(req.body.gtin)
            : serviceOrder.gtin;
        const nextQuantity = hasOwn(req.body, "quantity")
            ? normalizeQuantity(req.body.quantity, true)
            : serviceOrder.quantity;
        const nextRfidProgram = hasOwn(req.body, "rfidProgram")
            ? normalizeRfidProgram(req.body.rfidProgram)
            : serviceOrder.rfidProgram;
        const nextStatus = hasOwn(req.body, "status")
            ? normalizeServiceOrderStatus(req.body.status, true)
            : serviceOrder.status;
        const nextNotes = hasOwn(req.body, "notes")
            ? normalizeOptionalText(req.body.notes)
            : serviceOrder.notes;

        const resolvedCatalog = await validateServiceOrderCatalogReferences({
            readingMode: nextReadingMode as ServiceOrderReadingMode,
            partNumber: nextPartNumber,
            gtin: nextGtin,
            rfidProgram: nextRfidProgram,
        });

        if (nextQuantity !== serviceOrder.quantity) {
            await assertServiceOrderQuantityCanBeUpdated(id, nextQuantity as number);
        }

        serviceOrder.readingMode = nextReadingMode as ServiceOrderReadingMode;
        serviceOrder.quantity = nextQuantity as number;
        serviceOrder.status = nextStatus as ServiceOrderStatus;

        if (resolvedCatalog.partNumber) {
            serviceOrder.partNumber = resolvedCatalog.partNumber;
        } else {
            delete serviceOrder.partNumber;
        }

        if (resolvedCatalog.gtin) {
            serviceOrder.gtin = resolvedCatalog.gtin;
        } else {
            delete serviceOrder.gtin;
        }

        if (resolvedCatalog.rfidProgram) {
            serviceOrder.rfidProgram = resolvedCatalog.rfidProgram;
        } else {
            delete serviceOrder.rfidProgram;
        }

        if (nextNotes) {
            serviceOrder.notes = nextNotes;
        } else {
            delete serviceOrder.notes;
        }

        assignAuditFields(serviceOrder, req);
        await serviceOrder.save();

        res.json({
            message: "Orden de servicio actualizada",
            data: serviceOrder,
        });
    } catch (error) {
        if (isServiceOrderQuantityBelowProgressError(error)) {
            res.status(409).json({ message: (error as Error).message });
            return;
        }

        const message = isDuplicateKeyError(error)
            ? "Ya existe una orden de servicio con ese folio"
            : error instanceof Error
                ? error.message
                : "No se pudo actualizar la orden de servicio";
        res.status(400).json({ message });
    }
};

export const listOpenServiceOrdersByGtinHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const gtin = normalizeGtin(req.query.gtin, true) as string;
        const readingMode = normalizeGtinResolutionReadingMode(req.query.readingMode) ?? "double_scan";
        const serviceOrders = await listOpenServiceOrdersByGtin(gtin, readingMode);
        const availableServiceOrders = await getServiceOrdersAvailableForProgramming(
            serviceOrders as Array<ServiceOrder & { _id?: unknown }>
        );

        res.json({
            count: availableServiceOrders.length,
            data: availableServiceOrders.map(({ serviceOrder, progress }) =>
                toOpenServiceOrderProgrammingResponse(serviceOrder, progress)
            ),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudieron resolver las ordenes de servicio";
        res.status(400).json({ message });
    }
};

export const listOpenServiceOrdersByPartNumberHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const partNumber = normalizePartNumber(req.query.partNumber, true) as string;
        const readingMode = normalizePartNumberResolutionReadingMode(req.query.readingMode) ?? "manual";
        const serviceOrders = await listOpenServiceOrdersByPartNumber(partNumber, readingMode);
        const availableServiceOrders = await getServiceOrdersAvailableForProgramming(
            serviceOrders as Array<ServiceOrder & { _id?: unknown }>
        );

        res.json({
            count: availableServiceOrders.length,
            data: availableServiceOrders.map(({ serviceOrder, progress }) =>
                toOpenServiceOrderProgrammingResponse(serviceOrder, progress)
            ),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudieron resolver las ordenes de servicio";
        res.status(400).json({ message });
    }
};

export const listOpenManualServiceOrdersHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const partNumber = normalizePartNumber(req.query.partNumber);
        const serviceOrders = partNumber
            ? await listOpenServiceOrdersByPartNumber(partNumber)
            : await listServiceOrders({
                readingMode: "manual",
                status: "open",
            });
        const availableServiceOrders = await getServiceOrdersAvailableForProgramming(
            serviceOrders as Array<ServiceOrder & { _id?: unknown }>
        );

        res.json({
            count: availableServiceOrders.length,
            data: availableServiceOrders.map(({ serviceOrder, progress }) =>
                toOpenServiceOrderProgrammingResponse(serviceOrder, progress)
            ),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudieron listar las ordenes manuales abiertas";
        res.status(400).json({ message });
    }
};

export const listServiceOrderPartConfigOptions = async (
    req: Request<{ id: string }>,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            res.status(400).json({ message: "El id no es valido" });
            return;
        }

        const serviceOrder = await getServiceOrderById(id);

        if (!serviceOrder) {
            res.status(404).json({ message: "Orden de servicio no encontrada" });
            return;
        }

        if (serviceOrder.readingMode === "manual" || serviceOrder.readingMode === "single_scan") {
            if (!serviceOrder.partNumber) {
                res.json({ count: 0, data: [] });
                return;
            }

            const partConfig = await getPartConfigByPartNumber(serviceOrder.partNumber, serviceOrder.readingMode, true);

            if (!partConfig) {
                res.json({ count: 0, data: [] });
                return;
            }

            res.json({
                count: 1,
                data: [toPartConfigOption(partConfig as typeof partConfig & { _id?: unknown })],
            });
            return;
        }

        if (!serviceOrder.gtin) {
            res.json({ count: 0, data: [] });
            return;
        }

        const partConfigs = await listActivePartConfigsByExpectedGtin(serviceOrder.gtin, "double_scan");

        res.json({
            count: partConfigs.length,
            data: partConfigs.map((partConfig) =>
                toPartConfigOption(partConfig as typeof partConfig & { _id?: unknown })
            ),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudieron resolver los numeros de parte";
        res.status(400).json({ message });
    }
};
