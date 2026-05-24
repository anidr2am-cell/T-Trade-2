# T-Trade 서비스 5분 상용 배포 및 백엔드 서버 연동 가이드

T-Trade는 로컬 시뮬레이터(데모)와 실시간 클라우드 서버 연동이 완벽하게 설계된 **듀얼 모드 하이브리드 웹 앱**입니다. 아래 단계를 따라 하시면 5분 안에 전 세계의 모든 태국 교민들이 실제로 회원가입하고, 실시간 매물 등록 및 1:1 라이브 채팅을 즐길 수 있도록 무료로 웹에 배포하여 운영할 수 있습니다!

---

## 1. ☁️ Google Firebase 클라우드 DB & 인증 서버 무료 개설

서버 유지비가 전혀 없는 Google Firebase 서버리스 환경을 구성합니다.

1.  **Firebase 콘솔 접속**: [Firebase 콘솔](https://console.firebase.google.com)에 로그인 후 **[프로젝트 추가]**를 클릭하여 새 프로젝트를 생성합니다. (프로젝트명 예시: `t-trade-thai`)
2.  **웹(Web) 앱 추가**: 대시보드 중앙의 `웹` 아이콘(`</>`)을 클릭하여 앱을 등록합니다.
3.  **SDK 접속 키 복사**: 발급되는 `firebaseConfig` 객체 코드를 복사합니다:
    ```javascript
    const firebaseConfig = {
      apiKey: "AIzaSy...",
      authDomain: "...",
      projectId: "...",
      storageBucket: "...",
      messagingSenderId: "...",
      appId: "..."
    };
    ```
4.  **로컬 파일 연동**: 복사한 키들을 **`C:\Progemini\firebase-config.js`** 파일의 비어 있는 큰따옴표(`""`) 자리에 채워 넣고 저장합니다. **이 즉시 T-Trade 앱은 전 세계 실시간 클라우드 모드로 자동 스위칭됩니다!**

---

## 2. 🔑 Firebase 클라우드 세부 기능 활성화 (1회성 설정)

접속용 키를 입력했으면, 사용자가 서비스를 이용할 수 있도록 다음 기능을 켜줍니다.

### A. 회원 인증 서비스 (Authentication) 활성화
*   Firebase 콘솔 좌측 메뉴 ➔ **빌드(Build)** ➔ **Authentication** ➔ **시작하기(Get Started)**.
*   **로그인 제공업체** 탭 ➔ **이메일/비밀번호** 활성화 후 저장.

### B. 실시간 NoSQL 데이터베이스 (Cloud Firestore) 활성화
*   콘솔 좌측 메뉴 ➔ **빌드** ➔ **Firestore Database** ➔ **데이터베이스 만들기**.
*   위치 설정(기본값 선호) 후 **테스트 모드에서 시작**을 선택해 시작합니다.
*   **[규칙(Rules)]** 탭으로 이동하여 누구든지 쓸 수 있도록 다음과 같이 규칙을 설정하고 **게시(Publish)**를 누릅니다:
    ```javascript
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /{document=**} {
          allow read, write: if true; // ⚠️ 실제 대형 상용 서비스 시에는 로그인 회원(request.auth != null)으로 보안 제한을 설정하세요.
        }
      }
    }
    ```

### C. 클라우드 이미지 스토리지 (Storage) 활성화 (옵션)
*   콘솔 좌측 메뉴 ➔ **빌드** ➔ **Storage** ➔ **시작하기** ➔ **테스트 모드에서 시작**.

---

## 3. 🚀 1분 만에 전 세계에 무료 배포하기 (Web Hosting)

서버 없이 정적 소스 파일 3개(`index.html`, `index.css`, `app.js`)와 설정 파일만으로 구동되므로, 무료 정적 호스팅 서비스를 통해 즉시 전 세계에 고속 배포할 수 있습니다.

### 방법 1. Vercel / Netlify 무료 원클릭 배포 (가장 추천)
1.  [Netlify (넷리파이)](https://www.netlify.com/) 또는 [Vercel (버셀)](https://vercel.com/)에 무료 가입합니다.
2.  폴더 업로드 화면에 **`C:\Progemini`** 폴더 전체를 드래그 앤 드롭으로 던져 넣습니다.
3.  단 10초 만에 나만의 실제 도메인 주소(예: `t-trade.vercel.app` 또는 `t-trade.netlify.app`)가 생성되며 배포가 완료됩니다!
4.  이 생성된 도메인 링크를 태국 교민 단톡방이나 사이트에 공유하면 누구나 즉시 직거래를 할 수 있습니다.

### 방법 2. Firebase 자체 무료 호스팅 이용
1.  시스템에 Firebase CLI가 설치되어 있다면 배포 경로를 `C:\Progemini`로 지정한 뒤,
2.  터미널에 `firebase deploy` 명령어를 실행하면 구글 초고속 CDN 서버망을 통해 무료 배포됩니다.

---

## 🇹🇭 태국 직거래 맞춤형 스캔 가능 QR 가이드

사용자 등록 시 혹은 판매자 프로필에서 **PromptPay 번호**가 연동되어 있다면, T-Trade는 국제 금융 결제망 **EMVCo 규격과 태국 중앙은행 PromptPay 표준 규격**에 부합하는 체크섬(CRC16) 페이로드를 생성합니다.

이로 인해 생성되는 QR 코드는 단순한 장식용 이미지가 아니며, **태국 카시콘(K-Plus), 방콕은행(Bualuang), 시암상업은행(SCB Easy) 등 실제 태국 내 모든 상용 모바일 뱅킹 앱으로 스캔하면 해당 판매자의 프롬프트페이 계정으로 정확한 거래 금액이 로드**되어 1초 만에 안전하고 수수료 없는 실제 직거래 송금이 가능합니다!
