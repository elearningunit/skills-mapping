import { PRIVACY_POLICY_URL } from '../config/privacy';

export function PrivacyNotice() {
  return (
    <aside className="privacy-notice" aria-labelledby="pn-h">
      <h2 id="pn-h">לתשומת ליבך</h2>
      <p>
        המידע ייאסף על ידי הרשות לחדשנות בהוראה, אוניברסיטת אריאל בשומרון לצורך קידום מהלך הטמעת מיומנויות באקדמיה.
        מסירת המידע אינה חובה על פי דין, אך ללא מסירת הפרטים הנדרשים לא ניתן יהיה להשלים את התהליך.
        למידע נוסף ולמימוש זכויות עיון ותיקון, ראו{' '}
        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer">
          מדיניות הפרטיות באתר האוניברסיטה
          <span className="sr-only"> (נפתח בלשונית חדשה)</span>
        </a>
        .
      </p>
    </aside>
  );
}
