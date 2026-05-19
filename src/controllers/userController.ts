import { Request, Response } from "express";
import { UserModel } from "../models/user";

const toPublicUser = (user: any) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getUsers = async (_req: Request, res: Response) => {
  try {
    const users = await UserModel.find().sort({ createdAt: -1 });

    return res.json({
      users: users.map(toPublicUser),
    });
  } catch (error) {
    console.error("Error getting users:", error);
    return res.status(500).json({ message: "Error al obtener usuarios" });
  }
};

export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const currentUser = (req as any).user;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "El estado isActive es requerido" });
    }

    if (currentUser?.id === id && isActive === false) {
      return res.status(400).json({
        message: "No puedes deshabilitar tu propio usuario",
      });
    }

    const user = await UserModel.findByIdAndUpdate(
      id,
      { isActive },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.json({
      message: isActive ? "Usuario habilitado correctamente" : "Usuario deshabilitado correctamente",
      user: toPublicUser(user),
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    return res.status(500).json({ message: "Error al actualizar usuario" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentUser = (req as any).user;

    if (currentUser?.id === id) {
      return res.status(400).json({
        message: "No puedes eliminar tu propio usuario",
      });
    }

    const user = await UserModel.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ message: "Error al eliminar usuario" });
  }
};
