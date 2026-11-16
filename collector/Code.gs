/**
 * קולט מיפויים — Google Apps Script
 * מקבל מיפוי מאתר "מיפוי מיומנויות בהוראה" ושומר אותו כשורה בגיליון "מיפויים".
 * שליחה חוזרת של אותו מיפוי (אותו assessment_id) מעדכנת את השורה הקיימת ואינה יוצרת כפילות.
 *
 * התקנה: ראו collector/README.md. אין לשנות את רשימת העמודות ידנית — היא תואמת לקובץ ה-CSV של האתר.
 */

var SHEET_NAME = 'מיפויים';
var SKILL_KEYS = ['T', 'C', 'R', 'H'];

// העמודות, בסדר זהה ל-CSV של האתר (40 עמודות), ועמודת זמן קבלה בתחילה
var CSV_COLUMNS = [
  'assessment_id', 'faculty', 'department', 'study_year', 'lecturer_name', 'course_name',
  'assessment_date', 'questionnaire_version',
  'T1', 'T2', 'T3', 'T4', 'T5', 'C1', 'C2', 'C3', 'C4', 'C5', 'R1', 'R2', 'R3', 'R4', 'R5',
  'T_P', 'T_A', 'C_P', 'C_A', 'R_P', 'R_A',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H_P', 'H_A',
  'T_status', 'C_status', 'R_status', 'H_status'
];
var HEADER = ['received_at'].concat(CSV_COLUMNS);

/** הרצה ידנית פעם אחת: יוצר את הגיליון ואת שורת הכותרת */
function setup() {
  getSheet_();
}

function doGet() {
  // אינו מחזיר נתונים — רק אישור שהשירות פעיל
  return json_({ ok: true, service: 'skills-mapping-collector' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var row = validate_(body.row || {});
    var sheet = getSheet_();
    var values = [new Date()].concat(CSV_COLUMNS.map(function (c) { return row[c]; }));
    var existing = findRow_(sheet, row.assessment_id);
    if (existing > 0) {
      sheet.getRange(existing, 1, 1, values.length).setValues([values]);
    } else {
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, values.length).setValues([values]);
    }
    return json_({ ok: true, updated: existing > 0 });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findRow_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var ids = sheet.getRange(2, 2, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (ids[i][0] === id) return i + 2;
  return -1;
}

/** בדיקת תקינות: רק מבנה ותחום ערכים צפויים נשמרים בגיליון */
function validate_(r) {
  var out = {};
  function fail(m) { throw new Error('invalid ' + m); }
  function text(k, max) {
    var v = r[k];
    if (typeof v !== 'string' || !v.trim() || v.length > max) fail(k);
    // הגנה מפני נוסחאות: טקסט שמתחיל ב = + - @ נשמר כטקסט
    return /^[=+\-@]/.test(v) ? "'" + v : v;
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(r.assessment_id))) fail('assessment_id');
  out.assessment_id = String(r.assessment_id);
  out.faculty = text('faculty', 120);
  out.department = text('department', 120);
  out.lecturer_name = text('lecturer_name', 150);
  out.course_name = text('course_name', 200);
  var year = Number(r.study_year);
  if (!(year >= 1 && year <= 5 && Math.floor(year) === year)) fail('study_year');
  out.study_year = year;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.assessment_date))) fail('assessment_date');
  out.assessment_date = String(r.assessment_date);
  if (!/^\d+\.\d+$/.test(String(r.questionnaire_version))) fail('questionnaire_version');
  out.questionnaire_version = String(r.questionnaire_version);

  SKILL_KEYS.forEach(function (k) {
    var status = r[k + '_status'];
    if (status !== 'answered' && status !== 'not_applicable') fail(k + '_status');
    out[k + '_status'] = status;
    for (var n = 1; n <= 5; n++) {
      var v = r[k + n];
      if (status === 'not_applicable') {
        if (v !== '' && v !== undefined && v !== null) fail(k + n);
        out[k + n] = '';
      } else {
        var num = Number(v);
        if (v === '' || !(num >= 0 && num <= 4 && Math.floor(num) === num)) fail(k + n);
        out[k + n] = num;
      }
    }
    ['_P', '_A'].forEach(function (s) {
      var v = r[k + s];
      if (status === 'not_applicable') { out[k + s] = ''; return; }
      var num = Number(v);
      if (v === '' || !(num >= 0 && num <= 4)) fail(k + s);
      out[k + s] = num;
    });
  });
  return out;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
