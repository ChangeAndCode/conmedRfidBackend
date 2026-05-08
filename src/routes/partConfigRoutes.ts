import { Router } from "express";
import {
    createPartConfig,
    deletePartConfig,
    getPartConfigById,
    listPartConfigsHandler,
    permanentlyDeletePartConfig,
    updatePartConfig,
} from "../controllers/partConfigController";
import { setApiAction } from "../middleware/apiRequestLogger";

const partConfigRouter = Router();

partConfigRouter.get("/", setApiAction("part_config_list", "Configuraciones de numero de parte listadas"), listPartConfigsHandler);
partConfigRouter.get("/:id", setApiAction("part_config_get", "Configuracion de numero de parte consultada"), getPartConfigById);
partConfigRouter.post("/", setApiAction("part_config_create"), createPartConfig);
partConfigRouter.patch("/:id", setApiAction("part_config_update"), updatePartConfig);
partConfigRouter.delete("/:id/permanent", setApiAction("part_config_delete_permanent"), permanentlyDeletePartConfig);
partConfigRouter.delete("/:id", setApiAction("part_config_delete"), deletePartConfig);

export default partConfigRouter;
