import { Router } from "express";
import {
    createResponsibleController,
    deleteResponsibleController,
    listResponsibles,
    toggleResponsibleStatusController,
    updateResponsibleController,
} from "../controllers/responsibleController";

const router = Router();

router.get("/", listResponsibles);
router.post("/", createResponsibleController);
router.put("/:id", updateResponsibleController);
router.patch("/:id/toggle-status", toggleResponsibleStatusController);
router.delete("/:id", deleteResponsibleController);

export default router;