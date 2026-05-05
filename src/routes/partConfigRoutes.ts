import { Router } from "express";
import {
    createPartConfig,
    deletePartConfig,
    getPartConfigById,
    listPartConfigsHandler,
    permanentlyDeletePartConfig,
    updatePartConfig,
} from "../controllers/partConfigController";

const partConfigRouter = Router();

partConfigRouter.get("/", listPartConfigsHandler);
partConfigRouter.get("/:id", getPartConfigById);
partConfigRouter.post("/", createPartConfig);
partConfigRouter.patch("/:id", updatePartConfig);
partConfigRouter.delete("/:id/permanent", permanentlyDeletePartConfig);
partConfigRouter.delete("/:id", deletePartConfig);

export default partConfigRouter;
