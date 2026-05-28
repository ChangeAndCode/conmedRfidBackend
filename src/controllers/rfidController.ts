import { Request, Response } from "express";
import { buildLegacyTagPayload } from "../services/rfid/legacyTagCodec";
import { resolveLegacyRfidPartMappingByBackendPartNumber } from "../services/partConfigService";
import { normalizeOptionalText, normalizeRequiredText } from "../utils/requestNormalization";

type BuildLegacyTagPayloadBody = {
    dateCode?: unknown;
    legacyRfidPartNumber?: unknown;
    lot?: unknown;
    lotNo?: unknown;
    manufactureDate?: unknown;
    partNo?: unknown;
    partNumber?: unknown;
    tagId?: unknown;
};

const normalizeLegacyLotBodyValue = (value: unknown): string => {
    if (typeof value === "number") {
        if (!Number.isInteger(value) || value < 0) {
            throw new Error("El campo lot debe ser un entero no negativo");
        }

        return value.toString();
    }

    return normalizeRequiredText(value, "lot");
};

export const buildLegacyTagPayloadHandler = async (
    req: Request<unknown, unknown, BuildLegacyTagPayloadBody>,
    res: Response
): Promise<void> => {
    try {
        const backendPartNumber = normalizeRequiredText(req.body.partNumber ?? req.body.partNo, "partNumber");
        const explicitLegacyRfidPartNumber = normalizeOptionalText(req.body.legacyRfidPartNumber);
        const lot = normalizeLegacyLotBodyValue(req.body.lot ?? req.body.lotNo);
        const dateCode = normalizeOptionalText(req.body.dateCode);
        const manufactureDate = normalizeOptionalText(req.body.manufactureDate);

        if (!dateCode && !manufactureDate) {
            throw new Error("El campo dateCode o manufactureDate es obligatorio");
        }

        const legacyPartMapping = explicitLegacyRfidPartNumber
            ? {
                backendPartNumber,
                legacyRfidPartNumber: explicitLegacyRfidPartNumber,
                usesLegacyRfidPayload: true as const,
            }
            : await resolveLegacyRfidPartMappingByBackendPartNumber(backendPartNumber);

        const payload = buildLegacyTagPayload({
            partNumber: legacyPartMapping.legacyRfidPartNumber,
            lot,
            dateCode,
            manufactureDate,
            tagId: normalizeRequiredText(req.body.tagId, "tagId"),
        });

        res.json({
            message: "Payload RFID legado construido correctamente",
            data: {
                ...payload,
                backendPartNumber,
                legacyPartMapping,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo construir el payload RFID legado";
        res.status(400).json({ message });
    }
};
