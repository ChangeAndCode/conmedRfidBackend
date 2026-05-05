import { Router } from "express";
import {
    createManualRead,
    getManualReadById,
    listManualReads,
} from "../controllers/manualReadController";

const manualReadRouter = Router();

manualReadRouter.get("/", listManualReads);
manualReadRouter.get("/:id", getManualReadById);
manualReadRouter.post("/", createManualRead);

export default manualReadRouter;
