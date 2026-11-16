/**
 * קולט מיפויים — Google Apps Script (גרסה 2)
 * מקבל מיפוי מאתר "מיפוי מיומנויות בהוראה" ושומר אותו כשורה בגיליון "מיפויים".
 *
 * כללי קליטה (אפיון 2.0, סעיף 5):
 * - דיווח תקין נשמר אוטומטית בסטטוס valid ונספר בחישובים.
 * - דיווח עם שיוך לא מוכר, ערכים חריגים או חשד לכפילות נשמר בסטטוס flagged, ואינו נספר עד הכרעה.
 * - נדחית רק בקשה שאינה מיפוי (לא JSON, ללא מזהה תקין, גדולה מדי) או שליחה מהירה מדי.
 * - הנתונים המקוריים לעולם אינם נמחקים; כל קבלה ועדכון נרשמים בלשונית "יומן".
 * - שליחה חוזרת של אותו מיפוי מעדכנת את השורה; זמן היצירה (created_at) אינו משתנה.
 *
 * הגדרות (מאפייני הסקריפט, ולא בקוד): NOTIFY_EMAIL — כתובת/ות להודעה על כל מיפוי שמתקבל.
 * התקנה ועדכון: collector/README.md. אין לשנות ידנית את רשימת העמודות או את רשימת היחידות.
 */

var SHEET_NAME = 'מיפויים';
var LOG_SHEET_NAME = 'יומן';
var MAX_BODY_CHARS = 20000;
var RATE_PER_ID_SECONDS = 10;     // אותו מיפוי: שליחה אחת לכל 10 שניות
var RATE_GLOBAL_PER_MINUTE = 60;  // כלל השליחות: עד 60 בדקה
var SKILL_KEYS = ['T', 'C', 'R', 'H'];
var ACADEMIC_YEARS = ['תשפ״ו', 'תשפ״ז', 'תשפ״ח', 'תשפ״ט'];

// גיבוי בלבד: אם לא הוגדר מאפיין NOTIFY_EMAIL, משתמשים בערך הזה (בגרסה הציבורית — ריק)
var NOTIFY_EMAIL = '';

// העמודות, בסדר זהה ל-CSV של האתר (41 עמודות)
var CSV_COLUMNS = [
  'assessment_id', 'faculty', 'department', 'study_year', 'lecturer_name', 'course_name',
  'assessment_date', 'questionnaire_version',
  'T1', 'T2', 'T3', 'T4', 'T5', 'C1', 'C2', 'C3', 'C4', 'C5', 'R1', 'R2', 'R3', 'R4', 'R5',
  'T_P', 'T_A', 'C_P', 'C_A', 'R_P', 'R_A',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H_P', 'H_A',
  'T_status', 'C_status', 'R_status', 'H_status',
  'academic_year'
];
// עמודות ניהול, בסוף (נוספו בגרסה 2 של הקולט)
var ADMIN_COLUMNS = ['created_at', 'submissions', 'status', 'flags', 'dup_key', 'decision'];
var HEADER = ['received_at'].concat(CSV_COLUMNS, ADMIN_COLUMNS);
var LOG_HEADER = ['time', 'actor', 'action', 'assessment_id', 'details'];

// <units> רשימת הפקולטות והמחלקות — נוצרת אוטומטית מ-src/config/faculties_departments.json (npm run sync:collector)
var UNITS = {
  "הפקולטה להנדסה": ["הנדסה אזרחית", "הנדסת חשמל ואלקטרוניקה", "הנדסה כימית (ביוטכנולוגיה וחומרים)", "הנדסת מכונות מכטרוניקה", "הנדסת מחשבים ותוכנה", "הנדסת תעשייה וניהול"],
  "הפקולטה למדעי הטבע": ["ביולוגיה מולקולרית", "מדעי הכימיה", "מתמטיקה", "פיזיקה"],
  "הפקולטה למדעי החברה והרוח": ["ארץ ישראל וארכיאולוגיה (חוג)", "ביה\"ס לעבודה סוציאלית", "היסטוריה של עם ישראל (חוג)", "הכשרת מורים", "חינוך (חוג)", "חשבונאות (חוג)", "כלכלה ומנהל עסקים", "לימודי המזרח התיכון ומדעי המדינה", "מורשת ישראל", "מנהל עסקים", "סוציולוגיה ואנתרופולוגיה (חוג)", "פסיכולוגיה", "קרימינולוגיה (חוג)", "רב תחומי", "שמאות מקרקעין"],
  "הפקולטה למדעי הבריאות": ["הפרעות בתקשורת", "מדעי התזונה", "ניהול מערכות בריאות", "סיעוד", "פיזיותרפיה", "קדם רפואה", "ריפוי בעיסוק"],
  "בית הספר לרפואה": ["ביה\"ס לרפואה"],
  "בית הספר למדעי המחשב ובינה מלאכותית": ["מדעי המחשב", "מדעי הנתונים ובינה מלאכותית"],
  "בית הספר לארכיטקטורה": ["ארכיטקטורה"],
  "בית הספר לתקשורת": ["ביה\"ס לתקשורת"],
  "בית הספר ללימודים מתקדמים": ["ביה\"ס ללימודים מתקדמים"]
};
// </units>

/* ------------------------------------------------------------------ */
/* נקודות כניסה                                                         */
/* ------------------------------------------------------------------ */

/** הרצה ידנית פעם אחת בהתקנה חדשה: יוצר את הלשוניות ואת שורות הכותרת */
function setup() {
  getSheet_();
  getLogSheet_();
}

/**
 * הרצה ידנית פעם אחת בשדרוג מגרסה 1: מוסיף את עמודות הניהול לשורות הקיימות,
 * קובע created_at לפי received_at, מסמן חריגים וכפילויות. בטוח להרצה חוזרת.
 */
function migrate() {
  var sheet = getSheet_();
  var last = sheet.getLastRow();
  var migrated = 0;
  if (last >= 2) {
    var data = sheet.getRange(2, 1, last - 1, HEADER.length).getValues();
    // לפי סדר הקבלה, כדי שהדיווח המוקדם יותר יישאר תקין והמאוחר יסומן ככפול
    var order = data.map(function (_, i) { return i; }).sort(function (a, b) {
      return new Date(data[a][0]).getTime() - new Date(data[b][0]).getTime();
    });
    var seen = {};
    order.forEach(function (i) {
      var row = data[i];
      if (row[col_('created_at') - 1] !== '' && row[col_('created_at') - 1] !== null) {
        if (statusOf_(row) === 'valid') seen[row[col_('dup_key') - 1]] = row[1];
        return;
      }
      var r = {};
      CSV_COLUMNS.forEach(function (c, j) { r[c] = row[j + 1]; });
      var clean = clean_(r);
      if (clean.dupKey && seen[clean.dupKey] && seen[clean.dupKey] !== clean.values.assessment_id) {
        clean.flags.push('possible_duplicate:' + seen[clean.dupKey]);
      }
      var values = buildRow_(row[0], clean, row[0], 1, '');
      sheet.getRange(i + 2, 1, 1, values.length).setValues([values]);
      if (statusOf_(values) === 'valid' && clean.dupKey) seen[clean.dupKey] = clean.values.assessment_id;
      log_('migrate', 'migrated', clean.values.assessment_id, clean.flags.join(' '));
      migrated++;
    });
  }
  return migrated;
}

/** הרצה ידנית: שולח הודעת ניסיון לכתובת שהוגדרה */
function testNotification() {
  var to = notifyEmail_();
  if (!to) throw new Error('NOTIFY_EMAIL לא הוגדר במאפייני הסקריפט');
  MailApp.sendEmail(to, 'בדיקה: הודעות מיפוי מיומנויות', 'ההודעות על מיפויים חדשים יגיעו לכתובת זו.');
}

function doGet() {
  // אינו מחזיר נתונים — רק אישור שהשירות פעיל
  return json_({ ok: true, service: 'skills-mapping-collector', version: 2 });
}

function doPost(e) {
  var raw = (e && e.postData && e.postData.contents) || '';
  if (raw.length > MAX_BODY_CHARS) return json_({ ok: false, error: 'too_large' });
  var body;
  try { body = JSON.parse(raw); } catch (err) { return json_({ ok: false, error: 'bad_json' }); }
  if (!body || typeof body !== 'object' || !body.row || typeof body.row !== 'object') return json_({ ok: false, error: 'no_row' });
  var id = String(body.row.assessment_id || '');
  if (!isUuid_(id)) return json_({ ok: false, error: 'bad_id' });
  // שדה נסתר: דפדפן של מרצה אינו ממלא אותו. בוט שממלא אותו מקבל "אישור" אך דבר אינו נשמר.
  if (body.hp) return json_({ ok: true });

  var limited = rateLimit_(id);
  if (limited) return json_({ ok: false, error: limited });

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = getSheet_();
    var clean = clean_(body.row);
    var now = new Date();
    var existing = findRow_(sheet, id);
    var prev = existing > 0 ? sheet.getRange(existing, 1, 1, HEADER.length).getValues()[0] : null;

    var dupOf = findDuplicate_(sheet, clean.dupKey, id);
    if (dupOf) clean.flags.push('possible_duplicate:' + dupOf);

    var created = prev ? (prev[col_('created_at') - 1] || prev[0]) : now;
    var submissions = prev ? (Number(prev[col_('submissions') - 1]) || 1) + 1 : 1;
    var decision = prev ? String(prev[col_('decision') - 1] || '') : '';
    var values = buildRow_(now, clean, created, submissions, decision);

    if (existing > 0) sheet.getRange(existing, 1, 1, values.length).setValues([values]);
    else sheet.getRange(sheet.getLastRow() + 1, 1, 1, values.length).setValues([values]);

    var status = statusOf_(values);
    log_('collector', existing > 0 ? 'updated' : 'received', id, status + (clean.flags.length ? ' ' + clean.flags.join(' ') : ''));
    notify_(clean.values, existing > 0, status, clean.flags);
    return json_({ ok: true, updated: existing > 0 });
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* ניקוי ובדיקת תקינות                                                  */
/* ------------------------------------------------------------------ */

/**
 * מחזיר {values, flags, dupKey}. ערך לא תקין נשמר כטקסט (המקור נשמר) ומוסיף סימון.
 * ציוני התרגול וההערכה מחושבים מחדש בשרת מתוך התשובות.
 */
function clean_(r) {
  var v = {};
  var flags = [];
  function flag(f) { if (flags.indexOf(f) < 0) flags.push(f); }
  function rawText(x) { return guard_(x === undefined || x === null ? '' : String(x).slice(0, 300)); }
  function text(k, max) {
    var x = r[k];
    if (typeof x !== 'string' || !x.trim() || x.length > max) { flag('invalid_' + k); return rawText(x); }
    return guard_(x.replace(/\s+/g, ' ').trim());
  }

  v.assessment_id = String(r.assessment_id);
  v.faculty = text('faculty', 120);
  v.department = text('department', 120);
  v.lecturer_name = text('lecturer_name', 150);
  v.course_name = text('course_name', 200);
  if (!UNITS[v.faculty] || UNITS[v.faculty].indexOf(v.department) < 0) flag('unknown_unit');

  var year = Number(r.study_year);
  if (year >= 1 && year <= 5 && Math.floor(year) === year) v.study_year = year;
  else { flag('invalid_study_year'); v.study_year = rawText(r.study_year); }

  var ay = r.academic_year === undefined || r.academic_year === null ? '' : String(r.academic_year);
  if (ACADEMIC_YEARS.indexOf(ay) < 0) flag(ay ? 'invalid_academic_year' : 'missing_academic_year');
  v.academic_year = rawText(ay);

  // תאריך וגרסה נשמרים כטקסט (גרש בתחילה), כדי שהגיליון לא ימיר אותם לתאריך או למספר
  var date = dateText_(r.assessment_date);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) v.assessment_date = "'" + date;
  else { flag('invalid_assessment_date'); v.assessment_date = rawText(r.assessment_date); }
  var version = String(r.questionnaire_version);
  if (/^\d+\.\d+$/.test(version)) v.questionnaire_version = "'" + version;
  else { flag('invalid_questionnaire_version'); v.questionnaire_version = rawText(r.questionnaire_version); }

  SKILL_KEYS.forEach(function (k) {
    var status = r[k + '_status'];
    if (status !== 'answered' && status !== 'not_applicable') { flag('invalid_' + k + '_status'); status = rawText(status); }
    v[k + '_status'] = status;
    var nums = [];
    for (var n = 1; n <= 5; n++) {
      var x = r[k + n];
      if (status === 'not_applicable') {
        if (x !== '' && x !== undefined && x !== null) flag('invalid_' + k + n);
        v[k + n] = '';
        continue;
      }
      var num = Number(x);
      if (x === '' || x === null || x === undefined || !(num >= 0 && num <= 4 && Math.floor(num) === num)) {
        flag('invalid_' + k + n); v[k + n] = rawText(x); nums.push(null);
      } else { v[k + n] = num; nums.push(num); }
    }
    // ציונים: מחושבים מחדש מהתשובות (תרגול = ממוצע 1–4, הערכה = 5), כדי שלא יהיה אפשר לשלוח ציון שאינו תואם
    if (status === 'answered' && nums.length === 5 && nums.every(function (x) { return x !== null; })) {
      var p = Math.round(((nums[0] + nums[1] + nums[2] + nums[3]) / 4) * 100) / 100;
      var a = nums[4];
      var sentP = Number(r[k + '_P']), sentA = Number(r[k + '_A']);
      if (Math.abs(sentP - p) > 0.005 || Math.abs(sentA - a) > 0.005) flag('score_mismatch_' + k);
      v[k + '_P'] = p;
      v[k + '_A'] = a;
    } else {
      v[k + '_P'] = '';
      v[k + '_A'] = '';
    }
  });

  return { values: v, flags: flags, dupKey: dupKey_(v) };
}

/** מפתח כפילות: מרצה + קורס + מחלקה + שנה אקדמית + שנה בתואר, אחרי נרמול */
function dupKey_(v) {
  function norm(s) {
    return String(s || '').replace(/^'/, '').toLowerCase()
      .replace(/["'`״׳”“’‘]/g, '')
      .replace(/(^|\s)(דר|ד״ר|פרופסור|פרופ|פרופ׳|מר|גב|גברת|prof|dr)\.?(?=\s|$)/g, ' ')
      .replace(/[.,\-–—()]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  var lect = norm(v.lecturer_name), course = norm(v.course_name);
  if (!lect || !course) return '';
  return [lect, course, norm(v.department), norm(v.academic_year), String(v.study_year)].join('|');
}

/** מחפש דיווח תקין אחר עם אותו מפתח כפילות; מחזיר את מזהה הדיווח או '' */
function findDuplicate_(sheet, key, id) {
  if (!key) return '';
  var last = sheet.getLastRow();
  if (last < 2) return '';
  var rows = sheet.getRange(2, 1, last - 1, HEADER.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (row[1] !== id && row[col_('dup_key') - 1] === key && statusOf_(row) === 'valid') return row[1];
  }
  return '';
}

function buildRow_(receivedAt, clean, createdAt, submissions, decision) {
  var row = [receivedAt].concat(CSV_COLUMNS.map(function (c) { return clean.values[c]; }));
  var status = decision === 'excluded' ? 'excluded' : decision === 'included' ? 'valid' : clean.flags.length ? 'flagged' : 'valid';
  return row.concat([createdAt, submissions, status, clean.flags.join(' '), clean.dupKey, decision]);
}

function statusOf_(row) { return row[col_('status') - 1]; }

/* ------------------------------------------------------------------ */
/* עזרים                                                                */
/* ------------------------------------------------------------------ */

/** תאריך שהגיליון כבר המיר לאובייקט Date חוזר לפורמט YYYY-MM-DD */
function dateText_(x) {
  if (Object.prototype.toString.call(x) === '[object Date]' && !isNaN(x.getTime())) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate());
  }
  return x === undefined || x === null ? '' : String(x);
}

function isUuid_(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/** הגנה מפני נוסחאות: טקסט שמתחיל ב = + - @ נשמר כטקסט */
function guard_(s) {
  s = String(s);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/** הגבלת קצב: מחזיר קוד שגיאה, או '' אם מותר */
function rateLimit_(id) {
  var cache = CacheService.getScriptCache();
  if (cache.get('id:' + id)) return 'too_fast';
  var minuteKey = 'g:' + Math.floor(Date.now() / 60000);
  var count = Number(cache.get(minuteKey) || 0) + 1;
  if (count > RATE_GLOBAL_PER_MINUTE) return 'busy';
  cache.put(minuteKey, String(count), 120);
  cache.put('id:' + id, '1', RATE_PER_ID_SECONDS);
  return '';
}

function col_(name) { return HEADER.indexOf(name) + 1; }

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < HEADER.length) {
    // עמודות חדשות נוספות תמיד בסוף; מעדכנים את שורת הכותרת בלי לגעת בנתונים
    sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
  }
  return sheet;
}

function getLogSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LOG_SHEET_NAME) || ss.insertSheet(LOG_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, LOG_HEADER.length).setValues([LOG_HEADER]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function log_(actor, action, id, details) {
  var sheet = getLogSheet_();
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, LOG_HEADER.length).setValues([[new Date(), actor, action, id, details || '']]);
}

function findRow_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var ids = sheet.getRange(2, 2, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (ids[i][0] === id) return i + 2;
  return -1;
}

function notifyEmail_() {
  var fromProps = '';
  try { fromProps = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL') || ''; } catch (err) { fromProps = ''; }
  return fromProps || NOTIFY_EMAIL;
}

/** הודעה קצרה על מיפוי שהתקבל (ללא שם המרצה). כשל במייל אינו מבטל את שמירת המיפוי. */
function notify_(v, updated, status, flags) {
  var to = notifyEmail_();
  if (!to) return;
  try {
    var years = ['', 'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳'];
    var course = String(v.course_name).replace(/^'/, '');
    MailApp.sendEmail({
      to: to,
      name: 'מיפוי מיומנויות בהוראה',
      subject: (updated ? 'מיפוי עודכן: ' : 'מיפוי חדש התקבל: ') + course + (status === 'flagged' ? ' (לבדיקה)' : ''),
      body: [
        updated ? 'מיפוי שנשלח בעבר עודכן.' : 'התקבל מיפוי חדש.',
        status === 'flagged' ? 'המיפוי סומן לבדיקה ואינו נספר עד הכרעה: ' + flags.join(', ') : '',
        '',
        'קורס: ' + course,
        'פקולטה: ' + v.faculty,
        'מחלקה: ' + v.department,
        'שנה אקדמית: ' + (v.academic_year || '—'),
        'שנת לימודים בתואר: ' + (years[v.study_year] || v.study_year),
        'תאריך מיפוי: ' + String(v.assessment_date).replace(/^'/, ''),
        '',
        'הפרטים המלאים בגיליון: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()
      ].join('\n')
    });
  } catch (err) {
    console.error('notify failed: ' + err);
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
