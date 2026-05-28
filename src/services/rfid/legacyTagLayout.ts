export const legacyTagTotalBytes = 48;
export const legacyTagTotalHexLength = legacyTagTotalBytes * 2;
export const legacyTagDefaultHexByte = "20";
export const legacyTagDefaultFilterReset = "00000000";

type LegacyTagFieldDefinition = {
    byteLength: number;
    byteStart: number;
    hexLength: number;
    hexStart: number;
};

const createFieldDefinition = (byteStart: number, byteLength: number): LegacyTagFieldDefinition => ({
    byteStart,
    byteLength,
    hexStart: byteStart * 2,
    hexLength: byteLength * 2,
});

export const legacyTagFieldDefinitions = {
    authCode: createFieldDefinition(0, 2),
    initialLife: createFieldDefinition(2, 2),
    remainingLife1: createFieldDefinition(4, 2),
    remainingLifeXor1: createFieldDefinition(6, 2),
    remainingLife2: createFieldDefinition(8, 2),
    remainingLifeXor2: createFieldDefinition(10, 2),
    partNumber: createFieldDefinition(12, 10),
    lot: createFieldDefinition(22, 8),
    dateCode: createFieldDefinition(30, 8),
    reserved: createFieldDefinition(38, 2),
    filterReset: createFieldDefinition(40, 8),
} as const;

export type LegacyTagFieldName = keyof typeof legacyTagFieldDefinitions;
