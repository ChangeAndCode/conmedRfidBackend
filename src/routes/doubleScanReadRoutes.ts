import { Router } from "express";
import {
    createDoubleScanRead,
    getDoubleScanReadById,
    listDoubleScanConfigs,
    listDoubleScanReads,
    resolveFirstDoubleScan,
} from "../controllers/doubleScanReadController";
import { setApiAction } from "../middleware/apiRequestLogger";

const doubleScanReadRouter = Router();

doubleScanReadRouter.get(
    "/configs",
    setApiAction("double_scan_config_list", "Configuraciones de doble lectura listadas"),
    listDoubleScanConfigs
);
doubleScanReadRouter.post(
    "/resolve-first-scan",
    setApiAction("double_scan_resolve_first_scan"),
    resolveFirstDoubleScan
);
doubleScanReadRouter.get("/", setApiAction("double_scan_read_list", "Lecturas dobles listadas"), listDoubleScanReads);
doubleScanReadRouter.get("/:id", setApiAction("double_scan_read_get", "Lectura doble consultada"), getDoubleScanReadById);
doubleScanReadRouter.post("/", setApiAction("double_scan_read_create"), createDoubleScanRead);

export default doubleScanReadRouter;
