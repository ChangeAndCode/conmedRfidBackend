import { Router } from "express";
import {
    createManualRead,
    getManualReadById,
    listManualReads,
} from "../controllers/manualReadController";
import { setApiAction } from "../middleware/apiRequestLogger";

const manualReadRouter = Router();

manualReadRouter.get("/", setApiAction("manual_read_list", "Lecturas manuales listadas"), listManualReads);
manualReadRouter.get("/:id", setApiAction("manual_read_get", "Lectura manual consultada"), getManualReadById);
manualReadRouter.post("/", setApiAction("manual_read_create"), createManualRead);

export default manualReadRouter;
