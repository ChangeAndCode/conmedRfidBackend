import { PrintInterruption, PrintInterruptionModel } from "../models/printInterruption";

export const printInterruptionAlreadyExistsMessage = "Ya existe una interrupcion de impresion con ese titulo";
export const printInterruptionNotFoundMessage = "Interrupcion de impresion no encontrada";

const normalizePrintInterruptionTitle = (value: string): string => {
    const normalized = value.trim().replace(/\s+/g, " ");

    if (normalized.length < 3) {
        throw new Error("El campo title debe tener al menos 3 caracteres");
    }

    if (normalized.length > 160) {
        throw new Error("El campo title no puede exceder 160 caracteres");
    }

    return normalized;
};

const isDuplicateKeyError = (error: unknown): boolean => {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
};

export const isPrintInterruptionAlreadyExistsError = (error: unknown): boolean => {
    return error instanceof Error && error.message === printInterruptionAlreadyExistsMessage;
};

export const isPrintInterruptionNotFoundError = (error: unknown): boolean => {
    return error instanceof Error && error.message === printInterruptionNotFoundMessage;
};

export const listPrintInterruptions = async (): Promise<PrintInterruption[]> => {
    return PrintInterruptionModel.find().sort({ title: 1, createdAt: -1 });
};

export const getPrintInterruptionById = async (id: string): Promise<PrintInterruption | null> => {
    return PrintInterruptionModel.findById(id);
};

export const createPrintInterruption = async (title: string): Promise<PrintInterruption> => {
    try {
        return await PrintInterruptionModel.create({
            title: normalizePrintInterruptionTitle(title),
        });
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            throw new Error(printInterruptionAlreadyExistsMessage);
        }

        throw error;
    }
};

export const deletePrintInterruption = async (id: string): Promise<PrintInterruption> => {
    const printInterruption = await PrintInterruptionModel.findByIdAndDelete(id);

    if (!printInterruption) {
        throw new Error(printInterruptionNotFoundMessage);
    }

    return printInterruption;
};

export const getPrintInterruptionTitleSnapshot = async (id: string): Promise<string> => {
    const printInterruption = await getPrintInterruptionById(id);

    if (!printInterruption) {
        throw new Error("La interrupcion de impresion seleccionada no existe");
    }

    return printInterruption.title;
};
