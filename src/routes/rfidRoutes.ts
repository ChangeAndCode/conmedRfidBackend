import { Router } from "express";
import { buildLegacyTagPayloadHandler } from "../controllers/rfidController";
import { setApiAction } from "../middleware/apiRequestLogger";

const rfidRouter = Router();

rfidRouter.post(
    "/build-payload",
    setApiAction("rfid_legacy_build_payload"),
    buildLegacyTagPayloadHandler
);

export default rfidRouter;
