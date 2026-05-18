import { Router } from "express";
import { requireAuth, requireRoles } from "../middleware/auth";
import {
  getUsers,
  updateUserStatus,
  deleteUser,
} from "../controllers/userController";

const router = Router();

router.get("/", requireAuth, requireRoles("admin"), getUsers);

router.patch("/:id/status", requireAuth, requireRoles("admin"), updateUserStatus);

router.delete("/:id", requireAuth, requireRoles("admin"), deleteUser);

export default router;