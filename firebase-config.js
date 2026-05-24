/**
 * T-Trade 실운영을 위한 Firebase 클라우드 접속 키 설정
 * 
 * [설정 방법]
 * 1. Google Firebase 콘솔 (https://console.firebase.google.com) 접속 및 프로젝트 생성
 * 2. '웹 앱' 추가 후 발급받는 SDK 설정을 아래 객체에 복사-붙여넣기 하세요.
 * 3. 설정을 입력한 뒤 저장하면, T-Trade 앱은 즉시 실제 회원가입, 실시간 DB, 실시간 1:1 채팅 모드로 전환됩니다.
 * 4. 이 키를 비워두거나 파일이 누락된 경우, 앱은 오프라인 데모(로컬 시뮬레이터) 모드로 안전하게 작동합니다.
 */

const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};

// 태국 현지 직거래를 위한 프롬프트페이 설정 (QR 자동 결제용)
const promptPayConfig = {
    // 상품 거래 시 QR코드가 즉시 생성되도록 지원하는 판매자의 모바일 번호 또는 프롬프트페이 ID
    // 입력 예시: "0812345678" 또는 "1101234567890" (여권/태국 ID번호)
    defaultMerchantId: "0887654321" 
};
