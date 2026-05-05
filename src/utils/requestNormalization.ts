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
