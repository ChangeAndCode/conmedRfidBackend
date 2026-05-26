import { Schema, model } from "mongoose";

export interface ReportResponsibles {
    singletonKey: "global";
    manufacturingRepresentativeName: string;
    qualityRepresentativeName: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const reportResponsiblesSchema = new Schema<ReportResponsibles>(
    {
        singletonKey: {
            type: String,
            default: "global",
            required: true,
            immutable: true,
            trim: true,
        },
        manufacturingRepresentativeName: {
            type: String,
            required: true,
            trim: true,
        },
        qualityRepresentativeName: {
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

reportResponsiblesSchema.index({ singletonKey: 1 }, { unique: true });

export const ReportResponsiblesModel = model<ReportResponsibles>(
    "ReportResponsibles",
    reportResponsiblesSchema
);
