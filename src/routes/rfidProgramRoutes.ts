import { Router } from "express";
import {
    createRfidProgram,
    deleteRfidProgram,
    getRfidProgramById,
    listRfidProgramsHandler,
    updateRfidProgram,
} from "../controllers/rfidProgramController";
import { requireAuth, requireRoles } from "../middleware/auth";
import { setApiAction } from "../middleware/apiRequestLogger";

const rfidProgramRouter = Router();

rfidProgramRouter.get(
    "/",
    requireAuth,
    requireRoles("admin", "supervisor"),
    setApiAction("rfid_program_list", "RFID programs listados"),
    listRfidProgramsHandler
);
rfidProgramRouter.get(
    "/:id",
    requireAuth,
    requireRoles("admin", "supervisor"),
    setApiAction("rfid_program_get", "RFID program consultado"),
    getRfidProgramById
);
rfidProgramRouter.post("/", requireAuth, requireRoles("admin"), setApiAction("rfid_program_create"), createRfidProgram);
rfidProgramRouter.patch("/:id", requireAuth, requireRoles("admin"), setApiAction("rfid_program_update"), updateRfidProgram);
rfidProgramRouter.delete("/:id", requireAuth, requireRoles("admin"), setApiAction("rfid_program_delete"), deleteRfidProgram);

export default rfidProgramRouter;
