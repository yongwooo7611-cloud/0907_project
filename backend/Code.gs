/**
 * 기록의 조각 - Google Apps Script 인증 API
 *
 * 최초 1회 setupAuth()를 직접 실행한 뒤 웹 앱으로 배포하세요.
 * 요청 Content-Type은 text/plain;charset=utf-8, 본문은 JSON을 사용합니다.
 */

const SPREADSHEET_ID = '12TeozwfHAJKX6m3vx1ul_ngI2zRR1eJaW6OwkEykARE';
const USERS_SHEET = 'Users';
const SESSIONS_SHEET = 'Sessions';
const SESSION_DAYS = 7;
const LOGIN_LIMIT = 5;
const LOGIN_BLOCK_SECONDS = 600;
const HASH_ROUNDS = 1500;

const USER_HEADERS = [
  'id',
  'email',
  'name',
  'nickname',
  'passwordHash',
  'passwordSalt',
  'status',
  'createdAt',
  'lastLoginAt'
];

const SESSION_HEADERS = [
  'tokenHash',
  'userId',
  'expiresAt',
  'createdAt'
];

/** Apps Script 편집기에서 최초 1회 직접 실행합니다. */
function setupAuth() {
  ensureAuthReady_();
  return '인증 시트와 보안 설정을 준비했습니다.';
}

/** 브라우저에서 API 상태를 확인하기 위한 GET 요청입니다. */
function doGet() {
  return json_({
    ok: true,
    service: 'blog-auth',
    message: '인증 API가 실행 중입니다.'
  });
}

/** 회원가입, 로그인, 세션 확인, 로그아웃을 처리합니다. */
function doPost(e) {
  try {
    // 최초 요청에서도 별도의 수동 설정 없이 필요한 시트와 pepper를 준비합니다.
    ensureAuthReady_();
    const body = parseBody_(e);

    switch (body.action) {
      case 'signup':
        return json_(signup_(body));
      case 'login':
        return json_(login_(body));
      case 'me':
        return json_(getCurrentUser_(body.token));
      case 'logout':
        return json_(logout_(body.token));
      default:
        throw new Error('지원하지 않는 요청입니다.');
    }
  } catch (error) {
    console.error(error);
    return json_({
      ok: false,
      message: error.message || '요청을 처리하지 못했습니다.'
    });
  }
}

function ensureAuthReady_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    ensureSheet_(spreadsheet, USERS_SHEET, USER_HEADERS);
    ensureSheet_(spreadsheet, SESSIONS_SHEET, SESSION_HEADERS);

    const properties = PropertiesService.getScriptProperties();
    if (!properties.getProperty('PASSWORD_PEPPER')) {
      properties.setProperty('PASSWORD_PEPPER', createToken_());
    }
  } finally {
    lock.releaseLock();
  }
}

function signup_(body) {
  const email = normalizeEmail_(body.email);
  const name = cleanText_(body.name, '이름', 50);
  const nickname = cleanText_(body.nickname, '닉네임', 30);
  const password = validatePassword_(body.password);
  const lock = LockService.getScriptLock();

  lock.waitLock(10000);
  try {
    const sheet = getSheet_(USERS_SHEET);
    const users = readObjects_(sheet);

    if (users.some(user => normalizeEmail_(user.email) === email)) {
      throw new Error('이미 가입된 이메일입니다.');
    }

    const now = new Date().toISOString();
    const salt = createToken_();
    const userId = Utilities.getUuid();

    sheet.appendRow([
      userId,
      email,
      protectCell_(name),
      protectCell_(nickname),
      hashPassword_(password, salt),
      salt,
      'active',
      now,
      ''
    ]);

    return {
      ok: true,
      message: '회원가입이 완료되었습니다.',
      user: publicUser_({ id: userId, email, name, nickname, createdAt: now })
    };
  } finally {
    lock.releaseLock();
  }
}

function login_(body) {
  const email = normalizeEmail_(body.email);
  const password = String(body.password || '');
  const cache = CacheService.getScriptCache();
  const attemptKey = `login:${digest_(email).slice(0, 32)}`;
  const attempts = Number(cache.get(attemptKey) || 0);

  if (attempts >= LOGIN_LIMIT) {
    throw new Error('로그인 시도가 너무 많습니다. 10분 후 다시 시도해 주세요.');
  }

  const sheet = getSheet_(USERS_SHEET);
  const users = readObjects_(sheet);
  const user = users.find(item => normalizeEmail_(item.email) === email);

  // 존재하지 않는 사용자도 해시 계산을 수행해 응답 시간 차이를 줄입니다.
  const salt = user ? String(user.passwordSalt) : 'invalid-user-salt';
  const candidateHash = hashPassword_(password, salt);
  const passwordMatches = user && safeEqual_(candidateHash, String(user.passwordHash));

  if (!passwordMatches || user.status !== 'active') {
    cache.put(attemptKey, String(attempts + 1), LOGIN_BLOCK_SECONDS);
    throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  cache.remove(attemptKey);
  const now = new Date();
  updateUserLastLogin_(sheet, user.id, now.toISOString());
  const session = createSession_(user.id, now);

  return {
    ok: true,
    message: '로그인되었습니다.',
    token: session.token,
    expiresAt: session.expiresAt,
    user: publicUser_(user)
  };
}

function getCurrentUser_(token) {
  const session = findValidSession_(token);
  const users = readObjects_(getSheet_(USERS_SHEET));
  const user = users.find(item => String(item.id) === String(session.userId));

  if (!user || user.status !== 'active') {
    throw new Error('사용자 정보를 찾을 수 없습니다.');
  }

  return {
    ok: true,
    user: publicUser_(user),
    expiresAt: session.expiresAt
  };
}

function logout_(token) {
  if (!token) {
    return { ok: true, message: '로그아웃되었습니다.' };
  }

  const sheet = getSheet_(SESSIONS_SHEET);
  const tokenHash = digest_(String(token));
  const values = sheet.getDataRange().getValues();

  for (let row = values.length; row >= 2; row -= 1) {
    if (safeEqual_(String(values[row - 1][0]), tokenHash)) {
      sheet.deleteRow(row);
      break;
    }
  }

  return { ok: true, message: '로그아웃되었습니다.' };
}

function createSession_(userId, now) {
  const sheet = getSheet_(SESSIONS_SHEET);
  const token = createToken_();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  removeExpiredSessions_(sheet, now);
  sheet.appendRow([
    digest_(token),
    userId,
    expiresAt.toISOString(),
    now.toISOString()
  ]);

  return { token, expiresAt: expiresAt.toISOString() };
}

function findValidSession_(token) {
  if (!token || String(token).length < 32) {
    throw new Error('로그인이 필요합니다.');
  }

  const tokenHash = digest_(String(token));
  const sessions = readObjects_(getSheet_(SESSIONS_SHEET));
  const session = sessions.find(item => safeEqual_(String(item.tokenHash), tokenHash));

  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    throw new Error('로그인 세션이 만료되었습니다.');
  }

  return session;
}

function removeExpiredSessions_(sheet, now) {
  const values = sheet.getDataRange().getValues();
  for (let row = values.length; row >= 2; row -= 1) {
    if (new Date(values[row - 1][2]).getTime() <= now.getTime()) {
      sheet.deleteRow(row);
    }
  }
}

function updateUserLastLogin_(sheet, userId, isoDate) {
  const values = sheet.getDataRange().getValues();
  const idColumn = USER_HEADERS.indexOf('id');
  const lastLoginColumn = USER_HEADERS.indexOf('lastLoginAt') + 1;

  for (let row = 1; row < values.length; row += 1) {
    if (String(values[row][idColumn]) === String(userId)) {
      sheet.getRange(row + 1, lastLoginColumn).setValue(isoDate);
      return;
    }
  }
}

function hashPassword_(password, salt) {
  const pepper = PropertiesService.getScriptProperties().getProperty('PASSWORD_PEPPER');
  if (!pepper) {
    throw new Error('먼저 setupAuth 함수를 실행해 주세요.');
  }

  let value = `${salt}:${password}:${pepper}`;
  for (let round = 0; round < HASH_ROUNDS; round += 1) {
    value = digest_(`${value}:${salt}:${round}`);
  }
  return value;
}

function digest_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(bytes);
}

function createToken_() {
  return `${Utilities.getUuid()}${Utilities.getUuid()}`.replace(/-/g, '');
}

function safeEqual_(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index % Math.max(a.length, 1)) || 0)
      ^ (b.charCodeAt(index % Math.max(b.length, 1)) || 0);
  }
  return difference === 0;
}

function normalizeEmail_(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('올바른 이메일을 입력해 주세요.');
  }
  return email;
}

function validatePassword_(value) {
  const password = String(value || '');
  if (password.length < 8 || password.length > 72) {
    throw new Error('비밀번호는 8자 이상 72자 이하로 입력해 주세요.');
  }
  return password;
}

function cleanText_(value, label, maxLength) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${label}을(를) 입력해 주세요.`);
  if (text.length > maxLength) throw new Error(`${label}은(는) ${maxLength}자 이하여야 합니다.`);
  return text;
}

function protectCell_(value) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function publicUser_(user) {
  return {
    id: String(user.id),
    email: String(user.email),
    name: String(user.name).replace(/^'/, ''),
    nickname: String(user.nickname).replace(/^'/, ''),
    createdAt: String(user.createdAt || '')
  };
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('요청 본문이 없습니다.');
  }
  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error('JSON 형식의 요청이 필요합니다.');
  }
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!sheet) {
    throw new Error(`'${name}' 시트가 없습니다. setupAuth 함수를 실행해 주세요.`);
  }
  return sheet;
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

function readObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(String);
  return values.slice(1).map(row => Object.fromEntries(
    headers.map((header, index) => [header, row[index]])
  ));
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
