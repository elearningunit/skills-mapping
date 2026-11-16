// כתובת קולט המיפויים (Google Apps Script Web App) של הרשות לחדשנות בהוראה.
// כל עוד הכתובת ריקה, כפתור "שליחה לרשות" אינו מוצג. ראו collector/README.md.
// (VITE_SUBMIT_URL משמש רק לבדיקות, להפניית השליחה לכתובת מדומה.)
const COLLECTOR_URL = '';

export const SUBMIT_URL: string = (import.meta.env.VITE_SUBMIT_URL as string | undefined) || COLLECTOR_URL;
