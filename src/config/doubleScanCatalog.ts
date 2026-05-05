export interface DoubleScanPartConfig {
    partNumber: string;
    rfidProgram: string;
    expectedGtin: string;
    filterLabel?: string;
    expectedLotLength: number;
    lotTrimRight?: number;
    notes?: string;
}

export const doubleScanPartCatalog: DoubleScanPartConfig[] = [
    {
        partNumber: "VSXLLM01",
        rfidProgram: "VSXLL01",
        expectedGtin: "00851136001566",
        filterLabel: "902227",
        expectedLotLength: 9,
        notes: "Requiere dos codigos de barras",
    },
    {
        partNumber: "VSXLLM02",
        rfidProgram: "VSXLL01",
        expectedGtin: "00851136001566",
        filterLabel: "902227",
        expectedLotLength: 9,
        notes: "Requiere dos codigos de barras",
    },
    {
        partNumber: "SEA3700",
        rfidProgram: "VL-25",
        expectedGtin: "10884524001425",
        filterLabel: "P000027957",
        expectedLotLength: 9,
        lotTrimRight: 4,
        notes: "Requiere dos codigos de barras y recorta 4 digitos del lote",
    },
];

export const getDoubleScanPartConfig = (partNumber: string): DoubleScanPartConfig | undefined => {
    return doubleScanPartCatalog.find((item) => item.partNumber === partNumber.toUpperCase());
};
