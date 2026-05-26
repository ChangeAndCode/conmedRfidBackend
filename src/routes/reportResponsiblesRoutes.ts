import { Router } from "express";
import {
    getReportResponsiblesHandler,
    updateReportResponsiblesHandler,
} from "../controllers/reportResponsiblesController";
import { requireAuth, requireRoles } from "../middleware/auth";
import { setApiAction } from "../middleware/apiRequestLogger";

const reportResponsiblesRouter = Router();

reportResponsiblesRouter.use(requireAuth, requireRoles("admin"));

reportResponsiblesRouter.get(
    "/",
    setApiAction("report_responsibles_get", "Responsables de reporte consultados"),
    getReportResponsiblesHandler
);
reportResponsiblesRouter.put(
    "/",
    setApiAction("report_responsibles_update"),
    updateReportResponsiblesHandler
);

export default reportResponsiblesRouter;
