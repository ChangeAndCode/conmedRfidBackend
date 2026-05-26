import { Router } from "express";
import {
    createVerificationReportHandler,
    getVerificationReportByIdHandler,
    listVerificationReportsHandler,
    markVerificationReportPrintInterruptedHandler,
    markVerificationReportPrintedHandler,
    reprintVerificationReportHandler,
} from "../controllers/verificationReportController";
import { optionalAuth, requireAuth, requireRoles } from "../middleware/auth";
import { setApiAction } from "../middleware/apiRequestLogger";

const verificationReportRouter = Router();

verificationReportRouter.post(
    "/",
    optionalAuth,
    setApiAction("verification_report_create"),
    createVerificationReportHandler
);

verificationReportRouter.use(requireAuth);

verificationReportRouter.get(
    "/",
    requireRoles("admin", "supervisor"),
    setApiAction("verification_report_list", "Reportes de verificacion listados"),
    listVerificationReportsHandler
);
verificationReportRouter.get(
    "/:id",
    requireRoles("admin", "supervisor"),
    setApiAction("verification_report_get", "Reporte de verificacion consultado"),
    getVerificationReportByIdHandler
);
verificationReportRouter.post(
    "/:id/print-interrupted",
    requireRoles("admin", "supervisor"),
    setApiAction("verification_report_print_interrupted"),
    markVerificationReportPrintInterruptedHandler
);
verificationReportRouter.post(
    "/:id/print-completed",
    requireRoles("admin", "supervisor"),
    setApiAction("verification_report_print_completed"),
    markVerificationReportPrintedHandler
);
verificationReportRouter.post(
    "/:id/reprint",
    requireRoles("admin"),
    setApiAction("verification_report_reprint"),
    reprintVerificationReportHandler
);

export default verificationReportRouter;
