import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import {
    createPrintInterruption,
    deletePrintInterruption,
    isPrintInterruptionAlreadyExistsError,
    isPrintInterruptionNotFoundError,
    listPrintInterruptions,
} from "../services/printInterruptionService";
import { normalizeRequiredText } from "../utils/requestNormalization";

type PrintInterruptionBody = {
    title?: unknown;
};

export const listPrintInterruptionsHandler = async (_req: Request, res: Response): Promise<void> => {
    const interruptions = await listPrintInterruptions();

    res.json({
        count: interruptions.length,
        data: interruptions,
    });
};

export const createPrintInterruptionHandler = async (
    req: Request<unknown, unknown, PrintInterruptionBody>,
    res: Response
): Promise<void> => {
    try {
        const printInterruption = await createPrintInterruption(
            normalizeRequiredText(req.body.title, "title")
        );

        res.status(201).json({
            message: "Interrupcion de impresion creada",
            data: printInterruption,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo crear la interrupcion de impresion";
        res.status(isPrintInterruptionAlreadyExistsError(error) ? 409 : 400).json({ message });
    }
};

export const deletePrintInterruptionHandler = async (
    req: Request<{ id: string }>,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            res.status(400).json({ message: "El id no es valido" });
            return;
        }

        const printInterruption = await deletePrintInterruption(id);

        res.json({
            message: "Interrupcion de impresion eliminada",
            data: printInterruption,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo eliminar la interrupcion de impresion";
        res.status(isPrintInterruptionNotFoundError(error) ? 404 : 400).json({ message });
    }
};
