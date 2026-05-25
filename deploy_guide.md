# T-Trade 실제 서비스 런칭 체크리스트

태국 거주 한국인을 대상으로 실제 운영을 시작하려면 아래 순서대로 진행하세요.

## 1. Firebase 프로젝트 준비

1. [Firebase 콘솔](https://console.firebase.google.com)에서 새 프로젝트를 만듭니다.
2. 웹 앱을 추가하고 SDK 설정값을 복사합니다.
3. `C:\workspace\T-Trade-2\firebase-config.js`의 빈 값에 SDK 설정값을 입력합니다.
4. Firebase 콘솔에서 Authentication의 이메일/비밀번호 로그인을 활성화합니다.
5. Firestore Database를 생성합니다.
6. Storage를 생성합니다.

## 2. 운영 보안 규칙 배포

이 저장소에는 운영용 기본 규칙이 포함되어 있습니다.

- `firestore.rules`: 상품은 누구나 읽을 수 있고, 작성/채팅은 로그인 회원만 가능합니다.
- `storage.rules`: 상품 이미지는 로그인한 본인 폴더에만 업로드할 수 있고, 파일 크기는 5MB 미만 이미지만 허용합니다.

Firebase CLI에서 한 번 로그인한 뒤 아래 명령으로 규칙과 호스팅을 배포합니다.

```powershell
cd C:\workspace\T-Trade-2
firebase login
firebase use --add
firebase deploy
```

절대로 Firestore 규칙을 `allow read, write: if true;`로 운영 배포하지 마세요.

## 3. 현재 앱의 운영 동작

- `firebase-config.js` 값이 비어 있으면 로컬 데모 모드로 실행됩니다.
- Firebase 설정값이 들어 있으면 실제 회원가입, 상품 등록, 채팅이 Firebase로 연결됩니다.
- 상품 이미지는 실제 서비스 모드에서 Firebase Storage에 업로드되고, Firestore에는 이미지 URL만 저장됩니다.

## 4. 런칭 전 필수 확인

- 회원가입과 로그인 테스트
- 상품 사진 포함 등록 테스트
- 다른 계정 간 채팅방 생성 및 메시지 전송 테스트
- 모바일 브라우저에서 홈, 상세, 채팅, 글쓰기 화면 확인
- Firebase 콘솔에서 Firestore/Storage 규칙이 게시되어 있는지 확인
- 실제 공유 전 `firebase-config.js`가 올바른 프로젝트를 가리키는지 확인

## 5. 런칭 후 바로 봐야 할 것

- Firebase Authentication 사용자 수
- Firestore 읽기/쓰기 사용량
- Storage 사용량
- 신고/차단/삭제 요청이 들어오는 운영 채널

