import { Schema, model } from "mongoose";

export interface Responsible {
    name: string;
    area: "manufactura" | "calidad";
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const responsibleSchema = new Schema<Responsible>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        area: {
            type: String,
            enum: ["manufactura", "calidad"],
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export const ResponsibleModel = model<Responsible>(
    "Responsible",
    responsibleSchema
);