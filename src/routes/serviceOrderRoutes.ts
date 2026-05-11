import { Router } from "express";
import {
    createServiceOrder,
    getServiceOrderByIdHandler,
    listOpenServiceOrdersByGtinHandler,
    listOpenManualServiceOrdersHandler,
    listOpenServiceOrdersByPartNumberHandler,
    listServiceOrderPartConfigOptions,
    listServiceOrdersHandler,
    updateServiceOrder,
} from "../controllers/serviceOrderController";
import {
    createServiceOrderChangeRequest,
    getServiceOrderChangeRequestByIdHandler,
    listServiceOrderChangeRequestsHandler,
    resolveServiceOrderChangeRequest,
} from "../controllers/serviceOrderChangeRequestController";
import { requireAuth, requireRoles } from "../middleware/auth";
import { setApiAction } from "../middleware/apiRequestLogger";

const serviceOrderRouter = Router();

serviceOrderRouter.get(
    "/resolve-by-gtin",
    setApiAction("service_order_resolve_by_gtin", "Ordenes de servicio resueltas por GTIN"),
    listOpenServiceOrdersByGtinHandler
);
serviceOrderRouter.get(
    "/resolve-by-part-number",
    setApiAction("service_order_resolve_by_part_number", "Ordenes de servicio resueltas por numero de parte"),
    listOpenServiceOrdersByPartNumberHandler
);
serviceOrderRouter.get(
    "/resolve-manual-open",
    setApiAction("service_order_resolve_manual_open", "Ordenes manuales abiertas resueltas"),
    listOpenManualServiceOrdersHandler
);
serviceOrderRouter.get(
    "/:id/part-config-options",
    setApiAction("service_order_part_config_options", "Opciones de numero de parte listadas"),
    listServiceOrderPartConfigOptions
);
serviceOrderRouter.post(
    "/:id/change-requests",
    setApiAction("service_order_change_request_create"),
    createServiceOrderChangeRequest
);

serviceOrderRouter.use(requireAuth, requireRoles("supervisor"));

serviceOrderRouter.get("/", setApiAction("service_order_list", "Ordenes de servicio listadas"), listServiceOrdersHandler);
serviceOrderRouter.post("/", setApiAction("service_order_create"), createServiceOrder);
serviceOrderRouter.get(
    "/change-requests",
    setApiAction("service_order_change_request_list", "Solicitudes de cambio listadas"),
    listServiceOrderChangeRequestsHandler
);
serviceOrderRouter.get(
    "/change-requests/:id",
    setApiAction("service_order_change_request_get", "Solicitud de cambio consultada"),
    getServiceOrderChangeRequestByIdHandler
);
serviceOrderRouter.patch(
    "/change-requests/:id/resolve",
    setApiAction("service_order_change_request_resolve"),
    resolveServiceOrderChangeRequest
);
serviceOrderRouter.get("/:id", setApiAction("service_order_get", "Orden de servicio consultada"), getServiceOrderByIdHandler);
serviceOrderRouter.patch("/:id", setApiAction("service_order_update"), updateServiceOrder);

export default serviceOrderRouter;
