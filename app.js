/**
 * T-Trade - 태국 거주 한인 중고거래 앱 통합 코어 엔진 (바닐라 Full-Stack)
 * 
 * [듀얼 모드 설계 - Dual-Mode Hybrid Engine]
 * 1. Firebase 실시간 클라우드 백엔드 (Auth, Firestore, Storage) 지원
 * 2. firebase-config.js 설정 누락/공백 시 오프라인 데모 시뮬레이터 자동 폴백
 * 3. 실제 스캔하여 송금 가능한 태국 표준 PromptPay QR EMVCo Payload 및 CRC16 생성기 내장
 */

// 실시간 바트 환율 고정 기준 (1 Baht = 37.5 Korean Won)
const EXCHANGE_RATE = 37.5;

// --- 1. 백엔드 연동 모드 상태 판별 ---
const isFirebaseLive = typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey !== "";

let db = null;
let auth = null;
let storage = null;

// Firebase 초기화 연동
if (isFirebaseLive) {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        storage = firebase.storage();
        console.log("T-Trade 백엔드 서버 연동 성공: 실시간 클라우드 모드로 가동 중!");
    } catch (e) {
        console.error("Firebase 초기화 에러. 데모 모드로 복귀합니다.", e);
    }
} else {
    console.log("T-Trade 데모 시뮬레이터 가동 중! (firebase-config.js 키를 입력해 실운영으로 고도화할 수 있습니다.)");
}

// --- 2. 로컬 상태 관리 (Local State) ---
const state = {
    activeTab: 'home',
    currentLocation: '전체',
    currentCategory: '전체',
    selectedProductId: null,
    selectedChatId: null,
    
    // 내 로그인 정보 (데모/실제 공용)
    currentUser: null, 
    
    tempUploadedPhotos: [],
    goods: [],      // 상품 목록
    chats: [],      // 채팅방 목록
    messagesListener: null, // 실시간 채팅 리스너 해제용
    
    // 오프라인 기본 매물 더미 셋 (데모 모드 시 로드)
    mockGoods: [
        {
            id: 1,
            title: "아이폰 15 프로 256GB 내츄럴티타늄 S급 직거래",
            category: "디지털기기",
            price: 28500,
            location: "방콕 수쿰빗",
            time: "1시간 전",
            views: 45,
            likes: 6,
            chats: 2,
            likedByUser: false,
            images: [
                "https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=600"
            ],
            seller: {
                uid: "seller_sukhumvit",
                name: "수쿰빗살이",
                avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=150",
                temp: 41.2,
                badge: "친절왕 • 응답신속",
                promptpayId: "0887654321"
            },
            description: "한국에서 사온 아이폰 15 프로 256기가 내츄럴티타늄 색상 판매합니다.\n배터리 성능 96%이고 상태 최상급입니다.\n방콕 아속역 코리아타운 앞이나 엠쿼티어 근처에서 직거래 선호합니다.\n원화 계좌 이체도 가능합니다!",
            tradeLocation: "방콕 아속 코리아타운 광장 앞"
        },
        {
            id: 2,
            title: "이케아 패브릭 3인승 소파 (그레이색상, 용달필요)",
            category: "가구/인테리어",
            price: 3500,
            location: "치앙마이 님만",
            time: "3시간 전",
            views: 120,
            likes: 8,
            chats: 1,
            likedByUser: false,
            images: [
                "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=600"
            ],
            seller: {
                uid: "seller_chiangmai",
                name: "치앙마이노마드",
                avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150",
                temp: 36.8,
                badge: "신뢰감100",
                promptpayId: "0812345678"
            },
            description: "작년에 치앙마이 이케아에서 구매한 3인승 소파 급하게 처분합니다.\n찢어짐 없이 깨끗하며 직접 수거해가셔야 합니다.",
            tradeLocation: "치앙마이 님만해민 힐사이드 콘도 앞"
        },
        {
            id: 3,
            title: "에어팟 프로 2세대 풀박스 (정품, 상태양호)",
            category: "디지털기기",
            price: 4900,
            location: "방콕 라차다",
            time: "5시간 전",
            views: 78,
            likes: 12,
            chats: 4,
            likedByUser: true,
            images: [
                "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&q=80&w=600"
            ],
            seller: {
                uid: "seller_ratchada",
                name: "방콕타이",
                avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150",
                temp: 39.5,
                badge: "시간약속칼",
                promptpayId: "0898765432"
            },
            description: "에어팟 프로 2세대 라이트닝 버전 판매합니다.\n케이스 스크래치 외에는 완벽히 잘 작동합니다. 박스 있습니다.",
            tradeLocation: "MRT 팔람9역 3번출구 안쪽"
        }
    ],

    // 오프라인 모의 채팅방 기본 데이터 셋
    mockChats: [
        {
            id: 101,
            partner: {
                uid: "seller_ratchada",
                name: "방콕타이",
                avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150",
                temp: 39.5,
                promptpayId: "0898765432"
            },
            product: {
                id: 3,
                title: "에어팟 프로 2세대 풀박스",
                price: 4900,
                image: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&q=80&w=600"
            },
            lastMessage: "오늘 저녁 아속역 한인타운 앞에서 만나요!",
            lastTime: "오후 3:45",
            unreadCount: 1,
            messages: [
                { sender: 'them', text: "안녕하세요! 에어팟 프로 아직 구매 가능한가요?", time: "오후 3:10" },
                { sender: 'me', text: "안녕하세요, 방콕타이님! 네, 아직 판매 중입니다.", time: "오후 3:12" },
                { sender: 'them', text: "혹시 가격 제안이 가능할까요? ฿4,500에 해주시면 안되나요?", time: "오후 3:15" },
                { sender: 'me', text: "음.. 상태가 아주 좋아서요. ฿4,700 정도까지는 어떠신가요?", time: "오후 3:20" },
                { sender: 'them', text: "좋습니다! ฿4,700에 구매할게요! 아속역 근처에서 뵐까요?", time: "오후 3:30" },
                { sender: 'them', text: "오늘 저녁 아속역 한인타운 앞에서 만나요!", time: "오후 3:45" }
            ],
            promptPayPaid: false
        }
    ]
};

// --- 3. 앱 기동 (App Setup) ---
document.addEventListener("DOMContentLoaded", () => {
    setupAuthListeners();
    bindCommonEvents();
    syncDatabase();
});

// --- 4. 백엔드 상태에 따른 동기화 레이어 (Sync Database) ---
function syncDatabase() {
    const statusBadge = document.getElementById("db-status-badge");
    
    if (isFirebaseLive) {
        statusBadge.innerHTML = `<span style="color:#10B981;"><i class="fa-solid fa-cloud"></i> 실시간 클라우드</span>`;
        
        // 4-1. Firestore에서 실시간 매물 가져오기
        db.collection("products").orderBy("timestamp", "desc").onSnapshot(snapshot => {
            state.goods = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                state.goods.push({
                    id: doc.id,
                    ...data,
                    // 타임스탬프를 상대 시간으로 보조 포맷
                    time: formatRelativeTime(data.timestamp)
                });
            });
            renderFeed();
        }, err => {
            console.error("Firestore 실시간 상품 로딩 실패, 데모 데이터로 전환합니다.", err);
            loadDemoData();
        });

    } else {
        statusBadge.innerHTML = `<span style="color:var(--t-gray-text);"><i class="fa-solid fa-triangle-exclamation"></i> 로컬 데모 모드</span>`;
        loadDemoData();
    }
}

function loadDemoData() {
    state.goods = [...state.mockGoods];
    state.chats = [...state.mockChats];
    
    // 데모 환경 가상 로그인 세팅
    state.currentUser = {
        uid: "demo_user_123",
        name: "방콕조아",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150",
        temp: 37.5,
        region: "방콕 수쿰빗",
        promptpayId: "0887654321"
    };

    updateUserUI();
    renderFeed();
    renderChatList();
}

// 상대시간 계산기
function formatRelativeTime(timestamp) {
    if (!timestamp) return "방금 전";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // 초 단위
    
    if (diff < 60) return "방금 전";
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
}

// --- 5. 회원 인증 (Authentication) 및 가상/실제 리스너 ---
function setupAuthListeners() {
    if (isFirebaseLive) {
        auth.onAuthStateChanged(user => {
            if (user) {
                // 로그인 완료 시 Firestore에서 프로필 세부 데이터 조회
                db.collection("users").doc(user.uid).onSnapshot(doc => {
                    if (doc.exists) {
                        const profile = doc.data();
                        state.currentUser = {
                            uid: user.uid,
                            email: user.email,
                            name: profile.nickname || "교민",
                            avatar: profile.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150",
                            temp: profile.temp || 36.5,
                            region: profile.region || "방콕 수쿰빗",
                            promptpayId: profile.promptpayId || ""
                        };
                    } else {
                        // 정보가 없을 때의 기본값 세팅
                        state.currentUser = {
                            uid: user.uid,
                            email: user.email,
                            name: "이름없음",
                            avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150",
                            temp: 36.5,
                            region: "방콕 수쿰빗",
                            promptpayId: ""
                        };
                    }
                    updateUserUI();
                    syncRealChatRooms();
                });
            } else {
                state.currentUser = null;
                updateUserUI();
                renderChatList();
            }
        });
    }
}

// 실시간 DB 채팅방 리스너 연결
function syncRealChatRooms() {
    if (!isFirebaseLive || !state.currentUser) return;

    db.collection("chats")
      .where("participants", "array-contains", state.currentUser.uid)
      .onSnapshot(snapshot => {
          state.chats = [];
          snapshot.forEach(doc => {
              const data = doc.data();
              // 파트너 정보 가공
              const partnerInfo = data.buyer.uid === state.currentUser.uid ? data.seller : data.buyer;
              state.chats.push({
                  id: doc.id,
                  partner: {
                      uid: partnerInfo.uid,
                      name: partnerInfo.name,
                      avatar: partnerInfo.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150",
                      temp: partnerInfo.temp || 36.5,
                      promptpayId: partnerInfo.promptpayId || ""
                  },
                  product: data.product,
                  lastMessage: data.lastMessage || "대화가 시작되었습니다.",
                  lastTime: data.lastTime || "방금",
                  unreadCount: data.unreadCount ? (data.unreadCount[state.currentUser.uid] || 0) : 0,
                  promptPayPaid: data.promptPayPaid || false
              });
          });
          renderChatList();
      });
}

function updateUserUI() {
    const profileCard = document.getElementById("my-profile-card");
    const authPromptCard = document.getElementById("my-auth-prompt-card");
    const chatAuthBanner = document.getElementById("chat-auth-banner");
    const chatListView = document.getElementById("chat-list-view");

    if (state.currentUser) {
        // 로그인 완료 상태 UI 활성화
        profileCard.style.display = "flex";
        authPromptCard.style.display = "none";
        
        if (chatAuthBanner) chatAuthBanner.style.display = "none";
        chatListView.style.display = "block";

        document.getElementById("user-profile-name").textContent = state.currentUser.name;
        document.getElementById("user-profile-tag").textContent = `${state.currentUser.region} • ${isFirebaseLive ? '서버 로그인됨' : '로컬 데모 사용중'}`;
        document.getElementById("my-avatar").src = state.currentUser.avatar;
        document.getElementById("user-setting-loc").innerHTML = `${state.currentUser.region} <i class="fa-solid fa-chevron-right"></i>`;
        
        // 매너온도 반영
        document.getElementById("my-temp-text").innerHTML = `${state.currentUser.temp.toFixed(1)}°C <i class="fa-regular fa-face-smile"></i>`;
        document.getElementById("my-temp-bar").style.width = `${state.currentUser.temp}%`;
        document.getElementById("my-temp-bar").style.backgroundColor = getTempColor(state.currentUser.temp);
        
        // 플로팅 쓰기 버튼 활성
        document.getElementById("write-trigger-btn").style.opacity = "1";
        document.getElementById("write-trigger-btn").style.pointerEvents = "auto";
    } else {
        // 비로그인 상태 UI 활성화
        profileCard.style.display = "none";
        authPromptCard.style.display = "flex";

        if (chatAuthBanner) chatAuthBanner.style.display = "flex";
        chatListView.style.display = "none";

        // 글쓰기 불가 처리
        document.getElementById("write-trigger-btn").style.opacity = "0.4";
        document.getElementById("write-trigger-btn").style.pointerEvents = "none";
    }
    updateLikeCountDisplay();
}

// --- 6. 피드 및 상품 렌더링 ---
function renderFeed() {
    const feedContainer = document.getElementById("goods-feed");
    feedContainer.innerHTML = "";

    const filteredGoods = state.goods.filter(item => {
        const matchesLoc = (state.currentLocation === '전체' || item.location === state.currentLocation);
        const matchesCat = (state.currentCategory === '전체' || item.category === state.currentCategory);
        return matchesLoc && matchesCat;
    });

    if (filteredGoods.length === 0) {
        feedContainer.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--t-gray-text);">
                <i class="fa-solid fa-store-slash" style="font-size: 3rem; color: #D1D5DB; margin-bottom: 12px;"></i>
                <p style="font-size: 0.95rem; font-weight: 500;">현재 구역/카테고리에 매물이 없습니다.</p>
            </div>
        `;
        return;
    }

    filteredGoods.forEach(item => {
        const krwPriceStr = Math.round(item.price * EXCHANGE_RATE).toLocaleString();
        const thbPriceStr = item.price.toLocaleString();
        
        // 좋아요 카운터 (실시간 모드 시 Array length 또는 숫자형 지원)
        const isLiked = isFirebaseLive && Array.isArray(item.likedBy)
            ? item.likedBy.includes(state.currentUser?.uid)
            : item.likedByUser;
        
        const likesCount = isFirebaseLive && Array.isArray(item.likedBy)
            ? item.likedBy.length
            : item.likes;

        const card = document.createElement("div");
        card.className = "item-card";
        card.setAttribute("data-id", item.id);
        
        card.innerHTML = `
            <div class="item-img-container">
                <img src="${item.images[0]}" class="item-img" alt="${item.title}" loading="lazy">
            </div>
            <div class="item-info">
                <div>
                    <h3 class="item-title">${item.title}</h3>
                    <div class="item-meta">
                        <span>${item.location}</span>
                        <span>•</span>
                        <span>${item.time}</span>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <div class="price-container">
                        <span class="price-thb">฿ ${thbPriceStr}</span>
                        <span class="price-krw">≈ ${krwPriceStr}원</span>
                    </div>
                    <div class="card-stats">
                        ${item.chats > 0 ? `<span class="stat-item"><i class="fa-regular fa-comment"></i> ${item.chats}</span>` : ''}
                        <span class="stat-item ${isLiked ? 'active' : ''}">
                            <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i> ${likesCount}
                        </span>
                    </div>
                </div>
            </div>
        `;

        card.addEventListener("click", () => {
            openProductDetail(item.id);
        });

        feedContainer.appendChild(card);
    });
}

function openProductDetail(productId) {
    state.selectedProductId = productId;
    const item = state.goods.find(g => g.id === productId);
    if (!item) return;

    const detailOverlay = document.getElementById("product-detail-view");
    const carouselTrack = document.getElementById("detail-carousel-track");
    const carouselIndicators = document.getElementById("detail-carousel-indicators");
    
    carouselTrack.innerHTML = "";
    carouselIndicators.innerHTML = "";
    
    item.images.forEach((imgSrc, idx) => {
        const slide = document.createElement("div");
        slide.className = "carousel-slide";
        slide.innerHTML = `<img src="${imgSrc}" alt="${item.title} 이미지 ${idx+1}">`;
        carouselTrack.appendChild(slide);

        const indicator = document.createElement("div");
        indicator.className = `indicator ${idx === 0 ? 'active' : ''}`;
        indicator.setAttribute("data-slide-index", idx);
        carouselIndicators.appendChild(indicator);
    });

    document.getElementById("detail-seller-avatar").src = item.seller.avatar;
    document.getElementById("detail-seller-name").textContent = item.seller.name;
    document.getElementById("detail-seller-loc").textContent = `${item.location} • ${item.seller.badge || 'T-Trade 이웃'}`;
    
    // 매너온도 반영
    const sTemp = item.seller.temp || 36.5;
    const mannerVal = document.getElementById("detail-manner-temp");
    mannerVal.innerHTML = `${sTemp.toFixed(1)}°C <i class="fa-solid fa-face-smile"></i>`;
    mannerVal.style.color = getTempColor(sTemp);
    
    const mannerBar = document.getElementById("detail-manner-temp-bar");
    mannerBar.style.width = `${sTemp}%`;
    mannerBar.style.backgroundColor = getTempColor(sTemp);

    document.getElementById("detail-title").textContent = item.title;
    document.getElementById("detail-meta").textContent = `${item.category} • ${item.time} • 조회 ${item.views || 0}`;
    document.getElementById("detail-description").textContent = item.description;
    document.getElementById("detail-trade-location").textContent = item.tradeLocation || "판매자와 아속역 조율 가능";

    document.getElementById("detail-price-thb").textContent = `฿ ${item.price.toLocaleString()}`;
    document.getElementById("detail-price-krw").textContent = `≈ ${(Math.round(item.price * EXCHANGE_RATE)).toLocaleString()}원`;
    
    // 좋아요 상태 로딩
    const isLiked = isFirebaseLive && Array.isArray(item.likedBy)
        ? item.likedBy.includes(state.currentUser?.uid)
        : item.likedByUser;

    const likeBtn = document.getElementById("detail-like-btn");
    if (isLiked) {
        likeBtn.className = "like-action-btn active";
        likeBtn.innerHTML = `<i class="fa-solid fa-heart"></i>`;
    } else {
        likeBtn.className = "like-action-btn";
        likeBtn.innerHTML = `<i class="fa-regular fa-heart"></i>`;
    }

    detailOverlay.classList.add("active");
    initCarouselSwipe();
}

// --- 7. 채팅 목록 및 1:1 대화 렌더러 ---
function renderChatList() {
    const chatListContainer = document.getElementById("chat-list-view");
    if (!chatListContainer) return;
    chatListContainer.innerHTML = "";

    if (!state.currentUser) return;

    if (state.chats.length === 0) {
        chatListContainer.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--t-gray-text);">
                <i class="fa-regular fa-comments" style="font-size: 3rem; color: #D1D5DB; margin-bottom: 12px;"></i>
                <p style="font-size: 0.95rem; font-weight: 500;">현재 활성화된 대화방이 없습니다.</p>
                <p style="font-size: 0.8rem; margin-top: 4px;">관심 매물의 상세페이지에서 '채팅하기'를 눌러 시작하세요!</p>
            </div>
        `;
        return;
    }

    state.chats.forEach(chat => {
        const card = document.createElement("div");
        card.className = "chat-card";
        card.setAttribute("data-chat-id", chat.id);
        
        card.innerHTML = `
            <img src="${chat.partner.avatar}" class="chat-card-avatar" alt="${chat.partner.name}">
            <div class="chat-card-info">
                <div class="chat-card-row1">
                    <span class="chat-card-name">${chat.partner.name}</span>
                    <span class="chat-card-time">${chat.lastTime}</span>
                </div>
                <div class="chat-card-row2">
                    <span class="chat-card-msg">${chat.lastMessage}</span>
                    ${chat.unreadCount > 0 ? `<span class="chat-card-badge">${chat.unreadCount}</span>` : ''}
                </div>
            </div>
            <img src="${chat.product.image}" class="chat-card-prod-img" alt="${chat.product.title}">
        `;

        card.addEventListener("click", () => {
            openChatWindow(chat.id);
        });

        chatListContainer.appendChild(card);
    });

    // 전체 읽지 않은 메시지 뱃지 갱신
    const totalUnread = state.chats.reduce((acc, curr) => acc + curr.unreadCount, 0);
    const badge = document.getElementById("chat-tab-badge");
    if (totalUnread > 0) {
        badge.textContent = totalUnread;
        badge.style.display = "flex";
    } else {
        badge.style.display = "none";
    }
}

function openChatWindow(chatId) {
    state.selectedChatId = chatId;
    const chat = state.chats.find(c => c.id == chatId);
    if (!chat) return;

    // 대화 헤더 및 상품 요약 로드
    document.getElementById("chat-partner-name").textContent = chat.partner.name;
    document.getElementById("chat-prod-thumb").src = chat.product.image;
    document.getElementById("chat-prod-title").textContent = chat.product.title;
    document.getElementById("chat-prod-price").textContent = `฿ ${chat.product.price.toLocaleString()}`;

    const chatDetailView = document.getElementById("chat-detail-view");
    chatDetailView.classList.add("active");

    if (isFirebaseLive) {
        // 1) 클라우드 실시간 채팅 리스너 해제 및 재바인딩
        if (state.messagesListener) state.messagesListener();
        
        // 읽지 않은 메시지 카운트 0으로 초기화
        db.collection("chats").doc(chatId).set({
            unreadCount: {
                [state.currentUser.uid]: 0
            }
        }, { merge: true });

        state.messagesListener = db.collection("chats")
            .doc(chatId)
            .collection("messages")
            .orderBy("timestamp", "asc")
            .onSnapshot(snapshot => {
                const msgBox = document.getElementById("chat-messages-box");
                msgBox.innerHTML = "";

                // 안심 가이드 렌더링
                renderSystemTip(msgBox);

                snapshot.forEach(doc => {
                    const msg = doc.data();
                    const row = document.createElement("div");
                    const isMe = msg.senderId === state.currentUser.uid;
                    row.className = `chat-bubble-wrapper ${isMe ? 'sent' : 'received'}`;
                    
                    row.innerHTML = `
                        ${!isMe ? `<img src="${chat.partner.avatar}" class="bubble-avatar" alt="아바타">` : ''}
                        <div class="bubble-text">${msg.text}</div>
                        <div class="bubble-time">${formatChatTime(msg.timestamp)}</div>
                    `;
                    msgBox.appendChild(row);
                });

                // 프롬프트페이 송금 상태 실시간 시스템 노티
                if (chat.promptPayPaid) {
                    const payNoti = document.createElement("div");
                    payNoti.className = "chat-system-message";
                    payNoti.style.background = "#D1FAE5";
                    payNoti.style.color = "#065F46";
                    payNoti.innerHTML = `<i class="fa-solid fa-circle-check"></i> PromptPay ฿ ${chat.product.price.toLocaleString()} 송금 완료!`;
                    msgBox.appendChild(payNoti);
                }

                msgBox.scrollTop = msgBox.scrollHeight;
            });
    } else {
        // 2) 로컬 데모 모드 리스너
        renderChatMessages();
    }
}

function renderSystemTip(msgBox) {
    const systemTip = document.createElement("div");
    systemTip.className = "chat-system-message";
    systemTip.innerHTML = `
        <i class="fa-solid fa-circle-info"></i> T-Trade 안심 직거래 팁!<br>
        현금 소지 대신 아래의 <strong>PromptPay QR</strong> 버튼을 눌러 현장에서 실시간 이체하세요.
    `;
    msgBox.appendChild(systemTip);
}

function formatChatTime(timestamp) {
    if (!timestamp) return "방금";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? '오후' : '오전';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${ampm} ${hours}:${minutes}`;
}

// 로컬 오프라인 전용 채팅 렌더러
function renderChatMessages() {
    const chat = state.chats.find(c => c.id == state.selectedChatId);
    if (!chat) return;

    const msgBox = document.getElementById("chat-messages-box");
    msgBox.innerHTML = "";
    renderSystemTip(msgBox);

    chat.messages.forEach(msg => {
        const row = document.createElement("div");
        const isMe = msg.sender === 'me';
        row.className = `chat-bubble-wrapper ${isMe ? 'sent' : 'received'}`;
        
        row.innerHTML = `
            ${!isMe ? `<img src="${chat.partner.avatar}" class="bubble-avatar" alt="아바타">` : ''}
            <div class="bubble-text">${msg.text}</div>
            <div class="bubble-time">${msg.time}</div>
        `;
        msgBox.appendChild(row);
    });

    if (chat.promptPayPaid) {
        const payNoti = document.createElement("div");
        payNoti.className = "chat-system-message";
        payNoti.style.background = "#D1FAE5";
        payNoti.style.color = "#065F46";
        payNoti.innerHTML = `<i class="fa-solid fa-circle-check"></i> PromptPay ฿ ${chat.product.price.toLocaleString()} 송금 완료!`;
        msgBox.appendChild(payNoti);
    }
    msgBox.scrollTop = msgBox.scrollHeight;
}

// --- 8. 핵심 이벤트 리스너 바인딩 ---
function bindCommonEvents() {
    
    // 8-1. 공통 네비게이션 탭 바 스위처
    const navItems = document.querySelectorAll(".bottom-nav .nav-item");
    navItems.forEach(btn => {
        btn.addEventListener("click", () => {
            const tabName = btn.getAttribute("data-tab");
            switchTab(tabName);
        });
    });

    // 8-2. 헤더 지역 변경 드롭다운
    const locSelectBtn = document.getElementById("loc-select-btn");
    const locDropdown = document.getElementById("loc-dropdown");
    
    locSelectBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        locDropdown.classList.toggle("active");
    });

    const locOptions = document.querySelectorAll(".location-option");
    locOptions.forEach(opt => {
        opt.addEventListener("click", (e) => {
            e.stopPropagation();
            const locName = opt.getAttribute("data-loc");
            state.currentLocation = locName;
            document.getElementById("current-location").textContent = locName === '전체' ? '태국 전체' : locName;
            locDropdown.classList.remove("active");
            renderFeed();
        });
    });

    document.addEventListener("click", () => locDropdown.classList.remove("active"));

    // 8-3. 카테고리 퀵 바 필터
    const catChips = document.querySelectorAll(".category-slider .category-chip");
    catChips.forEach(chip => {
        chip.addEventListener("click", () => {
            catChips.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            state.currentCategory = chip.getAttribute("data-cat");
            renderFeed();
        });
    });

    // 8-4. 상세 및 채팅 닫기 백버튼
    document.getElementById("detail-back-btn").addEventListener("click", () => {
        document.getElementById("product-detail-view").classList.remove("active");
        state.selectedProductId = null;
    });

    document.getElementById("chat-back-btn").addEventListener("click", () => {
        document.getElementById("chat-detail-view").classList.remove("active");
        if (state.messagesListener) state.messagesListener();
        state.selectedChatId = null;
    });

    // 8-5. 상세화면 좋아요 클릭
    document.getElementById("detail-like-btn").addEventListener("click", handleProductLike);

    // 8-6. 상세화면 채팅하기 액션
    document.getElementById("detail-chat-btn").addEventListener("click", handleInitiateChat);

    // 8-7. 대화 전송
    document.getElementById("chat-send-btn").addEventListener("click", handleSendMessage);
    document.getElementById("chat-text-input").addEventListener("keypress", (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });

    // 8-8. 글쓰기 모달 열기/닫기
    const writeSheet = document.getElementById("write-sheet");
    const writeSheetDim = document.getElementById("write-sheet-dim");
    
    document.getElementById("write-trigger-btn").addEventListener("click", () => {
        if (!state.currentUser) {
            alert("상품을 등록하려면 로그인이 필요합니다.");
            return;
        }
        writeSheet.classList.add("active");
        writeSheetDim.classList.add("active");
        
        state.tempUploadedPhotos = [];
        document.getElementById("uploaded-img-preview-container").innerHTML = "";
        document.getElementById("uploaded-count").textContent = "0";
        document.getElementById("write-title").value = "";
        document.getElementById("write-price").value = "";
        document.getElementById("write-desc").value = "";
        document.getElementById("write-loc-text").value = "";
        document.getElementById("price-convert-msg").innerHTML = "";
    });

    const closeWrite = () => {
        writeSheet.classList.remove("active");
        writeSheetDim.classList.remove("active");
    };
    document.getElementById("write-close-btn").addEventListener("click", closeWrite);
    writeSheetDim.addEventListener("click", closeWrite);

    // 8-9. 실제 파일 업로드 체이닝 (HTML5 FileReader 로컬 Base64 지원)
    const fileInput = document.getElementById("real-file-input");
    fileInput.addEventListener("change", (e) => {
        const files = e.target.files;
        if (!files) return;

        const maxUpload = 5 - state.tempUploadedPhotos.length;
        const limit = Math.min(files.length, maxUpload);

        for (let i = 0; i < limit; i++) {
            const file = files[i];
            const reader = new FileReader();
            
            reader.onload = function(evt) {
                const base64Url = evt.target.result;
                const idx = state.tempUploadedPhotos.length;
                state.tempUploadedPhotos.push(base64Url);

                // 화면에 임시 썸네일 프리뷰 칩 렌더링
                const previewContainer = document.getElementById("uploaded-img-preview-container");
                const wrapper = document.createElement("div");
                wrapper.className = "uploaded-img-wrapper";
                wrapper.innerHTML = `
                    <img src="${base64Url}" alt="업로드 이미지">
                    <button class="img-delete-btn" data-index="${idx}"><i class="fa-solid fa-xmark"></i></button>
                `;
                previewContainer.appendChild(wrapper);
                document.getElementById("uploaded-count").textContent = state.tempUploadedPhotos.length;

                // 썸네일 삭제 바인딩
                wrapper.querySelector(".img-delete-btn").addEventListener("click", (evt) => {
                    evt.stopPropagation();
                    const dIdx = parseInt(evt.currentTarget.getAttribute("data-index"));
                    state.tempUploadedPhotos.splice(dIdx, 1);
                    wrapper.remove();
                    
                    document.getElementById("uploaded-count").textContent = state.tempUploadedPhotos.length;
                    previewContainer.querySelectorAll(".img-delete-btn").forEach((btn, newIdx) => {
                        btn.setAttribute("data-index", newIdx);
                    });
                });
            };
            reader.readAsDataURL(file);
        }
    });

    // 8-10. 바트-원화 글쓰기 실시간 환율 정보 자동 연산
    document.getElementById("write-price").addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        const convertMsg = document.getElementById("price-convert-msg");
        if (isNaN(val) || val <= 0) {
            convertMsg.innerHTML = "";
            return;
        }
        const wonPrice = Math.round(val * EXCHANGE_RATE);
        convertMsg.innerHTML = `<i class="fa-solid fa-arrow-right-arrow-left"></i> 원화 환산 약 <strong>${wonPrice.toLocaleString()}</strong>원 <span style="font-size:0.75rem; color:var(--t-gray-text);">(${EXCHANGE_RATE}원 적용)</span>`;
    });

    // 8-11. 상품 업로드 완료 제출
    document.getElementById("write-submit-btn").addEventListener("click", handleSubmitProduct);

    // 8-12. 회원가입/로그인 모달 창 열기/닫기 제어
    const authSheet = document.getElementById("auth-sheet");
    const authSheetDim = document.getElementById("auth-sheet-dim");
    
    const openAuth = (isSignUp = false) => {
        authSheet.classList.add("active");
        authSheetDim.classList.add("active");
        document.getElementById("auth-error-msg").textContent = "";
        
        toggleAuthMode(isSignUp);
    };

    const closeAuth = () => {
        authSheet.classList.remove("active");
        authSheetDim.classList.remove("active");
    };

    document.getElementById("auth-login-sheet-btn").addEventListener("click", () => openAuth(false));
    document.getElementById("auth-signup-sheet-btn").addEventListener("click", () => openAuth(true));
    document.getElementById("chat-login-trigger").addEventListener("click", () => {
        switchTab('mypage');
        openAuth(false);
    });

    document.getElementById("auth-close-btn").addEventListener("click", closeAuth);
    authSheetDim.addEventListener("click", closeAuth);

    // 로그인 ⇄ 회원가입 양식 전환 토글 링크
    document.getElementById("auth-toggle-link").addEventListener("click", (e) => {
        e.preventDefault();
        const isSignUp = document.getElementById("auth-submit-btn").textContent === "회원가입 하기";
        toggleAuthMode(!isSignUp);
    });

    // 로그인/회원가입 가상/실제 데이터 제출 처리
    document.getElementById("auth-submit-btn").addEventListener("click", handleAuthSubmit);

    // 로그아웃 버튼
    document.getElementById("logout-btn").addEventListener("click", handleLogout);

    // 8-13. 바트-원화 간편 계산기
    document.getElementById("calc-tool-btn").addEventListener("click", () => {
        const userPrompt = prompt("환전 계산할 태국 바트(฿) 금액을 숫자로 입력하세요:", "1000");
        if (userPrompt === null) return;
        const baht = parseFloat(userPrompt);
        if (isNaN(baht)) {
            alert("유효한 숫자를 입력해 주세요.");
            return;
        }
        const krw = Math.round(baht * EXCHANGE_RATE);
        alert(`฿ ${baht.toLocaleString()} 바트는 현재 원화 환산 약 ${krw.toLocaleString()}원 입니다.\n(환율 기준: 1 THB = ${EXCHANGE_RATE} KRW)`);
    });

    // 8-14. PromptPay QR 모달 생성 제어 및 100% 실거래 QR 생성
    const qrModal = document.getElementById("promptpay-modal");
    document.getElementById("promptpay-open-btn").addEventListener("click", () => {
        const chat = state.chats.find(c => c.id == state.selectedChatId);
        if (!chat) return;

        // 수취인 프롬프트페이 번호 확보 (판매자의 ID가 없다면 기본 지정 ID 연동)
        const receiverPP = chat.partner.promptpayId || (typeof promptPayConfig !== 'undefined' ? promptPayConfig.defaultMerchantId : "0887654321");
        
        document.getElementById("pp-receiver-name").textContent = `${chat.partner.name} (수취인)`;
        document.getElementById("pp-amount-baht").textContent = `฿ ${chat.product.price.toLocaleString()}`;
        document.getElementById("pp-amount-won").textContent = `≈ ${(Math.round(chat.product.price * EXCHANGE_RATE)).toLocaleString()}원`;

        // 1. 오프라인 Canvas QR 그리기
        drawPromptPayQR(chat.partner.name, chat.product.price);

        // 2. 실거래 가능 100% 스캔 QR 연동 (공식 API)
        const qrCanvas = document.getElementById("qr-canvas");
        const qrRealImg = document.getElementById("qr-real-api-img");
        const guideMsg = document.getElementById("qr-scan-guide-msg");

        try {
            // 태국 PromptPay 모바일 표준 Payload 생성
            const payload = generatePromptPayPayload(receiverPP, chat.product.price);
            // QR Server 글로벌 보안 API 링크 전달
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payload)}`;
            
            qrRealImg.src = qrApiUrl;
            qrRealImg.style.display = "block";
            qrCanvas.style.display = "none";
            
            guideMsg.innerHTML = `<span style="color:#0D9488; font-weight:700;"><i class="fa-solid fa-qrcode"></i> 태국 모바일 뱅킹 스캔 지원!</span><br>모바일 뱅킹 앱의 QR스캐너로 비추면 금액이 자동 기입됩니다.`;
        } catch (err) {
            console.error("실거래용 QR 생성 실패. 로컬 모형 QR로 렌더링합니다.", err);
            qrRealImg.style.display = "none";
            qrCanvas.style.display = "block";
            guideMsg.innerHTML = `모형 송금 완료 버튼을 클릭하면 완료 처리됩니다.`;
        }

        qrModal.classList.add("active");
    });

    document.getElementById("pp-pay-cancel-btn").addEventListener("click", () => qrModal.classList.remove("active"));
    document.getElementById("pp-pay-complete-btn").addEventListener("click", handleCompletePayment);
}

// --- 9. 핵심 비즈니스 로직 이벤트 처리기 (Event Handlers) ---

function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll(".tab-content").forEach(tc => tc.style.display = "none");
    document.querySelectorAll(".bottom-nav .nav-item").forEach(item => item.classList.remove("active"));

    if (tabName === 'home') {
        document.getElementById("tab-home").style.display = "block";
        document.querySelector("[data-tab='home']").classList.add("active");
        document.getElementById("main-header").style.display = "flex";
        document.getElementById("write-trigger-btn").style.display = "flex";
        renderFeed();
    } else if (tabName === 'chats') {
        document.getElementById("tab-chats").style.display = "block";
        document.querySelector("[data-tab='chats']").classList.add("active");
        document.getElementById("main-header").style.display = "flex";
        document.getElementById("write-trigger-btn").style.display = "none";
        renderChatList();
    } else if (tabName === 'mypage') {
        document.getElementById("tab-mypage").style.display = "block";
        document.querySelector("[data-tab='mypage']").classList.add("active");
        document.getElementById("main-header").style.display = "none";
        document.getElementById("write-trigger-btn").style.display = "none";
    }
}

// 9-1. 좋아요 버튼 기능
function handleProductLike() {
    if (!state.currentUser) {
        alert("관심 목록에 추가하려면 로그인이 필요합니다.");
        return;
    }

    const item = state.goods.find(g => g.id == state.selectedProductId);
    if (!item) return;

    const likeBtn = document.getElementById("detail-like-btn");

    if (isFirebaseLive) {
        const prodRef = db.collection("products").doc(item.id);
        const isLiked = item.likedBy.includes(state.currentUser.uid);
        
        if (isLiked) {
            prodRef.update({
                likedBy: firebase.firestore.FieldValue.arrayRemove(state.currentUser.uid)
            });
            likeBtn.className = "like-action-btn";
            likeBtn.innerHTML = `<i class="fa-regular fa-heart"></i>`;
        } else {
            prodRef.update({
                likedBy: firebase.firestore.FieldValue.arrayUnion(state.currentUser.uid)
            });
            likeBtn.className = "like-action-btn active";
            likeBtn.innerHTML = `<i class="fa-solid fa-heart"></i>`;
        }
    } else {
        item.likedByUser = !item.likedByUser;
        if (item.likedByUser) {
            item.likes += 1;
            likeBtn.className = "like-action-btn active";
            likeBtn.innerHTML = `<i class="fa-solid fa-heart"></i>`;
        } else {
            item.likes -= 1;
            likeBtn.className = "like-action-btn";
            likeBtn.innerHTML = `<i class="fa-regular fa-heart"></i>`;
        }
        renderFeed();
        updateLikeCountDisplay();
    }
}

// 9-2. 상세창에서 1:1 채팅하기 시작
function handleInitiateChat() {
    if (!state.currentUser) {
        alert("채팅을 시작하려면 로그인이 필요합니다.");
        return;
    }

    const item = state.goods.find(g => g.id == state.selectedProductId);
    if (!item) return;

    if (item.seller.uid === state.currentUser.uid) {
        alert("본인이 등록한 물건에는 채팅을 보낼 수 없습니다.");
        return;
    }

    if (isFirebaseLive) {
        // Firestore 기반 채팅방 개설 (두 사람의 UID 결합 키 생성)
        const chatRoomId = state.currentUser.uid < item.seller.uid 
            ? `${state.currentUser.uid}_${item.seller.uid}_${item.id}` 
            : `${item.seller.uid}_${state.currentUser.uid}_${item.id}`;

        const chatRef = db.collection("chats").doc(chatRoomId);
        
        chatRef.get().then(doc => {
            if (!doc.exists) {
                // 신규 채팅방 개설 데이터 주입
                chatRef.set({
                    participants: [state.currentUser.uid, item.seller.uid],
                    buyer: {
                        uid: state.currentUser.uid,
                        name: state.currentUser.name,
                        avatar: state.currentUser.avatar
                    },
                    seller: {
                        uid: item.seller.uid,
                        name: item.seller.name,
                        avatar: item.seller.avatar,
                        promptpayId: item.seller.promptpayId || ""
                    },
                    product: {
                        id: item.id,
                        title: item.title,
                        price: item.price,
                        image: item.images[0]
                    },
                    lastMessage: "거래가 신청되었습니다.",
                    lastTime: "방금",
                    unreadCount: {
                        [item.seller.uid]: 1
                    },
                    promptPayPaid: false,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                }).then(() => {
                    // 최초 안내 시스템 메시지
                    chatRef.collection("messages").add({
                        senderId: "system",
                        text: `👋 이웃과 대화가 시작되었습니다. 아속역 등 직거래 시 따뜻한 매너를 지켜주세요!`,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    document.getElementById("product-detail-view").classList.remove("active");
                    openChatWindow(chatRoomId);
                    switchTab('chats');
                });
            } else {
                document.getElementById("product-detail-view").classList.remove("active");
                openChatWindow(chatRoomId);
                switchTab('chats');
            }
        });
    } else {
        // 로컬 데모 모드 채팅 개설
        let existingChat = state.chats.find(c => c.partner.name === item.seller.name && c.product.id === item.id);
        
        if (!existingChat) {
            const newChat = {
                id: Date.now(),
                partner: {
                    uid: item.seller.uid,
                    name: item.seller.name,
                    avatar: item.seller.avatar,
                    promptpayId: item.seller.promptpayId || ""
                },
                product: {
                    id: item.id,
                    title: item.title,
                    price: item.price,
                    image: item.images[0]
                },
                lastMessage: "거래가 신청되었습니다.",
                lastTime: "방금",
                unreadCount: 0,
                messages: [
                    { sender: 'me', text: `안녕하세요! 올려놓으신 [${item.title}] 거래 희망합니다.`, time: getCurrentTimeStr() }
                ],
                promptPayPaid: false
            };
            state.chats.unshift(newChat);
            existingChat = newChat;
        }

        document.getElementById("product-detail-view").classList.remove("active");
        openChatWindow(existingChat.id);
        switchTab('chats');
    }
}

// 9-3. 메시지 전송
function handleSendMessage() {
    const input = document.getElementById("chat-text-input");
    const text = input.value.trim();
    if (!text) return;

    if (isFirebaseLive) {
        const chat = state.chats.find(c => c.id == state.selectedChatId);
        if (!chat) return;

        const chatRef = db.collection("chats").doc(state.selectedChatId);
        
        // 메시지 전송
        chatRef.collection("messages").add({
            senderId: state.currentUser.uid,
            text: text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 부모 채팅방 상태 업데이트
        chatRef.update({
            lastMessage: text,
            lastTime: getCurrentTimeStr(),
            unreadCount: {
                [chat.partner.uid]: firebase.firestore.FieldValue.increment(1)
            },
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        input.value = "";
    } else {
        const chat = state.chats.find(c => c.id == state.selectedChatId);
        if (!chat) return;

        const timeStr = getCurrentTimeStr();
        chat.messages.push({ sender: 'me', text: text, time: timeStr });
        chat.lastMessage = text;
        chat.lastTime = timeStr;
        
        input.value = "";
        renderChatMessages();
        renderChatList();

        // 데모 챗봇 쏨차이의 답장 시나리오 구동
        setTimeout(() => {
            let replyText = "네 고맙습니다! 시간 장소 잘 지켜서 이따 뵐게요 😊";
            if (text.includes("네고") || text.includes("깎아")) {
                replyText = "상태가 좋은 정품이라 네고는 정말 죄송합니다ㅠㅠ";
            } else if (text.includes("위치") || text.includes("어디")) {
                replyText = "아속역 코리아타운 1층 광장 입구로 오시면 제가 서 있겠습니다!";
            } else if (text.includes("송금") || text.includes("계좌") || text.includes("바트")) {
                replyText = "직거래 시 제가 보여드리는 PromptPay QR코드 찍고 바로 송금해 주시면 됩니다!";
            }

            chat.messages.push({ sender: 'them', text: replyText, time: getCurrentTimeStr() });
            chat.lastMessage = replyText;
            chat.lastTime = getCurrentTimeStr();
            renderChatMessages();
            renderChatList();

            const badge = document.getElementById("chat-tab-badge");
            if (state.activeTab !== 'chats') {
                badge.style.display = "flex";
                badge.textContent = (parseInt(badge.textContent) || 0) + 1;
            }
        }, 1500);
    }
}

// 9-4. 새 매물 업로드 제출
function handleSubmitProduct() {
    const title = document.getElementById("write-title").value.trim();
    const category = document.getElementById("write-cat").value;
    const price = parseFloat(document.getElementById("write-price").value);
    const desc = document.getElementById("write-desc").value.trim();
    const locText = document.getElementById("write-loc-text").value.trim() || state.currentUser.region;

    if (!title || isNaN(price) || !desc) {
        alert("제목, 가격, 상품 설명을 바르게 채워주세요.");
        return;
    }

    // 기본 이미지
    let finalPhotos = state.tempUploadedPhotos.length > 0 
        ? state.tempUploadedPhotos 
        : ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600"];

    if (isFirebaseLive) {
        // 실제 운영 모드: Firestore 추가
        db.collection("products").add({
            title: title,
            category: category,
            price: price,
            location: state.currentUser.region,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            views: 0,
            chats: 0,
            images: finalPhotos, // 대용량 Base64 이미지나 주소 동적 전송
            likedBy: [],
            seller: {
                uid: state.currentUser.uid,
                name: state.currentUser.name,
                avatar: state.currentUser.avatar,
                temp: state.currentUser.temp,
                promptpayId: state.currentUser.promptpayId
            },
            description: desc,
            tradeLocation: locText
        }).then(() => {
            document.getElementById("write-sheet").classList.remove("active");
            document.getElementById("write-sheet-dim").classList.remove("active");
            switchTab('home');
        }).catch(err => {
            alert("서버 등록 실패: " + err.message);
        });
    } else {
        // 데모 모드: 로컬 배열 삽입
        const newGood = {
            id: Date.now(),
            title: title,
            category: category,
            price: price,
            location: state.currentUser.region,
            time: "방금 전",
            views: 1,
            likes: 0,
            chats: 0,
            likedByUser: false,
            images: finalPhotos,
            seller: {
                uid: state.currentUser.uid,
                name: state.currentUser.name,
                avatar: state.currentUser.avatar,
                temp: state.currentUser.temp,
                promptpayId: state.currentUser.promptpayId
            },
            description: desc,
            tradeLocation: locText
        };
        state.goods.unshift(newGood);
        renderFeed();
        document.getElementById("write-sheet").classList.remove("active");
        document.getElementById("write-sheet-dim").classList.remove("active");
        switchTab('home');
        document.getElementById("main-scroll-view").scrollTop = 0;
    }
}

// 9-5. 로그인 및 회원가입 모달 내 토글 제어
function toggleAuthMode(isSignUp = false) {
    const title = document.getElementById("auth-sheet-title");
    const submitBtn = document.getElementById("auth-submit-btn");
    const signupFields = document.getElementById("auth-signup-fields");
    const toggleMsg = document.getElementById("auth-toggle-msg");

    if (isSignUp) {
        title.textContent = "T-Trade 회원가입";
        submitBtn.textContent = "회원가입 하기";
        signupFields.style.display = "block";
        toggleMsg.innerHTML = `이미 회원가입 하셨나요? <a href="#" id="auth-toggle-link" style="color: var(--t-orange); font-weight:700; text-decoration:none;">로그인 하기</a>`;
    } else {
        title.textContent = "T-Trade 로그인";
        submitBtn.textContent = "로그인 하기";
        signupFields.style.display = "none";
        toggleMsg.innerHTML = `T-Trade가 처음이신가요? <a href="#" id="auth-toggle-link" style="color: var(--t-orange); font-weight:700; text-decoration:none;">회원가입 하기</a>`;
    }

    // 신규 배선 토글 링크 다시 바인딩
    document.getElementById("auth-toggle-link").addEventListener("click", (e) => {
        e.preventDefault();
        toggleAuthMode(!isSignUp);
    });
}

// 9-6. 로그인/회원가입 데이터 실제 제출 처리기
function handleAuthSubmit() {
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const isSignUp = document.getElementById("auth-submit-btn").textContent === "회원가입 하기";
    const errorMsg = document.getElementById("auth-error-msg");

    if (!email || !password) {
        errorMsg.textContent = "이메일과 비밀번호를 모두 입력해 주세요.";
        return;
    }

    if (password.length < 6) {
        errorMsg.textContent = "비밀번호는 최소 6자리 이상이어야 합니다.";
        return;
    }

    if (isFirebaseLive) {
        // 1) 클라우드 실 운영 회원가입 / 로그인
        if (isSignUp) {
            const nickname = document.getElementById("auth-nickname").value.trim();
            const region = document.getElementById("auth-region").value;
            
            if (!nickname) {
                errorMsg.textContent = "회원가입 시 사용할 닉네임을 입력해 주세요.";
                return;
            }

            auth.createUserWithEmailAndPassword(email, password)
                .then(cred => {
                    // 가입 완료 후 Firestore에 프로필 추가 저장
                    return db.collection("users").doc(cred.user.uid).set({
                        nickname: nickname,
                        region: region,
                        temp: 36.5,
                        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150"
                    });
                })
                .then(() => {
                    document.getElementById("auth-sheet").classList.remove("active");
                    document.getElementById("auth-sheet-dim").classList.remove("active");
                })
                .catch(err => {
                    errorMsg.textContent = "회원가입 오류: " + err.message;
                });
        } else {
            // 로그인 처리
            auth.signInWithEmailAndPassword(email, password)
                .then(() => {
                    document.getElementById("auth-sheet").classList.remove("active");
                    document.getElementById("auth-sheet-dim").classList.remove("active");
                })
                .catch(err => {
                    errorMsg.textContent = "로그인 오류: " + err.message;
                });
        }
    } else {
        // 2) 로컬 가상 데모 로그인/가입
        if (isSignUp) {
            const nickname = document.getElementById("auth-nickname").value.trim() || "신규이웃";
            const region = document.getElementById("auth-region").value;
            
            state.currentUser = {
                uid: "user_" + Date.now(),
                email: email,
                name: nickname,
                avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150",
                temp: 36.5,
                region: region
            };
        } else {
            state.currentUser = {
                uid: "demo_user_123",
                email: email,
                name: email.split("@")[0],
                avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150",
                temp: 37.5,
                region: "방콕 수쿰빗",
                promptpayId: "0887654321"
            };
        }
        updateUserUI();
        document.getElementById("auth-sheet").classList.remove("active");
        document.getElementById("auth-sheet-dim").classList.remove("active");
    }
}

// 9-7. 로그아웃
function handleLogout() {
    if (isFirebaseLive) {
        auth.signOut().then(() => {
            switchTab('home');
        });
    } else {
        state.currentUser = null;
        updateUserUI();
        switchTab('home');
    }
}

// 9-8. 모의/실시간 결제 완료
function handleCompletePayment() {
    const chat = state.chats.find(c => c.id == state.selectedChatId);
    if (!chat) return;

    if (isFirebaseLive) {
        db.collection("chats").doc(state.selectedChatId).update({
            promptPayPaid: true,
            lastMessage: "฿ " + chat.product.price.toLocaleString() + " 송금 완료!",
            lastTime: getCurrentTimeStr(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            // 시스템 메시지 추가 전송
            db.collection("chats").doc(state.selectedChatId).collection("messages").add({
                senderId: "system_pay",
                text: `💰 [PromptPay] ฿ ${chat.product.price.toLocaleString()} 송금이 완료되었습니다.`,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            document.getElementById("promptpay-modal").classList.remove("active");
            triggerConfetti();
        });
    } else {
        chat.promptPayPaid = true;
        document.getElementById("promptpay-modal").classList.remove("active");
        renderChatMessages();
        triggerConfetti();
    }
}

// --- 10. 공통 도구 함수 (Utility Functions) ---

function getTempColor(temp) {
    if (temp < 36.5) return "var(--temp-36)";
    if (temp < 40) return "var(--temp-40)";
    if (temp < 50) return "var(--temp-50)";
    return "var(--temp-99)";
}

function updateLikeCountDisplay() {
    if (!state.currentUser) return;
    const totalLikes = state.goods.filter(g => {
        return isFirebaseLive && Array.isArray(g.likedBy)
            ? g.likedBy.includes(state.currentUser.uid)
            : g.likedByUser;
    }).length;
    document.getElementById("my-like-count").textContent = totalLikes;
}

function getCurrentTimeStr() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? '오후' : '오전';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${ampm} ${hours}:${minutes}`;
}

let currentSlideIdx = 0;
function initCarouselSwipe() {
    currentSlideIdx = 0;
    const track = document.getElementById("detail-carousel-track");
    if (track) track.style.transform = `translateX(0)`;
    
    const indicators = document.querySelectorAll("#detail-carousel-indicators .indicator");
    indicators.forEach(ind => {
        ind.addEventListener("click", () => {
            const idx = parseInt(ind.getAttribute("data-slide-index"));
            goToSlide(idx);
        });
    });
}

function goToSlide(idx) {
    const track = document.getElementById("detail-carousel-track");
    const indicators = document.querySelectorAll("#detail-carousel-indicators .indicator");
    const maxSlide = indicators.length;
    if (idx < 0 || idx >= maxSlide) return;
    currentSlideIdx = idx;
    track.style.transform = `translateX(-${idx * 100}%)`;
    indicators.forEach(ind => ind.classList.remove("active"));
    indicators[idx].classList.add("active");
}

// --- 11. 실제 뱅킹 사용 가능 PromptPay QR 생성 표준 연동 엔진 ---
function generatePromptPayPayload(ppId, amount) {
    // 1. 여백 및 하이픈 소거
    let target = ppId.replace(/[^0-9]/g, "");
    let merchantField = "";
    
    if (target.length === 10 && target.startsWith("0")) {
        // 태국 휴대전화 번호 규격인 경우: '66' 국가코드로 변환하고 13자리 패딩
        let formattedMobile = "0066" + target.substring(1);
        merchantField = "0016A000000677010111" + "0113" + formattedMobile;
    } else {
        // 태국 법인 ID 또는 여권 번호 규격 (13자리) 인 경우
        merchantField = "0016A000000677010111" + "0213" + target;
    }
    
    // EMVCo 표준 페이로드 조립
    let payload = "000201010211"; // 표준 고정 포맷 버전
    payload += "29" + merchantField.length.toString().padStart(2, '0') + merchantField;
    payload += "5303764"; // THB 통화 부호 지정 (ISO 4217 규격 코드 764)
    
    if (amount && amount > 0) {
        let amtStr = amount.toFixed(2);
        payload += "54" + amtStr.length.toString().padStart(2, '0') + amtStr; // 실거래용 금액 태그 54
    }
    payload += "5802TH"; // 태국 국가 코드 지정
    payload += "6304"; // CRC16 체크섬 영역 선언
    
    // CRC-16 CCITT 체크섬 연산 후 결합
    payload += computeCRC16(payload);
    return payload;
}

// CRC-16 CCITT 체크섬 알고리즘
function computeCRC16(str) {
    let crc = 0xFFFF;
    for (let c = 0; c < str.length; c++) {
        let charCode = str.charCodeAt(c);
        crc ^= (charCode << 8);
        for (let i = 0; i < 8; i++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = (crc << 1);
            }
        }
    }
    let hex = (crc & 0xFFFF).toString(16).toUpperCase();
    return hex.padStart(4, '0');
}

// 오프라인용 Canvas 모의 QR 그리기 백업
function drawPromptPayQR(receiverName, price) {
    const canvas = document.getElementById("qr-canvas");
    const ctx = canvas.getContext("2d");
    const size = canvas.width;

    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = "#002D59";
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, size - 14, size - 14);

    ctx.strokeStyle = "#2E86C1";
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, size - 32, size - 32);

    drawFinderPattern(ctx, 24, 24, 32);
    drawFinderPattern(ctx, size - 56, 24, 32);
    drawFinderPattern(ctx, 24, size - 56, 32);

    ctx.fillStyle = "#111";
    const gridStart = 24;
    const gridEnd = size - 24;
    const step = 8;
    
    let seed = 45;
    function pseudoRandom() {
        let x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }

    for (let x = gridStart; x < gridEnd; x += step) {
        for (let y = gridStart; y < gridEnd; y += step) {
            if ((x < 64 && y < 64) || (x > size - 64 && y < 64) || (x < 64 && y > size - 64)) {
                continue;
            }
            if (pseudoRandom() > 0.45) {
                ctx.fillRect(x + 1, y + 1, step - 2, step - 2);
            }
        }
    }

    const logoSize = 36;
    const logoX = (size - logoSize) / 2;
    const logoY = (size - logoSize) / 2;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(logoX - 2, logoY - 2, logoSize + 4, logoSize + 4);
    ctx.strokeStyle = "#002D59";
    ctx.lineWidth = 2;
    ctx.strokeRect(logoX - 2, logoY - 2, logoSize + 4, logoSize + 4);

    ctx.fillStyle = "#002D59";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 12, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = "#FFF";
    ctx.font = "bold 9px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TH", size / 2, size / 2);
}

function drawFinderPattern(ctx, x, y, size) {
    ctx.fillStyle = "#111";
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = "#FFF";
    ctx.fillRect(x + 4, y + 4, size - 8, size - 8);
    ctx.fillStyle = "#111";
    ctx.fillRect(x + 8, y + 8, size - 16, size - 16);
}

// --- 12. 물리 엔진 연동 송금 축하 컨페티 효과 ---
let confettiAnimationId = null;
function triggerConfetti() {
    const canvas = document.getElementById("confetti-canvas");
    const ctx = canvas.getContext("2d");
    const parent = canvas.parentElement;
    
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    const colors = ["#FF7E36", "#FFC72C", "#10B981", "#3B82F6", "#EC4899", "#8B5CF6"];
    const particles = [];

    for (let i = 0; i < 80; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * -20 - 10,
            size: Math.random() * 6 + 6,
            color: colors[Math.floor(Math.random() * colors.length)],
            speedX: Math.random() * 4 - 2,
            speedY: Math.random() * 5 + 3,
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 6 - 3
        });
    }

    if (confettiAnimationId) {
        cancelAnimationFrame(confettiAnimationId);
    }

    function update() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let finished = true;

        particles.forEach(p => {
            p.x += p.speedX;
            p.y += p.speedY;
            p.rotation += p.rotationSpeed;

            if (p.y < canvas.height) finished = false;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
        });

        if (!finished) {
            confettiAnimationId = requestAnimationFrame(update);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    update();
}

// ============================================================
// --- 13. 검색 기능 완전 구현 (Search Engine) ---
// ============================================================

// 검색 상태
const searchState = {
    query: '',
    sortBy: 'relevant',   // relevant | recent | price_asc | price_desc
    isOpen: false,
};

const RECENT_SEARCH_KEY = 'ttrade_recent_searches';
const MAX_RECENT = 10;

// ---------- 13-1. 최근 검색어 관리 ----------

function getRecentSearches() {
    try {
        return JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY) || '[]');
    } catch { return []; }
}

function saveRecentSearch(kw) {
    if (!kw.trim()) return;
    let list = getRecentSearches().filter(k => k !== kw);
    list.unshift(kw);
    if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(list));
}

function deleteRecentSearch(kw) {
    const list = getRecentSearches().filter(k => k !== kw);
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(list));
    renderRecentSearches();
}

function clearAllRecentSearches() {
    localStorage.removeItem(RECENT_SEARCH_KEY);
    renderRecentSearches();
}

function renderRecentSearches() {
    const container = document.getElementById('recent-tags-container');
    const emptyMsg  = document.getElementById('search-empty-recent');
    const list = getRecentSearches();

    container.innerHTML = '';

    if (list.length === 0) {
        emptyMsg.style.display = 'block';
        return;
    }
    emptyMsg.style.display = 'none';

    list.forEach(kw => {
        const tag = document.createElement('div');
        tag.className = 'recent-tag';
        tag.innerHTML = `
            <span class="recent-tag-text">${escapeHtml(kw)}</span>
            <button class="recent-tag-del" aria-label="삭제"><i class="fa-solid fa-xmark"></i></button>
        `;
        tag.querySelector('.recent-tag-text').addEventListener('click', () => {
            executeSearch(kw);
        });
        tag.querySelector('.recent-tag-del').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteRecentSearch(kw);
        });
        container.appendChild(tag);
    });
}

// ---------- 13-2. 검색 실행 ----------

function executeSearch(kw) {
    kw = kw.trim();
    if (!kw) return;

    searchState.query = kw;
    document.getElementById('search-input').value = kw;
    document.getElementById('search-clear-btn').style.display = 'flex';

    saveRecentSearch(kw);
    renderSearchResults();
    showSearchResultView();
}

function renderSearchResults() {
    const kw    = searchState.query.trim().toLowerCase();
    const feed  = document.getElementById('search-feed');
    const noRes = document.getElementById('search-no-result');
    const meta  = document.getElementById('search-result-meta');
    const kwSpan = document.getElementById('search-no-result-kw');

    feed.innerHTML = '';

    if (!kw) {
        showSearchIdleView();
        return;
    }

    // 필터링: 제목 | 설명 | 카테고리 | 지역 | 판매자명 모두 검색
    let results = state.goods.filter(item => {
        const fields = [
            item.title,
            item.description || '',
            item.category,
            item.location,
            item.seller?.name || '',
        ].join(' ').toLowerCase();
        return fields.includes(kw);
    });

    // 정렬
    results = sortSearchResults(results, kw);

    // 메타 텍스트
    meta.innerHTML = results.length > 0
        ? `<strong>"${escapeHtml(searchState.query)}"</strong> 검색결과 ${results.length}건`
        : '';

    if (results.length === 0) {
        noRes.style.display = 'flex';
        kwSpan.textContent = `"${searchState.query}"`;
        feed.style.display = 'none';
        return;
    }

    noRes.style.display = 'none';
    feed.style.display = '';

    results.forEach(item => {
        const krwPriceStr = Math.round(item.price * EXCHANGE_RATE).toLocaleString();
        const thbPriceStr = item.price.toLocaleString();
        const isLiked = isFirebaseLive && Array.isArray(item.likedBy)
            ? item.likedBy.includes(state.currentUser?.uid)
            : item.likedByUser;
        const likesCount = isFirebaseLive && Array.isArray(item.likedBy)
            ? item.likedBy.length
            : item.likes;

        const card = document.createElement('div');
        card.className = 'item-card';
        card.setAttribute('data-id', item.id);

        card.innerHTML = `
            <div class="item-img-container">
                <img src="${item.images[0]}" class="item-img" alt="${escapeHtml(item.title)}" loading="lazy">
            </div>
            <div class="item-info">
                <div>
                    <h3 class="item-title">${highlightKeyword(item.title, searchState.query)}</h3>
                    <div class="item-meta">
                        <span>${highlightKeyword(item.location, searchState.query)}</span>
                        <span>•</span>
                        <span>${item.time}</span>
                        <span>•</span>
                        <span>${highlightKeyword(item.category, searchState.query)}</span>
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                    <div class="price-container">
                        <span class="price-thb">฿ ${thbPriceStr}</span>
                        <span class="price-krw">≈ ${krwPriceStr}원</span>
                    </div>
                    <div class="card-stats">
                        ${item.chats > 0 ? `<span class="stat-item"><i class="fa-regular fa-comment"></i> ${item.chats}</span>` : ''}
                        <span class="stat-item ${isLiked ? 'active' : ''}">
                            <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i> ${likesCount}
                        </span>
                    </div>
                </div>
            </div>
        `;
        card.addEventListener('click', () => {
            openProductDetail(item.id);
        });
        feed.appendChild(card);
    });
}

// ---------- 13-3. 정렬 ----------

function sortSearchResults(results, kw) {
    switch (searchState.sortBy) {
        case 'recent':
            // 최신순: mockGoods 배열 역순 (실제 서비스에서는 createdAt 타임스탬프 기준)
            return [...results].reverse();
        case 'price_asc':
            return [...results].sort((a, b) => a.price - b.price);
        case 'price_desc':
            return [...results].sort((a, b) => b.price - a.price);
        case 'relevant':
        default:
            // 관련순: 제목에 키워드 포함 시 우선
            return [...results].sort((a, b) => {
                const aTitle = a.title.toLowerCase().includes(kw) ? 0 : 1;
                const bTitle = b.title.toLowerCase().includes(kw) ? 0 : 1;
                return aTitle - bTitle;
            });
    }
}

// ---------- 13-4. UI 상태 전환 ----------

function openSearch() {
    searchState.isOpen = true;
    const overlay = document.getElementById('search-overlay');
    overlay.classList.add('active');
    // 약간 딜레이 후 포커스 (iOS 키보드 팝업 타이밍)
    setTimeout(() => {
        document.getElementById('search-input').focus();
    }, 300);
    renderRecentSearches();
    showSearchIdleView();
}

function closeSearch() {
    searchState.isOpen = false;
    searchState.query = '';
    searchState.sortBy = 'relevant';
    const overlay = document.getElementById('search-overlay');
    overlay.classList.remove('active');
    document.getElementById('search-input').value = '';
    document.getElementById('search-clear-btn').style.display = 'none';
    // 정렬 버튼 초기화
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.sort-btn[data-sort="relevant"]')?.classList.add('active');
    showSearchIdleView();
}

function showSearchIdleView() {
    document.getElementById('search-idle-view').style.display = 'block';
    document.getElementById('search-result-view').style.display = 'none';
}

function showSearchResultView() {
    document.getElementById('search-idle-view').style.display = 'none';
    document.getElementById('search-result-view').style.display = 'flex';
}

// ---------- 13-5. 유틸 ----------

function highlightKeyword(text, kw) {
    if (!kw || !text) return escapeHtml(text);
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return escapeHtml(text).replace(regex, '<mark class="search-highlight">$1</mark>');
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ---------- 13-6. 이벤트 바인딩 ----------

function bindSearchEvents() {
    const input       = document.getElementById('search-input');
    const clearBtn    = document.getElementById('search-clear-btn');
    const cancelBtn   = document.getElementById('search-cancel-btn');
    const recentClear = document.getElementById('recent-clear-btn');
    const triggerBtn  = document.getElementById('search-trigger-btn');

    // 검색 버튼으로 열기
    triggerBtn.addEventListener('click', openSearch);

    // 실시간 타이핑 검색 (디바운스 150ms)
    let debounceTimer;
    input.addEventListener('input', () => {
        const val = input.value;
        clearBtn.style.display = val ? 'flex' : 'none';

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (val.trim()) {
                searchState.query = val;
                renderSearchResults();
                showSearchResultView();
            } else {
                searchState.query = '';
                showSearchIdleView();
            }
        }, 150);
    });

    // 엔터로 검색 확정 + 최근 검색어 저장
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = input.value.trim();
            if (val) executeSearch(val);
            input.blur();
        }
        // ESC로 닫기
        if (e.key === 'Escape') closeSearch();
    });

    // X 버튼으로 입력 초기화
    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        searchState.query = '';
        showSearchIdleView();
        input.focus();
    });

    // 취소 버튼으로 닫기
    cancelBtn.addEventListener('click', closeSearch);

    // 최근 검색어 전체 삭제
    recentClear.addEventListener('click', clearAllRecentSearches);

    // 인기 키워드 클릭
    document.querySelectorAll('.popular-kw-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            executeSearch(chip.getAttribute('data-kw'));
        });
    });

    // 정렬 버튼
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            searchState.sortBy = btn.getAttribute('data-sort');
            renderSearchResults();
        });
    });
}

// 검색 이벤트 바인딩을 DOMContentLoaded에 추가
document.addEventListener('DOMContentLoaded', () => {
    bindSearchEvents();
});
