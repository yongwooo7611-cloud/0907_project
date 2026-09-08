# Google Apps Script 인증 API 설치

## 1. 코드 복사

스프레드시트에서 `확장 프로그램 → Apps Script`를 열고 `Code.gs` 내용을 전부 복사합니다.

## 2. 최초 설정

Apps Script 상단 함수 목록에서 `setupAuth`를 선택해 한 번 실행하고 Google 권한을 승인합니다.

최신 코드는 첫 회원가입·로그인 요청에서도 동일한 초기화를 자동 실행합니다. 따라서
`setupAuth` 수동 실행을 빠뜨려도 `Users`, `Sessions` 시트와 보안 pepper가 생성됩니다.
다만 배포 전 스프레드시트 접근 권한을 확인하려면 직접 한 번 실행하는 것을 권장합니다.

실행 후 스프레드시트에 다음 시트가 자동 생성됩니다.

- `Users`: 사용자 정보와 비밀번호 해시
- `Sessions`: 로그인 세션의 토큰 해시와 만료시간

`PASSWORD_PEPPER`는 Apps Script의 스크립트 속성에 자동 생성됩니다. 이 값이 삭제되면 기존 비밀번호를 검증할 수 없으므로 삭제하지 마세요.

## 3. 웹 앱 배포

먼저 `프로젝트 설정 → 편집기에 appsscript.json 매니페스트 파일 표시`를 켜고,
로컬의 `appsscript.json` 내용도 Apps Script의 같은 파일에 복사합니다.

매니페스트에서 GitHub Pages 공개 호출에 필요한 설정은 다음과 같습니다.

```json
"webapp": {
  "access": "ANYONE_ANONYMOUS",
  "executeAs": "USER_DEPLOYING"
}
```

`ANYONE`은 Google에 로그인한 사용자만 의미합니다. 로그아웃 상태에서도 접근할 수 있는
`ANYONE_ANONYMOUS`가 필요합니다.

1. 기존 배포를 보관한 채 `배포 → 새 배포`를 선택
2. 유형을 `웹 앱`으로 선택
3. 실행 사용자를 `나`로 선택
4. 액세스 사용자를 로그인 요구가 없는 `모든 사용자`로 선택
5. 새 배포 후 새로 발급된 `/exec` 웹 앱 URL 복사

기존 배포를 수정했다면 반드시 버전을 `새 버전`으로 변경해야 저장한 코드와
매니페스트가 반영됩니다.

## 4. 요청 예시

브라우저 요청은 JSON 문자열을 `text/plain`으로 전송합니다.

### 회원가입

```javascript
fetch(APP_SCRIPT_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({
    action: 'signup',
    email: 'user@example.com',
    name: '김용우',
    nickname: '용우',
    password: '8자 이상의 비밀번호'
  })
}).then(response => response.json());
```

### 로그인

```javascript
fetch(APP_SCRIPT_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({
    action: 'login',
    email: 'user@example.com',
    password: '8자 이상의 비밀번호'
  })
}).then(response => response.json());
```

로그인 성공 응답의 `token`은 원문이 한 번만 반환됩니다. 프런트엔드에서는 `sessionStorage`에 보관하고 `me`, `logout` 요청에 함께 전달하세요.

### 세션 확인

```javascript
body: JSON.stringify({ action: 'me', token })
```

### 로그아웃

```javascript
body: JSON.stringify({ action: 'logout', token })
```

## 보안 범위

이 구현은 개인 프로젝트용 인증 예제입니다. 평문 비밀번호는 저장하지 않지만 Apps Script와 Sheets는 전문 인증 시스템이 아닙니다. 결제, 개인정보, 관리자 권한 등 민감한 서비스를 운영하려면 Firebase Authentication 같은 전용 인증 서비스를 사용하세요.
