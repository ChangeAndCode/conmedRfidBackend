import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { listPartConfigs } from "../services/partConfigService";
import { PartConfig, PartConfigModel, ReadingMode, readingModes } from "../models/partConfig";
import {
    normalizeOptionalBoolean,
    normalizeOptionalPositiveInteger,
    normalizeOptionalText,
    normalizeRequiredText,
} from "../utils/requestNormalization";

type PartConfigBody = {
    partNumber?: unknown;
    description?: unknown;
    readingMode?: unknown;
    rfidProgram?: unknown;
    expectedGtin?: unknown;
    filterLabel?: unknown;
    expectedLotLength?: unknown;
    lotTrimRight?: unknown;
    isActive?: unknown;
    notes?: unknown;
};

const hasOwn = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

const normalizeReadingMode = (value: unknown, required = false): ReadingMode | undefined => {
    const normalized = required
        ? normalizeRequiredText(value, "readingMode").toLowerCase()
        : normalizeOptionalText(value)?.toLowerCase();

    if (!normalized) {
        return undefined;
    }

    if (!readingModes.includes(normalized as ReadingMode)) {
        throw new Error("El campo readingMode no es valido");
    }

    return normalized as ReadingMode;
};

const validatePartConfig = (config: PartConfig): void => {
    if (config.readingMode === "double_scan") {
        if (!config.rfidProgram) {
            throw new Error("double_scan requiere rfidProgram");
        }

        if (!config.expectedGtin) {
            throw new Error("double_scan requiere expectedGtin");
        }

        if (!config.expectedLotLength) {
            throw new Error("double_scan requiere expectedLotLength");
        }
    }

    if (config.lotTrimRight && !config.expectedLotLength) {
        throw new Error("lotTrimRight requiere expectedLotLength");
    }
};

const createBasePartConfig = (partNumber: string, readingMode: ReadingMode, isActive: boolean): PartConfig => ({
    partNumber,
    readingMode,
    isActive,
});

const copyOptionalFields = (source: PartConfig, target: PartConfig): void => {
    if (source.description) {
        target.description = source.description;
    }

    if (source.rfidProgram) {
        target.rfidProgram = source.rfidProgram;
    }

    if (source.expectedGtin) {
        target.expectedGtin = source.expectedGtin;
    }

    if (source.filterLabel) {
        target.filterLabel = source.filterLabel;
    }

    if (source.expectedLotLength) {
        target.expectedLotLength = source.expectedLotLength;
    }

    if (source.lotTrimRight) {
        target.lotTrimRight = source.lotTrimRight;
    }

    if (source.notes) {
        target.notes = source.notes;
    }
};

const assignStringField = (
    target: PartConfig,
    field: "description" | "expectedGtin" | "filterLabel" | "notes",
    value: string | undefined
): void => {
    if (value) {
        target[field] = value;
        return;
    }

    delete target[field];
};

const assignUppercaseField = (
    target: PartConfig,
    field: "rfidProgram",
    value: string | undefined
): void => {
    if (value) {
        target[field] = value.toUpperCase();
        return;
    }

    delete target[field];
};

const assignNumberField = (
    target: PartConfig,
    field: "expectedLotLength" | "lotTrimRight",
    value: number | undefined
): void => {
    if (typeof value === "number") {
        target[field] = value;
        return;
    }

    delete target[field];
};

const isDuplicateKeyError = (error: unknown): boolean => {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
};

export const listPartConfigsHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const readingMode = normalizeReadingMode(req.query.readingMode);
        const isActive = normalizeOptionalBoolean(req.query.isActive);
        const partNumber = normalizeOptionalText(req.query.partNumber);
        const filters: {
            readingMode?: ReadingMode;
            isActive?: boolean;
            partNumber?: string;
        } = {};

        if (readingMode) {
            filters.readingMode = readingMode;
        }

        if (typeof isActive === "boolean") {
            filters.isActive = isActive;
        }

        if (partNumber) {
            filters.partNumber = partNumber;
        }

        const configs = await listPartConfigs(filters);

        res.json({
            count: configs.length,
            data: configs,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudieron listar las configuraciones";
        res.status(400).json({ message });
    }
};

export const getPartConfigById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        res.status(400).json({ message: "El id no es valido" });
        return;
    }

    const config = await PartConfigModel.findById(id);

    if (!config) {
        res.status(404).json({ message: "Configuracion de numero de parte no encontrada" });
        return;
    }

    res.json({ data: config });
};

export const createPartConfig = async (
    req: Request<unknown, unknown, PartConfigBody>,
    res: Response
): Promise<void> => {
    try {
        const payload = createBasePartConfig(
            normalizeRequiredText(req.body.partNumber, "partNumber").toUpperCase(),
            normalizeReadingMode(req.body.readingMode, true) as ReadingMode,
            normalizeOptionalBoolean(req.body.isActive) ?? true
        );

        assignStringField(payload, "description", normalizeOptionalText(req.body.description));
        assignUppercaseField(payload, "rfidProgram", normalizeOptionalText(req.body.rfidProgram));
        assignStringField(payload, "expectedGtin", normalizeOptionalText(req.body.expectedGtin));
        assignStringField(payload, "filterLabel", normalizeOptionalText(req.body.filterLabel));
        assignNumberField(
            payload,
            "expectedLotLength",
            normalizeOptionalPositiveInteger(req.body.expectedLotLength, "expectedLotLength")
        );
        assignNumberField(
            payload,
            "lotTrimRight",
            normalizeOptionalPositiveInteger(req.body.lotTrimRight, "lotTrimRight")
        );
        assignStringField(payload, "notes", normalizeOptionalText(req.body.notes));

        validatePartConfig(payload);

        const config = await PartConfigModel.create(payload);

        res.status(201).json({
            message: "Configuracion de numero de parte creada",
            data: config,
        });
    } catch (error) {
        const message = isDuplicateKeyError(error)
            ? "Ya existe una configuracion para ese numero de parte"
            : error instanceof Error
                ? error.message
                : "No se pudo crear la configuracion";
        res.status(400).json({ message });
    }
};

export const updatePartConfig = async (
    req: Request<{ id: string }, unknown, PartConfigBody>,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            res.status(400).json({ message: "El id no es valido" });
            return;
        }

        const existing = await PartConfigModel.findById(id);

        if (!existing) {
            res.status(404).json({ message: "Configuracion de numero de parte no encontrada" });
            return;
        }

        const nextConfig = createBasePartConfig(existing.partNumber, existing.readingMode, existing.isActive);
        copyOptionalFields(existing.toObject(), nextConfig);

        if (hasOwn(req.body, "partNumber")) {
            nextConfig.partNumber = normalizeRequiredText(req.body.partNumber, "partNumber").toUpperCase();
        }

        if (hasOwn(req.body, "readingMode")) {
            nextConfig.readingMode = normalizeReadingMode(req.body.readingMode, true) as ReadingMode;
        }

        if (hasOwn(req.body, "isActive")) {
            const isActive = normalizeOptionalBoolean(req.body.isActive);

            if (typeof isActive !== "boolean") {
                throw new Error("El campo isActive no es valido");
            }

            nextConfig.isActive = isActive;
        }

        if (hasOwn(req.body, "description")) {
            assignStringField(nextConfig, "description", normalizeOptionalText(req.body.description));
        }

        if (hasOwn(req.body, "rfidProgram")) {
            assignUppercaseField(nextConfig, "rfidProgram", normalizeOptionalText(req.body.rfidProgram));
        }

        if (hasOwn(req.body, "expectedGtin")) {
            assignStringField(nextConfig, "expectedGtin", normalizeOptionalText(req.body.expectedGtin));
        }

        if (hasOwn(req.body, "filterLabel")) {
            assignStringField(nextConfig, "filterLabel", normalizeOptionalText(req.body.filterLabel));
        }

        if (hasOwn(req.body, "expectedLotLength")) {
            assignNumberField(
                nextConfig,
                "expectedLotLength",
                normalizeOptionalPositiveInteger(req.body.expectedLotLength, "expectedLotLength")
            );
        }

        if (hasOwn(req.body, "lotTrimRight")) {
            assignNumberField(
                nextConfig,
                "lotTrimRight",
                normalizeOptionalPositiveInteger(req.body.lotTrimRight, "lotTrimRight")
            );
        }

        if (hasOwn(req.body, "notes")) {
            assignStringField(nextConfig, "notes", normalizeOptionalText(req.body.notes));
        }

        validatePartConfig(nextConfig);
        existing.set(nextConfig);
        await existing.save();

        res.json({
            message: "Configuracion de numero de parte actualizada",
            data: existing,
        });
    } catch (error) {
        const message = isDuplicateKeyError(error)
            ? "Ya existe una configuracion para ese numero de parte"
            : error instanceof Error
                ? error.message
                : "No se pudo actualizar la configuracion";
        res.status(400).json({ message });
    }
};

export const deletePartConfig = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        res.status(400).json({ message: "El id no es valido" });
        return;
    }

    const config = await PartConfigModel.findByIdAndUpdate(id, { isActive: false }, { new: true });

    if (!config) {
        res.status(404).json({ message: "Configuracion de numero de parte no encontrada" });
        return;
    }

    res.json({
        message: "Configuracion de numero de parte desactivada",
        data: config,
    });
};
