import { ProgrammingRecord, ProgrammingRecordModel } from "../models/programmingRecord";
import {
    ServiceOrder,
    ServiceOrderModel,
    ServiceOrderStatus,
} from "../models/serviceOrder";
import {
    VerificationReport,
    VerificationReportHistoryEvent,
    VerificationReportHistoryEventType,
    VerificationReportModel,
    VerificationReportStatus,
} from "../models/verificationReport";
import { getPrintInterruptionTitleSnapshot } from "./printInterruptionService";
import { resolveVerificationReportRepresentativeNames } from "./reportResponsiblesService";
import { getDocumentId, getServiceOrderById, getServiceOrderProgress } from "./serviceOrderService";

type VerificationReportFilters = {
    serviceOrderId?: string;
    serviceOrderFolio?: string;
    status?: VerificationReportStatus;
};

type VerificationReportActor = {
    userId?: string;
    username?: string;
};

type CreateVerificationReportInput = {
    serviceOrderId: string;
    manufacturingRepresentativeName?: string;
    qualityRepresentativeName?: string;
    actor?: VerificationReportActor;
};

type UpdateVerificationReportStatusInput = {
    verificationReportId: string;
    printInterruptionId?: string;
    notes?: string;
    actor?: VerificationReportActor;
    source?: VerificationReportActionSource;
};

export type VerificationReportActionSource = "authenticated-dashboard" | "public-station";

type VerificationReportHeader = {
    partNumber: string;
    lot: string;
    manufactureDate: string;
};

type VerificationReportDocument = VerificationReport & {
    history: VerificationReportHistoryEvent[];
    save: () => Promise<VerificationReportDocument>;
};

type ServiceOrderDocument = ServiceOrder & {
    save: () => Promise<ServiceOrderDocument>;
};

export type VerificationReportAvailableActions = {
    canMarkPrinted: boolean;
    canMarkPrintInterrupted: boolean;
    canReprint: boolean;
};

const buildHistoryEvent = (
    type: VerificationReportHistoryEventType,
    actor?: VerificationReportActor,
    notes?: string,
    interruptionTitle?: string
): VerificationReportHistoryEvent => {
    const event: VerificationReportHistoryEvent = {
        type,
        occurredAt: new Date(),
    };

    if (actor?.userId) {
        event.performedByUserId = actor.userId;
    }

    if (actor?.username) {
        event.performedByUsername = actor.username;
    }

    if (interruptionTitle) {
        event.interruptionTitle = interruptionTitle;
    }

    if (notes) {
        event.notes = notes;
    }

    return event;
};

const listVerifiedProgrammingRecordsByServiceOrderId = async (
    serviceOrderId: string
): Promise<Array<ProgrammingRecord & { _id?: unknown }>> => {
    return ProgrammingRecordModel.find({
        serviceOrderId,
        status: "verified",
    }).sort({ createdAt: 1, verifiedAt: 1 });
};

const resolveRequiredHeaderField = (
    record: ProgrammingRecord,
    fieldName: "partNumber" | "lot" | "manufactureDate"
): string => {
    const value = record[fieldName];

    if (!value) {
        throw new Error(`No se puede generar el reporte porque falta ${fieldName} en al menos un registro verificado`);
    }

    return value;
};

const buildVerificationReportHeader = (
    records: ProgrammingRecord[]
): VerificationReportHeader => {
    if (records.length === 0) {
        throw new Error("No hay registros verificados para generar el reporte");
    }

    const firstRecord = records[0] as ProgrammingRecord;
    const header: VerificationReportHeader = {
        partNumber: resolveRequiredHeaderField(firstRecord, "partNumber"),
        lot: resolveRequiredHeaderField(firstRecord, "lot"),
        manufactureDate: resolveRequiredHeaderField(firstRecord, "manufactureDate"),
    };

    for (const record of records.slice(1)) {
        const partNumber = resolveRequiredHeaderField(record, "partNumber");
        const lot = resolveRequiredHeaderField(record, "lot");
        const manufactureDate = resolveRequiredHeaderField(record, "manufactureDate");

        if (
            partNumber !== header.partNumber
            || lot !== header.lot
            || manufactureDate !== header.manufactureDate
        ) {
            throw new Error(
                "La orden contiene multiples numeros de parte, lotes o fechas de manufactura y no puede generar un solo reporte"
            );
        }
    }

    return header;
};

export const verificationReportAlreadyExistsMessage = "La orden de servicio ya tiene un reporte de verificacion generado";
export const verificationReportNotFoundMessage = "Reporte de verificacion no encontrado";

export const isVerificationReportAlreadyExistsError = (error: unknown): boolean => {
    return error instanceof Error && error.message === verificationReportAlreadyExistsMessage;
};

export const isVerificationReportNotFoundError = (error: unknown): boolean => {
    return error instanceof Error && error.message === verificationReportNotFoundMessage;
};

const isDuplicateKeyError = (error: unknown): boolean => {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
};

export const listVerificationReports = async (
    filters: VerificationReportFilters = {}
): Promise<VerificationReport[]> => {
    const query: Record<string, string> = {};

    if (filters.serviceOrderId) {
        query.serviceOrderId = filters.serviceOrderId;
    }

    if (filters.serviceOrderFolio) {
        query.serviceOrderFolio = filters.serviceOrderFolio;
    }

    if (filters.status) {
        query.status = filters.status;
    }

    return VerificationReportModel.find(query).sort({ createdAt: -1 });
};

export const getVerificationReportById = async (id: string): Promise<VerificationReport | null> => {
    return VerificationReportModel.findById(id);
};

export const getVerificationReportByServiceOrderId = async (
    serviceOrderId: string
): Promise<VerificationReport | null> => {
    return VerificationReportModel.findOne({ serviceOrderId });
};

export const getVerificationReportAvailableActions = (
    status: VerificationReportStatus
): VerificationReportAvailableActions => {
    if (status === "generated") {
        return {
            canMarkPrinted: true,
            canMarkPrintInterrupted: true,
            canReprint: false,
        };
    }

    if (status === "print_interrupted") {
        return {
            canMarkPrinted: true,
            canMarkPrintInterrupted: false,
            canReprint: false,
        };
    }

    if (status === "printed") {
        return {
            canMarkPrinted: false,
            canMarkPrintInterrupted: false,
            canReprint: true,
        };
    }

    return {
        canMarkPrinted: false,
        canMarkPrintInterrupted: false,
        canReprint: true,
    };
};

export const hasVerificationReportForServiceOrder = async (serviceOrderId: string): Promise<boolean> => {
    const existingReport = await VerificationReportModel.exists({ serviceOrderId });
    return existingReport !== null;
};

export const createVerificationReport = async (
    input: CreateVerificationReportInput
): Promise<VerificationReport> => {
    if (await hasVerificationReportForServiceOrder(input.serviceOrderId)) {
        throw new Error(verificationReportAlreadyExistsMessage);
    }

    const serviceOrder = await getServiceOrderById(input.serviceOrderId);

    if (!serviceOrder) {
        throw new Error("La orden de servicio asociada no existe");
    }

    if (serviceOrder.status !== "closed") {
        throw new Error("La orden de servicio debe estar cerrada para generar el reporte");
    }

    const progress = await getServiceOrderProgress(input.serviceOrderId, serviceOrder.quantity);

    if (progress.verifiedCount !== serviceOrder.quantity) {
        throw new Error("La orden de servicio aun no completa todas sus verificaciones");
    }

    const verifiedRecords = await listVerifiedProgrammingRecordsByServiceOrderId(input.serviceOrderId);

    if (verifiedRecords.length !== serviceOrder.quantity) {
        throw new Error("La cantidad de registros verificados no coincide con la cantidad de la orden");
    }

    const header = buildVerificationReportHeader(verifiedRecords);
    const representativeNamesInput: {
        manufacturingRepresentativeName?: string;
        qualityRepresentativeName?: string;
    } = {};

    if (input.manufacturingRepresentativeName) {
        representativeNamesInput.manufacturingRepresentativeName = input.manufacturingRepresentativeName;
    }

    if (input.qualityRepresentativeName) {
        representativeNamesInput.qualityRepresentativeName = input.qualityRepresentativeName;
    }

    const representativeNames = await resolveVerificationReportRepresentativeNames(representativeNamesInput);
    const history = [
        buildHistoryEvent("generated", input.actor),
    ];

    try {
        const payload: Record<string, unknown> = {
            serviceOrderId: input.serviceOrderId,
            serviceOrderFolio: serviceOrder.folio,
            serviceOrderReadingMode: serviceOrder.readingMode,
            quantity: serviceOrder.quantity,
            partNumber: header.partNumber,
            lot: header.lot,
            manufactureDate: header.manufactureDate,
            manufacturingRepresentativeName: representativeNames.manufacturingRepresentativeName,
            qualityRepresentativeName: representativeNames.qualityRepresentativeName,
            rows: verifiedRecords.map((record) => {
                const programmedAt = record.programmedAt ?? record.createdAt;
                const verifiedAt = record.verifiedAt;

                if (!programmedAt || !verifiedAt) {
                    throw new Error("No se puede generar el reporte porque faltan fechas de programacion o verificacion");
                }

                return {
                    programmingRecordId: getDocumentId(record),
                    programmedAt,
                    verifiedAt,
                };
            }),
            status: "generated",
            history,
        };

        if (input.actor?.userId) {
            payload.generatedByUserId = input.actor.userId;
        }

        if (input.actor?.username) {
            payload.generatedByUsername = input.actor.username;
        }

        return await VerificationReportModel.create(payload);
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            throw new Error(verificationReportAlreadyExistsMessage);
        }

        throw error;
    }
};

const getExistingVerificationReport = async (id: string): Promise<VerificationReportDocument> => {
    const verificationReport = await VerificationReportModel.findById(id) as VerificationReportDocument | null;

    if (!verificationReport) {
        throw new Error(verificationReportNotFoundMessage);
    }

    return verificationReport;
};

const getExistingServiceOrder = async (serviceOrderId: string): Promise<ServiceOrderDocument> => {
    const serviceOrder = await ServiceOrderModel.findById(serviceOrderId) as ServiceOrderDocument | null;

    if (!serviceOrder) {
        throw new Error("La orden de servicio asociada no existe");
    }

    return serviceOrder;
};

const ensureServiceOrderStatus = (
    serviceOrder: ServiceOrder,
    expectedStatuses: ServiceOrderStatus[],
    message: string
): void => {
    if (!expectedStatuses.includes(serviceOrder.status)) {
        throw new Error(message);
    }
};

const blockServiceOrderForPrintInterruption = async (serviceOrderId: string): Promise<void> => {
    const serviceOrder = await getExistingServiceOrder(serviceOrderId);

    if (serviceOrder.status === "blocked") {
        return;
    }

    ensureServiceOrderStatus(
        serviceOrder,
        ["closed"],
        "La orden de servicio asociada no tiene un estado valido para marcar la impresion como interrumpida"
    );

    serviceOrder.status = "blocked";
    await serviceOrder.save();
};

const closeServiceOrderAfterPrinted = async (serviceOrderId: string): Promise<void> => {
    const serviceOrder = await getExistingServiceOrder(serviceOrderId);

    if (serviceOrder.status === "closed") {
        return;
    }

    ensureServiceOrderStatus(
        serviceOrder,
        ["blocked"],
        "La orden de servicio asociada no tiene un estado valido para completar la impresion"
    );

    serviceOrder.status = "closed";
    await serviceOrder.save();
};

export const markVerificationReportPrintInterrupted = async (
    input: UpdateVerificationReportStatusInput
): Promise<VerificationReport> => {
    const verificationReport = await getExistingVerificationReport(input.verificationReportId);

    if (verificationReport.status === "print_interrupted") {
        throw new Error("El reporte ya se encuentra marcado como impresion interrumpida");
    }

    if (verificationReport.status === "printed" || verificationReport.status === "reprinted") {
        throw new Error(
            "El reporte ya fue marcado como impreso; no puede marcarse como impresion interrumpida"
        );
    }

    const interruptionTitle = input.printInterruptionId
        ? await getPrintInterruptionTitleSnapshot(input.printInterruptionId)
        : undefined;

    verificationReport.status = "print_interrupted";
    verificationReport.lastPrintInterruptedAt = new Date();
    verificationReport.history.push(
        buildHistoryEvent("print_interrupted", input.actor, input.notes, interruptionTitle)
    );
    await verificationReport.save();
    await blockServiceOrderForPrintInterruption(verificationReport.serviceOrderId);

    return verificationReport;
};

export const markVerificationReportAsPrinted = async (
    input: UpdateVerificationReportStatusInput
): Promise<VerificationReport> => {
    const verificationReport = await getExistingVerificationReport(input.verificationReportId);
    const source = input.source ?? "authenticated-dashboard";

    if (verificationReport.status === "printed") {
        throw new Error("El reporte ya fue marcado como impreso");
    }

    if (verificationReport.status === "reprinted") {
        throw new Error("El reporte ya fue reimpreso; no puede marcarse nuevamente como impresion inicial");
    }

    if (source === "public-station" && verificationReport.status === "print_interrupted") {
        throw new Error(
            "El reporte con impresion interrumpida debe completarse desde el dashboard del supervisor"
        );
    }

    verificationReport.status = "printed";
    verificationReport.lastPrintedAt = new Date();
    verificationReport.history.push(buildHistoryEvent("printed", input.actor, input.notes));
    await verificationReport.save();
    await closeServiceOrderAfterPrinted(verificationReport.serviceOrderId);

    return verificationReport;
};

export const reprintVerificationReport = async (
    input: UpdateVerificationReportStatusInput
): Promise<VerificationReport> => {
    const verificationReport = await getExistingVerificationReport(input.verificationReportId);

    if (verificationReport.status === "generated" || verificationReport.status === "print_interrupted") {
        throw new Error("El reporte debe marcarse como impreso antes de reimprimirlo");
    }

    verificationReport.status = "reprinted";
    verificationReport.lastReprintedAt = new Date();
    verificationReport.history.push(buildHistoryEvent("reprinted", input.actor, input.notes));
    await verificationReport.save();

    return verificationReport;
};
