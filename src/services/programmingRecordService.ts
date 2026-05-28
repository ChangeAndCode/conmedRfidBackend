import { DoubleScanRead } from "../models/doubleScanRead";
import { ManualRead, ManualReadModel } from "../models/manualRead";
import {
    ProgrammingConnectionMethod,
    ProgrammingExecutionData,
    ProgrammingRecord,
    ProgrammingVerificationData,
    ProgrammingRecordMode,
    ProgrammingRecordModel,
    ProgrammingRecordSourceType,
    ProgrammingRecordStatus,
} from "../models/programmingRecord";
import { SingleScanRead, SingleScanReadModel } from "../models/singleScanRead";
import { DoubleScanReadModel } from "../models/doubleScanRead";
import { parseDoubleScanVerificationReading, parseSingleScanReading } from "./gs1Parser";
import { VerificationReportStatus } from "../models/verificationReport";
import { buildLegacyTagPayload } from "./rfid/legacyTagCodec";
import { BuildLegacyTagPayloadResponseData, buildLegacyTagPayloadResponseData } from "./rfid/legacyTagResponse";
import { ResolvedLegacyRfidPartMapping } from "./rfid/legacyTagMapping";
import {
    closeServiceOrderIfVerificationCompleted,
    getDocumentId,
    getServiceOrderById,
    getServiceOrderProgress,
} from "./serviceOrderService";
import { resolveLegacyRfidPartMappingByBackendPartNumber } from "./partConfigService";
import {
    getVerificationReportAvailableActions,
    getVerificationReportByServiceOrderId,
    VerificationReportAvailableActions,
} from "./verificationReportService";

type ProgrammingRecordQuery = {
    mode?: ProgrammingRecordMode;
    sourceType?: ProgrammingRecordSourceType;
    sourceReadId?: string;
    serviceOrderId?: string;
    serviceOrderFolio?: string;
    partNumber?: string;
    gtin?: string;
    rfidProgram?: string;
    status?: ProgrammingRecordStatus;
};

type ResolveProgrammingRecordInput = {
    mode: ProgrammingRecordMode;
    strictMode: boolean;
    rawReference?: string | undefined;
    rawScan?: string | undefined;
    firstBarcodeRaw?: string | undefined;
    secondBarcodeRaw?: string | undefined;
};

type ProgrammingRecordResolutionType = "no_match" | "single_match" | "multiple_matches";
type ProgrammingRecordMatchStrategy = "manual_raw_reference" | "single_scan_raw" | "double_scan_raw" | "gs1_fields";

type ResolvedProgrammingRecordInput = {
    mode: ProgrammingRecordMode;
    rawReference?: string | undefined;
    rawScan?: string | undefined;
    firstBarcodeRaw?: string | undefined;
    secondBarcodeRaw?: string | undefined;
    gtin?: string | undefined;
    lot?: string | undefined;
    manufactureDate?: string | undefined;
};

export type ResolveProgrammingRecordResult = {
    resolutionType: ProgrammingRecordResolutionType;
    matchedBy?: ProgrammingRecordMatchStrategy | undefined;
    candidateCount: number;
    autoSelectedProgrammingRecordId: string | null;
    candidates: ProgrammingRecord[];
    normalizedInput: ResolvedProgrammingRecordInput;
};

type VerifyProgrammingRecordInput = {
    programmingRecordId: string;
    rawReference?: string | undefined;
    rawScan?: string | undefined;
    firstBarcodeRaw?: string | undefined;
    secondBarcodeRaw?: string | undefined;
    verificationNotes?: string | undefined;
};

type BuildProgrammingRecordRfidPayloadInput = {
    programmingRecordId: string;
    tagId: string;
    includeDetails: boolean;
};

type CompleteProgrammingRecordInput = {
    programmingRecordId: string;
    connectionMethod: ProgrammingConnectionMethod;
    deviceId?: string | undefined;
    deviceName?: string | undefined;
    serialPortPath?: string | undefined;
    tagId: string;
    payloadHex?: string | undefined;
    authCode?: string | undefined;
    programmingNotes?: string | undefined;
    programmedBy?: string | undefined;
};

export type BuildProgrammingRecordRfidPayloadResult = BuildLegacyTagPayloadResponseData & {
    programmingRecordId: string;
    programmingRecordStatus: ProgrammingRecordStatus;
    serviceOrderFolio?: string | undefined;
};

export type CompleteProgrammingRecordResult = {
    payload: BuildProgrammingRecordRfidPayloadResult;
    programmingRecord: ProgrammingRecord;
};

type VerifiedProgrammingRecordServiceOrderSummary = {
    _id: string;
    folio: string;
    readingMode: string;
    partNumber?: string;
    gtin?: string;
    rfidProgram?: string;
    quantity: number;
    status: string;
    reservedCount: number;
    programmedCount: number;
    verifiedCount: number;
    remainingToCapture: number;
    remainingToProgram: number;
    remainingToVerify: number;
};

type VerifiedProgrammingRecordVerificationReportState = {
    exists: boolean;
    canGenerate: boolean;
    reportId: string | null;
    status: VerificationReportStatus | null;
    availableActions: VerificationReportAvailableActions | null;
};

export type VerifyProgrammingRecordResult = {
    programmingRecord: ProgrammingRecord;
    serviceOrder: VerifiedProgrammingRecordServiceOrderSummary | null;
    verificationReport: VerifiedProgrammingRecordVerificationReportState;
};

const listQueryValue = (value: string | undefined): string | undefined => {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : undefined;
};

const getVerificationEvidenceCodes = (
    input: VerifyProgrammingRecordInput
): string[] => {
    return [
        input.rawReference,
        input.rawScan,
        input.firstBarcodeRaw,
        input.secondBarcodeRaw,
    ]
        .map((value) => listQueryValue(value)?.toUpperCase())
        .filter((value): value is string => Boolean(value));
};

const verificationSearchStatuses: ProgrammingRecordStatus[] = ["programmed", "verified"];

const statusPriority: Record<ProgrammingRecordStatus, number> = {
    programmed: 0,
    verified: 1,
    captured: 2,
};

const resolveResolutionType = (candidateCount: number): ProgrammingRecordResolutionType => {
    if (candidateCount === 0) {
        return "no_match";
    }

    if (candidateCount === 1) {
        return "single_match";
    }

    return "multiple_matches";
};

const sortVerificationCandidates = (records: ProgrammingRecord[]): ProgrammingRecord[] => {
    return [...records].sort((left, right) => {
        const statusDelta = statusPriority[left.status] - statusPriority[right.status];

        if (statusDelta !== 0) {
            return statusDelta;
        }

        const leftCreatedAt = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightCreatedAt = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        return rightCreatedAt - leftCreatedAt;
    });
};

const queryVerificationCandidates = async (query: Record<string, unknown>): Promise<ProgrammingRecord[]> => {
    const records = await ProgrammingRecordModel.find({
        ...query,
        status: { $in: verificationSearchStatuses },
    }).sort({ createdAt: -1 }).limit(25);

    return sortVerificationCandidates(records);
};

const buildResolveProgrammingRecordResult = (
    candidates: ProgrammingRecord[],
    matchedBy: ProgrammingRecordMatchStrategy | undefined,
    normalizedInput: ResolvedProgrammingRecordInput
): ResolveProgrammingRecordResult => {
    const candidateCount = candidates.length;

    return {
        resolutionType: resolveResolutionType(candidateCount),
        matchedBy,
        candidateCount,
        autoSelectedProgrammingRecordId: candidateCount === 1
            ? getDocumentId(candidates[0] as ProgrammingRecord & { _id?: unknown })
            : null,
        candidates,
        normalizedInput,
    };
};

export const listProgrammingRecords = async (filters: ProgrammingRecordQuery = {}): Promise<ProgrammingRecord[]> => {
    const query: Record<string, string> = {};

    if (filters.mode) {
        query.mode = filters.mode;
    }

    if (filters.sourceType) {
        query.sourceType = filters.sourceType;
    }

    if (filters.sourceReadId) {
        query.sourceReadId = filters.sourceReadId;
    }

    if (filters.serviceOrderId) {
        query.serviceOrderId = filters.serviceOrderId;
    }

    if (filters.serviceOrderFolio) {
        query.serviceOrderFolio = filters.serviceOrderFolio;
    }

    if (filters.partNumber) {
        query.partNumber = filters.partNumber.toUpperCase();
    }

    if (filters.gtin) {
        query.gtin = filters.gtin;
    }

    if (filters.rfidProgram) {
        query.rfidProgram = filters.rfidProgram.toUpperCase();
    }

    if (filters.status) {
        query.status = filters.status;
    }

    return ProgrammingRecordModel.find(query).sort({ createdAt: -1 }).limit(100);
};

export const getProgrammingRecordById = async (id: string): Promise<ProgrammingRecord | null> => {
    return ProgrammingRecordModel.findById(id);
};

export const buildRfidPayloadForProgrammingRecord = async (
    input: BuildProgrammingRecordRfidPayloadInput
): Promise<BuildProgrammingRecordRfidPayloadResult> => {
    const programmingRecord = await ProgrammingRecordModel.findById(input.programmingRecordId);

    if (!programmingRecord) {
        throw new Error("Programming record no encontrado");
    }

    const { payload } = await buildProgrammingRecordPayloadCore(
        programmingRecord as ProgrammingRecord & { _id?: unknown },
        input.tagId,
        input.includeDetails
    );

    return {
        ...payload,
        programmingRecordId: getDocumentId(programmingRecord as ProgrammingRecord & { _id?: unknown }),
        programmingRecordStatus: programmingRecord.status,
        serviceOrderFolio: programmingRecord.serviceOrderFolio,
    };
};

const buildVerificationData = (
    normalizedInput: ResolvedProgrammingRecordInput
): ProgrammingVerificationData | undefined => {
    const payload: ProgrammingVerificationData = {};

    if (normalizedInput.rawReference) {
        payload.rawReference = normalizedInput.rawReference;
    }

    if (normalizedInput.rawScan) {
        payload.rawScan = normalizedInput.rawScan;
    }

    if (normalizedInput.firstBarcodeRaw) {
        payload.firstBarcodeRaw = normalizedInput.firstBarcodeRaw;
    }

    if (normalizedInput.secondBarcodeRaw) {
        payload.secondBarcodeRaw = normalizedInput.secondBarcodeRaw;
    }

    return Object.keys(payload).length > 0 ? payload : undefined;
};

const getProgrammingRecordFieldValue = (
    value: string | undefined,
    fieldName: "lot" | "manufactureDate"
): string => {
    const normalized = listQueryValue(value);

    if (!normalized) {
        throw new Error(`El programming record no tiene ${fieldName} suficiente para construir el payload RFID`);
    }

    return normalized;
};

const normalizeProgrammingConnectionData = (
    input: Pick<CompleteProgrammingRecordInput, "connectionMethod" | "deviceId" | "deviceName" | "serialPortPath">
): ProgrammingExecutionData["connection"] => {
    const deviceId = listQueryValue(input.deviceId);
    const deviceName = listQueryValue(input.deviceName);

    if (input.connectionMethod === "serial_port") {
        const serialPortPath = listQueryValue(input.serialPortPath);

        if (!serialPortPath) {
            throw new Error("El campo serialPortPath es obligatorio cuando connectionMethod es serial_port");
        }

        const connectionData: ProgrammingExecutionData["connection"] = {
            method: "serial_port",
            serialPortPath,
        };

        if (deviceId) {
            connectionData.deviceId = deviceId;
        }

        if (deviceName) {
            connectionData.deviceName = deviceName;
        }

        return connectionData;
    }

    const connectionData: ProgrammingExecutionData["connection"] = {
        method: "android_usb_nfc",
    };

    if (deviceId) {
        connectionData.deviceId = deviceId;
    }

    if (deviceName) {
        connectionData.deviceName = deviceName;
    }

    return connectionData;
};

const assertProgrammingRecordCanBuildRfidPayload = (record: ProgrammingRecord): void => {
    if (record.status === "verified") {
        throw new Error("El programming record ya fue verificado y no puede volver a programarse");
    }

    if (record.status === "programmed") {
        throw new Error("El programming record ya fue marcado como programado");
    }
};

const buildProgrammingRecordPayloadCore = async (
    record: ProgrammingRecord & { _id?: unknown },
    tagId: string,
    includeDetails: boolean
): Promise<{
    legacyPartMapping: ResolvedLegacyRfidPartMapping;
    payload: BuildLegacyTagPayloadResponseData;
}> => {
    assertProgrammingRecordCanBuildRfidPayload(record);

    const legacyPartMapping = await resolveLegacyRfidPartMappingByBackendPartNumber(record.partNumber);
    const builtPayload = buildLegacyTagPayload({
        partNumber: legacyPartMapping.legacyRfidPartNumber,
        lot: getProgrammingRecordFieldValue(record.lot, "lot"),
        manufactureDate: getProgrammingRecordFieldValue(record.manufactureDate, "manufactureDate"),
        tagId,
    });

    return {
        legacyPartMapping,
        payload: buildLegacyTagPayloadResponseData(
            builtPayload,
            record.partNumber,
            legacyPartMapping,
            includeDetails
        ),
    };
};

const updateSourceReadStatus = async (
    record: ProgrammingRecord,
    status: "programmed" | "verified"
): Promise<void> => {
    if (record.sourceType === "manual_read") {
        const updated = await ManualReadModel.findByIdAndUpdate(record.sourceReadId, { status }, { new: true });

        if (!updated) {
            throw new Error("La lectura manual asociada no existe");
        }

        return;
    }

    if (record.sourceType === "single_scan_read") {
        const updated = await SingleScanReadModel.findByIdAndUpdate(
            record.sourceReadId,
            { status },
            { new: true }
        );

        if (!updated) {
            throw new Error("La lectura single scan asociada no existe");
        }

        return;
    }

    const updated = await DoubleScanReadModel.findByIdAndUpdate(record.sourceReadId, { status }, { new: true });

    if (!updated) {
        throw new Error("La lectura doble asociada no existe");
    }
};

const buildVerifiedProgrammingRecordServiceOrderSummary = async (
    serviceOrderId: string
): Promise<{
    serviceOrder: VerifiedProgrammingRecordServiceOrderSummary;
    verificationReport: VerifiedProgrammingRecordVerificationReportState;
}> => {
    const serviceOrder = await getServiceOrderById(serviceOrderId);

    if (!serviceOrder) {
        throw new Error("La orden de servicio asociada no existe");
    }

    const progress = await getServiceOrderProgress(serviceOrderId, serviceOrder.quantity);
    const verificationReport = await getVerificationReportByServiceOrderId(serviceOrderId);
    const reportExists = verificationReport !== null;
    const serviceOrderSummary: VerifiedProgrammingRecordServiceOrderSummary = {
        _id: getDocumentId(serviceOrder as typeof serviceOrder & { _id?: unknown }),
        folio: serviceOrder.folio,
        readingMode: serviceOrder.readingMode,
        quantity: serviceOrder.quantity,
        status: serviceOrder.status,
        reservedCount: progress.reservedCount,
        programmedCount: progress.programmedCount,
        verifiedCount: progress.verifiedCount,
        remainingToCapture: progress.remainingToCapture,
        remainingToProgram: progress.remainingToProgram,
        remainingToVerify: progress.remainingToVerify,
    };

    if (serviceOrder.partNumber) {
        serviceOrderSummary.partNumber = serviceOrder.partNumber;
    }

    if (serviceOrder.gtin) {
        serviceOrderSummary.gtin = serviceOrder.gtin;
    }

    if (serviceOrder.rfidProgram) {
        serviceOrderSummary.rfidProgram = serviceOrder.rfidProgram;
    }

    return {
        serviceOrder: serviceOrderSummary,
        verificationReport: {
            exists: reportExists,
            canGenerate: serviceOrder.status === "closed"
                && progress.remainingToVerify === 0
                && !reportExists,
            reportId: verificationReport
                ? getDocumentId(verificationReport as typeof verificationReport & { _id?: unknown })
                : null,
            status: verificationReport?.status ?? null,
            availableActions: verificationReport
                ? getVerificationReportAvailableActions(verificationReport.status)
                : null,
        },
    };
};

export const completeProgrammingRecord = async (
    input: CompleteProgrammingRecordInput
): Promise<CompleteProgrammingRecordResult> => {
    const programmingRecord = await ProgrammingRecordModel.findById(input.programmingRecordId);

    if (!programmingRecord) {
        throw new Error("Programming record no encontrado");
    }

    const { legacyPartMapping, payload } = await buildProgrammingRecordPayloadCore(
        programmingRecord as ProgrammingRecord & { _id?: unknown },
        input.tagId,
        false
    );

    const providedPayloadHex = listQueryValue(input.payloadHex)?.toUpperCase();

    if (providedPayloadHex && providedPayloadHex !== payload.payloadHex) {
        throw new Error("El payloadHex reportado no coincide con el payload RFID legado esperado");
    }

    const providedAuthCode = listQueryValue(input.authCode)?.toUpperCase();

    if (providedAuthCode && providedAuthCode !== payload.authCode) {
        throw new Error("El authCode reportado no coincide con el AuthCode esperado");
    }

    const programmingData: ProgrammingExecutionData = {
        connection: normalizeProgrammingConnectionData(input),
        rfid: {
            authCode: payload.authCode,
            backendPartNumber: payload.backendPartNumber,
            legacyRfidPartNumber: legacyPartMapping.legacyRfidPartNumber,
            payloadHex: payload.payloadHex,
            tagByteLength: payload.tagByteLength,
            tagId: payload.tagId,
        },
    };

    const programmingNotes = listQueryValue(input.programmingNotes);

    if (programmingNotes) {
        programmingData.notes = programmingNotes;
    }

    const programmedBy = listQueryValue(input.programmedBy);

    if (programmedBy) {
        programmingData.programmedBy = programmedBy;
    }

    programmingRecord.status = "programmed";
    programmingRecord.programmedAt = new Date();
    programmingRecord.programmingData = programmingData;
    await programmingRecord.save();

    try {
        await updateSourceReadStatus(programmingRecord, "programmed");
    } catch (error) {
        programmingRecord.status = "captured";
        delete programmingRecord.programmedAt;
        delete programmingRecord.programmingData;
        await programmingRecord.save();
        throw error;
    }

    return {
        payload: {
            ...payload,
            programmingRecordId: getDocumentId(programmingRecord as ProgrammingRecord & { _id?: unknown }),
            programmingRecordStatus: programmingRecord.status,
            serviceOrderFolio: programmingRecord.serviceOrderFolio,
        },
        programmingRecord,
    };
};

export const resolveProgrammingRecord = async (
    input: ResolveProgrammingRecordInput
): Promise<ResolveProgrammingRecordResult> => {
    if (input.mode === "manual") {
        const rawReference = listQueryValue(input.rawReference);

        if (!rawReference) {
            throw new Error("El campo rawReference es obligatorio para resolver una programacion manual");
        }

        const upperReference = rawReference.toUpperCase();

        const candidates = await queryVerificationCandidates({
            mode: "manual",
            $or: [
                { "rawSourceData.rawReference": rawReference },
                { serviceOrderFolio: upperReference },
                { partNumber: upperReference },
            ],
        });

        return buildResolveProgrammingRecordResult(candidates, "manual_raw_reference", {
            mode: "manual",
            rawReference,
        });
    }

    if (input.mode === "single_scan") {
        const rawScan = listQueryValue(input.rawScan);

        if (!rawScan) {
            throw new Error("El campo rawScan es obligatorio para resolver una programacion single scan");
        }

        const resolvedScan = parseSingleScanReading(rawScan);
        const exactCandidates = await queryVerificationCandidates({
            mode: "single_scan",
            "rawSourceData.rawScan": resolvedScan.rawScan,
        });

        if (exactCandidates.length > 0) {
            return buildResolveProgrammingRecordResult(exactCandidates, "single_scan_raw", {
                mode: "single_scan",
                rawScan: resolvedScan.rawScan,
                gtin: resolvedScan.gtin,
                lot: resolvedScan.lot,
                manufactureDate: resolvedScan.manufactureDate,
            });
        }

        const gs1FieldQuery: Record<string, unknown> = {
            gtin: resolvedScan.gtin,
            lot: resolvedScan.lot,
            manufactureDate: resolvedScan.manufactureDate,
        };

        if (input.strictMode) {
            gs1FieldQuery.mode = "single_scan";
        }

        const candidates = await queryVerificationCandidates(gs1FieldQuery);

        return buildResolveProgrammingRecordResult(candidates, "gs1_fields", {
            mode: "single_scan",
            rawScan: resolvedScan.rawScan,
            gtin: resolvedScan.gtin,
            lot: resolvedScan.lot,
            manufactureDate: resolvedScan.manufactureDate,
        });
    }

    const firstBarcodeRaw = listQueryValue(input.firstBarcodeRaw);
    const secondBarcodeRaw = listQueryValue(input.secondBarcodeRaw);

    if (!firstBarcodeRaw || !secondBarcodeRaw) {
        throw new Error("Los campos firstBarcodeRaw y secondBarcodeRaw son obligatorios para doble codigo");
    }

    const resolvedReading = parseDoubleScanVerificationReading(firstBarcodeRaw, secondBarcodeRaw);
    const exactCandidates = await queryVerificationCandidates({
        mode: "double_scan",
        "rawSourceData.firstBarcodeRaw": resolvedReading.firstBarcodeRaw,
        "rawSourceData.secondBarcodeRaw": resolvedReading.secondBarcodeRaw,
    });

    if (exactCandidates.length > 0) {
        return buildResolveProgrammingRecordResult(exactCandidates, "double_scan_raw", {
            mode: "double_scan",
            firstBarcodeRaw: resolvedReading.firstBarcodeRaw,
            secondBarcodeRaw: resolvedReading.secondBarcodeRaw,
            gtin: resolvedReading.gtin,
            lot: resolvedReading.lot,
            manufactureDate: resolvedReading.manufactureDate,
        });
    }

    const gs1FieldQuery: Record<string, unknown> = {
        gtin: resolvedReading.gtin,
        lot: resolvedReading.lot,
        manufactureDate: resolvedReading.manufactureDate,
    };

    if (input.strictMode) {
        gs1FieldQuery.mode = "double_scan";
    }

    const candidates = await queryVerificationCandidates(gs1FieldQuery);

    return buildResolveProgrammingRecordResult(candidates, "gs1_fields", {
        mode: "double_scan",
        firstBarcodeRaw: resolvedReading.firstBarcodeRaw,
        secondBarcodeRaw: resolvedReading.secondBarcodeRaw,
        gtin: resolvedReading.gtin,
        lot: resolvedReading.lot,
        manufactureDate: resolvedReading.manufactureDate,
    });
};

export const verifyProgrammingRecord = async (
    input: VerifyProgrammingRecordInput
): Promise<VerifyProgrammingRecordResult> => {
    const programmingRecord = await ProgrammingRecordModel.findById(input.programmingRecordId);

    if (!programmingRecord) {
        throw new Error("Programming record no encontrado");
    }

    if (programmingRecord.status === "captured") {
        throw new Error("El programming record aun no ha sido programado");
    }

    if (programmingRecord.status === "verified") {
        throw new Error("El programming record ya fue verificado");
    }

    const resolution = await resolveProgrammingRecord({
        mode: programmingRecord.mode,
        strictMode: true,
        rawReference: input.rawReference,
        rawScan: input.rawScan,
        firstBarcodeRaw: input.firstBarcodeRaw,
        secondBarcodeRaw: input.secondBarcodeRaw,
    });
    const programmingRecordId = getDocumentId(programmingRecord as ProgrammingRecord & { _id?: unknown });
    const matchingCandidate = resolution.candidates.find((candidate) => {
        return getDocumentId(candidate as ProgrammingRecord & { _id?: unknown }) === programmingRecordId;
    });

    if (!matchingCandidate) {
        throw new Error("La evidencia de verificacion no coincide con el programming record seleccionado");
    }

    if (programmingRecord.serviceOrderId) {
        const serviceOrder = await getServiceOrderById(programmingRecord.serviceOrderId);

        if (!serviceOrder) {
            throw new Error("La orden de servicio asociada no existe");
        }

        const allowedValidationCodes = serviceOrder.allowedValidationCodes ?? [];

        if (allowedValidationCodes.length > 0) {
            const evidenceCodes = getVerificationEvidenceCodes(input);
            const hasAllowedEvidenceCode = evidenceCodes.some((code) =>
                allowedValidationCodes.includes(code)
            );

            if (!hasAllowedEvidenceCode) {
                throw new Error("El código escaneado no pertenece a los códigos permitidos para esta orden de servicio");
            }
        }
    }

    const verificationData = buildVerificationData(resolution.normalizedInput);

    programmingRecord.status = "verified";
    programmingRecord.verifiedAt = new Date();

    if (verificationData) {
        programmingRecord.verificationData = verificationData;
    } else {
        delete programmingRecord.verificationData;
    }

    if (resolution.matchedBy) {
        programmingRecord.verificationMatchedBy = resolution.matchedBy;
    } else {
        delete programmingRecord.verificationMatchedBy;
    }

    const verificationNotes = listQueryValue(input.verificationNotes);

    if (verificationNotes) {
        programmingRecord.verificationNotes = verificationNotes;
    } else {
        delete programmingRecord.verificationNotes;
    }

    await programmingRecord.save();

    let serviceOrderSummary: VerifiedProgrammingRecordServiceOrderSummary | null = null;
    let verificationReportState: VerifiedProgrammingRecordVerificationReportState = {
        exists: false,
        canGenerate: false,
        reportId: null,
        status: null,
        availableActions: null,
    };

    try {
        await updateSourceReadStatus(programmingRecord, "verified");

        if (programmingRecord.serviceOrderId) {
            await closeServiceOrderIfVerificationCompleted(programmingRecord.serviceOrderId);
            const serviceOrderState = await buildVerifiedProgrammingRecordServiceOrderSummary(
                programmingRecord.serviceOrderId
            );

            serviceOrderSummary = serviceOrderState.serviceOrder;
            verificationReportState = serviceOrderState.verificationReport;
        }
    } catch (error) {
        programmingRecord.status = "programmed";
        delete programmingRecord.verifiedAt;
        delete programmingRecord.verificationData;
        delete programmingRecord.verificationMatchedBy;
        delete programmingRecord.verificationNotes;
        await programmingRecord.save();
        await updateSourceReadStatus(programmingRecord, "programmed");
        throw error;
    }

    return {
        programmingRecord,
        serviceOrder: serviceOrderSummary,
        verificationReport: verificationReportState,
    };
};

export const createProgrammingRecordFromManualRead = async (
    read: ManualRead & { _id?: unknown }
): Promise<ProgrammingRecord> => {
    const payload: ProgrammingRecord = {
        mode: "manual",
        sourceType: "manual_read",
        sourceReadId: getDocumentId(read),
        partNumber: read.partNumber,
        rawSourceData: {},
        status: read.status,
    };

    const serviceOrderId = listQueryValue(read.serviceOrderId);
    const serviceOrderFolio = listQueryValue(read.serviceOrder);
    const rfidProgram = listQueryValue(read.rfidProgram);
    const gtin = listQueryValue(read.gtin);
    const lot = listQueryValue(read.lot);
    const manufactureDate = listQueryValue(read.manufactureDate);
    const filterLabel = listQueryValue(read.filterLabel);
    const rawReference = listQueryValue(read.rawReference);
    const notes = listQueryValue(read.notes);
    const createdBy = listQueryValue(read.createdBy);

    if (serviceOrderId) {
        payload.serviceOrderId = serviceOrderId;
    }

    if (serviceOrderFolio) {
        payload.serviceOrderFolio = serviceOrderFolio;
    }

    if (rfidProgram) {
        payload.rfidProgram = rfidProgram;
    }

    if (gtin) {
        payload.gtin = gtin;
    }

    if (lot) {
        payload.lot = lot;
    }

    if (manufactureDate) {
        payload.manufactureDate = manufactureDate;
    }

    if (filterLabel) {
        payload.filterLabel = filterLabel;
    }

    if (rawReference) {
        payload.rawSourceData.rawReference = rawReference;
    }

    if (notes) {
        payload.notes = notes;
    }

    if (createdBy) {
        payload.createdBy = createdBy;
    }

    return ProgrammingRecordModel.create(payload);
};

export const createProgrammingRecordFromSingleScanRead = async (
    read: SingleScanRead & { _id?: unknown }
): Promise<ProgrammingRecord> => {
    const payload: ProgrammingRecord = {
        mode: "single_scan",
        sourceType: "single_scan_read",
        sourceReadId: getDocumentId(read),
        partNumber: read.partNumber,
        rawSourceData: {
            rawScan: read.rawScan.trim(),
        },
        status: read.status,
    };

    const serviceOrderId = listQueryValue(read.serviceOrderId);
    const serviceOrderFolio = listQueryValue(read.serviceOrder);
    const rfidProgram = listQueryValue(read.rfidProgram);
    const gtin = listQueryValue(read.gtin);
    const lot = listQueryValue(read.lot);
    const manufactureDate = listQueryValue(read.manufactureDate);
    const filterLabel = listQueryValue(read.filterLabel);
    const notes = listQueryValue(read.notes);
    const createdBy = listQueryValue(read.createdBy);

    if (serviceOrderId) {
        payload.serviceOrderId = serviceOrderId;
    }

    if (serviceOrderFolio) {
        payload.serviceOrderFolio = serviceOrderFolio;
    }

    if (rfidProgram) {
        payload.rfidProgram = rfidProgram;
    }

    if (gtin) {
        payload.gtin = gtin;
    }

    if (lot) {
        payload.lot = lot;
    }

    if (manufactureDate) {
        payload.manufactureDate = manufactureDate;
    }

    if (filterLabel) {
        payload.filterLabel = filterLabel;
    }

    if (notes) {
        payload.notes = notes;
    }

    if (createdBy) {
        payload.createdBy = createdBy;
    }

    return ProgrammingRecordModel.create(payload);
};

export const createProgrammingRecordFromDoubleScanRead = async (
    read: DoubleScanRead & { _id?: unknown }
): Promise<ProgrammingRecord> => {
    const payload: ProgrammingRecord = {
        mode: "double_scan",
        sourceType: "double_scan_read",
        sourceReadId: getDocumentId(read),
        partNumber: read.partNumber,
        rawSourceData: {
            firstBarcodeRaw: read.firstBarcodeRaw.trim(),
            secondBarcodeRaw: read.secondBarcodeRaw.trim(),
        },
        status: read.status,
    };

    const serviceOrderId = listQueryValue(read.serviceOrderId);
    const serviceOrderFolio = listQueryValue(read.serviceOrder);
    const partConfigId = listQueryValue(read.partConfigId);
    const rfidProgram = listQueryValue(read.rfidProgram);
    const gtin = listQueryValue(read.gtin);
    const lot = listQueryValue(read.lot);
    const manufactureDate = listQueryValue(read.manufactureDate);
    const filterLabel = listQueryValue(read.filterLabel);
    const notes = listQueryValue(read.notes);
    const createdBy = listQueryValue(read.createdBy);

    if (serviceOrderId) {
        payload.serviceOrderId = serviceOrderId;
    }

    if (serviceOrderFolio) {
        payload.serviceOrderFolio = serviceOrderFolio;
    }

    if (partConfigId) {
        payload.partConfigId = partConfigId;
    }

    if (rfidProgram) {
        payload.rfidProgram = rfidProgram;
    }

    if (gtin) {
        payload.gtin = gtin;
    }

    if (lot) {
        payload.lot = lot;
    }

    if (manufactureDate) {
        payload.manufactureDate = manufactureDate;
    }

    if (filterLabel) {
        payload.filterLabel = filterLabel;
    }

    if (notes) {
        payload.notes = notes;
    }

    if (createdBy) {
        payload.createdBy = createdBy;
    }

    return ProgrammingRecordModel.create(payload);
};
