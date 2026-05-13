import { Router } from "express";
import {
    getProgrammingRecordByIdHandler,
    listProgrammingRecordsHandler,
    resolveProgrammingRecordHandler,
    verifyProgrammingRecordHandler,
} from "../controllers/programmingRecordController";
import { optionalAuth } from "../middleware/auth";
import { setApiAction } from "../middleware/apiRequestLogger";

const programmingRecordRouter = Router();

programmingRecordRouter.post(
    "/resolve",
    setApiAction("programming_record_resolve", "Programming record resuelto"),
    resolveProgrammingRecordHandler
);
programmingRecordRouter.post(
    "/:id/verify",
    optionalAuth,
    setApiAction("programming_record_verify", "Programming record verificado"),
    verifyProgrammingRecordHandler
);
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
