const GROUP_SEPARATOR = String.fromCharCode(29);

export interface DoubleScanValidationConfig {
    expectedGtin: string;
    expectedLotLength: number;
}

export interface SingleScanValidationConfig {
    expectedGtin?: string;
    expectedLotLength?: number;
}

type ParsedGs1Fields = {
    ai01?: string;
    ai10?: string;
    ai11?: string;
    ai241?: string;
};

type ParseGs1BarcodeOptions = {
    expectedLotLength?: number;
};

export interface ParsedGs1Barcode {
    raw: string;
    normalizedRaw: string;
    fields: ParsedGs1Fields;
}

export interface DoubleScanParseResult {
    firstBarcodeRaw: string;
    secondBarcodeRaw: string;
    firstScanFields: ParsedGs1Fields;
    secondScanFields: ParsedGs1Fields;
    gtin: string;
    lot: string;
    manufactureDate: string;
    rulesApplied: string[];
}

export interface FirstScanParseResult {
    firstBarcodeRaw: string;
    firstScanFields: ParsedGs1Fields;
    gtin: string;
}

export interface SingleScanParseResult {
    rawScan: string;
    scanFields: ParsedGs1Fields;
    gtin: string;
    lot: string;
    manufactureDate: string;
    rulesApplied: string[];
}

export interface DoubleScanVerificationParseResult {
    firstBarcodeRaw: string;
    secondBarcodeRaw: string;
    firstScanFields: ParsedGs1Fields;
    secondScanFields: ParsedGs1Fields;
    gtin: string;
    lot: string;
    manufactureDate: string;
    rulesApplied: string[];
}

const normalizeScanValue = (raw: string): string => {
    return raw.replace(/[\r\n\t]/g, "").trim();
};

const resolveVariableLengthField = (
    normalizedRaw: string,
    valueStart: number,
    options: ParseGs1BarcodeOptions = {}
): { value: string; nextCursor: number } => {
    const separatorIndex = normalizedRaw.indexOf(GROUP_SEPARATOR, valueStart);

    if (separatorIndex !== -1) {
        return {
            value: normalizedRaw.slice(valueStart, separatorIndex),
            nextCursor: separatorIndex + 1,
        };
    }

    if (options.expectedLotLength) {
        const lotEnd = valueStart + options.expectedLotLength;
        return {
            value: normalizedRaw.slice(valueStart, lotEnd),
            nextCursor: lotEnd,
        };
    }

    const nextAi241Index = normalizedRaw.indexOf("241", valueStart + 1);

    if (nextAi241Index !== -1) {
        return {
            value: normalizedRaw.slice(valueStart, nextAi241Index),
            nextCursor: nextAi241Index,
        };
    }

    return {
        value: normalizedRaw.slice(valueStart),
        nextCursor: normalizedRaw.length,
    };
};

const parseGs1Barcode = (raw: string, options: ParseGs1BarcodeOptions = {}): ParsedGs1Barcode => {
    const normalizedRaw = normalizeScanValue(raw);
    const fields: ParsedGs1Fields = {};
    let cursor = 0;

    while (cursor < normalizedRaw.length) {
        if (normalizedRaw[cursor] === GROUP_SEPARATOR) {
            cursor += 1;
            continue;
        }

        const ai3 = normalizedRaw.slice(cursor, cursor + 3);

        if (ai3 === "241") {
            const valueStart = cursor + 3;
            const separatorIndex = normalizedRaw.indexOf(GROUP_SEPARATOR, valueStart);
            const value = separatorIndex === -1
                ? normalizedRaw.slice(valueStart)
                : normalizedRaw.slice(valueStart, separatorIndex);

            if (!value) {
                throw new Error("El codigo GS1 no contiene un identificador valido en AI 241");
            }

            fields.ai241 = value;
            cursor = separatorIndex === -1 ? normalizedRaw.length : separatorIndex + 1;
            continue;
        }

        const ai = normalizedRaw.slice(cursor, cursor + 2);

        if (ai === "01") {
            const value = normalizedRaw.slice(cursor + 2, cursor + 16);

            if (value.length !== 14) {
                throw new Error("El codigo GS1 no contiene un GTIN valido en AI 01");
            }

            fields.ai01 = value;
            cursor += 16;
            continue;
        }

        if (ai === "11") {
            const value = normalizedRaw.slice(cursor + 2, cursor + 8);

            if (value.length !== 6) {
                throw new Error("El codigo GS1 no contiene una fecha valida en AI 11");
            }

            fields.ai11 = value;
            cursor += 8;
            continue;
        }

        if (ai === "10") {
            const lotStart = cursor + 2;
            const resolvedLot = resolveVariableLengthField(normalizedRaw, lotStart, options);
            const value = resolvedLot.value;

            if (!value) {
                throw new Error("El codigo GS1 no contiene un lote valido en AI 10");
            }

            fields.ai10 = value;
            cursor = resolvedLot.nextCursor;
            continue;
        }

        throw new Error(`AI GS1 no soportado: ${ai}`);
    }

    return {
        raw,
        normalizedRaw,
        fields,
    };
};

export const parseFirstScanBarcode = (firstBarcodeRaw: string): FirstScanParseResult => {
    const firstScan = parseGs1Barcode(firstBarcodeRaw);

    if (!firstScan.fields.ai01) {
        throw new Error("La primera lectura no contiene GTIN en AI 01");
    }

    return {
        firstBarcodeRaw: firstScan.normalizedRaw,
        firstScanFields: firstScan.fields,
        gtin: firstScan.fields.ai01,
    };
};

export const parseDoubleScanReading = (
    partConfig: DoubleScanValidationConfig,
    firstBarcodeRaw: string,
    secondBarcodeRaw: string
): DoubleScanParseResult => {
    const resolvedFirstScan = parseFirstScanBarcode(firstBarcodeRaw);
    const secondScan = parseGs1Barcode(secondBarcodeRaw, partConfig.expectedLotLength
        ? { expectedLotLength: partConfig.expectedLotLength }
        : {});

    if (resolvedFirstScan.gtin !== partConfig.expectedGtin) {
        throw new Error("La primera lectura no coincide con el GTIN esperado para el numero de parte");
    }

    if (!secondScan.fields.ai11) {
        throw new Error("La segunda lectura no contiene fecha de manufactura en AI 11");
    }

    if (!secondScan.fields.ai10) {
        throw new Error("La segunda lectura no contiene lote en AI 10");
    }

    const rulesApplied: string[] = [
        "first_scan_ai01_gtin",
        "second_scan_ai11_manufacture_date",
        "second_scan_ai10_lot",
    ];

    const lot = secondScan.fields.ai10;

    if (lot.length !== partConfig.expectedLotLength) {
        throw new Error(
            `El lote obtenido no cumple la longitud esperada de ${partConfig.expectedLotLength} caracteres`
        );
    }

    return {
        firstBarcodeRaw: resolvedFirstScan.firstBarcodeRaw,
        secondBarcodeRaw: secondScan.normalizedRaw,
        firstScanFields: resolvedFirstScan.firstScanFields,
        secondScanFields: secondScan.fields,
        gtin: resolvedFirstScan.gtin,
        lot,
        manufactureDate: secondScan.fields.ai11,
        rulesApplied,
    };
};

export const parseDoubleScanVerificationReading = (
    firstBarcodeRaw: string,
    secondBarcodeRaw: string
): DoubleScanVerificationParseResult => {
    const resolvedFirstScan = parseFirstScanBarcode(firstBarcodeRaw);
    const secondScan = parseGs1Barcode(secondBarcodeRaw);

    if (!secondScan.fields.ai11) {
        throw new Error("La segunda lectura no contiene fecha de manufactura en AI 11");
    }

    if (!secondScan.fields.ai10) {
        throw new Error("La segunda lectura no contiene lote en AI 10");
    }

    return {
        firstBarcodeRaw: resolvedFirstScan.firstBarcodeRaw,
        secondBarcodeRaw: secondScan.normalizedRaw,
        firstScanFields: resolvedFirstScan.firstScanFields,
        secondScanFields: secondScan.fields,
        gtin: resolvedFirstScan.gtin,
        lot: secondScan.fields.ai10,
        manufactureDate: secondScan.fields.ai11,
        rulesApplied: [
            "first_scan_ai01_gtin",
            "second_scan_ai11_manufacture_date",
            "second_scan_ai10_lot",
        ],
    };
};

export const parseSingleScanReading = (
    rawScan: string,
    validationConfig: SingleScanValidationConfig = {}
): SingleScanParseResult => {
    const scan = parseGs1Barcode(rawScan, validationConfig.expectedLotLength
        ? { expectedLotLength: validationConfig.expectedLotLength }
        : {});

    if (!scan.fields.ai01) {
        throw new Error("La lectura single scan no contiene GTIN en AI 01");
    }

    if (!scan.fields.ai11) {
        throw new Error("La lectura single scan no contiene fecha de manufactura en AI 11");
    }

    if (!scan.fields.ai10) {
        throw new Error("La lectura single scan no contiene lote en AI 10");
    }

    if (validationConfig.expectedGtin && scan.fields.ai01 !== validationConfig.expectedGtin) {
        throw new Error("La lectura single scan no coincide con el GTIN esperado para el numero de parte");
    }

    if (
        validationConfig.expectedLotLength
        && scan.fields.ai10.length !== validationConfig.expectedLotLength
    ) {
        throw new Error(
            `El lote obtenido no cumple la longitud esperada de ${validationConfig.expectedLotLength} caracteres`
        );
    }

    return {
        rawScan: scan.normalizedRaw,
        scanFields: scan.fields,
        gtin: scan.fields.ai01,
        lot: scan.fields.ai10,
        manufactureDate: scan.fields.ai11,
        rulesApplied: [
            "single_scan_ai01_gtin",
            "single_scan_ai11_manufacture_date",
            "single_scan_ai10_lot",
        ],
    };
};
