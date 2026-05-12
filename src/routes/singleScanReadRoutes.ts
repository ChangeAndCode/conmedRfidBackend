import { Router } from "express";
import {
    createSingleScanRead,
    getSingleScanReadById,
    listSingleScanReads,
    resolveSingleScanRead,
} from "../controllers/singleScanReadController";
import { setApiAction } from "../middleware/apiRequestLogger";

const singleScanReadRouter = Router();

singleScanReadRouter.get("/", setApiAction("single_scan_read_list", "Lecturas single scan listadas"), listSingleScanReads);
singleScanReadRouter.post(
    "/resolve",
    setApiAction("single_scan_read_resolve", "Lectura single scan resuelta"),
    resolveSingleScanRead
);
singleScanReadRouter.get("/:id", setApiAction("single_scan_read_get", "Lectura single scan consultada"), getSingleScanReadById);
singleScanReadRouter.post("/", setApiAction("single_scan_read_create"), createSingleScanRead);

export default singleScanReadRouter;
