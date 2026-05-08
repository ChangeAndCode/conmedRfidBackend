import { PartConfig } from "../models/partConfig";

type SeedPartConfig = Omit<PartConfig, "createdAt" | "updatedAt">;

export const defaultPartConfigs: SeedPartConfig[] = [
    {
        partNumber: "EMVS353",
        readingMode: "manual",
        isActive: true,
        notes: "Carga inicial del catalogo manual",
    },
    {
        partNumber: "QVC-MSF8D-1",
        readingMode: "manual",
        isActive: true,
        notes: "Carga inicial del catalogo manual",
    },
    {
        partNumber: "A2A00231",
        readingMode: "manual",
        isActive: true,
        notes: "Carga inicial del catalogo manual",
    },
    {
        partNumber: "A74802",
        readingMode: "manual",
        isActive: true,
        notes: "Carga inicial del catalogo manual",
    },
    {
        partNumber: "A84962",
        readingMode: "manual",
        isActive: true,
        notes: "Carga inicial del catalogo manual",
    },
    {
        partNumber: "VSXLLM01",
        readingMode: "double_scan",
        rfidProgram: "VSXLL01",
        expectedGtin: "00851136001566",
        filterLabel: "902227",
        expectedLotLength: 9,
        isActive: true,
        notes: "Requiere dos codigos de barras",
    },
    {
        partNumber: "VSXLLM02",
        readingMode: "double_scan",
        rfidProgram: "VSXLL01",
        expectedGtin: "00851136001566",
        filterLabel: "902227",
        expectedLotLength: 9,
        isActive: true,
        notes: "Requiere dos codigos de barras",
    },
    {
        partNumber: "SEA3700",
        readingMode: "double_scan",
        rfidProgram: "VL-25",
        expectedGtin: "10884524001425",
        filterLabel: "P000027957",
        expectedLotLength: 9,
        isActive: true,
        notes: "Requiere dos codigos de barras",
    },
];
