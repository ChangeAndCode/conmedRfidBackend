import { Request, Response } from "express";
import {
    createResponsible,
    deleteResponsible,
    getResponsibles,
    toggleResponsibleStatus,
    updateResponsible,
} from "../services/responsibleService";

export const listResponsibles = async (_req: Request, res: Response): Promise<void> => {
    try {
        const responsibles = await getResponsibles();
        res.json({ data: responsibles });
    } catch (error) {
        res.status(500).json({ message: "Error al obtener responsables" });
    }
};

export const createResponsibleController = async (req: Request, res: Response): Promise<void> => {
    try {
        const responsible = await createResponsible(req.body);
        res.status(201).json({
            message: "Responsable creado correctamente",
            data: responsible,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Error al crear responsable";
        res.status(400).json({ message });
    }
};

export const updateResponsibleController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (typeof id !== "string") {
            res.status(400).json({ message: "ID de responsable inválido" });
            return;
        }

        const responsible = await updateResponsible(id, req.body);
        res.json({
            message: "Responsable actualizado correctamente",
            data: responsible,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Error al actualizar responsable";
        res.status(400).json({ message });
    }
};

export const toggleResponsibleStatusController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (typeof id !== "string") {
            res.status(400).json({ message: "ID de responsable inválido" });
            return;
        }

        const responsible = await toggleResponsibleStatus(id);
        res.json({
            message: "Estatus de responsable actualizado correctamente",
            data: responsible,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Error al cambiar estatus";
        res.status(400).json({ message });
    }
};

export const deleteResponsibleController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (typeof id !== "string") {
            res.status(400).json({ message: "ID de responsable inválido" });
            return;
        }

        await deleteResponsible(id);
        res.json({ message: "Responsable eliminado correctamente" });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Error al eliminar responsable";
        res.status(400).json({ message });
    }
};