export const normalizeOptionalText = (value: unknown): string | undefined => {
    if (typeof value !== "string") {
        return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
};

export const normalizeRequiredText = (value: unknown, fieldName: string): string => {
    const normalized = normalizeOptionalText(value);

    if (!normalized) {
        throw new Error(`El campo ${fieldName} es obligatorio`);
    }

    return normalized;
};

export const normalizeOptionalBoolean = (value: unknown): boolean | undefined => {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value !== "string") {
        return undefined;
    }

    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
        return true;
    }

    if (normalized === "false") {
        return false;
    }

    return undefined;
};

export const normalizeOptionalPositiveInteger = (value: unknown, fieldName: string): number | undefined => {
    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value === "string" && value.trim().length === 0) {
        return undefined;
    }

    const parsed = typeof value === "number" ? value : Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`El campo ${fieldName} debe ser un entero positivo`);
    }

    return parsed;
};
