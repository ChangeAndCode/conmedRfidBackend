import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { RfidProgramModel } from "../models/rfidProgram";
import {
    hasActivePartConfigsUsingRfidProgram,
    listRfidPrograms,
    syncPartConfigsRfidProgram,
} from "../services/rfidProgramService";
import { rfidProgramMaxLength } from "../utils/catalogValidation";
import { normalizeOptionalBoolean, normalizeOptionalText, normalizeRequiredText } from "../utils/requestNormalization";

type RfidProgramBody = {
    value?: unknown;
    isActive?: unknown;
};

const hasOwn = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

const isDuplicateKeyError = (error: unknown): boolean => {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
};

const normalizeRfidProgramValue = (value: unknown, required = false): string | undefined => {
    const normalized = required ? normalizeRequiredText(value, "value") : normalizeOptionalText(value);

    if (!normalized) {
        return undefined;
    }

    const uppercased = normalized.toUpperCase();

    if (uppercased.length > rfidProgramMaxLength) {
        throw new Error(`El RFID program no debe exceder ${rfidProgramMaxLength} caracteres`);
    }

    return uppercased;
};

export const listRfidProgramsHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const value = normalizeRfidProgramValue(req.query.value);
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

        const rfidPrograms = await listRfidPrograms(filters);

        res.json({
            count: rfidPrograms.length,
            data: rfidPrograms,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudieron listar los RFID programs";
        res.status(400).json({ message });
    }
};

export const getRfidProgramById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        res.status(400).json({ message: "El id no es valido" });
        return;
    }

    const rfidProgram = await RfidProgramModel.findById(id);

    if (!rfidProgram) {
        res.status(404).json({ message: "RFID program no encontrado" });
        return;
    }

    res.json({ data: rfidProgram });
};

export const createRfidProgram = async (
    req: Request<unknown, unknown, RfidProgramBody>,
    res: Response
): Promise<void> => {
    try {
        const rfidProgram = await RfidProgramModel.create({
            value: normalizeRfidProgramValue(req.body.value, true) as string,
            isActive: normalizeOptionalBoolean(req.body.isActive) ?? true,
        });

        res.status(201).json({
            message: "RFID program creado",
            data: rfidProgram,
        });
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            res.status(409).json({ message: "El RFID program ya existe" });
            return;
        }

        const message = error instanceof Error ? error.message : "No se pudo crear el RFID program";
        res.status(400).json({ message });
    }
};

export const updateRfidProgram = async (
    req: Request<{ id: string }, unknown, RfidProgramBody>,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            res.status(400).json({ message: "El id no es valido" });
            return;
        }

        const rfidProgram = await RfidProgramModel.findById(id);

        if (!rfidProgram) {
            res.status(404).json({ message: "RFID program no encontrado" });
            return;
        }

        const nextValue = hasOwn(req.body, "value")
            ? normalizeRfidProgramValue(req.body.value, true)
            : rfidProgram.value;
        const nextIsActive = hasOwn(req.body, "isActive")
            ? normalizeOptionalBoolean(req.body.isActive)
            : rfidProgram.isActive;

        if (hasOwn(req.body, "isActive") && typeof nextIsActive !== "boolean") {
            throw new Error("El campo isActive no es valido");
        }

        if (!nextValue) {
            throw new Error("El campo value es obligatorio");
        }

        if (nextIsActive === false) {
            const isInUse = await hasActivePartConfigsUsingRfidProgram(rfidProgram.value);

            if (isInUse) {
                res.status(409).json({ message: "No se puede desactivar el RFID program porque esta en uso" });
                return;
            }
        }

        const previousValue = rfidProgram.value;
        rfidProgram.value = nextValue;

        if (typeof nextIsActive === "boolean") {
            rfidProgram.isActive = nextIsActive;
        }

        await rfidProgram.save();
        await syncPartConfigsRfidProgram(previousValue, rfidProgram.value);

        res.json({
            message: "RFID program actualizado",
            data: rfidProgram,
        });
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            res.status(409).json({ message: "El RFID program ya existe" });
            return;
        }

        const message = error instanceof Error ? error.message : "No se pudo actualizar el RFID program";
        res.status(400).json({ message });
    }
};

export const deleteRfidProgram = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        res.status(400).json({ message: "El id no es valido" });
        return;
    }

    const rfidProgram = await RfidProgramModel.findById(id);

    if (!rfidProgram) {
        res.status(404).json({ message: "RFID program no encontrado" });
        return;
    }

    const isInUse = await hasActivePartConfigsUsingRfidProgram(rfidProgram.value);

    if (isInUse) {
        res.status(409).json({ message: "No se puede desactivar el RFID program porque esta en uso" });
        return;
    }

    rfidProgram.isActive = false;
    await rfidProgram.save();

    res.json({
        message: "RFID program desactivado",
        data: rfidProgram,
    });
};
