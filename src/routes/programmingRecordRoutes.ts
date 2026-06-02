import { Router } from "express";
import {
    buildProgrammingRecordRfidPayloadHandler,
    completeProgrammingRecordHandler,
    getProgrammingRecordByIdHandler,
    listProgrammingRecordsHandler,
    resolveProgrammingRecordHandler,
    resolveVerificationHandler,
    verifyProgrammingRecordHandler,
} from "../controllers/programmingRecordController";
import { setApiAction } from "../middleware/apiRequestLogger";
import { optionalAuth } from "../middleware/auth";

const programmingRecordRouter = Router();

programmingRecordRouter.post(
    "/resolve",
    setApiAction("programming_record_resolve", "Programming record resuelto"),
    resolveProgrammingRecordHandler
);
programmingRecordRouter.post(
    "/resolve-verification",
    setApiAction("programming_record_resolve_verification", "Verificacion RFID resuelta"),
    resolveVerificationHandler
);
programmingRecordRouter.post(
    "/:id/build-rfid-payload",
    setApiAction("programming_record_build_rfid_payload", "Payload RFID de programming record construido"),
    buildProgrammingRecordRfidPayloadHandler
);
programmingRecordRouter.post(
    "/:id/complete-programming",
    optionalAuth,
    setApiAction("programming_record_complete_programming", "Programming record marcado como programado"),
    completeProgrammingRecordHandler
);
programmingRecordRouter.post(
    "/:id/verify",
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
