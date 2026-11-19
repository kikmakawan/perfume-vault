/**
 * Perfume Vault 2.0 — Apps Script API
 * ------------------------------------------------------------
 * ไฟล์นี้ทำให้ Apps Script เป็น "หลังบ้าน" ให้แอปบน GitHub Pages
 *
 * ตั้งค่าครั้งเดียว:
 * 1) Project Settings ⚙️ > Script Properties
 *      GEMINI_API_KEY = คีย์ Gemini ของคุณ
 * 2) รันฟังก์ชัน setupToken() หนึ่งครั้ง แล้วคัดลอกรหัสจาก Execution log
 *    (หรือตั้ง Script Property APP_TOKEN เองก็ได้)
 * 3) Deploy > New deployment > Web app
 *      Execute as: Me   |   Who has access: Anyone
 *    คัดลอก URL ที่ลงท้ายด้วย /exec ไปใส่ในหน้า "ตั้งค่า" ของแอป พร้อมรหัส APP_TOKEN
 * ------------------------------------------------------------
 */
var SHEET_ID = '1LR2Wp-Kae79HtyuL1Ncx_G4TJfXu2ycd0PKkmcSMu00';
var DRIVE_FOLDER_ID = '1PfmaLj_wcMtNhie9_-W1lF7GLCMWA8Nv';
var GEMINI_MODELS = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];
var API_VERSION = '2.0';

// key ในแอป ↔ คอลัมน์ในชีต
// fixed = คอลัมน์ตามตำแหน่งเดิม (เข้ากับข้อมูลเก่า), extra = หาจากชื่อหัวคอลัมน์ ถ้าไม่มีจะสร้างต่อท้ายให้
var SCHEMA = {
  perfumes: {
    sheetName: null, // ชีตแรก
    fixed: ['id', 'name', 'brand', 'brandGroup', 'format', 'category', 'volume', 'topNotes', 'midNotes', 'baseNotes',
      'batchCode', 'pao', 'status', 'mfgDate', 'expDate', 'purchaseDate', 'location', 'price', 'rating', 'notes', 'pic'],
    fixedHeaders: ['ID', 'Name', 'Brand', 'BrandGroup', 'Format', 'Category', 'Volume', 'TopNotes', 'MidNotes', 'BaseNotes',
      'BatchCode', 'PAO', 'Status', 'MFG', 'EXP', 'PurchaseDate', 'Location', 'Price', 'Rating', 'Notes', 'Pic'],
    extra: [['uid', 'UID'], ['updatedAt', 'UpdatedAt'], ['openedDate', 'OpenedDate'], ['fillLevel', 'FillLevel'], ['tags', 'Tags']],
    dates: ['mfgDate', 'expDate', 'purchaseDate', 'openedDate']
  },
  wishlist: {
    sheetName: 'Wishlist',
    fixed: ['id', 'name', 'brand', 'brandGroup', 'format', 'category', 'topNotes', 'midNotes', 'baseNotes', 'status',
      'sourceUrl', 'modelUsed', 'matchScore', 'pros', 'redFlags', 'finalVerdict', 'similarCount'],
    fixedHeaders: ['ID', 'Name', 'Brand', 'BrandGroup', 'Format', 'Category', 'TopNotes', 'MidNotes', 'BaseNotes', 'Status',
      'SourceUrl', 'ModelUsed', 'MatchScore', 'Pros', 'RedFlags', 'FinalVerdict', 'SimilarCount'],
    extra: [['uid', 'UID'], ['updatedAt', 'UpdatedAt'], ['targetPrice', 'TargetPrice'], ['prices', 'PriceLog'], ['wishNotes', 'WishNotes']],
    dates: []
  },
  wears: {
    sheetName: 'WearLog',
    fixed: [], fixedHeaders: [],
    extra: [['uid', 'UID'], ['perfumeUid', 'PerfumeUID'], ['perfumeName', 'PerfumeName'], ['date', 'Date'], ['occasion', 'Occasion'],
      ['weather', 'Weather'], ['tempC', 'TempC'], ['longevity', 'LongevityH'], ['compliments', 'Compliments'],
      ['sprays', 'Sprays'], ['note', 'Note'], ['updatedAt', 'UpdatedAt']],
    dates: ['date']
  }
};

// =======================================================
//  ENTRY POINTS
// =======================================================
function doGet() {
  return json_({ ok: true, app: 'Perfume Vault API', version: API_VERSION });
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var token = PropertiesService.getScriptProperties().getProperty('APP_TOKEN');
    if (!token) throw new Error('ยังไม่ได้ตั้ง APP_TOKEN (รันฟังก์ชัน setupToken ใน Apps Script ก่อน)');
    if (body.token !== token) return json_({ ok: false, error: 'รหัสเข้าใช้งาน (token) ไม่ถูกต้อง', code: 401 });

    var p = body.payload || {};
    switch (body.action) {
      case 'ping': return json_({ ok: true, data: { version: API_VERSION, time: new Date().toISOString() } });
      case 'pull': return json_({ ok: true, data: pullAll_() });
      case 'sync': return json_({ ok: true, data: sync_(p.ops || []) });
      case 'ai': return json_({ ok: true, data: ai_(p) });
      default: throw new Error('ไม่รู้จักคำสั่ง: ' + body.action);
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** รันครั้งเดียวเพื่อสร้างรหัสเข้าใช้งาน */
function setupToken() {
  var props = PropertiesService.getScriptProperties();
  var t = props.getProperty('APP_TOKEN');
  if (!t) {
    t = Utilities.getUuid().replace(/-/g, '').substring(0, 20);
    props.setProperty('APP_TOKEN', t);
  }
  Logger.log('APP_TOKEN ของคุณคือ: ' + t);
  return t;
}

// =======================================================
//  TABLE HELPERS
// =======================================================
function ss_() { return SpreadsheetApp.openById(SHEET_ID); }

function formatCell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : v;
}

/** เปิดตาราง + ตรวจหัวคอลัมน์ คืน { sheet, cols: {key: colIndex1based}, width } */
function table_(entity) {
  var sc = SCHEMA[entity];
  var ss = ss_();
  var sheet = sc.sheetName ? ss.getSheetByName(sc.sheetName) : ss.getSheets()[0];
  if (!sheet) sheet = ss.insertSheet(sc.sheetName);

  if (sheet.getLastRow() === 0) {
    var h = sc.fixedHeaders.concat(sc.extra.map(function (x) { return x[1]; }));
    sheet.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  var lastCol = Math.max(sheet.getLastColumn(), sc.fixed.length);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (x) { return String(x).trim(); });
  var cols = {};
  sc.fixed.forEach(function (k, i) { cols[k] = i + 1; });
  sc.extra.forEach(function (pair) {
    var idx = headers.indexOf(pair[1]);
    if (idx === -1) {
      lastCol++;
      sheet.getRange(1, lastCol).setValue(pair[1]).setFontWeight('bold');
      headers.push(pair[1]);
      idx = lastCol - 1;
    }
    cols[pair[0]] = idx + 1;
  });
  return { sheet: sheet, cols: cols, width: lastCol, schema: sc };
}

function readAll_(entity) {
  var t = table_(entity);
  var lastRow = t.sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = t.sheet.getRange(2, 1, lastRow - 1, t.width).getValues();
  var out = [], missingUid = [];
  values.forEach(function (r, i) {
    if (r.join('').trim() === '') return;
    var o = {};
    Object.keys(t.cols).forEach(function (k) { o[k] = formatCell_(r[t.cols[k] - 1]); });
    if (!o.uid) {
      o.uid = Utilities.getUuid();
      missingUid.push([i + 2, o.uid]);
    }
    out.push(o);
  });
  // ใส่ UID ให้แถวเก่าที่ยังไม่มี (ครั้งแรกที่ใช้แอปใหม่)
  missingUid.forEach(function (m) { t.sheet.getRange(m[0], t.cols.uid).setValue(m[1]); });
  return out;
}

function findRow_(t, uid) {
  var lastRow = t.sheet.getLastRow();
  if (lastRow < 2 || !uid) return -1;
  var uids = t.sheet.getRange(2, t.cols.uid, lastRow - 1, 1).getValues();
  for (var i = 0; i < uids.length; i++) if (String(uids[i][0]) === String(uid)) return i + 2;
  return -1;
}

function nextId_(t) {
  if (!t.cols.id) return '';
  var lastRow = t.sheet.getLastRow();
  if (lastRow < 2) return 1;
  var ids = t.sheet.getRange(2, t.cols.id, lastRow - 1, 1).getValues();
  var max = 0;
  ids.forEach(function (r) { var n = Number(r[0]); if (!isNaN(n) && n > max) max = n; });
  return max + 1;
}

function toCell_(k, v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  if (['volume', 'pao', 'price', 'rating', 'fillLevel', 'targetPrice', 'matchScore', 'tempC', 'longevity', 'compliments', 'sprays', 'similarCount'].indexOf(k) > -1) {
    if (v === '') return '';
    var n = Number(v);
    return isNaN(n) ? v : n;
  }
  return v;
}

function upsert_(t, rec) {
  var row = findRow_(t, rec.uid);
  var arr;
  if (row > 0) {
    arr = t.sheet.getRange(row, 1, 1, t.width).getValues()[0];
  } else {
    arr = new Array(t.width).fill('');
    if (t.cols.id && !rec.id) rec.id = nextId_(t);
  }
  Object.keys(t.cols).forEach(function (k) {
    if (!(k in rec)) return;                                   // ไม่ส่งมา = ไม่แตะ
    if (k === 'pic' && !rec.pic && !rec._removePic) return;   // ไม่ลบรูปเดิมโดยไม่ตั้งใจ
    arr[t.cols[k] - 1] = toCell_(k, rec[k]);
  });
  if (row > 0) t.sheet.getRange(row, 1, 1, t.width).setValues([arr]);
  else t.sheet.appendRow(arr);
}

// =======================================================
//  SYNC
// =======================================================
function pullAll_() {
  return {
    perfumes: readAll_('perfumes'),
    wishlist: readAll_('wishlist'),
    wears: readAll_('wears'),
    serverTime: new Date().toISOString()
  };
}

/**
 * ops: [{ opId, kind: 'upsert'|'delete', entity, rec?, uid? }]
 * rec._picData (base64) = รูปใหม่ จะอัปขึ้น Drive ให้
 */
function sync_(ops) {
  var cache = CacheService.getScriptCache();
  var results = [];

  // อัปรูปก่อน (นอก lock)
  ops.forEach(function (op) {
    if (op.opId && cache.get('op_' + op.opId)) { op._done = true; return; }
    if (op.rec && op.rec._picData) {
      try { op.rec.pic = saveImage_(op.rec._picData, op.rec._picName || (op.rec.uid + '.jpg')); }
      catch (e) { op._warn = 'อัปโหลดรูปไม่สำเร็จ: ' + e.message; }
      delete op.rec._picData; delete op.rec._picName;
    }
  });

  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var tables = {};
    var tbl = function (ent) { return tables[ent] || (tables[ent] = table_(ent)); };
    ops.forEach(function (op) {
      if (op._done) { results.push({ opId: op.opId, ok: true, skipped: true }); return; }
      try {
        if (!SCHEMA[op.entity]) throw new Error('entity ไม่ถูกต้อง');
        var t = tbl(op.entity);
        if (op.kind === 'upsert') {
          upsert_(t, op.rec);
        } else if (op.kind === 'delete') {
          var row = findRow_(t, op.uid);
          if (row > 0) t.sheet.deleteRow(row);
        } else throw new Error('kind ไม่ถูกต้อง');
        if (op.opId) cache.put('op_' + op.opId, '1', 21600);
        results.push({ opId: op.opId, ok: true, warning: op._warn || '' });
      } catch (e) {
        results.push({ opId: op.opId, ok: false, error: e.message, label: (op.rec && op.rec.name) || op.uid || '' });
      }
    });
  } finally {
    lock.releaseLock();
  }

  var data = pullAll_();
  data.results = results;
  return data;
}

function saveImage_(base64, name) {
  var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(base64), 'image/jpeg', name));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w600';
}

// =======================================================
//  AI (Gemini) — คีย์อยู่ฝั่งนี้เท่านั้น ไม่โผล่ในแอป
// =======================================================
function getApiKey_() {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Script Properties');
  return key;
}

function extractJson_(text) {
  var clean = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  var s = clean.indexOf('{'), e = clean.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('AI ไม่ได้ตอบเป็น JSON');
  return JSON.parse(clean.substring(s, e + 1));
}

/**
 * contents: Gemini contents array
 * opts: { search: bool, system: string }
 */
function gemini_(contents, opts) {
  opts = opts || {};
  var apiKey = getApiKey_();
  var lastError = '';
  for (var i = 0; i < GEMINI_MODELS.length; i++) {
    var model = GEMINI_MODELS[i];
    var modes = opts.search ? [true, false] : [false];
    for (var j = 0; j < modes.length; j++) {
      var payload = { contents: contents, generationConfig: { temperature: opts.temperature || 0.3 } };
      if (opts.system) payload.systemInstruction = { parts: [{ text: opts.system }] };
      if (modes[j]) payload.tools = [{ google_search: {} }];
      else payload.generationConfig.responseMimeType = 'application/json';
      try {
        var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
          method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': apiKey },
          payload: JSON.stringify(payload), muteHttpExceptions: true
        });
        if (res.getResponseCode() !== 200) { lastError = model + ' (' + res.getResponseCode() + '): ' + res.getContentText().substring(0, 200); continue; }
        var json = JSON.parse(res.getContentText());
        var cand = json.candidates && json.candidates[0];
        var text = ((cand && cand.content && cand.content.parts) || []).map(function (p) { return p.text || ''; }).join('');
        var data = extractJson_(text);
        data._meta = {
          model: model + (modes[j] ? ' + Google Search' : ''),
          tokens: json.usageMetadata ? json.usageMetadata.totalTokenCount : null,
          sources: []
        };
        if (cand && cand.groundingMetadata && cand.groundingMetadata.groundingChunks) {
          cand.groundingMetadata.groundingChunks.forEach(function (c) {
            if (c.web && c.web.uri && data._meta.sources.length < 4) data._meta.sources.push({ title: c.web.title || c.web.uri, uri: c.web.uri });
          });
        }
        return data;
      } catch (e) { lastError = model + ': ' + e.message; }
    }
  }
  throw new Error('AI ไม่ตอบสนอง: ' + lastError);
}

function textPart_(t) { return { text: t }; }
function imagePart_(b64, mime) { return { inline_data: { mime_type: mime || 'image/jpeg', data: b64 } }; }
function user_(parts) { return [{ role: 'user', parts: parts }]; }

var SYSTEM_EXPERT = 'คุณคือผู้เชี่ยวชาญน้ำหอมระดับโลก อ้างอิง Fragrantica เป็นหลัก ห้ามเดาข้อมูลรุ่นที่ไม่แน่ใจ ' +
  'ระวังแบรนด์ตะวันออกกลาง (Lattafa, Armaf, Fragrance World, Afnan, Ahmed Al Maghribi ฯลฯ) และแบรนด์ไทย (Mith, Butterfly Thai Perfume ฯลฯ) ที่มีรุ่นย่อยเยอะ ' +
  'โน้ตกลิ่นให้เขียนเป็นภาษาอังกฤษคั่นด้วย ", " ส่วนคำอธิบายให้เป็นภาษาไทยที่เป็นกันเอง กระชับ ตอบเป็น JSON ตามรูปแบบที่กำหนดเท่านั้น';

var PERFUME_FIELDS_JSON = '"name":"","brand":"","brandGroup":"Middle Eastern | Designer | Niche | Thai","format":"EDP | EDT | Parfum | Extrait | EDC | Oil | Mist",' +
  '"category":"เช่น Woody Aromatic","topNotes":"","midNotes":"","baseNotes":""';

function ai_(p) {
  var ctx = p.context ? '\n\n=== ตู้น้ำหอมของผู้ใช้ (ชื่อ | แบรนด์ | หมวด | โน้ต | คะแนน | สถานะ | ฉีดไปกี่ครั้ง | ฉีดล่าสุด | แท็ก) ===\n' + p.context + '\n=== จบ ===' : '';
  switch (p.task) {
    case 'identify':
      return gemini_(user_([textPart_(
        'ค้นหาข้อมูลน้ำหอม "' + p.name + '"' + (p.brand ? ' แบรนด์ "' + p.brand + '"' : '') + ' ความเข้มข้น "' + (p.format || '') + '" ' +
        'ต้องเป็นรุ่นนี้เป๊ะๆ ไม่เอา flanker ถ้าไม่แน่ใจให้ใส่ "" \nตอบ JSON: {' + PERFUME_FIELDS_JSON + ',"confidence":"high | medium | low"}')]),
        { search: true, system: SYSTEM_EXPERT });

    case 'vision':
      return gemini_(user_([
        imagePart_(p.image, p.mime),
        textPart_('ดูรูปขวดน้ำหอมนี้ แล้วระบุว่าเป็นรุ่นอะไร (อ่านจากฉลาก โลโก้ รูปทรงขวด) ' +
          (p.hint ? 'ผู้ใช้บอกใบ้ว่า: "' + p.hint + '" ' : '') +
          'ถ้าเห็น batch code หรือปริมาณ ml ให้ใส่ด้วย ถ้าไม่แน่ใจให้ใส่ "" ห้ามเดา\n' +
          'ตอบ JSON: {' + PERFUME_FIELDS_JSON + ',"volume":"","batchCode":"","confidence":"high | medium | low","seen":"สิ่งที่อ่านได้จากรูปสั้นๆ"}')
      ]), { system: SYSTEM_EXPERT });

    case 'batch':
      var parts = [];
      if (p.image) parts.push(imagePart_(p.image, p.mime));
      parts.push(textPart_('ช่วยอ่านและถอดรหัส batch code ของน้ำหอมแบรนด์ "' + (p.brand || '') + '"' +
        (p.code ? ' รหัสคือ "' + p.code + '"' : ' จากรูปที่แนบ') +
        ' ประเมินเดือน/ปีที่ผลิตตามรูปแบบรหัสของแบรนด์นั้น (เช่นแบบที่เว็บ CheckFresh ใช้) ถ้าแบรนด์นี้ไม่มีรูปแบบที่รู้จัก ให้ mfgDate เป็น "" และอธิบายเหตุผล\n' +
        'ตอบ JSON: {"batchCode":"","mfgDate":"yyyy-mm-01 หรือ \\"\\"","confidence":"high | medium | low","explain":""}'));
      return gemini_(user_(parts), { search: !p.image, system: SYSTEM_EXPERT });

    case 'purchase':
      return gemini_(user_([textPart_(
        'วิเคราะห์ว่าควรซื้อ "' + p.name + '"' + (p.brand ? ' แบรนด์ "' + p.brand + '"' : '') + ' (' + (p.format || '') + ') ไหม โดยเทียบกับตู้ของผู้ใช้' + ctx +
        '\nmatchScore 0-100 = เข้ากับรสนิยม (ดูคะแนนและความถี่ที่ฉีด) หักคะแนนถ้าซ้ำกับของที่มีมาก ' +
        'similarOwned = ชื่อขวดในตู้ที่กลิ่นใกล้ (คัดลอกชื่อจากรายการเป๊ะๆ สูงสุด 5)\n' +
        'ตอบ JSON: {' + PERFUME_FIELDS_JSON + ',"longevity":"","bestFor":"","matchScore":0,"similarOwned":[],"pros":"","redFlags":"","finalVerdict":"","priceRange":"ช่วงราคาโดยประมาณในไทย (ถ้ารู้)"}')]),
        { search: true, system: SYSTEM_EXPERT });

    case 'recommend':
      return gemini_(user_([textPart_(
        'ช่วยเลือกน้ำหอม 3 ขวดจากตู้ของผู้ใช้สำหรับวันนี้' +
        '\nสภาพอากาศ: ' + (p.weather || 'ไม่ทราบ') + '\nโอกาส: ' + (p.occasion || 'ทั่วไป') + '\nเวลา: ' + (p.timeOfDay || '') +
        '\nฉีดไปแล้วช่วง 7 วันที่ผ่านมา: ' + (p.recent || '-') + ctx +
        '\nเลือกเฉพาะขวดที่สถานะ in-use เป็นหลัก หลีกเลี่ยงที่เพิ่งฉีด ชื่อต้องคัดลอกจากรายการเป๊ะๆ\n' +
        'ตอบ JSON: {"picks":[{"name":"","reason":"เหตุผลสั้นๆ น่ารักๆ"}],"tip":"เคล็ดลับการฉีดวันนี้ 1 ประโยค"}')]),
        { system: SYSTEM_EXPERT, temperature: 0.8 });

    case 'layering':
      return gemini_(user_([textPart_(
        'แนะนำการฉีดซ้อน (layering) โดยใช้ "' + p.base + '" เป็นตัวหลัก จับคู่กับขวดอื่นในตู้ของผู้ใช้' + ctx +
        '\nให้ 3-4 คู่ ชื่อ partner ต้องคัดลอกจากรายการเป๊ะๆ\n' +
        'ตอบ JSON: {"combos":[{"partner":"","how":"ฉีดอะไรก่อน กี่ครั้ง ตรงไหน","result":"กลิ่นที่ได้","vibe":"เหมาะกับโอกาสไหน"}],"avoid":"คู่ที่ไม่ควรจับคู่และเหตุผล"}')]),
        { system: SYSTEM_EXPERT, temperature: 0.6 });

    case 'dupe':
      return gemini_(user_([textPart_(
        'หา dupe / clone / ตัวแทนของ "' + p.name + '"' + (p.brand ? ' แบรนด์ "' + p.brand + '"' : '') +
        ' ทั้งในตลาด (เน้นที่หาซื้อได้ในไทย ราคาถูกกว่า) และในตู้ของผู้ใช้' + ctx +
        '\ninCollection: ชื่อต้องคัดลอกจากรายการเป๊ะๆ\n' +
        'ตอบ JSON: {"original":{"brand":"","topNotes":"","midNotes":"","baseNotes":""},"market":[{"name":"","brand":"","similarity":0,"priceNote":"","note":""}],"inCollection":[{"name":"","similarity":0,"note":""}]}')]),
        { search: true, system: SYSTEM_EXPERT });

    case 'chat':
      var contents = (p.messages || []).slice(-12).map(function (m) {
        return { role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] };
      });
      var sys = SYSTEM_EXPERT + ' คุณเป็นผู้ช่วยส่วนตัวที่รู้จักตู้น้ำหอมของผู้ใช้ดี พูดคุยแบบเพื่อนสนิท สดใส ใช้อีโมจิได้นิดหน่อย ' +
        'เวลาแนะนำให้เลือกจากตู้ของผู้ใช้ก่อน (ชื่อต้องตรงกับรายการ) ' +
        'ตอบ JSON: {"reply":"ข้อความตอบ (ขึ้นบรรทัดใหม่ด้วย \\n ได้)","mentioned":["ชื่อขวดจากตู้ที่พูดถึง"]}' + ctx +
        (p.weather ? '\nสภาพอากาศตอนนี้: ' + p.weather : '') + '\nวันนี้: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      return gemini_(contents, { system: sys, temperature: 0.7 });

    default:
      throw new Error('ไม่รู้จักงาน AI: ' + p.task);
  }
}

// =======================================================
//  UTILITIES (รันเองจาก Editor)
// =======================================================
function checkAvailableModels() {
  var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models', {
    headers: { 'x-goog-api-key': getApiKey_() }, muteHttpExceptions: true
  });
  (JSON.parse(res.getContentText()).models || []).forEach(function (m) {
    if ((m.supportedGenerationMethods || []).indexOf('generateContent') > -1) Logger.log('✅ ' + m.name.replace('models/', ''));
  });
}

/** ทดสอบอ่านข้อมูล (ดูใน Execution log) */
function testPull() {
  var d = pullAll_();
  Logger.log('perfumes: ' + d.perfumes.length + ', wishlist: ' + d.wishlist.length + ', wears: ' + d.wears.length);
}
