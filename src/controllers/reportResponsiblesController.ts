import { Request, Response } from "express";
import {
    getReportResponsibles,
    updateReportResponsibles,
} from "../services/reportResponsiblesService";
import { normalizeRequiredText } from "../utils/requestNormalization";

type ReportResponsiblesBody = {
    manufacturingRepresentativeName?: unknown;
    qualityRepresentativeName?: unknown;
};

const toReportResponsiblesResponse = (
    settings: {
        manufacturingRepresentativeName: string;
        qualityRepresentativeName: string;
    } | null
): Record<string, unknown> => {
    if (!settings) {
        return {
            isConfigured: false,
            manufacturingRepresentativeName: "",
            qualityRepresentativeName: "",
        };
    }

    return {
        isConfigured: true,
        manufacturingRepresentativeName: settings.manufacturingRepresentativeName,
        qualityRepresentativeName: settings.qualityRepresentativeName,
    };
};

export const getReportResponsiblesHandler = async (_req: Request, res: Response): Promise<void> => {
    const settings = await getReportResponsibles();

    res.json({
        data: toReportResponsiblesResponse(settings),
    });
};

export const updateReportResponsiblesHandler = async (
    req: Request<unknown, unknown, ReportResponsiblesBody>,
    res: Response
): Promise<void> => {
    try {
        const settings = await updateReportResponsibles({
            manufacturingRepresentativeName: normalizeRequiredText(
                req.body.manufacturingRepresentativeName,
                "manufacturingRepresentativeName"
            ),
            qualityRepresentativeName: normalizeRequiredText(
                req.body.qualityRepresentativeName,
                "qualityRepresentativeName"
            ),
        });

        res.json({
            message: "Responsables de reporte actualizados",
            data: toReportResponsiblesResponse(settings),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudieron actualizar los responsables";
        res.status(400).json({ message });
    }
};
