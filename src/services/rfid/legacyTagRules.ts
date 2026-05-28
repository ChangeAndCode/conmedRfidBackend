export type LegacyTagLifeConfig = {
    initialLifeMinutes: number;
    multiplier: 2 | 4;
    remainingLifeMinutes: number;
};

const legacyLifeMinutesByPartNumberKey: Record<string, number> = {
    "6_MIN_TEST": 6,
    "608590001": 35 * 60,
    "905389M25": 35 * 60,
    "905390M22": 35 * 60,
    A74802: 24 * 60,
    A84962: 24 * 60,
    AARON: 18 * 60,
    AEVS353: 35 * 60,
    ARVS353: 35 * 60,
    ATMVS353: 35 * 60,
    BOWA: 8 * 60,
    BOWA353: 35 * 60,
    CE_CRTSY: 0,
    "CE-25": 25 * 60,
    CMIS: 8 * 60,
    COURTESY: 0,
    CTVS353: 35 * 60,
    "ELMAN-270": 270 * 60,
    ELM_FLTR01: 6 * 60,
    EMVS353: 35 * 60,
    EXTD_CRTSY: 0,
    FUMOVAC: 32 * 60,
    LVAC: 8 * 60,
    MGVS353: 35 * 60,
    MHVS353: 35 * 60,
    "NUVO-8": 8 * 60,
    OL353: 35 * 60,
    PLVS353: 35 * 60,
    "QUANTA-8": 8 * 60,
    SKYTRON: 8 * 60,
    SMOKESTAR: 32 * 60,
    STHAF01: 35 * 60,
    STSLT3501: 35 * 60,
    STRYKEVAC: 24 * 60,
    "TELEVAC-8": 8 * 60,
    TRUMPF: 8 * 60,
    "VL-25": 25 * 60,
    VS06001: 6 * 60,
    VS06D01: 6 * 60,
    VS06T04: 6 * 60,
    VS06VMP: 6 * 60,
    VS135: 35 * 60,
    VS353: 35 * 60,
    VSEY1_4: 12 * 60,
    "VSEY1-4": 12 * 60,
    VSOH001: 24 * 60,
    VSVET: 24 * 60,
    VSXLL01: 18 * 60,
    VSXLL01M01: 18 * 60,
} as const;

const legacyAuthAdjustmentMasksByPartNumberKey: Record<string, number[]> = {
    AARON: [9],
    AEVS353: [10],
    ARVS353: [2],
    BOWA: [14],
    BOWA353: [6],
    CE_CRTSY: [8, 255],
    "CE-25": [8],
    CMIS: [13],
    COURTESY: [255],
    CTVS353: [4],
    EMVS353: [3],
    EXTD_CRTSY: [255],
    LVAC: [3],
    MGVS353: [8],
    "NUVO-8": [7],
    PLVS353: [5],
    "QUANTA-8": [6],
    SKYTRON: [4],
    STHAF01: [7],
    STSLT3501: [1],
    STRYKEVAC: [10],
    "TELEVAC-8": [5],
    TRUMPF: [15],
    "VL-25": [11],
    "608590001": [9],
    "905389M25": [16],
    "905390M22": [16],
} as const;

export const resolveLegacyPartNumberKey = (partNumber: string): string => {
    return partNumber.trim().toUpperCase();
};

export const getLegacyTagLifeConfig = (partNumber: string): LegacyTagLifeConfig => {
    const partNumberKey = resolveLegacyPartNumberKey(partNumber);
    const lifeMinutes = legacyLifeMinutesByPartNumberKey[partNumberKey];

    if (typeof lifeMinutes !== "number") {
        throw new Error("El numero de parte no existe en la estructura RFID legada");
    }

    return {
        initialLifeMinutes: lifeMinutes,
        remainingLifeMinutes: lifeMinutes,
        multiplier: partNumberKey === "STRYKEVAC" ? 4 : 2,
    };
};

export const applyLegacyAuthCodeAdjustments = (crcValue: number, partNumber: string): number => {
    const partNumberKey = resolveLegacyPartNumberKey(partNumber);
    const masks = legacyAuthAdjustmentMasksByPartNumberKey[partNumberKey] ?? [];

    return masks.reduce((accumulator, mask) => accumulator ^ mask, crcValue);
};
