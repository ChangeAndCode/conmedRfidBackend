import { ReportResponsibles, ReportResponsiblesModel } from "../models/reportResponsibles";

export type ReportResponsiblesInput = {
    manufacturingRepresentativeName: string;
    qualityRepresentativeName: string;
};

const representativeNamePattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'. -]+$/u;

const normalizeRepresentativeNameValue = (value: string, fieldName: string): string => {
    const normalized = value.trim().replace(/\s+/g, " ");

    if (normalized.length < 3) {
        throw new Error(`El campo ${fieldName} debe tener al menos 3 caracteres`);
    }

    if (normalized.length > 120) {
        throw new Error(`El campo ${fieldName} no puede exceder 120 caracteres`);
    }

    if (!representativeNamePattern.test(normalized)) {
        throw new Error(`El campo ${fieldName} solo permite letras y separadores de nombre`);
    }

    return normalized;
};

export const validateRepresentativeName = (value: string, fieldName: string): string => {
    return normalizeRepresentativeNameValue(value, fieldName);
};

export const getReportResponsibles = async (): Promise<ReportResponsibles | null> => {
    return ReportResponsiblesModel.findOne({ singletonKey: "global" });
};

export const updateReportResponsibles = async (
    input: ReportResponsiblesInput
): Promise<ReportResponsibles> => {
    const manufacturingRepresentativeName = validateRepresentativeName(
        input.manufacturingRepresentativeName,
        "manufacturingRepresentativeName"
    );
    const qualityRepresentativeName = validateRepresentativeName(
        input.qualityRepresentativeName,
        "qualityRepresentativeName"
    );

    const settings = await ReportResponsiblesModel.findOneAndUpdate(
        { singletonKey: "global" },
        {
            $set: {
                manufacturingRepresentativeName,
                qualityRepresentativeName,
            },
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
            runValidators: true,
        }
    );

    if (!settings) {
        throw new Error("No se pudo guardar la configuracion de responsables");
    }

    return settings;
};

export const resolveVerificationReportRepresentativeNames = async (
    input: Partial<ReportResponsiblesInput>
): Promise<ReportResponsiblesInput> => {
    const configuredSettings = await getReportResponsibles();
    const manufacturingSource = input.manufacturingRepresentativeName
        ?? configuredSettings?.manufacturingRepresentativeName;
    const qualitySource = input.qualityRepresentativeName
        ?? configuredSettings?.qualityRepresentativeName;

    if (!manufacturingSource) {
        throw new Error("No hay responsable de manufactura configurado para generar el reporte");
    }

    if (!qualitySource) {
        throw new Error("No hay responsable de calidad configurado para generar el reporte");
    }

    return {
        manufacturingRepresentativeName: validateRepresentativeName(
            manufacturingSource,
            "manufacturingRepresentativeName"
        ),
        qualityRepresentativeName: validateRepresentativeName(
            qualitySource,
            "qualityRepresentativeName"
        ),
    };
};
