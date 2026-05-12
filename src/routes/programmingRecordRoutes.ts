import { Router } from "express";
import {
    getProgrammingRecordByIdHandler,
    listProgrammingRecordsHandler,
} from "../controllers/programmingRecordController";
import { setApiAction } from "../middleware/apiRequestLogger";

const programmingRecordRouter = Router();

programmingRecordRouter.get(
    "/",
    setApiAction("programming_record_list", "Programming records listados"),
    listProgrammingRecordsHandler
);
programmingRecordRouter.get(
    "/:id",
    setApiAction("programming_record_get", "Programming record consultado"),
    getProgrammingRecordByIdHandler
);

export default programmingRecordRouter;
