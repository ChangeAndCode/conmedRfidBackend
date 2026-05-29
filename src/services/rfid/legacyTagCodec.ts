import {
    legacyTagDefaultFilterReset,
    legacyTagDefaultHexByte,
    legacyTagFieldDefinitions,
    LegacyTagFieldName,
    legacyTagTotalBytes,
    legacyTagTotalHexLength,
} from "./legacyTagLayout";
import { applyLegacyAuthCodeAdjustments, getLegacyTagLifeConfig, resolveLegacyPartNumberKey } from "./legacyTagRules";

export type BuildLegacyTagPayloadInput = {
    dateCode?: string | undefined;
    lot: bigint | number | string;
    manufactureDate?: string | undefined;
    partNumber: string;
    tagId: string;
};

type LegacyTagHexFields = {
    authCode: string;
    dateCode: string;
    filterReset: string;
    initialLife: string;
    lot: string;
    partNumber: string;
    payloadHex: string;
    remainingLife1: string;
    remainingLife2: string;
    remainingLifeXor1: string;
    remainingLifeXor2: string;
    reserved: string;
};

export type DecodedLegacyTagPayload = {
    authCode: string;
    dateCode: string;
    dateCodeRaw: string;
    fields: LegacyTagHexFields;
    filterReset: string;
    filterResetRaw: string;
    initialLifeEncodedValue: number;
    initialLifeMinutes: number;
    legacyLifeMultiplier: 2 | 4;
    lot: string;
    partNumber: string;
    partNumberKey: string;
    partNumberRaw: string;
    payloadHex: string;
    remainingLife1EncodedValue: number;
    remainingLife1Minutes: number;
    remainingLife2EncodedValue: number;
    remainingLife2Minutes: number;
    remainingLifeXor1: string;
    remainingLifeXor2: string;
    reservedRaw: string;
    tagByteLength: number;
};

export type BuiltLegacyTagPayload = {
    authCode: string;
    dateCode: string;
    decoded: DecodedLegacyTagPayload;
    initialLifeMinutes: number;
    lot: string;
    partNumber: string;
    payloadHex: string;
    remainingLifeMinutes: number;
    tagByteLength: number;
    tagId: string;
};

const asciiPattern = /^[\x20-\x7E]+$/;
const hexPattern = /^[0-9A-F]+$/;
const numericPattern = /^\d+$/;

const buildEmptyPayloadHex = (): string => legacyTagDefaultHexByte.repeat(legacyTagTotalBytes);

const padHex = (value: string, length: number): string => value.padStart(length, "0").toUpperCase();

const normalizeHex = (
    value: string,
    fieldName: string,
    options: {
        allowCommonSeparators?: boolean;
    } = {}
): string => {
    const normalized = (options.allowCommonSeparators ? value.replace(/[\s:-]+/g, "") : value.replace(/\s+/g, ""))
        .toUpperCase();

    if (normalized.length === 0) {
        throw new Error(`El campo ${fieldName} es obligatorio`);
    }

    if (normalized.length % 2 !== 0 || !hexPattern.test(normalized)) {
        throw new Error(`El campo ${fieldName} debe ser una cadena hexadecimal valida`);
    }

    return normalized;
};

const normalizeAscii = (value: string, fieldName: string, maxLength: number): string => {
    const normalized = value.trim();

    if (normalized.length === 0) {
        throw new Error(`El campo ${fieldName} es obligatorio`);
    }

    if (!asciiPattern.test(normalized)) {
        throw new Error(`El campo ${fieldName} solo permite caracteres ASCII imprimibles`);
    }

    if (normalized.length > maxLength) {
        throw new Error(`El campo ${fieldName} no puede exceder ${maxLength} caracteres`);
    }

    return normalized;
};

const normalizeLegacyLot = (value: bigint | number | string): string => {
    let normalized: string;

    if (typeof value === "bigint") {
        normalized = value.toString();
    } else if (typeof value === "number") {
        if (!Number.isInteger(value) || value < 0) {
            throw new Error("El campo lot debe ser un entero no negativo");
        }

        normalized = value.toString();
    } else if (typeof value === "string") {
        normalized = value.trim();
    } else {
        throw new Error("El campo lot es obligatorio");
    }

    if (!numericPattern.test(normalized)) {
        throw new Error("El campo lot debe contener solo digitos para el layout RFID legado");
    }

    const lotValue = BigInt(normalized);
    const maxLegacyLotValue = BigInt("0xFFFFFFFFFFFFFFFF");

    if (lotValue > maxLegacyLotValue) {
        throw new Error("El campo lot excede la capacidad de 8 bytes del layout RFID legado");
    }

    return lotValue.toString();
};

const encodeAsciiToHex = (value: string): string => {
    return Array.from(value, (character) => character.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase())
        .join("");
};

const decodeAsciiFromHex = (value: string): string => {
    let decoded = "";

    for (let index = 0; index < value.length; index += 2) {
        decoded += String.fromCharCode(parseInt(value.slice(index, index + 2), 16));
    }

    return decoded;
};

const encodeMirroredWord = (value: number): string => {
    const hexValue = padHex(value.toString(16), 4);
    return `${hexValue.slice(2)}${hexValue.slice(0, 2)}`;
};

const decodeMirroredWord = (value: string): number => {
    return parseInt(`${value.slice(2)}${value.slice(0, 2)}`, 16);
};

const encodeRemainingLifeXor = (mirroredWordHex: string): string => {
    return padHex((parseInt(mirroredWordHex, 16) ^ 0xFFFF).toString(16), 4);
};

const replaceFieldHex = (payloadHex: string, fieldName: LegacyTagFieldName, fieldHex: string): string => {
    const field = legacyTagFieldDefinitions[fieldName];
    const normalizedHex = fieldHex.toUpperCase();

    if (normalizedHex.length > field.hexLength) {
        throw new Error(`El campo ${fieldName} excede la longitud permitida en el layout RFID legado`);
    }

    return [
        payloadHex.slice(0, field.hexStart),
        normalizedHex,
        payloadHex.slice(field.hexStart + normalizedHex.length),
    ].join("");
};

const getFieldHex = (payloadHex: string, fieldName: LegacyTagFieldName): string => {
    const field = legacyTagFieldDefinitions[fieldName];
    return payloadHex.slice(field.hexStart, field.hexStart + field.hexLength);
};

const getDecodedLifeMultiplier = (partNumber: string): 2 | 4 => {
    return resolveLegacyPartNumberKey(partNumber) === "STRYKEVAC" ? 4 : 2;
};

export const calculateLegacyAuthCode = (partNumber: string, tagId: string): string => {
    const normalizedPartNumber = normalizeAscii(partNumber, "partNumber", legacyTagFieldDefinitions.partNumber.byteLength);
    const normalizedTagId = normalizeHex(tagId, "tagId", { allowCommonSeparators: true });
    const tempValue = `${normalizedTagId}0000`;
    let crcValue = 65535;

    for (let index = tempValue.length; index > 0; index -= 2) {
        const currentByte = parseInt(tempValue.slice(index - 2, index), 16);
        crcValue = currentByte ^ crcValue;

        for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) {
            if (crcValue & 1) {
                crcValue = (crcValue & 65534) >>> 1;
                crcValue ^= 33800;
            } else {
                crcValue = (crcValue & 65534) >>> 1;
            }
        }
    }

    crcValue ^= 251;

    for (let index = 0; index < 3; index += 1) {
        if (crcValue & 1) {
            crcValue = (crcValue & 65534) >>> 1;
            crcValue ^= 33800;
        } else {
            crcValue = (crcValue & 65534) >>> 1;
        }
    }

    crcValue = applyLegacyAuthCodeAdjustments(crcValue, normalizedPartNumber);

    return padHex(crcValue.toString(16), legacyTagFieldDefinitions.authCode.hexLength);
};

export const decodeLegacyTagPayload = (payloadHex: string): DecodedLegacyTagPayload => {
    const normalizedPayload = normalizeHex(payloadHex, "payloadHex");

    if (normalizedPayload.length !== legacyTagTotalHexLength) {
        throw new Error(`El payload RFID legado debe contener exactamente ${legacyTagTotalHexLength} caracteres hexadecimales`);
    }

    const authCode = getFieldHex(normalizedPayload, "authCode");
    const initialLifeHex = getFieldHex(normalizedPayload, "initialLife");
    const remainingLife1Hex = getFieldHex(normalizedPayload, "remainingLife1");
    const remainingLifeXor1 = getFieldHex(normalizedPayload, "remainingLifeXor1");
    const remainingLife2Hex = getFieldHex(normalizedPayload, "remainingLife2");
    const remainingLifeXor2 = getFieldHex(normalizedPayload, "remainingLifeXor2");
    const partNumberRaw = decodeAsciiFromHex(getFieldHex(normalizedPayload, "partNumber"));
    const partNumber = partNumberRaw.trimEnd();
    const lotHex = getFieldHex(normalizedPayload, "lot");
    const dateCodeRaw = decodeAsciiFromHex(getFieldHex(normalizedPayload, "dateCode"));
    const dateCode = dateCodeRaw.trimEnd();
    const reservedRaw = decodeAsciiFromHex(getFieldHex(normalizedPayload, "reserved"));
    const filterResetRaw = decodeAsciiFromHex(getFieldHex(normalizedPayload, "filterReset"));
    const filterReset = filterResetRaw.trimEnd();
    const lifeMultiplier = getDecodedLifeMultiplier(partNumber);
    const initialLifeEncodedValue = decodeMirroredWord(initialLifeHex);
    const remainingLife1EncodedValue = decodeMirroredWord(remainingLife1Hex);
    const remainingLife2EncodedValue = decodeMirroredWord(remainingLife2Hex);

    return {
        authCode,
        dateCode,
        dateCodeRaw,
        fields: {
            authCode,
            dateCode: getFieldHex(normalizedPayload, "dateCode"),
            filterReset: getFieldHex(normalizedPayload, "filterReset"),
            initialLife: initialLifeHex,
            lot: lotHex,
            partNumber: getFieldHex(normalizedPayload, "partNumber"),
            payloadHex: normalizedPayload,
            remainingLife1: remainingLife1Hex,
            remainingLife2: remainingLife2Hex,
            remainingLifeXor1,
            remainingLifeXor2,
            reserved: getFieldHex(normalizedPayload, "reserved"),
        },
        filterReset,
        filterResetRaw,
        initialLifeEncodedValue,
        initialLifeMinutes: initialLifeEncodedValue / lifeMultiplier,
        legacyLifeMultiplier: lifeMultiplier,
        lot: BigInt(`0x${lotHex}`).toString(10),
        partNumber,
        partNumberKey: resolveLegacyPartNumberKey(partNumber),
        partNumberRaw,
        payloadHex: normalizedPayload,
        remainingLife1EncodedValue,
        remainingLife1Minutes: remainingLife1EncodedValue / lifeMultiplier,
        remainingLife2EncodedValue,
        remainingLife2Minutes: remainingLife2EncodedValue / lifeMultiplier,
        remainingLifeXor1,
        remainingLifeXor2,
        reservedRaw,
        tagByteLength: legacyTagTotalBytes,
    };
};

export const buildLegacyTagPayload = (input: BuildLegacyTagPayloadInput): BuiltLegacyTagPayload => {
    const partNumber = normalizeAscii(
        input.partNumber,
        "partNumber",
        legacyTagFieldDefinitions.partNumber.byteLength
    );
    const lot = normalizeLegacyLot(input.lot);
    const dateCodeInput = input.dateCode ?? input.manufactureDate;

    if (!dateCodeInput) {
        throw new Error("El campo dateCode o manufactureDate es obligatorio");
    }

    const dateCode = normalizeAscii(
        dateCodeInput,
        "dateCode",
        legacyTagFieldDefinitions.dateCode.byteLength
    );
    const tagId = normalizeHex(input.tagId, "tagId", { allowCommonSeparators: true });
    const authCode = calculateLegacyAuthCode(partNumber, tagId);
    const lifeConfig = getLegacyTagLifeConfig(partNumber);
    const initialLifeEncodedValue = lifeConfig.initialLifeMinutes * lifeConfig.multiplier;
    const remainingLifeEncodedValue = lifeConfig.remainingLifeMinutes * lifeConfig.multiplier;
    const initialLifeHex = encodeMirroredWord(initialLifeEncodedValue);
    const remainingLifeHex = encodeMirroredWord(remainingLifeEncodedValue);
    const remainingLifeXorHex = encodeRemainingLifeXor(remainingLifeHex);
    const partNumberHex = encodeAsciiToHex(partNumber);
    const lotHex = padHex(BigInt(lot).toString(16), legacyTagFieldDefinitions.lot.hexLength);
    const dateCodeHex = encodeAsciiToHex(dateCode);
    const filterResetHex = encodeAsciiToHex(legacyTagDefaultFilterReset);

    let payloadHex = buildEmptyPayloadHex();
    payloadHex = replaceFieldHex(payloadHex, "authCode", authCode);
    payloadHex = replaceFieldHex(payloadHex, "initialLife", initialLifeHex);
    payloadHex = replaceFieldHex(payloadHex, "remainingLife1", remainingLifeHex);
    payloadHex = replaceFieldHex(payloadHex, "remainingLifeXor1", remainingLifeXorHex);
    payloadHex = replaceFieldHex(payloadHex, "remainingLife2", remainingLifeHex);
    payloadHex = replaceFieldHex(payloadHex, "remainingLifeXor2", remainingLifeXorHex);
    payloadHex = replaceFieldHex(payloadHex, "partNumber", partNumberHex);
    payloadHex = replaceFieldHex(payloadHex, "lot", lotHex);
    payloadHex = replaceFieldHex(payloadHex, "dateCode", dateCodeHex);
    payloadHex = replaceFieldHex(payloadHex, "filterReset", filterResetHex);

    const decoded = decodeLegacyTagPayload(payloadHex);

    return {
        authCode,
        dateCode,
        decoded,
        initialLifeMinutes: lifeConfig.initialLifeMinutes,
        lot,
        partNumber,
        payloadHex,
        remainingLifeMinutes: lifeConfig.remainingLifeMinutes,
        tagByteLength: legacyTagTotalBytes,
        tagId,
    };
};
