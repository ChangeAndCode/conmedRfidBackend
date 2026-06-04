import { ReadingMode } from "../../models/partConfig";

export type LegacyRfidPartMappingInput = {
    backendPartNumber: string;
    legacyRfidPartNumber?: string | undefined;
    partConfigId?: string | undefined;
    readingMode?: ReadingMode | undefined;
    usesLegacyRfidPayload: boolean;
};

export type ResolvedLegacyRfidPartMapping = {
    backendPartNumber: string;
    legacyRfidPartNumber: string;
    partConfigId?: string | undefined;
    readingMode?: ReadingMode | undefined;
    usesLegacyRfidPayload: true;
};

export const resolveLegacyRfidPartMapping = (
    input: LegacyRfidPartMappingInput
): ResolvedLegacyRfidPartMapping => {
    if (!input.usesLegacyRfidPayload) {
        throw new Error("El numero de parte no esta habilitado para payload RFID legado");
    }

    const legacyRfidPartNumber = input.legacyRfidPartNumber?.trim();

    if (!legacyRfidPartNumber) {
        throw new Error("El numero de parte no tiene legacyRfidPartNumber configurado");
    }

    return {
        backendPartNumber: input.backendPartNumber,
        legacyRfidPartNumber,
        partConfigId: input.partConfigId,
        readingMode: input.readingMode,
        usesLegacyRfidPayload: true,
    };
};
