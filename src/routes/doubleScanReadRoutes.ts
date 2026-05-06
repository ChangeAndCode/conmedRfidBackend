import { Router } from "express";
import {
    createDoubleScanRead,
    getDoubleScanReadById,
    listDoubleScanConfigs,
    listDoubleScanReads,
    resolveFirstDoubleScan,
} from "../controllers/doubleScanReadController";

const doubleScanReadRouter = Router();

doubleScanReadRouter.get("/configs", listDoubleScanConfigs);
doubleScanReadRouter.post("/resolve-first-scan", resolveFirstDoubleScan);
doubleScanReadRouter.get("/", listDoubleScanReads);
doubleScanReadRouter.get("/:id", getDoubleScanReadById);
doubleScanReadRouter.post("/", createDoubleScanRead);

export default doubleScanReadRouter;
