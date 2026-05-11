import { Router } from "express";
import {
    createPartConfig,
    deletePartConfig,
    getPartConfigById,
    listPartConfigsHandler,
    permanentlyDeletePartConfig,
    updatePartConfig,
} from "../controllers/partConfigController";
import { requireAuth, requireRoles } from "../middleware/auth";
import { setApiAction } from "../middleware/apiRequestLogger";

const partConfigRouter = Router();

partConfigRouter.get(
    "/",
    requireAuth,
    requireRoles("admin", "supervisor"),
    setApiAction("part_config_list", "Configuraciones de numero de parte listadas"),
    listPartConfigsHandler
);
partConfigRouter.get(
    "/:id",
    requireAuth,
    requireRoles("admin", "supervisor"),
    setApiAction("part_config_get", "Configuracion de numero de parte consultada"),
    getPartConfigById
);
partConfigRouter.post("/", requireAuth, requireRoles("admin"), setApiAction("part_config_create"), createPartConfig);
partConfigRouter.patch("/:id", requireAuth, requireRoles("admin"), setApiAction("part_config_update"), updatePartConfig);
partConfigRouter.delete(
    "/:id/permanent",
    requireAuth,
    requireRoles("admin"),
    setApiAction("part_config_delete_permanent"),
    permanentlyDeletePartConfig
);
partConfigRouter.delete("/:id", requireAuth, requireRoles("admin"), setApiAction("part_config_delete"), deletePartConfig);

export default partConfigRouter;
