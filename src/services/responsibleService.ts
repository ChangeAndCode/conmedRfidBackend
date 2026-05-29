import { Responsible, ResponsibleModel } from "../models/responsible";

export type ResponsibleInput = {
    name: string;
    area: "manufactura" | "calidad";
};

const responsibleNamePattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'. -]+$/u;

const normalizeResponsibleName = (value: string): string => {
    const normalized = value.trim().replace(/\s+/g, " ");

    if (normalized.length < 3) {
        throw new Error("El nombre debe tener al menos 3 caracteres");
    }

    if (normalized.length > 120) {
        throw new Error("El nombre no puede exceder 120 caracteres");
    }

    if (!responsibleNamePattern.test(normalized)) {
        throw new Error("El nombre contiene caracteres inválidos");
    }

    return normalized;
};

export const getResponsibles = async (): Promise<Responsible[]> => {
    return ResponsibleModel.find().sort({ createdAt: -1 });
};

export const createResponsible = async (
    input: ResponsibleInput
): Promise<Responsible> => {
    const responsible = await ResponsibleModel.create({
        name: normalizeResponsibleName(input.name),
        area: input.area,
        isActive: true,
    });

    return responsible;
};

export const updateResponsible = async (
    id: string,
    input: ResponsibleInput
): Promise<Responsible> => {
    const responsible = await ResponsibleModel.findByIdAndUpdate(
        id,
        {
            $set: {
                name: normalizeResponsibleName(input.name),
                area: input.area,
            },
        },
        {
            new: true,
            runValidators: true,
        }
    );

    if (!responsible) {
        throw new Error("Responsable no encontrado");
    }

    return responsible;
};

export const toggleResponsibleStatus = async (
    id: string
): Promise<Responsible> => {
    const responsible = await ResponsibleModel.findById(id);

    if (!responsible) {
        throw new Error("Responsable no encontrado");
    }

    responsible.isActive = !responsible.isActive;

    await responsible.save();

    return responsible;
};

export const deleteResponsible = async (id: string): Promise<void> => {
    const responsible = await ResponsibleModel.findByIdAndDelete(id);

    if (!responsible) {
        throw new Error("Responsable no encontrado");
    }
};