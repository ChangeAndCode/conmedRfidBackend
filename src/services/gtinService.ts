import { logger } from "../config/logger";
import { Gtin, GtinModel } from "../models/gtin";
import { PartConfigModel } from "../models/partConfig";
import { gtinValuePattern } from "../utils/catalogValidation";

type GtinQuery = {
    value?: string;
    isActive?: boolean;
};

export const listGtins = async (filters: GtinQuery = {}): Promise<Gtin[]> => {
    const query: Record<string, string | boolean> = {};

    if (filters.value) {
        query.value = filters.value;
    }

    if (typeof filters.isActive === "boolean") {
        query.isActive = filters.isActive;
    }

    return GtinModel.find(query).sort({ value: 1 });
};

export const getActiveGtinByValue = async (value: string): Promise<Gtin | null> => {
    return GtinModel.findOne({
        value,
        isActive: true,
    });
};

export const hasActivePartConfigsUsingGtin = async (value: string): Promise<boolean> => {
    const usageCount = await PartConfigModel.countDocuments({
        expectedGtin: value,
        isActive: true,
    });

    return usageCount > 0;
};

export const syncPartConfigsExpectedGtin = async (currentValue: string, nextValue: string): Promise<void> => {
    if (currentValue === nextValue) {
        return;
    }

    await PartConfigModel.updateMany(
        {
            expectedGtin: currentValue,
        },
        {
            $set: {
                expectedGtin: nextValue,
            },
        }
    );
};

export const seedGtinsFromPartConfigs = async (): Promise<void> => {
    const distinctValues = await PartConfigModel.distinct("expectedGtin", {
        expectedGtin: {
            $type: "string",
            $ne: "",
        },
    }) as string[];

    const validValues = distinctValues.filter((value) => gtinValuePattern.test(value));
    const skippedValues = distinctValues.filter((value) => !gtinValuePattern.test(value));

    if (skippedValues.length > 0) {
        logger.warn(`Se omitieron ${skippedValues.length} GTIN legacy invalidos al sembrar el catalogo`);
    }

    if (validValues.length === 0) {
        return;
    }

    const result = await GtinModel.bulkWrite(
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
        logger.info(`Se insertaron ${insertedCount} GTIN en el catalogo inicial`);
    }
};
