/**
 * INSECT MBTI 결과 저장용 Google Apps Script
 * 1) 아래 SPREADSHEET_ID를 결과를 저장할 Google Sheets ID로 교체합니다.
 * 2) setupSpreadsheet()를 한 번 실행해 responses/summary 시트를 생성합니다.
 * 3) 웹앱으로 배포한 /exec URL을 웹페이지 script.js의 CONFIG.APPS_SCRIPT_URL에 입력합니다.
 */
const SERVER_CONFIG = Object.freeze({
  SPREADSHEET_ID: "1ahjyNQEQw1pTwDtOX3FRA6uN14va6lD7u8pjRssbiZc",
  DEFAULT_EVENT_ID: "insect-mbti-2026-09",
  ALLOWED_EVENT_IDS: ["insect-mbti-2026-09"],
  RESPONSES_SHEET_NAME: "responses",
  SUMMARY_SHEET_NAME: "summary",
  TIME_ZONE: "Asia/Seoul",
  LOCK_TIMEOUT_MS: 10000
});

const RESULT_NAMES = Object.freeze({
  rhinocerosBeetle: "장수풍뎅이",
  stagBeetle: "넓적사슴벌레",
  jewelBug: "큰광대노린재",
  grasshopper: "풀무치",
  whiteSpottedFlowerChafer: "흰점박이꽃무지",
  riceGrasshopper: "벼메뚜기",
  divingBeetle: "물방개",
  waterBug: "물자라",
  dragonflyNymph: "왕잠자리수채",
  waterScorpion: "장구애비",
  bumblebee: "서양뒤영벌",
  cabbageButterfly: "배추흰나비",
  southernEmperorButterfly: "남방오색나비"
});

const RESULT_ORDER = Object.freeze([
  "장수풍뎅이", "넓적사슴벌레", "큰광대노린재", "풀무치", "흰점박이꽃무지",
  "벼메뚜기", "물방개", "물자라", "왕잠자리수채", "장구애비",
  "서양뒤영벌", "배추흰나비", "남방오색나비"
]);

const PARTICIPATION_ID_PATTERN = /^[A-Za-z0-9-]{20,100}$/;

function doGet(e) {
  try {
    const action = String(e && e.parameter && e.parameter.action || "");
    const eventId = String(e && e.parameter && e.parameter.eventId || "");

    if (action !== "count") return createJsonResponse({ success: false, error: "INVALID_ACTION" });
    if (!isAllowedEventId(eventId)) return createJsonResponse({ success: false, error: "INVALID_EVENT_ID" });

    const sheet = getResponsesSheet_();
    return createJsonResponse({
      success: true,
      eventId: eventId,
      totalParticipants: countValidParticipants_(sheet, eventId)
    });
  } catch (error) {
    console.error(error);
    return createJsonResponse({ success: false, error: "COUNT_FAILED" });
  }
}

function doPost(e) {
  let lock;
  try {
    const data = parseRequest_(e);
    const validation = validateRequest(data);
    if (!validation.valid) return createJsonResponse({ success: false, error: validation.error });

    const sheet = getResponsesSheet_();
    lock = LockService.getScriptLock();
    lock.waitLock(SERVER_CONFIG.LOCK_TIMEOUT_MS);

    const existing = findExistingParticipation_(sheet, data.eventId, data.participationId);
    if (existing) {
      return createJsonResponse({
        success: true,
        duplicate: true,
        participantNumber: existing.participantNumber,
        totalParticipants: countValidParticipants_(sheet, data.eventId)
      });
    }

    const participantNumber = getNextParticipantNumber_(sheet);
    const participatedAt = new Date();
    const resultName = RESULT_NAMES[data.resultId];

    sheet.appendRow([
      participantNumber,
      participatedAt,
      resultName,
      data.participationId,
      data.eventId
    ]);

    const appendedRow = sheet.getLastRow();
    sheet.getRange(appendedRow, 1).setNumberFormat("0");
    sheet.getRange(appendedRow, 2).setNumberFormat("yyyy-mm-dd hh:mm:ss");

    return createJsonResponse({
      success: true,
      duplicate: false,
      participantNumber: participantNumber,
      totalParticipants: countValidParticipants_(sheet, data.eventId)
    });
  } catch (error) {
    console.error(error);
    const errorCode = String(error && error.message || "").indexOf("잠금") >= 0 ? "LOCK_TIMEOUT" : "SAVE_FAILED";
    return createJsonResponse({ success: false, error: errorCode });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function parseRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error("EMPTY_REQUEST");
  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error("INVALID_JSON");
  }
}

function validateRequest(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { valid: false, error: "INVALID_REQUEST" };

  const eventId = typeof data.eventId === "string" ? data.eventId.trim() : "";
  const participationId = typeof data.participationId === "string" ? data.participationId.trim() : "";
  const resultId = typeof data.resultId === "string" ? data.resultId.trim() : "";

  if (!isAllowedEventId(eventId)) return { valid: false, error: "INVALID_EVENT_ID" };
  if (!PARTICIPATION_ID_PATTERN.test(participationId)) return { valid: false, error: "INVALID_PARTICIPATION_ID" };
  if (!Object.prototype.hasOwnProperty.call(RESULT_NAMES, resultId)) return { valid: false, error: "INVALID_RESULT_ID" };

  data.eventId = eventId;
  data.participationId = participationId;
  data.resultId = resultId;
  return { valid: true };
}

function isAllowedEventId(eventId) {
  return SERVER_CONFIG.ALLOWED_EVENT_IDS.indexOf(eventId) !== -1;
}

function getSpreadsheet_() {
  if (!SERVER_CONFIG.SPREADSHEET_ID || SERVER_CONFIG.SPREADSHEET_ID.indexOf("PASTE_") === 0) {
    throw new Error("SPREADSHEET_ID_NOT_CONFIGURED");
  }
  return SpreadsheetApp.openById(SERVER_CONFIG.SPREADSHEET_ID);
}

function getResponsesSheet_() {
  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(SERVER_CONFIG.RESPONSES_SHEET_NAME);
  if (!sheet) throw new Error("RESPONSES_SHEET_NOT_FOUND");
  return sheet;
}

function findExistingParticipation_(sheet, eventId, participationId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  for (let index = 0; index < values.length; index += 1) {
    const row = values[index];
    if (String(row[3]) === participationId && String(row[4]) === eventId) {
      return { participantNumber: Number(row[0]), rowNumber: index + 2 };
    }
  }
  return null;
}

function getNextParticipantNumber_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let maxNumber = 0;
  values.forEach(function(row) {
    const value = Number(row[0]);
    if (Number.isFinite(value) && value > maxNumber) maxNumber = value;
  });
  return maxNumber + 1;
}

function countValidParticipants_(sheet, eventId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const allowedNames = new Set(Object.keys(RESULT_NAMES).map(function(key) { return RESULT_NAMES[key]; }));
  const values = sheet.getRange(2, 3, lastRow - 1, 3).getValues();
  return values.reduce(function(count, row) {
    const resultName = String(row[0]);
    const rowEventId = String(row[2]);
    return count + (rowEventId === eventId && allowedNames.has(resultName) ? 1 : 0);
  }, 0);
}

function createJsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 최초 1회 수동 실행: responses/summary 시트와 차트를 구성합니다. */
function setupSpreadsheet() {
  const spreadsheet = getSpreadsheet_();
  spreadsheet.setSpreadsheetTimeZone(SERVER_CONFIG.TIME_ZONE);

  const responses = getOrCreateSheet_(spreadsheet, SERVER_CONFIG.RESPONSES_SHEET_NAME);
  setupResponsesSheet_(responses);

  const summary = getOrCreateSheet_(spreadsheet, SERVER_CONFIG.SUMMARY_SHEET_NAME);
  setupSummarySheet_(summary);

  SpreadsheetApp.flush();
  return "responses 및 summary 시트 설정이 완료되었습니다.";
}

function getOrCreateSheet_(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function setupResponsesSheet_(sheet) {
  const headers = [["참여번호", "참여시간", "최종결과곤충", "참여 ID", "행사 ID"]];
  sheet.getRange(1, 1, 1, 5).setValues(headers);
  sheet.setFrozenRows(1);
  sheet.getRange("A1:E1").setFontWeight("bold").setBackground("#dfead9");
  sheet.getRange("A:A").setNumberFormat("0");
  sheet.getRange("B:B").setNumberFormat("yyyy-mm-dd hh:mm:ss");
  sheet.setColumnWidth(1, 90);
  sheet.setColumnWidth(2, 170);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 260);
  sheet.setColumnWidth(5, 190);
  sheet.hideColumns(4, 2);

  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), 5).createFilter();
}

function setupSummarySheet_(sheet) {
  sheet.clear();
  sheet.getCharts().forEach(function(chart) { sheet.removeChart(chart); });

  sheet.getRange("A1:D1").merge().setValue("INSECT MBTI 참여 결과 현황");
  sheet.getRange("A1:D1").setFontSize(16).setFontWeight("bold").setHorizontalAlignment("center").setBackground("#dfead9");

  sheet.getRange("A2").setValue("집계 대상 행사 ID");
  const eventIdCell = sheet.getRange("B2");
  eventIdCell.setValue(SERVER_CONFIG.DEFAULT_EVENT_ID);
  const eventIdRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(SERVER_CONFIG.ALLOWED_EVENT_IDS, true)
    .setAllowInvalid(false)
    .setHelpText("집계할 행사 ID를 목록에서 선택하세요.")
    .build();
  eventIdCell.setDataValidation(eventIdRule).setBackground("#fff8df");

  const metrics = [
    ["전체 참여자 수", "=SUM(C11:C23)"],
    ["가장 많이 나온 곤충", '=IF(B4=0,"-",INDEX(B11:B23,MATCH(MAX(C11:C23),C11:C23,0)))'],
    ["가장 많이 나온 결과 인원", "=IF(B4=0,0,MAX(C11:C23))"],
    ["가장 많이 나온 결과 비율", "=IF(B4=0,0,B6/B4)"],
    ["최근 참여시간", '=IFERROR(MAX(FILTER(responses!B2:B,responses!E2:E=$B$2)),"")']
  ];
  sheet.getRange(4, 1, metrics.length, 2).setValues(metrics);

  sheet.getRange("A10:D10").setValues([["순번", "곤충", "결과 인원", "결과 비율"]]);
  const rows = RESULT_ORDER.map(function(name, index) { return [index + 1, name, "", ""]; });
  sheet.getRange(11, 1, rows.length, 4).setValues(rows);

  for (let row = 11; row <= 23; row += 1) {
    sheet.getRange(row, 3).setFormula('=COUNTIFS(responses!$E$2:$E,$B$2,responses!$C$2:$C,B' + row + ')');
    sheet.getRange(row, 4).setFormula('=IF($B$4=0,0,C' + row + '/$B$4)');
  }

  sheet.getRange("A24:D24").setValues([["", "합계", "", ""]]);
  sheet.getRange("C24").setFormula("=SUM(C11:C23)");
  sheet.getRange("D24").setFormula("=IF(B4=0,0,1)");

  sheet.getRange("A2:A8").setFontWeight("bold");
  sheet.getRange("A10:D10").setFontWeight("bold").setBackground("#dfead9");
  sheet.getRange("A24:D24").setFontWeight("bold").setBackground("#f3eedf");
  sheet.getRange("B4").setNumberFormat('0"명"');
  sheet.getRange("B6").setNumberFormat('0"명"');
  sheet.getRange("B7").setNumberFormat("0.0%");
  sheet.getRange("B8").setNumberFormat("yyyy-mm-dd hh:mm:ss");
  sheet.getRange("C11:C24").setNumberFormat('0"명"');
  sheet.getRange("D11:D24").setNumberFormat("0.0%");
  sheet.setFrozenRows(2);
  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(3, 110);
  sheet.setColumnWidth(4, 110);

  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(sheet.getRange("B10:B23"))
    .addRange(sheet.getRange("D10:D23"))
    .setPosition(2, 6, 0, 0)
    .setOption("title", "곤충별 결과 비율")
    .setOption("legend", { position: "none" })
    .setOption("height", 520)
    .setOption("width", 720)
    .setOption("hAxis", { format: "0.0%", minValue: 0 })
    .setOption("chartArea", { left: 150, top: 55, width: "68%", height: "78%" })
    .build();
  sheet.insertChart(chart);
}
