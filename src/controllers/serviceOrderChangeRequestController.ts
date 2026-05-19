import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import {
    ServiceOrderChangeRequestModel,
    ServiceOrderChangeRequestStatus,
    ServiceOrderChangeRequestType,
    serviceOrderChangeRequestStatuses,
    serviceOrderChangeRequestTypes,
} from "../models/serviceOrderChangeRequest";
import {
    ServiceOrderModel,
    ServiceOrderReadingMode,
    ServiceOrderStatus,
    serviceOrderReadingModes,
} from "../models/serviceOrder";
import {
    assertServiceOrderQuantityCanBeUpdated,
    hasPendingServiceOrderChangeRequest,
    isServiceOrderQuantityBelowProgressError,
    validateServiceOrderCatalogReferences,
} from "../services/serviceOrderService";
import {
    normalizeOptionalPositiveInteger,
    normalizeOptionalText,
    normalizeRequiredText,
} from "../utils/requestNormalization";
import { gtinValuePattern, rfidProgramMaxLength } from "../utils/catalogValidation";

type CreateServiceOrderChangeRequestBody = {
    requestType?: unknown;
};

type ResolveServiceOrderChangeRequestBody = {
    folio?: unknown;
    readingMode?: unknown;
    partNumber?: unknown;
    gtin?: unknown;
    quantity?: unknown;
    rfidProgram?: unknown;
    notes?: unknown;
    resolutionNotes?: unknown;
    status?: unknown;
};

const hasOwn = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

const normalizeChangeRequestType = (value: unknown, required = false): ServiceOrderChangeRequestType | undefined => {
    const normalized = required
        ? normalizeRequiredText(value, "requestType").toLowerCase()
        : normalizeOptionalText(value)?.toLowerCase();

    if (!normalized) {
        return undefined;
    }

    if (!serviceOrderChangeRequestTypes.includes(normalized as ServiceOrderChangeRequestType)) {
        throw new Error("El campo requestType no es valido");
    }

    return normalized as ServiceOrderChangeRequestType;
};

const normalizeChangeRequestStatus = (
    value: unknown,
    required = false
): ServiceOrderChangeRequestStatus | undefined => {
    const normalized = required
        ? normalizeRequiredText(value, "status").toLowerCase()
        : normalizeOptionalText(value)?.toLowerCase();

    if (!normalized) {
        return undefined;
    }

    if (!serviceOrderChangeRequestStatuses.includes(normalized as ServiceOrderChangeRequestStatus)) {
        throw new Error("El campo status no es valido");
    }

    return normalized as ServiceOrderChangeRequestStatus;
};

const normalizeServiceOrderStatus = (value: unknown): ServiceOrderStatus | undefined => {
    const normalized = normalizeOptionalText(value)?.toLowerCase();

    if (!normalized) {
        return undefined;
    }

    if (normalized !== "open" && normalized !== "closed") {
        throw new Error("El campo status solo permite open o closed al resolver la solicitud");
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

const normalizePartNumber = (value: unknown): string | undefined => {
    const normalized = normalizeOptionalText(value);

    if (!normalized) {
        return undefined;
    }

    return normalized.toUpperCase();
};

const normalizeGtin = (value: unknown): string | undefined => {
    const normalized = normalizeOptionalText(value);

    if (!normalized) {
        return undefined;
    }

    if (!gtinValuePattern.test(normalized)) {
        throw new Error("El GTIN debe contener exactamente 14 digitos numericos");
    }

    return normalized;
};

const normalizeRfidProgram = (value: unknown): string | undefined => {
    const normalized = normalizeOptionalText(value);

    if (!normalized) {
        return undefined;
    }

    const uppercased = normalized.toUpperCase();

    if (uppercased.length > rfidProgramMaxLength) {
        throw new Error(`El RFID program no debe exceder ${rfidProgramMaxLength} caracteres`);
    }

    return uppercased;
};

export const createServiceOrderChangeRequest = async (
    req: Request<{ id: string }, unknown, CreateServiceOrderChangeRequestBody>,
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

        if (serviceOrder.status !== "open") {
            res.status(409).json({ message: "La orden de servicio no esta disponible para solicitar cambios" });
            return;
        }

        if (await hasPendingServiceOrderChangeRequest(id)) {
            res.status(409).json({ message: "La orden ya tiene una solicitud de cambio pendiente" });
            return;
        }

        const requestType = normalizeChangeRequestType(req.body.requestType, true) as ServiceOrderChangeRequestType;

        const changeRequest = await ServiceOrderChangeRequestModel.create({
            serviceOrderId: id,
            serviceOrderFolio: serviceOrder.folio,
            requestType,
            status: "pending",
        });

        serviceOrder.status = "blocked";
        await serviceOrder.save();

        res.status(201).json({
            message: "Solicitud de cambio creada",
            data: changeRequest,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo crear la solicitud de cambio";
        res.status(400).json({ message });
    }
};

export const listServiceOrderChangeRequestsHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const status = normalizeChangeRequestStatus(req.query.status);
        const serviceOrderId = normalizeOptionalText(req.query.serviceOrderId);
        const filters: {
            status?: ServiceOrderChangeRequestStatus;
            serviceOrderId?: string;
        } = {};

        if (status) {
            filters.status = status;
        }

        if (serviceOrderId) {
            filters.serviceOrderId = serviceOrderId;
        }

        const changeRequests = await ServiceOrderChangeRequestModel.find(filters).sort({ createdAt: -1 });

        res.json({
            count: changeRequests.length,
            data: changeRequests,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudieron listar las solicitudes";
        res.status(400).json({ message });
    }
};

export const getServiceOrderChangeRequestByIdHandler = async (
    req: Request<{ id: string }>,
    res: Response
): Promise<void> => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        res.status(400).json({ message: "El id no es valido" });
        return;
    }

    const changeRequest = await ServiceOrderChangeRequestModel.findById(id);

    if (!changeRequest) {
        res.status(404).json({ message: "Solicitud de cambio no encontrada" });
        return;
    }

    res.json({ data: changeRequest });
};

export const resolveServiceOrderChangeRequest = async (
    req: Request<{ id: string }, unknown, ResolveServiceOrderChangeRequestBody>,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            res.status(400).json({ message: "El id no es valido" });
            return;
        }

        const changeRequest = await ServiceOrderChangeRequestModel.findById(id);

        if (!changeRequest) {
            res.status(404).json({ message: "Solicitud de cambio no encontrada" });
            return;
        }

        if (changeRequest.status !== "pending") {
            res.status(409).json({ message: "La solicitud de cambio ya fue resuelta" });
            return;
        }

        const serviceOrder = await ServiceOrderModel.findById(changeRequest.serviceOrderId);

        if (!serviceOrder) {
            res.status(404).json({ message: "La orden de servicio asociada no existe" });
            return;
        }

        const nextReadingMode = hasOwn(req.body, "readingMode")
            ? normalizeServiceOrderReadingMode(req.body.readingMode, true)
            : serviceOrder.readingMode;
        const nextPartNumber = hasOwn(req.body, "partNumber")
            ? normalizePartNumber(req.body.partNumber)
            : serviceOrder.partNumber;
        const nextGtin = hasOwn(req.body, "gtin")
            ? normalizeGtin(req.body.gtin) ?? serviceOrder.gtin
            : serviceOrder.gtin;
        const nextQuantity = hasOwn(req.body, "quantity")
            ? normalizeOptionalPositiveInteger(req.body.quantity, "quantity") ?? serviceOrder.quantity
            : serviceOrder.quantity;
        const nextRfidProgram = hasOwn(req.body, "rfidProgram")
            ? normalizeRfidProgram(req.body.rfidProgram) ?? serviceOrder.rfidProgram
            : serviceOrder.rfidProgram;
        const nextNotes = hasOwn(req.body, "notes")
            ? normalizeOptionalText(req.body.notes)
            : serviceOrder.notes;
        const nextStatus = normalizeServiceOrderStatus(req.body.status) ?? "open";
        const resolutionNotes = normalizeOptionalText(req.body.resolutionNotes);

        const resolvedCatalog = await validateServiceOrderCatalogReferences({
            readingMode: nextReadingMode as ServiceOrderReadingMode,
            partNumber: nextPartNumber,
            gtin: nextGtin,
            rfidProgram: nextRfidProgram,
        });

        if (nextQuantity !== serviceOrder.quantity) {
            await assertServiceOrderQuantityCanBeUpdated(serviceOrder.id, nextQuantity);
        }

        serviceOrder.readingMode = nextReadingMode as ServiceOrderReadingMode;
        serviceOrder.quantity = nextQuantity;
        serviceOrder.status = nextStatus;

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

        if (req.authUser) {
            serviceOrder.updatedByUserId = req.authUser.sub;
            serviceOrder.updatedByUsername = req.authUser.username;
        } else {
            delete serviceOrder.updatedByUserId;
            delete serviceOrder.updatedByUsername;
        }

        if (nextNotes) {
            serviceOrder.notes = nextNotes;
        } else {
            delete serviceOrder.notes;
        }

        await serviceOrder.save();

        changeRequest.status = "resolved";
        changeRequest.resolvedAt = new Date();

        if (req.authUser) {
            changeRequest.resolvedByUserId = req.authUser.sub;
            changeRequest.resolvedByUsername = req.authUser.username;
        } else {
            delete changeRequest.resolvedByUserId;
            delete changeRequest.resolvedByUsername;
        }

        if (resolutionNotes) {
            changeRequest.resolutionNotes = resolutionNotes;
        } else {
            delete changeRequest.resolutionNotes;
        }

        await changeRequest.save();

        res.json({
            message: "Solicitud de cambio resuelta",
            data: {
                serviceOrder,
                changeRequest,
            },
        });
    } catch (error) {
        if (isServiceOrderQuantityBelowProgressError(error)) {
            res.status(409).json({ message: (error as Error).message });
            return;
        }

        const message = error instanceof Error ? error.message : "No se pudo resolver la solicitud de cambio";
        res.status(400).json({ message });
    }
};
