import { Request, Response } from "express";
import { buildLegacyTagPayload, BuiltLegacyTagPayload } from "../services/rfid/legacyTagCodec";
import { resolveLegacyRfidPartMappingByBackendPartNumber } from "../services/partConfigService";
import { ResolvedLegacyRfidPartMapping } from "../services/rfid/legacyTagMapping";
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

type BuildLegacyTagPayloadQuery = {
    debug?: unknown;
    verbose?: unknown;
};

type BuildLegacyTagPayloadResponseData = {
    authCode: string;
    backendPartNumber: string;
    dateCode: string;
    details?: {
        decoded: BuiltLegacyTagPayload["decoded"];
        initialLifeMinutes: number;
        remainingLifeMinutes: number;
    };
    legacyPartMapping: ResolvedLegacyRfidPartMapping;
    lot: string;
    partNumber: string;
    payloadHex: string;
    tagByteLength: number;
    tagId: string;
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

const isEnabledQueryFlag = (value: unknown): boolean => {
    if (Array.isArray(value)) {
        return value.some((item) => isEnabledQueryFlag(item));
    }

    if (typeof value !== "string") {
        return false;
    }

    const normalized = value.trim().toLowerCase();

    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
};

export const buildLegacyTagPayloadResponseData = (
    payload: BuiltLegacyTagPayload,
    backendPartNumber: string,
    legacyPartMapping: ResolvedLegacyRfidPartMapping,
    includeDetails: boolean
): BuildLegacyTagPayloadResponseData => {
    const responseData: BuildLegacyTagPayloadResponseData = {
        authCode: payload.authCode,
        backendPartNumber,
        dateCode: payload.dateCode,
        legacyPartMapping,
        lot: payload.lot,
        partNumber: payload.partNumber,
        payloadHex: payload.payloadHex,
        tagByteLength: payload.tagByteLength,
        tagId: payload.tagId,
    };

    if (includeDetails) {
        responseData.details = {
            decoded: payload.decoded,
            initialLifeMinutes: payload.initialLifeMinutes,
            remainingLifeMinutes: payload.remainingLifeMinutes,
        };
    }

    return responseData;
};

export const buildLegacyTagPayloadHandler = async (
    req: Request<unknown, unknown, BuildLegacyTagPayloadBody, BuildLegacyTagPayloadQuery>,
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
        const includeDetails = isEnabledQueryFlag(req.query.verbose) || isEnabledQueryFlag(req.query.debug);

        res.json({
            message: "Payload RFID legado construido correctamente",
            data: buildLegacyTagPayloadResponseData(payload, backendPartNumber, legacyPartMapping, includeDetails),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo construir el payload RFID legado";
        res.status(400).json({ message });
    }
};
