import { Router } from "express";
import {
    createPrintInterruptionHandler,
    deletePrintInterruptionHandler,
    listPrintInterruptionsHandler,
} from "../controllers/printInterruptionController";
import { requireAuth, requireRoles } from "../middleware/auth";
import { setApiAction } from "../middleware/apiRequestLogger";

const printInterruptionRouter = Router();

printInterruptionRouter.get(
    "/",
    requireAuth,
    requireRoles("admin", "supervisor"),
    setApiAction("print_interruption_list", "Interrupciones de impresion listadas"),
    listPrintInterruptionsHandler
);
printInterruptionRouter.post(
    "/",
    requireAuth,
    requireRoles("admin"),
    setApiAction("print_interruption_create"),
    createPrintInterruptionHandler
);
printInterruptionRouter.delete(
    "/:id",
    requireAuth,
    requireRoles("admin"),
    setApiAction("print_interruption_delete"),
    deletePrintInterruptionHandler
);

export default printInterruptionRouter;
