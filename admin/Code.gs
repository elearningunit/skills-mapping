/**
 * ממשק הרשות — צד השרת (Google Apps Script, פרויקט נפרד מהקולט)
 *
 * אבטחה:
 * 1. פריסה כאפליקציית אינטרנט עם "הפעלה בתור: אני" ו"למי יש גישה: רק אני" — Google חוסם כל חשבון אחר.
 * 2. בנוסף, כל פונקציה בודקת שהמשתמש המחובר נמצא ברשימת המורשים (מאפיין סקריפט ADMIN_EMAILS).
 *    אם הרשימה לא הוגדרה — אף אחד אינו מורשה (ברירת מחדל בטוחה).
 * 3. הנתונים אינם מוטמעים בדף; הם נשלפים רק אחרי בדיקת ההרשאה.
 *
 * מאפייני סקריפט (הגדרות הפרויקט ← מאפייני סקריפט):
 *   SHEET_ID      — מזהה הגיליון של הקולט (מתוך כתובת הגיליון)
 *   ADMIN_EMAILS  — כתובות מורשות, מופרדות בפסיק
 *
 * הקבצים: Code.gs (הקובץ הזה) ו-index.html (המסך, נבנה מהמאגר: admin/apps-script/index.html).
 */

var SHEET_NAME = 'מיפויים';
var LOG_SHEET_NAME = 'יומן';
var ACTIONS = ['include', 'exclude', 'reset', 'replace_previous'];

/* ------------------------------------------------------------------ */
/* נקודת כניסה                                                          */
/* ------------------------------------------------------------------ */

function doGet() {
  if (!isAdmin_()) {
    return HtmlService.createHtmlOutput(
      '<p dir="rtl" style="font-family:Arial;padding:24px">אין הרשאה לממשק הרשות. יש להתחבר בחשבון מורשה.</p>'
    ).setTitle('אין הרשאה');
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('ממשק הרשות – מיפוי מיומנויות')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ------------------------------------------------------------------ */
/* פונקציות שהמסך קורא (google.script.run)                              */
/* ------------------------------------------------------------------ */

/** כל המיפויים ויומן הפעולות. דורש הרשאה. */
function listMappings() {
  var me = requireAdmin_();
  var ss = spreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  var rows = [];
  if (sheet && sheet.getLastRow() >= 2) {
    var values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
    var header = values[0].map(String);
    rows = values.slice(1).filter(function (r) { return r[1]; }).map(function (r) {
      var o = {};
      header.forEach(function (h, i) { o[h] = plain_(r[i]); });
      return o;
    });
  }
  var log = [];
  var logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (logSheet && logSheet.getLastRow() >= 2) {
    log = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 5).getValues().map(function (r) {
      return { time: plain_(r[0]), actor: String(r[1]), action: String(r[2]), assessment_id: String(r[3]), details: String(r[4]) };
    });
  }
  return { me: me, rows: rows, log: log, loadedAt: new Date().toISOString() };
}

/**
 * הכרעה בדיווח: include (הכללה), exclude (החרגה), reset (ביטול הכרעה),
 * replace_previous (הדיווח הזה תקין, והדיווח הכפול שאליו הוא מפנה מוחרג).
 * הנתונים המקוריים אינם משתנים; נכתבות רק העמודות decision ו-status, וכל פעולה נרשמת ביומן.
 */
function setDecision(id, action, note) {
  var me = requireAdmin_();
  if (ACTIONS.indexOf(action) < 0) throw new Error('פעולה לא מוכרת');
  note = String(note || '').slice(0, 500);
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = spreadsheet_().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('הגיליון לא נמצא');
    var t = table_(sheet);
    var row = t.find(id);
    if (!row) throw new Error('הדיווח לא נמצא');
    var changed = [];
    if (action === 'include') changed.push(t.decide(row, 'included'));
    if (action === 'exclude') changed.push(t.decide(row, 'excluded'));
    if (action === 'reset') changed.push(t.decide(row, ''));
    if (action === 'replace_previous') {
      var refs = String(t.get(row, 'flags')).split(' ')
        .filter(function (f) { return f.indexOf('possible_duplicate:') === 0; })
        .map(function (f) { return f.slice('possible_duplicate:'.length); });
      if (!refs.length) throw new Error('לדיווח הזה אין כפילות להחלפה');
      changed.push(t.decide(row, 'included'));
      refs.forEach(function (ref) {
        var other = t.find(ref);
        if (other) {
          changed.push(t.decide(other, 'excluded'));
          log_(me, 'excluded', ref, 'הוחלף בדיווח ' + id + (note ? ' · ' + note : ''));
        }
      });
    }
    log_(me, action === 'replace_previous' ? 'included_replacing' : action === 'reset' ? 'reset' : action + 'd', id, note);
    return { ok: true, changed: changed };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* עזרים                                                                */
/* ------------------------------------------------------------------ */

function adminEmails_() {
  var raw = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS') || '';
  return raw.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
}

function currentEmail_() {
  var email = '';
  try { email = Session.getActiveUser().getEmail() || ''; } catch (err) { email = ''; }
  return email.toLowerCase();
}

function isAdmin_() {
  var email = currentEmail_();
  return !!email && adminEmails_().indexOf(email) >= 0;
}

function requireAdmin_() {
  if (!isAdmin_()) throw new Error('אין הרשאה');
  return currentEmail_();
}

function spreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('לא הוגדר SHEET_ID במאפייני הסקריפט');
  return SpreadsheetApp.openById(id);
}

/** גישה לטבלת המיפויים לפי שמות עמודות */
function table_(sheet) {
  var lastCol = sheet.getLastColumn();
  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  function col(name) {
    var i = header.indexOf(name);
    if (i < 0) throw new Error('עמודה חסרה בגיליון: ' + name + ' (יש לעדכן את הקולט לגרסה 2 ולהריץ migrate)');
    return i + 1;
  }
  var last = sheet.getLastRow();
  var data = last >= 2 ? sheet.getRange(2, 1, last - 1, lastCol).getValues() : [];
  return {
    find: function (id) {
      for (var i = 0; i < data.length; i++) if (String(data[i][col('assessment_id') - 1]) === String(id)) return { index: i, values: data[i] };
      return null;
    },
    get: function (row, name) { return row.values[col(name) - 1]; },
    /** קובע הכרעה ומחשב סטטוס באותו כלל של הקולט */
    decide: function (row, decision) {
      var flags = String(row.values[col('flags') - 1] || '');
      var status = decision === 'excluded' ? 'excluded' : decision === 'included' ? 'valid' : flags ? 'flagged' : 'valid';
      var r = row.index + 2;
      sheet.getRange(r, col('decision'), 1, 1).setValues([[decision]]);
      sheet.getRange(r, col('status'), 1, 1).setValues([[status]]);
      row.values[col('decision') - 1] = decision;
      row.values[col('status') - 1] = status;
      return { id: String(row.values[col('assessment_id') - 1]), decision: decision, status: status };
    }
  };
}

function log_(actor, action, id, details) {
  var ss = spreadsheet_();
  var sheet = ss.getSheetByName(LOG_SHEET_NAME) || ss.insertSheet(LOG_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, 5).setValues([['time', 'actor', 'action', 'assessment_id', 'details']]);
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, 5).setValues([[new Date(), actor, action, id, details || '']]);
}

/** ערך מהגיליון לערך שניתן להעביר לדפדפן: תאריכים כ-ISO */
function plain_(x) {
  if (Object.prototype.toString.call(x) === '[object Date]') return isNaN(x.getTime()) ? '' : x.toISOString();
  return x === null || x === undefined ? '' : x;
}
