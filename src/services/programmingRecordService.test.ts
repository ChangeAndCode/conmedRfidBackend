import assert from "node:assert/strict";
import test from "node:test";
import { PartConfigModel } from "../models/partConfig";
import { ProgrammingRecord, ProgrammingRecordModel } from "../models/programmingRecord";
import { ServiceOrderModel } from "../models/serviceOrder";
import { SingleScanReadModel } from "../models/singleScanRead";
import { VerificationReportModel } from "../models/verificationReport";
import { resolveVerification, tagAlreadyVerifiedMessage, verifyProgrammingRecord } from "./programmingRecordService";
import { buildLegacyTagPayload } from "./rfid/legacyTagCodec";

type RestoreFn = () => void;

const stubMethod = <T extends object, K extends keyof T>(target: T, key: K, replacement: T[K]): RestoreFn => {
    const original = target[key];
    Object.assign(target, { [key]: replacement });

    return () => {
        Object.assign(target, { [key]: original });
    };
};

const createFindChain = <T>(records: T[]) => ({
    sort: () => ({
        limit: async () => records,
    }),
});

const createFindOneChain = <T>(record: T | null) => ({
    sort: async () => record,
});

const createSingleScanFixture = () => {
    const tagId = "E004010012345678";
    const rawScan = "0120845854081720112501011042";
    const payload = buildLegacyTagPayload({
        dateCode: "250101",
        lot: "42",
        partNumber: "CTVS353",
        tagId,
    });
    const serviceOrder = {
        _id: "so1",
        folio: "SO-1",
        readingMode: "single_scan" as const,
        partNumber: "C32-25-001",
        gtin: "20845854081720",
        rfidProgram: "CTVS353",
        quantity: 1,
        status: "open" as const,
        allowedValidationCodes: [] as string[],
        save: async () => serviceOrder,
    };
    const programmingRecord: ProgrammingRecord & {
        _id: string;
        save: () => Promise<ProgrammingRecord>;
    } = {
        _id: "pr1",
        mode: "single_scan",
        sourceType: "single_scan_read",
        sourceReadId: "sr1",
        serviceOrderId: "so1",
        serviceOrderFolio: "SO-1",
        partNumber: "C32-25-001",
        rfidProgram: "CTVS353",
        gtin: "20845854081720",
        lot: "42",
        manufactureDate: "250101",
        rawSourceData: {
            rawScan,
        },
        programmingData: {
            connection: {
                method: "serial_port",
                serialPortPath: "COM1",
            },
            rfid: {
                authCode: payload.authCode,
                backendPartNumber: "C32-25-001",
                legacyRfidPartNumber: "CTVS353",
                payloadHex: payload.payloadHex,
                tagByteLength: payload.tagByteLength,
                tagId,
            },
        },
        status: "programmed",
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        save: async () => programmingRecord,
    };
    const partConfig = {
        _id: "pc1",
        partNumber: "C32-25-001",
        readingMode: "single_scan" as const,
        rfidProgram: "CTVS353",
        usesLegacyRfidPayload: true,
        legacyRfidPartNumber: "CTVS353",
        expectedGtin: "20845854081720",
        expectedLotLength: 9,
        isActive: true,
    };

    return {
        payload,
        partConfig,
        programmingRecord,
        rawScan,
        serviceOrder,
        tagId,
    };
};

test("resolveVerification returns normalized backend part number and decoded RFID payload", async () => {
    const fixture = createSingleScanFixture();
    const restores: RestoreFn[] = [
        stubMethod(ProgrammingRecordModel, "findOne", (() => createFindOneChain(null)) as typeof ProgrammingRecordModel.findOne),
        stubMethod(ProgrammingRecordModel, "find", ((query: unknown) => {
            assert.deepEqual(query, {
                mode: "single_scan",
                serviceOrderId: "so1",
                "rawSourceData.rawScan": fixture.rawScan,
                status: { $in: ["programmed"] },
            });

            return createFindChain([fixture.programmingRecord]);
        }) as unknown as typeof ProgrammingRecordModel.find),
        stubMethod(ProgrammingRecordModel, "aggregate", (async () => ([{
            _id: "so1",
            reservedCount: 1,
            programmedCount: 1,
            verifiedCount: 0,
        }])) as typeof ProgrammingRecordModel.aggregate),
        stubMethod(ServiceOrderModel, "findById", (async () => fixture.serviceOrder) as typeof ServiceOrderModel.findById),
        stubMethod(PartConfigModel, "findOne", (async () => fixture.partConfig) as typeof PartConfigModel.findOne),
        stubMethod(VerificationReportModel, "findOne", (async () => null) as typeof VerificationReportModel.findOne),
    ];

    try {
        const result = await resolveVerification({
            serviceOrderId: "so1",
            mode: "single_scan",
            rawScan: fixture.rawScan,
            rfidPayloadText: fixture.payload.payloadHex.toLowerCase(),
            tagId: "E0:04:01:00:12:34:56:78",
        });

        assert.equal(result.programmingRecord.partNumber, "C32-25-001");
        assert.equal(result.serviceOrder._id, "so1");
        assert.deepEqual(result.rfidPayload, {
            partNumber: "C32-25-001",
            rawPartNumber: "CTVS353",
            lot: "42",
            manufactureDate: "250101",
            tagId: fixture.tagId,
        });
    } finally {
        restores.reverse().forEach((restore) => restore());
    }
});

test("resolveVerification rejects RFID tags that were already verified", async () => {
    const fixture = createSingleScanFixture();
    const restores: RestoreFn[] = [
        stubMethod(ProgrammingRecordModel, "findOne", (() => createFindOneChain({
            _id: "verified-record",
        } as unknown as ProgrammingRecord)) as typeof ProgrammingRecordModel.findOne),
        stubMethod(ServiceOrderModel, "findById", (async () => fixture.serviceOrder) as typeof ServiceOrderModel.findById),
    ];

    try {
        await assert.rejects(
            () => resolveVerification({
                serviceOrderId: "so1",
                mode: "single_scan",
                rawScan: fixture.rawScan,
                rfidPayloadText: fixture.payload.payloadHex,
                tagId: fixture.tagId,
            }),
            new Error(tagAlreadyVerifiedMessage)
        );
    } finally {
        restores.reverse().forEach((restore) => restore());
    }
});

test("verifyProgrammingRecord persists RFID verification evidence when tag data is provided", async () => {
    const fixture = createSingleScanFixture();
    const restores: RestoreFn[] = [
        stubMethod(ProgrammingRecordModel, "findById", (async () => fixture.programmingRecord) as typeof ProgrammingRecordModel.findById),
        stubMethod(ProgrammingRecordModel, "findOne", (() => createFindOneChain(null)) as typeof ProgrammingRecordModel.findOne),
        stubMethod(ProgrammingRecordModel, "find", (() => createFindChain([fixture.programmingRecord])) as unknown as typeof ProgrammingRecordModel.find),
        stubMethod(ProgrammingRecordModel, "aggregate", (async () => ([{
            _id: "so1",
            reservedCount: 1,
            programmedCount: 1,
            verifiedCount: 1,
        }])) as typeof ProgrammingRecordModel.aggregate),
        stubMethod(ServiceOrderModel, "findById", (async () => fixture.serviceOrder) as typeof ServiceOrderModel.findById),
        stubMethod(PartConfigModel, "findOne", (async () => fixture.partConfig) as typeof PartConfigModel.findOne),
        stubMethod(VerificationReportModel, "findOne", (async () => null) as typeof VerificationReportModel.findOne),
        stubMethod(SingleScanReadModel, "findByIdAndUpdate", (async () => ({ _id: "sr1" })) as typeof SingleScanReadModel.findByIdAndUpdate),
    ];

    try {
        const result = await verifyProgrammingRecord({
            programmingRecordId: "pr1",
            rawScan: fixture.rawScan,
            tagId: fixture.tagId,
            rfidPayloadText: fixture.payload.payloadHex,
            verificationNotes: "confirmado en estacion",
        });

        assert.equal(result.programmingRecord.status, "verified");
        assert.equal(result.programmingRecord.verificationData?.tagId, fixture.tagId);
        assert.equal(result.programmingRecord.verificationData?.rfidPayloadText, fixture.payload.payloadHex);
        assert.deepEqual(result.programmingRecord.verificationData?.rfidPayload, {
            partNumber: "C32-25-001",
            rawPartNumber: "CTVS353",
            lot: "42",
            manufactureDate: "250101",
            tagId: fixture.tagId,
        });
        assert.equal(result.programmingRecord.verificationNotes, "confirmado en estacion");
        assert.equal(result.serviceOrder?.status, "closed");
    } finally {
        restores.reverse().forEach((restore) => restore());
    }
});
