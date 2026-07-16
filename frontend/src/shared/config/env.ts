/** Единственная точка конфигурации фронта. На проде Vercel задаёт VITE_API_URL. */
export const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';
export const IS_DEV = import.meta.env.DEV;
