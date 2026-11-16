// כתובת קולט המיפויים (Google Apps Script Web App) של הרשות לחדשנות בהוראה.
// כל עוד הכתובת ריקה, כפתור "שליחה לרשות" אינו מוצג. ראו collector/README.md.
// (VITE_SUBMIT_URL משמש רק לבדיקות, להפניית השליחה לכתובת מדומה.)
const COLLECTOR_URL =
  'https://script.google.com/macros/s/AKfycbzeMYlddVTwGy4gxwqh81DNZssLsJJ_ptLYYll44ZU5rHY4KxZB-yM6PRAw_Da7pxbPJw/exec';

export const SUBMIT_URL: string = (import.meta.env.VITE_SUBMIT_URL as string | undefined) || COLLECTOR_URL;
