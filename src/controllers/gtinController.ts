import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { GtinModel } from "../models/gtin";
import { listGtins, hasActivePartConfigsUsingGtin, syncPartConfigsExpectedGtin } from "../services/gtinService";
import { gtinValuePattern } from "../utils/catalogValidation";
import { normalizeOptionalBoolean, normalizeOptionalText, normalizeRequiredText } from "../utils/requestNormalization";

type GtinBody = {
    value?: unknown;
    isActive?: unknown;
};

const hasOwn = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

const isDuplicateKeyError = (error: unknown): boolean => {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
};

const normalizeGtinValue = (value: unknown, required = false): string | undefined => {
    const normalized = required ? normalizeRequiredText(value, "value") : normalizeOptionalText(value);

    if (!normalized) {
        return undefined;
    }

    if (!gtinValuePattern.test(normalized)) {
        throw new Error("El GTIN debe contener exactamente 14 digitos numericos");
    }

    return normalized;
};

export const listGtinsHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const value = normalizeGtinValue(req.query.value);
        const isActive = normalizeOptionalBoolean(req.query.isActive);
        const filters: {
            value?: string;
            isActive?: boolean;
        } = {};

        if (value) {
            filters.value = value;
        }

        if (typeof isActive === "boolean") {
            filters.isActive = isActive;
        }

        const gtins = await listGtins(filters);

        res.json({
            count: gtins.length,
            data: gtins,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudieron listar los GTIN";
        res.status(400).json({ message });
    }
};

export const getGtinById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        res.status(400).json({ message: "El id no es valido" });
        return;
    }

    const gtin = await GtinModel.findById(id);

    if (!gtin) {
        res.status(404).json({ message: "GTIN no encontrado" });
        return;
    }

    res.json({ data: gtin });
};

export const createGtin = async (req: Request<unknown, unknown, GtinBody>, res: Response): Promise<void> => {
    try {
        const gtin = await GtinModel.create({
            value: normalizeGtinValue(req.body.value, true) as string,
            isActive: normalizeOptionalBoolean(req.body.isActive) ?? true,
        });

        res.status(201).json({
            message: "GTIN creado",
            data: gtin,
        });
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            res.status(409).json({ message: "El GTIN ya existe" });
            return;
        }

        const message = error instanceof Error ? error.message : "No se pudo crear el GTIN";
        res.status(400).json({ message });
    }
};

export const updateGtin = async (req: Request<{ id: string }, unknown, GtinBody>, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            res.status(400).json({ message: "El id no es valido" });
            return;
        }

        const gtin = await GtinModel.findById(id);

        if (!gtin) {
            res.status(404).json({ message: "GTIN no encontrado" });
            return;
        }

        const nextValue = hasOwn(req.body, "value")
            ? normalizeGtinValue(req.body.value, true)
            : gtin.value;
        const nextIsActive = hasOwn(req.body, "isActive")
            ? normalizeOptionalBoolean(req.body.isActive)
            : gtin.isActive;

        if (hasOwn(req.body, "isActive") && typeof nextIsActive !== "boolean") {
            throw new Error("El campo isActive no es valido");
        }

        if (!nextValue) {
            throw new Error("El campo value es obligatorio");
        }

        if (nextIsActive === false) {
            const isInUse = await hasActivePartConfigsUsingGtin(gtin.value);

            if (isInUse) {
                res.status(409).json({ message: "No se puede desactivar el GTIN porque esta en uso" });
                return;
            }
        }

        const previousValue = gtin.value;
        gtin.value = nextValue;

        if (typeof nextIsActive === "boolean") {
            gtin.isActive = nextIsActive;
        }

        await gtin.save();
        await syncPartConfigsExpectedGtin(previousValue, gtin.value);

        res.json({
            message: "GTIN actualizado",
            data: gtin,
        });
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            res.status(409).json({ message: "El GTIN ya existe" });
            return;
        }

        const message = error instanceof Error ? error.message : "No se pudo actualizar el GTIN";
        res.status(400).json({ message });
    }
};

export const deleteGtin = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        res.status(400).json({ message: "El id no es valido" });
        return;
    }

    const gtin = await GtinModel.findById(id);

    if (!gtin) {
        res.status(404).json({ message: "GTIN no encontrado" });
        return;
    }

    const isInUse = await hasActivePartConfigsUsingGtin(gtin.value);

    if (isInUse) {
        res.status(409).json({ message: "No se puede desactivar el GTIN porque esta en uso" });
        return;
    }

    gtin.isActive = false;
    await gtin.save();

    res.json({
        message: "GTIN desactivado",
        data: gtin,
    });
};
