import { Router } from "express";
import {
    createRfidProgram,
    deleteRfidProgram,
    getRfidProgramById,
    listRfidProgramsHandler,
    updateRfidProgram,
} from "../controllers/rfidProgramController";
import { setApiAction } from "../middleware/apiRequestLogger";

const rfidProgramRouter = Router();

rfidProgramRouter.get("/", setApiAction("rfid_program_list", "RFID programs listados"), listRfidProgramsHandler);
rfidProgramRouter.get("/:id", setApiAction("rfid_program_get", "RFID program consultado"), getRfidProgramById);
rfidProgramRouter.post("/", setApiAction("rfid_program_create"), createRfidProgram);
rfidProgramRouter.patch("/:id", setApiAction("rfid_program_update"), updateRfidProgram);
rfidProgramRouter.delete("/:id", setApiAction("rfid_program_delete"), deleteRfidProgram);

export default rfidProgramRouter;
