// ============================================================
//  โรงพยาบาลสดใส — Apps Script: ระบบ Login
//  Sheet name: "ผู้ใช้งาน"
//  Columns: A=username, B=password, C=ชื่อ-สกุล, D=role, E=สถานะ
//
//  role values: staff=เจ้าหน้าที่, head=หัวหน้า, admin=ผู้ดูแลระบบ
//  สถานะ: active / inactive
//
//  Deploy: Web App | Execute as: Me | Who has access: Anyone
// ============================================================

var USER_SHEET = 'ผู้ใช้งาน';

var ROLE_LABELS = {
  'staff' : 'เจ้าหน้าที่',
  'head'  : 'หัวหน้างาน',
  'admin' : 'ผู้ดูแลระบบ'
};

// ── รองรับทั้ง login และ getAll (สำหรับ dashboard เดิม) ──────────
function doGet(e) {
  var callback = e.parameter.callback || '';
  var action   = e.parameter.action   || 'getAll';
  var result;

  if (action === 'login') {
    result = handleLogin(e.parameter.username, e.parameter.password);
  } else {
    result = handleGetAll();
  }

  var json = JSON.stringify(result);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Login ─────────────────────────────────────────────────────────
function handleLogin(username, password) {
  if (!username || !password) {
    return { success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };
  }

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(USER_SHEET);

  if (!sheet) {
    return { success: false, message: 'ไม่พบ Sheet "ผู้ใช้งาน" กรุณาสร้าง Sheet ก่อน' };
  }

  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var row      = data[i];
    var uname    = String(row[0]).trim().toLowerCase();
    var upass    = String(row[1]).trim();
    var uname_fn = String(row[2]).trim();
    var urole    = String(row[3]).trim().toLowerCase();
    var ustatus  = String(row[4]).trim().toLowerCase();

    if (uname === username.toLowerCase().trim() && upass === password.trim()) {
      if (ustatus !== 'active') {
        return { success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' };
      }
      // บันทึก Log การเข้าใช้
      logLogin(username, uname_fn, urole);
      return {
        success   : true,
        username  : uname,
        name      : uname_fn,
        role      : urole,
        roleLabel : ROLE_LABELS[urole] || urole,
        message   : 'เข้าสู่ระบบสำเร็จ'
      };
    }
  }
  return { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
}

// ── บันทึก Log การเข้าใช้งาน ─────────────────────────────────────
function logLogin(username, name, role) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Log การเข้าใช้');
    if (!sheet) {
      sheet = ss.insertSheet('Log การเข้าใช้');
      sheet.appendRow(['วันที่-เวลา','Username','ชื่อ-สกุล','ระดับสิทธิ์']);
    }
    var now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss');
    sheet.appendRow([now, username, name, ROLE_LABELS[role] || role]);
  } catch(e) { /* ไม่ให้ log พัง login */ }
}

// ── ดึงข้อมูลครุภัณฑ์ (สำหรับ dashboard) ─────────────────────────
function handleGetAll() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var rows   = [];

  var sheetNames = ['ข้อมูลการซ่อม'];
  sheetNames.forEach(function(name) {
    var s = ss.getSheetByName(name);
    if (!s) return;
    var data = s.getDataRange().getValues();
    if (data.length < 4) return;
    var headers = data[2];
    for (var i = 3; i < data.length; i++) {
      if (!data[i][0] || data[i][0].toString().trim() === '') continue;
      var obj = buildRow(headers, data[i]);
      if (!obj['สถานะ']) obj['สถานะ'] = 'ปกติ';
      obj['_source'] = 'manual';
      rows.push(obj);
    }
  });

  // Form responses
  var formNames = ['การตอบแบบฟอร์ม 1','Form_Responses','การตอบกลับแบบฟอร์ม 1'];
  var fs = null;
  for (var n = 0; n < formNames.length; n++) {
    fs = ss.getSheetByName(formNames[n]);
    if (fs) break;
  }
  if (fs) {
    var d2 = fs.getDataRange().getValues();
    if (d2.length >= 2) {
      var h2 = d2[0];
      for (var j = 1; j < d2.length; j++) {
        if (!d2[j][0] || d2[j][0].toString().trim() === '') continue;
        var o2 = buildRow(h2, d2[j]);
        if (!o2['สถานะ']) o2['สถานะ'] = 'ปกติ';
        o2['_source'] = 'form';
        rows.push(o2);
      }
    }
  }

  return { action:'getAll', count:rows.length, data:rows };
}

function buildRow(headers, row) {
  var obj = {};
  headers.forEach(function(h, i) {
    var val = row[i];
    obj[h.trim()] = val instanceof Date
      ? Utilities.formatDate(val, 'Asia/Bangkok', 'dd/MM/yyyy HH:mm')
      : (val === null || val === undefined ? '' : String(val).trim());
  });
  return obj;
}
