import { logger } from "../config/logger";
import { PartConfigModel } from "../models/partConfig";
import { RfidProgram, RfidProgramModel } from "../models/rfidProgram";
import { rfidProgramMaxLength } from "../utils/catalogValidation";

type RfidProgramQuery = {
    value?: string;
    isActive?: boolean;
};

export const listRfidPrograms = async (filters: RfidProgramQuery = {}): Promise<RfidProgram[]> => {
    const query: Record<string, string | boolean> = {};

    if (filters.value) {
        query.value = filters.value.toUpperCase();
    }

    if (typeof filters.isActive === "boolean") {
        query.isActive = filters.isActive;
    }

    return RfidProgramModel.find(query).sort({ value: 1 });
};

export const getActiveRfidProgramByValue = async (value: string): Promise<RfidProgram | null> => {
    return RfidProgramModel.findOne({
        value: value.toUpperCase(),
        isActive: true,
    });
};

export const hasActivePartConfigsUsingRfidProgram = async (value: string): Promise<boolean> => {
    const usageCount = await PartConfigModel.countDocuments({
        rfidProgram: value.toUpperCase(),
        isActive: true,
    });

    return usageCount > 0;
};

export const syncPartConfigsRfidProgram = async (currentValue: string, nextValue: string): Promise<void> => {
    if (currentValue === nextValue) {
        return;
    }

    await PartConfigModel.updateMany(
        {
            rfidProgram: currentValue,
        },
        {
            $set: {
                rfidProgram: nextValue,
            },
        }
    );
};

export const seedRfidProgramsFromPartConfigs = async (): Promise<void> => {
    const distinctValues = await PartConfigModel.distinct("rfidProgram", {
        rfidProgram: {
            $type: "string",
            $ne: "",
        },
    }) as string[];

    const normalizedValues = distinctValues.map((value) => value.toUpperCase());
    const validValues = Array.from(
        new Set(normalizedValues.filter((value) => value.length <= rfidProgramMaxLength))
    );
    const skippedValues = normalizedValues.filter((value) => value.length > rfidProgramMaxLength);

    if (skippedValues.length > 0) {
        logger.warn(`Se omitieron ${skippedValues.length} RFID programs legacy invalidos al sembrar el catalogo`);
    }

    if (validValues.length === 0) {
        return;
    }

    const result = await RfidProgramModel.bulkWrite(
        validValues.map((value) => ({
            updateOne: {
                filter: { value },
                update: {
                    $setOnInsert: {
                        value,
                        isActive: true,
                    },
                },
                upsert: true,
            },
        }))
    );

    const insertedCount = result.upsertedCount ?? 0;

    if (insertedCount > 0) {
        logger.info(`Se insertaron ${insertedCount} RFID programs en el catalogo inicial`);
    }
};
