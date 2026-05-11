import { Schema, model } from "mongoose";

export const serviceOrderChangeRequestTypes = ["missing_product", "extra_product"] as const;
export const serviceOrderChangeRequestStatuses = ["pending", "resolved"] as const;

export type ServiceOrderChangeRequestType = (typeof serviceOrderChangeRequestTypes)[number];
export type ServiceOrderChangeRequestStatus = (typeof serviceOrderChangeRequestStatuses)[number];

export interface ServiceOrderChangeRequest {
    serviceOrderId: string;
    serviceOrderFolio: string;
    requestType: ServiceOrderChangeRequestType;
    status: ServiceOrderChangeRequestStatus;
    resolutionNotes?: string;
    resolvedAt?: Date;
    resolvedByUserId?: string;
    resolvedByUsername?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const serviceOrderChangeRequestSchema = new Schema<ServiceOrderChangeRequest>(
    {
        serviceOrderId: {
            type: String,
            required: true,
            trim: true,
        },
        serviceOrderFolio: {
            type: String,
            required: true,
            trim: true,
        },
        requestType: {
            type: String,
            enum: serviceOrderChangeRequestTypes,
            required: true,
        },
        status: {
            type: String,
            enum: serviceOrderChangeRequestStatuses,
            default: "pending",
            required: true,
        },
        resolutionNotes: {
            type: String,
            trim: true,
        },
        resolvedAt: {
            type: Date,
        },
        resolvedByUserId: {
            type: String,
            trim: true,
        },
        resolvedByUsername: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

serviceOrderChangeRequestSchema.index(
    { serviceOrderId: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: {
            status: "pending",
        },
    }
);
serviceOrderChangeRequestSchema.index({ status: 1, createdAt: -1 });

export const ServiceOrderChangeRequestModel = model<ServiceOrderChangeRequest>(
    "ServiceOrderChangeRequest",
    serviceOrderChangeRequestSchema
);
