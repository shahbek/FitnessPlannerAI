
export const kgToLbs = (kg: number): number => {
    return Math.round(kg * 2.20462);
};

export const lbsToKg = (lbs: number): number => {
    return Math.round(lbs / 2.20462);
};

export const cmToFtIn = (cm: number): { ft: number; in: number } => {
    const totalInches = cm / 2.54;
    const ft = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return { ft, in: inches };
};

export const ftInToCm = (ft: number, inches: number): number => {
    const totalInches = (ft * 12) + inches;
    return Math.round(totalInches * 2.54);
};

export const formatHeight = (cm: number, units: 'metric' | 'imperial'): string => {
    if (units === 'imperial') {
        const { ft, in: inches } = cmToFtIn(cm);
        return `${ft}'${inches}"`;
    }
    return `${cm} cm`;
};

export const formatWeight = (kg: number, units: 'metric' | 'imperial'): string => {
    if (units === 'imperial') {
        return `${kgToLbs(kg)} lbs`;
    }
    return `${kg} kg`;
};

export const cmToInches = (cm: number): number => {
    return cm / 2.54;
};
