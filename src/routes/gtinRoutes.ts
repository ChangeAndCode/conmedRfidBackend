import { Router } from "express";
import { createGtin, deleteGtin, getGtinById, listGtinsHandler, updateGtin } from "../controllers/gtinController";
import { setApiAction } from "../middleware/apiRequestLogger";

const gtinRouter = Router();

gtinRouter.get("/", setApiAction("gtin_list", "GTIN listados"), listGtinsHandler);
gtinRouter.get("/:id", setApiAction("gtin_get", "GTIN consultado"), getGtinById);
gtinRouter.post("/", setApiAction("gtin_create"), createGtin);
gtinRouter.patch("/:id", setApiAction("gtin_update"), updateGtin);
gtinRouter.delete("/:id", setApiAction("gtin_delete"), deleteGtin);

export default gtinRouter;
