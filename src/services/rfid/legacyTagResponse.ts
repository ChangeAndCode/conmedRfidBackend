import { BuiltLegacyTagPayload } from "./legacyTagCodec";
import { ResolvedLegacyRfidPartMapping } from "./legacyTagMapping";

export type BuildLegacyTagPayloadResponseData = {
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
