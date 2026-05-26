import { Schema, model } from "mongoose";

export interface PrintInterruption {
    title: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const printInterruptionSchema = new Schema<PrintInterruption>(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

printInterruptionSchema.index({ title: 1 }, { unique: true });

export const PrintInterruptionModel = model<PrintInterruption>(
    "PrintInterruption",
    printInterruptionSchema
);
