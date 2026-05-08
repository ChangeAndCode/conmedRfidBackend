const GROUP_SEPARATOR = String.fromCharCode(29);

export interface DoubleScanValidationConfig {
    expectedGtin: string;
    expectedLotLength: number;
}

type ParsedGs1Fields = {
    ai01?: string;
    ai10?: string;
    ai11?: string;
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

const normalizeScanValue = (raw: string): string => {
    return raw.replace(/[\r\n\t]/g, "").trim();
};

const parseGs1Barcode = (raw: string): ParsedGs1Barcode => {
    const normalizedRaw = normalizeScanValue(raw);
    const fields: ParsedGs1Fields = {};
    let cursor = 0;

    while (cursor < normalizedRaw.length) {
        if (normalizedRaw[cursor] === GROUP_SEPARATOR) {
            cursor += 1;
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
            const separatorIndex = normalizedRaw.indexOf(GROUP_SEPARATOR, lotStart);
            const value = separatorIndex === -1
                ? normalizedRaw.slice(lotStart)
                : normalizedRaw.slice(lotStart, separatorIndex);

            if (!value) {
                throw new Error("El codigo GS1 no contiene un lote valido en AI 10");
            }

            fields.ai10 = value;
            cursor = separatorIndex === -1 ? normalizedRaw.length : separatorIndex + 1;
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
    const secondScan = parseGs1Barcode(secondBarcodeRaw);

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
