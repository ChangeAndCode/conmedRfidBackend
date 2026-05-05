import { Router } from "express";
import {
    createDoubleScanRead,
    getDoubleScanReadById,
    listDoubleScanConfigs,
    listDoubleScanReads,
} from "../controllers/doubleScanReadController";

const doubleScanReadRouter = Router();

doubleScanReadRouter.get("/configs", listDoubleScanConfigs);
doubleScanReadRouter.get("/", listDoubleScanReads);
doubleScanReadRouter.get("/:id", getDoubleScanReadById);
doubleScanReadRouter.post("/", createDoubleScanRead);

export default doubleScanReadRouter;
