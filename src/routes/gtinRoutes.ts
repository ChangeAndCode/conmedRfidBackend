import { Router } from "express";
import { createGtin, deleteGtin, getGtinById, listGtinsHandler, updateGtin } from "../controllers/gtinController";
import { requireAuth, requireRoles } from "../middleware/auth";
import { setApiAction } from "../middleware/apiRequestLogger";

const gtinRouter = Router();

gtinRouter.get(
    "/",
    requireAuth,
    requireRoles("admin", "supervisor"),
    setApiAction("gtin_list", "GTIN listados"),
    listGtinsHandler
);
gtinRouter.get(
    "/:id",
    requireAuth,
    requireRoles("admin", "supervisor"),
    setApiAction("gtin_get", "GTIN consultado"),
    getGtinById
);
gtinRouter.post("/", requireAuth, requireRoles("admin"), setApiAction("gtin_create"), createGtin);
gtinRouter.patch("/:id", requireAuth, requireRoles("admin"), setApiAction("gtin_update"), updateGtin);
gtinRouter.delete("/:id", requireAuth, requireRoles("admin"), setApiAction("gtin_delete"), deleteGtin);

export default gtinRouter;
