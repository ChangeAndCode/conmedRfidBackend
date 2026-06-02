import { Router } from "express";
import { listPrintInterruptionsHandler } from "../controllers/printInterruptionController";
import {
    publicMarkVerificationReportPrintInterruptedHandler,
    publicMarkVerificationReportPrintedHandler,
} from "../controllers/verificationReportController";
import { setApiAction } from "../middleware/apiRequestLogger";

const publicStationRouter = Router();

publicStationRouter.get(
    "/print-interruptions",
    setApiAction("public_print_interruption_list", "Interrupciones publicas de impresion listadas"),
    listPrintInterruptionsHandler
);

publicStationRouter.post(
    "/verification-reports/:id/print-interrupted",
    setApiAction("public_verification_report_print_interrupted"),
    publicMarkVerificationReportPrintInterruptedHandler
);

publicStationRouter.post(
    "/verification-reports/:id/print-completed",
    setApiAction("public_verification_report_print_completed"),
    publicMarkVerificationReportPrintedHandler
);

export default publicStationRouter;
