// כניסה לתצוגת הדגמה: מחבר נתוני דוגמה בדויים במקום השרת, ואז טוען את ממשק הרשות הרגיל.
import { demoApi } from './demo';

window.__ADMIN_API__ = demoApi();
void import('./main');
