// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, query, onSnapshot, deleteDoc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase Configuration
const MY_FIREBASE_CONFIG = {
    apiKey: "AIzaSyAUmJV0geKhi4cO3coN-Rnhw5m0LrAWI9Y",
    authDomain: "webb-862b1.firebaseapp.com",
    projectId: "webb-862b1",
    storageBucket: "webb-862b1.firebasestorage.app",
    messagingSenderId: "929452543975",
    appId: "1:929452543975:web:238d0f3677da736fdf7742",
    measurementId: "G-6P0KVWZGTC"
};

// Telegram Bot API Configuration
const TELEGRAM_BOT_TOKEN = '7570266115:AAGZUk96YHFewFpDlqkVpbDT6PwyZJ2ZVmE';
const TELEGRAM_CHAT_ID = '1526903621';

// Developer UID - معرف المطور الرئيسي من Firebase
const MAIN_DEVELOPER_UID = 'NrXWrgBSsGfd9x8iTj8rvAQmoxI3';

// قائمة معرفات المطورين
let developerUIDs = [MAIN_DEVELOPER_UID];

// Iraqi Governorates
const iraqiGovernorates = [
    "بغداد", "البصرة", "الأنبار", "بابل", "ذي قار", "ديالى", "دهوك", "أربيل", "كربلاء",
    "كركوك", "ميسان", "المثنى", "النجف", "نينوى", "القادسية", "صلاح الدين", "السليمانية", "واسط"
];

let app;
let auth;
let db;
let userId = null;
let isAdmin = false;
let firebaseInitialized = false;
let currentUserProfile = null;

let productsData = [];
let categoriesData = [];
let reviewsData = [];
let currentCart = [];
let orderCartData = [];

let firebaseReadyPromise;
let resolveFirebaseReady;

firebaseReadyPromise = new Promise(resolve => {
    resolveFirebaseReady = resolve;
});

let uiElements = {};

// Helper function to safely get element
const getUiElement = (id) => {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`UI Element with ID '${id}' not found in the DOM.`);
        return null;
    }
    return element;
};

// Custom message system
let resolveMessageBoxPromise;

const alertUserMessage = (message, type = 'info') => {
    if (!uiElements.messageBox) {
        console.error("Message box container element not found. Cannot display message.");
        return;
    }
    const msgBoxText = uiElements.messageBoxText;
    const msgBoxConfirmBtn = uiElements.messageBoxConfirmBtn;
    const msgBoxCancelBtn = uiElements.messageBoxCancelBtn;

    if (msgBoxText) msgBoxText.textContent = message;
    if (msgBoxConfirmBtn) msgBoxConfirmBtn.classList.add('hidden');
    if (msgBoxCancelBtn) msgBoxCancelBtn.classList.add('hidden');

    if (uiElements.messageBox) {
        uiElements.messageBox.classList.remove('hidden', 'bg-green-100', 'bg-red-100', 'bg-blue-100', 'bg-yellow-100');
        if (msgBoxText) msgBoxText.classList.remove('text-green-800', 'text-red-800', 'text-blue-800', 'text-yellow-800');

        if (type === 'success') {
            uiElements.messageBox.classList.add('bg-green-100');
            if (msgBoxText) msgBoxText.classList.add('text-green-800');
        } else if (type === 'error') {
            uiElements.messageBox.classList.add('bg-red-100');
            if (msgBoxText) msgBoxText.classList.add('text-white');
        } else if (type === 'warning') {
            uiElements.messageBox.classList.add('bg-yellow-100');
            if (msgBoxText) msgBoxText.classList.add('text-yellow-800');
        } else {
            uiElements.messageBox.classList.add('bg-blue-100');
            if (msgBoxText) msgBoxText.classList.add('text-white');
        }
    }

    if (uiElements.messageBox.timeoutId) {
        clearTimeout(uiElements.messageBox.timeoutId);
    }
    uiElements.messageBox.timeoutId = setTimeout(() => {
        if (uiElements.messageBox) uiElements.messageBox.classList.add('hidden');
    }, 3000);
};

const showConfirmationMessage = (message) => {
    if (!uiElements.messageBox) {
        console.error("Message box container element not found. Cannot display confirmation.");
        return Promise.resolve(false);
    }
    const msgBoxText = uiElements.messageBoxText;
    const msgBoxConfirmBtn = uiElements.messageBoxConfirmBtn;
    const msgBoxCancelBtn = uiElements.messageBoxCancelBtn;

    return new Promise(resolve => {
        if (msgBoxText) msgBoxText.textContent = message;
        if (msgBoxConfirmBtn) msgBoxConfirmBtn.classList.remove('hidden');
        if (msgBoxCancelBtn) msgBoxCancelBtn.classList.remove('hidden');

        if (uiElements.messageBox) {
            uiElements.messageBox.classList.remove('hidden', 'bg-green-100', 'bg-red-100', 'bg-blue-100', 'bg-yellow-100');
            if (msgBoxText) msgBoxText.classList.remove('text-green-800', 'text-red-800', 'text-blue-800', 'text-yellow-800');
            uiElements.messageBox.classList.add('bg-yellow-100');
            if (msgBoxText) msgBoxText.classList.add('text-yellow-800');
        }

        if (uiElements.messageBox.timeoutId) {
            clearTimeout(uiElements.messageBox.timeoutId);
            uiElements.messageBox.timeoutId = null;
        }

        resolveMessageBoxPromise = resolve;
    });
};

// Firebase initialization
const initializeFirebase = async () => {
    try {
        if (!MY_FIREBASE_CONFIG || !MY_FIREBASE_CONFIG.apiKey || MY_FIREBASE_CONFIG.apiKey === "YOUR_FALLBACK_API_KEY") {
            console.error("Custom Firebase config is missing or incomplete. Please update MY_FIREBASE_CONFIG with your project details.");
            alertUserMessage("خطأ: إعدادات Firebase الخاصة بك مفقودة أو غير مكتملة. الرجاء تحديثها في الكود.", 'error');
            if (resolveFirebaseReady) resolveFirebaseReady(false);
            return;
        }

        app = initializeApp(MY_FIREBASE_CONFIG);

        if (!app) {
            console.error("Firebase app object is undefined after initialization. Check config or Firebase SDK loading.");
            alertUserMessage("فشل تهيئة تطبيق Firebase بشكل صحيح. الرجاء مراجعة الإعدادات.", 'error');
            if (resolveFirebaseReady) resolveFirebaseReady(false);
            return;
        }

        auth = getAuth(app);
        db = getFirestore(app);

        firebaseInitialized = true;
        console.log("Firebase services (app, auth, db) initialized with custom config.");

        if (!auth.currentUser) {
            await signInAnonymously(auth);
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                console.log("Authenticated with UID:", userId);
                await fetchUserProfile(userId);
                await fetchAdminStatus();
                setupRealtimeListeners();
            } else {
                userId = null;
                isAdmin = false;
                currentUserProfile = null;
                console.log("User logged out or not authenticated.");
                updateUIForLoggedOutUser();
            }
            if (firebaseReadyPromise && !firebaseReadyPromise._isResolved) {
                if (resolveFirebaseReady) resolveFirebaseReady(true);
                firebaseReadyPromise._isResolved = true;
            }
        });

        setTimeout(() => {
            if (firebaseReadyPromise && !firebaseReadyPromise._isResolved) {
                console.warn("FirebaseReadyPromise not resolved by onAuthStateChanged within timeout. Resolving as true as fallback.");
                if (resolveFirebaseReady) resolveFirebaseReady(true);
                firebaseReadyPromise._isResolved = true;
            }
        }, 5000);

    } catch (error) {
        console.error("Error initializing Firebase (outer catch):", error);
        alertUserMessage(`خطأ فادح أثناء تهيئة Firebase: ${error.message}. تأكد من أن إعداداتك صحيحة وأن Firebase مُمكّن.`, 'error');
        if (resolveFirebaseReady) resolveFirebaseReady(false);
    }
};

// Real-time listeners
const setupRealtimeListeners = () => {
    if (!db || !userId) {
        console.warn("Firestore or userId not available for setting up listeners.");
        return;
    }

    console.log("Setting up real-time listeners for products, categories, reviews, and cart...");

    const productsColRef = collection(db, `products`);
    onSnapshot(productsColRef, (snapshot) => {
        productsData = [];
        snapshot.forEach((doc) => {
            productsData.push({ id: doc.id, ...doc.data() });
        });
        console.log("Products data fetched:", productsData.length);
        displayProducts(productsData);
    }, (error) => {
        console.error("Error fetching products:", error);
        if (error.code === 'permission-denied') {
            if (uiElements.productsContainer) {
                uiElements.productsContainer.innerHTML = '<p class="col-span-full text-center text-red-500">خطأ في الأذونات: لا يمكن عرض المنتجات. الرجاء التحقق من قواعد أمان Firestore.</p>';
            } else {
                console.error("productsContainer element not found when trying to display permission error.");
            }
            alertUserMessage("خطأ في عرض المنتجات: الأذونات غير كافية.", 'error');
        } else {
            if (uiElements.productsContainer) {
                uiElements.productsContainer.innerHTML = '<p class="col-span-full text-center text-red-500">فشل تحميل المنتجات.</p>';
            } else {
                console.error("productsContainer element not found when trying to display generic error.");
            }
        }
    });

    const categoriesColRef = collection(db, `categories`);
    onSnapshot(categoriesColRef, (snapshot) => {
        categoriesData = [];
        snapshot.forEach((doc) => {
            categoriesData.push({ id: doc.id, ...doc.data() });
        });
        console.log("Categories data fetched:", categoriesData.length);
        populateCategoryDropdowns();
    }, (error) => {
        console.error("Error fetching categories:", error);
    });

    const reviewsColRef = collection(db, `reviews`);
    onSnapshot(reviewsColRef, (snapshot) => {
        reviewsData = [];
        snapshot.forEach((doc) => {
            reviewsData.push({ id: doc.id, ...doc.data() });
        });
        console.log("Reviews data fetched:", reviewsData.length);
        displayReviews(reviewsData);
        // تحديث زر إضافة التقييم بعد جلب البيانات
        updateAddReviewButton();
    }, (error) => {
        console.error("Error fetching reviews:", error);
    });

    const cartColRef = collection(db, `users/${userId}/cart`);
    onSnapshot(cartColRef, (snapshot) => {
        currentCart = [];
        snapshot.forEach((doc) => {
            currentCart.push({ id: doc.id, ...doc.data() });
        });
        console.log("Cart data fetched:", currentCart.length);
        displayCart();
    }, (error) => {
        console.error("Error fetching cart:", error);
        if (error.code === 'permission-denied') {
            if (userId && uiElements.cartItemsContainer) {
                uiElements.cartItemsContainer.innerHTML = '<p class="text-center text-red-500">خطأ في الأذونات: لا يمكن عرض سلة التسوق الخاصة بك.</p>';
            }
        } else {
            if (uiElements.cartItemsContainer) {
                uiElements.cartItemsContainer.innerHTML = '<p class="text-center text-red-500">فشل تحميل سلة التسوق.</p>';
            }
        }
    });
};

// User profile and admin functions
const fetchUserProfile = async (uid) => {
    try {
        const userDocRef = doc(db, `users/${uid}/userProfile`, uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            currentUserProfile = userData;
            if (uiElements.profileDetailsName) uiElements.profileDetailsName.textContent = userData.fullName || 'مستخدم';
            if (uiElements.profileDetailsPhone) uiElements.profileDetailsPhone.textContent = userData.phoneNumber || 'N/A';
            if (uiElements.profileDetailsImage) uiElements.profileDetailsImage.src = userData.profilePicUrl || 'https://placehold.co/100x100/eeeeee/333333?text=User';

            if (userData.createdAt) {
                const date = new Date(userData.createdAt);
                if (uiElements.profileDetailsRegisteredDate) uiElements.profileDetailsRegisteredDate.textContent = `تاريخ التسجيل: ${date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })} في ${date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
            } else {
                if (uiElements.profileDetailsRegisteredDate) uiElements.profileDetailsRegisteredDate.textContent = 'تاريخ التسجيل: غير متوفر';
            }

            if (uiElements.loginProfileText) uiElements.loginProfileText.textContent = 'حسابي';
            if (uiElements.profileDetailsLogoutBtn) uiElements.profileDetailsLogoutBtn.classList.remove('hidden');
            if (uiElements.profileDetailsLoginBtn) uiElements.profileDetailsLoginBtn.classList.add('hidden');

        } else {
            currentUserProfile = null;
            if (uiElements.profileDetailsName) uiElements.profileDetailsName.textContent = 'مستخدم غير مسجل';
            if (uiElements.profileDetailsPhone) uiElements.profileDetailsPhone.textContent = 'الرجاء تسجيل الدخول';
            if (uiElements.profileDetailsRegisteredDate) uiElements.profileDetailsRegisteredDate.textContent = '';
            if (uiElements.profileDetailsImage) uiElements.profileDetailsImage.src = 'https://placehold.co/100x100/eeeeee/333333?text=User';
            if (uiElements.loginProfileText) uiElements.loginProfileText.textContent = 'تسجيل دخول';
            if (uiElements.profileDetailsLogoutBtn) uiElements.profileDetailsLogoutBtn.classList.add('hidden');
            if (uiElements.profileDetailsLoginBtn) uiElements.profileDetailsLoginBtn.classList.remove('hidden');
        }
    } catch (error) {
        console.error("Error fetching user profile:", error);
        alertUserMessage(`خطأ في جلب بيانات الملف الشخصي: ${error.message}`, 'error');
    }
};

const fetchAdminStatus = async () => {
    try {
        // جلب قائمة المطورين من Firestore
        const developersDocRef = doc(db, `settings`, 'developers');
        const developersDocSnap = await getDoc(developersDocRef);

        if (developersDocSnap.exists()) {
            const developersData = developersDocSnap.data();
            developerUIDs = developersData.uids || [MAIN_DEVELOPER_UID];
        } else {
            // إنشاء وثيقة المطورين إذا لم تكن موجودة
            await setDoc(developersDocRef, { uids: [MAIN_DEVELOPER_UID] });
            developerUIDs = [MAIN_DEVELOPER_UID];
        }

        // التحقق من كون المستخدم الحالي مطور
        if (developerUIDs.includes(userId)) {
            isAdmin = true;
            if (uiElements.developerButtons) uiElements.developerButtons.classList.remove('hidden');
            if (uiElements.developerStatus) uiElements.developerStatus.classList.remove('hidden');
            console.log("Current user is admin/developer.");

            // إظهار زر إدارة المطورين فقط للمطور الرئيسي
            const manageDevelopersBtn = document.getElementById('manage-developers-btn');
            if (manageDevelopersBtn) {
                if (userId === MAIN_DEVELOPER_UID) {
                    manageDevelopersBtn.classList.remove('hidden');
                } else {
                    manageDevelopersBtn.classList.add('hidden');
                }
            }

            // جلب وعرض عدد المستخدمين للمطور
            setTimeout(() => {
                fetchAndDisplayUserCount();
            }, 2000);
        } else {
            isAdmin = false;
            if (uiElements.developerButtons) uiElements.developerButtons.classList.add('hidden');
            if (uiElements.developerStatus) uiElements.developerStatus.classList.add('hidden');
            console.log("Current user is not admin/developer.");
        }
    }
    catch (error) {
        console.error("Error fetching admin status:", error);
    }
};

// دالة البحث عن مستخدم موجود بنفس المعلومات (محسنة لتجنب مشاكل الأذونات)
const findExistingUser = async (fullName, phoneNumber) => {
    try {
        console.log("Searching for existing user with:", { fullName, phoneNumber });
        
        // بما أن Firebase لا يسمح بالوصول لجميع المستخدمين، سنتجاهل هذه الميزة مؤقتاً
        // وننشئ مستخدم جديد دائماً للتجنب مشاكل الأذونات
        console.log("Skipping user search due to permission restrictions");
        return null;
    } catch (error) {
        console.error("Error searching for existing user:", error);
        // في حالة فشل البحث، نعيد null لإنشاء مستخدم جديد
        return null;
    }
};

// دالة جلب وعرض عدد المستخدمين (للمطور فقط)
const fetchAndDisplayUserCount = async () => {
    if (!isAdmin) return;

    try {
        const usersColRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersColRef);
        let userCount = 0;

        // عد المستخدمين الذين لديهم ملف شخصي مكتمل
        for (const userDoc of usersSnapshot.docs) {
            try {
                const userProfileRef = doc(db, `users/${userDoc.id}/userProfile`, userDoc.id);
                const userProfileSnapshot = await getDoc(userProfileRef);
                if (userProfileSnapshot.exists()) {
                    const userData = userProfileSnapshot.data();
                    // التحقق من وجود البيانات الأساسية
                    if (userData.fullName && userData.phoneNumber) {
                        userCount++;
                    }
                }
            } catch (profileError) {
                // تجاهل الأخطاء والمتابعة
                continue;
            }
        }

        const userCountElement = document.getElementById('user-count');
        if (userCountElement) {
            userCountElement.textContent = userCount;
        }

    } catch (error) {
        console.error("Error fetching user count:", error);
        const userCountElement = document.getElementById('user-count');
        if (userCountElement) {
            userCountElement.textContent = '0';
        }
    }
};

// دالة تحديث حالة زر إضافة التقييم
const updateAddReviewButton = () => {
    // البحث عن الزر مرة أخرى في حالة عدم وجوده
    if (!uiElements.addReviewBtn) {
        uiElements.addReviewBtn = document.getElementById('add-review-btn');
    }

    if (userId && currentUserProfile) {
        // المستخدم مسجل الدخول وله ملف شخصي، يمكنه إضافة تقييم
        if (uiElements.addReviewBtn) {
            uiElements.addReviewBtn.disabled = false;
            uiElements.addReviewBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            uiElements.addReviewBtn.classList.add('cursor-pointer');
            uiElements.addReviewBtn.title = 'إضافة تقييم';
        }
    } else {
        // المستخدم غير مسجل الدخول أو ليس له ملف شخصي، لا يمكنه إضافة تقييم
        if (uiElements.addReviewBtn) {
            uiElements.addReviewBtn.disabled = true;
            uiElements.addReviewBtn.classList.add('opacity-50', 'cursor-not-allowed');
            uiElements.addReviewBtn.classList.remove('cursor-pointer');
            uiElements.addReviewBtn.title = 'يرجى تسجيل الدخول أولاً';
        }
    }
};

const updateUIForLoggedOutUser = () => {
    isAdmin = false;
    currentUserProfile = null;
    if (uiElements.developerButtons) uiElements.developerButtons.classList.add('hidden');
    if (uiElements.developerStatus) uiElements.developerStatus.classList.add('hidden');
    if (uiElements.loginProfileText) uiElements.loginProfileText.textContent = 'تسجيل دخول';

    // إخفاء أيقونة البروفايل
    const profileIcon = document.getElementById('profile-icon');
    if (profileIcon) profileIcon.classList.add('hidden');

    if (uiElements.productsContainer) uiElements.productsContainer.innerHTML = '<p class="col-span-full text-center text-purple-300">الرجاء تسجيل الدخول لعرض المنتجات.</p>';
    if (uiElements.cartItemsContainer) uiElements.cartItemsContainer.innerHTML = '<p class="text-center text-purple-300">الرجاء تسجيل الدخول لعرض سلة التسوق.</p>';
    if (uiElements.headerCartCount) uiElements.headerCartCount.textContent = '0';
    if (uiElements.cartTotalElement) uiElements.cartTotalElement.textContent = '0.00 د.ع';
    if (uiElements.cartSummaryDiv) uiElements.cartSummaryDiv.classList.add('hidden');
    if (uiElements.checkoutButton) uiElements.checkoutButton.classList.add('hidden');

    if (uiElements.profileDetailsName) uiElements.profileDetailsName.textContent = 'مستخدم غير مسجل';
    if (uiElements.profileDetailsPhone) uiElements.profileDetailsPhone.textContent = 'الرجاء تسجيل الدخول';
    if (uiElements.profileDetailsRegisteredDate) uiElements.profileDetailsRegisteredDate.textContent = '';
    if (uiElements.profileDetailsImage) uiElements.profileDetailsImage.src = 'https://placehold.co/100x100/eeeeee/333333?text=User';
    if (uiElements.profileDetailsLogoutBtn) uiElements.profileDetailsLogoutBtn.classList.add('hidden');
    if (uiElements.profileDetailsLoginBtn) uiElements.profileDetailsLoginBtn.classList.remove('hidden');

    currentCart = [];

    // تحديث زر إضافة التقييم
    updateAddReviewButton();
};

// Product display
const displayProducts = (products) => {
    console.log("displayProducts: productsData received:", products);

    // البحث عن العنصر مرة أخرى إذا لم يكن موجوداً
    if (!uiElements.productsContainer) {
        uiElements.productsContainer = document.getElementById('products-container');
        console.log("Re-fetching productsContainer:", uiElements.productsContainer);
    }

    // تأكد من وجود العنصر قبل المتابعة
    if (!uiElements.productsContainer) {
        console.error("Error: productsContainer element not found when trying to display products.");
        console.log("Available elements with 'product' in ID:", 
            Array.from(document.querySelectorAll('[id*="product"]')).map(el => el.id));
        return;
    }

    console.log("displayProducts: uiElements.productsContainer found successfully");

    uiElements.productsContainer.innerHTML = '';
    if (products.length === 0) {
        uiElements.productsContainer.innerHTML = '<p class="col-span-full text-center text-purple-300">لا توجد منتجات لعرضها حاليًا.</p>';
        return;
    }
    products.forEach(product => {
        const formattedPrice = Math.round(product.price).toLocaleString('en-US');
        // استخدام الصورة الأولى من مجموعة الصور أو الصورة القديمة كـ fallback
        const mainImageUrl = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : product.imageUrl;

        // عرض التوصيل المجاني إذا كان متاحاً
        const freeDeliveryText = product.freeDelivery ? '<p class="text-green-400 text-sm mt-1 font-semibold">توصيل مجاني</p>' : '';

        // عرض حالة المنتج (متوفر/مباع) - فقط إذا تم تحديدها وليست فارغة أو غير محدد
        let availabilityText = '';
        let buttonsSection = '';

        if (product.availability === 'available') {
            availabilityText = '<p class="text-green-400 text-sm mt-1 font-semibold">متوفر</p>';
        } else if (product.availability === 'sold') {
            availabilityText = '<p class="text-red-400 text-sm mt-1 font-semibold">مباع</p>';
        }
        // إذا كانت availability فارغة أو غير محدد، لن يظهر شيء

        // إظهار الأزرار فقط إذا كان المنتج متوفر أو غير محدد (ليس مباع)
        if (product.availability !== 'sold') {
            buttonsSection = `
                <div class="space-y-2 mt-3">
                    <button data-product-id="${product.id}" class="add-to-cart-btn w-full bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition duration-300 shadow-md">
                        أضف إلى السلة
                    </button>
                    <button data-product-id="${product.id}" class="buy-now-card-btn w-full bg-orange-600 text-white py-2 rounded-lg font-semibold hover:bg-orange-700 transition duration-300 shadow-md">
                        شراء الآن
                    </button>
                </div>
            `;
        }

        const removeWhiteBgClass = product.removeWhiteBackground ? ' remove-white-bg' : '';
        const productCard = `
            <div id="product-${product.id}" class="bg-purple-800 rounded-lg shadow-lg overflow-hidden cursor-pointer transform transition duration-300 hover:scale-105 hover:shadow-xl product-card-hover border border-purple-700${removeWhiteBgClass}">
                <img src="${mainImageUrl || 'https://placehold.co/600x400/1a012a/ffffff?text=Product'}" alt="${product.name}" class="w-full h-48 object-contain bg-transparent rounded-t-lg" onerror="this.onerror=null;this.src='https://placehold.co/600x400/1a012a/ffffff?text=Product';" style="image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;">
                <div class="p-4 text-right">
                    <h3 class="text-xl font-semibold text-white truncate">${product.name}</h3>
                    <p class="text-purple-300 text-sm mt-1">القسم: ${
                        categoriesData.find(cat => cat.id === product.category)?.name || 'غير مصنف'
                    }</p>
                    <p class="text-purple-400 text-xs mt-1">اضغط على المنتج لمعرفة التفاصيل</p>
                    ${freeDeliveryText}
                    ${availabilityText}
                    <p class="text-lg font-bold text-green-400 mt-2 text-center">${formattedPrice} د.ع</p>
                    ${buttonsSection}
                    ${isAdmin ? `
                    <div class="flex gap-2 mt-3">
                        <button data-product-id="${product.id}" class="edit-single-product-btn w-1/2 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition duration-300 shadow-md">
                            تعديل
                        </button>
                        <button data-product-id="${product.id}" class="delete-single-product-btn w-1/2 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition duration-300 shadow-md">
                            حذف
                        </button>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        uiElements.productsContainer.insertAdjacentHTML('beforeend', productCard);
    });

    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            const productId = e.target.dataset.productId;
            const productToAdd = productsData.find(p => p.id === productId);
            if (productToAdd && userId) {
                await addToCart(productToAdd);
            } else if (!userId) {
                alertUserMessage("الرجاء تسجيل الدخول أولاً لإضافة منتجات إلى السلة.");
            }
        });
    });

    document.querySelectorAll('.buy-now-card-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.stopPropagation();

            if (!userId || !currentUserProfile) {
                alertUserMessage("الرجاء تسجيل الدخول أولاً لإتمام عملية الشراء.", 'warning');
                return;
            }

            const productId = e.target.dataset.productId;
            const productToBuy = productsData.find(p => p.id === productId);

            if (productToBuy) {
                // Create temporary cart with single product
                const tempCart = [{
                    id: productToBuy.id,
                    productId: productToBuy.id,
                    name: productToBuy.name,
                    price: productToBuy.price,
                    imageUrl: productToBuy.imageUrl,
                    quantity: 1
                }];

                // حفظ بيانات الطلب المؤقتة
                orderCartData = [...tempCart];

                // Populate checkout modal with single product
                populateCheckoutModalDirectPurchase(productToBuy);

                // Open checkout modal
                if (uiElements.checkoutModal) uiElements.checkoutModal.classList.remove('hidden');
            }
        });
    });

    document.querySelectorAll('.product-card-hover').forEach(card => {
        card.addEventListener('click', (e) => {
            const productId = e.currentTarget.id.replace('product-', '');
            const product = productsData.find(p => p.id === productId);
            if (product) {
                openProductDetailModal(product);
            }
        });
    });

    if (isAdmin) {
        document.querySelectorAll('.edit-single-product-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const productId = e.target.dataset.productId;
                const productToEdit = productsData.find(p => p.id === productId);
                if (productToEdit) {
                    openEditProductModal(productToEdit);
                }
            });
        });
        document.querySelectorAll('.delete-single-product-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const productId = e.target.dataset.productId;
                await deleteProduct(productId);
            });
        });
    }
};

const openProductDetailModal = (product) => {
    const productDetailMainImage = document.getElementById('product-detail-main-image');
    const productDetailThumbnails = document.getElementById('product-detail-thumbnails');
    const currentImageIndex = document.getElementById('current-image-index');
    const totalImages = document.getElementById('total-images');
    const productDetailAvailability = document.getElementById('product-detail-availability');
    const productDetailButtons = document.getElementById('product-detail-buttons');

    if (!uiElements.productDetailName || !productDetailMainImage || !uiElements.productDetailDescription || !uiElements.productDetailPrice || !uiElements.productDetailCategory || !uiElements.addToCartDetailBtn || !uiElements.productDetailModal || !productDetailThumbnails) {
         console.error("One or more product detail modal elements not found.");
         return;
    }

    uiElements.productDetailName.textContent = product.name;
    uiElements.productDetailDescription.textContent = product.description;
    uiElements.productDetailPrice.textContent = `${Math.round(product.price).toLocaleString('en-US')} د.ع`;
    uiElements.productDetailCategory.textContent = `القسم: ${categoriesData.find(cat => cat.id === product.category)?.name || 'غير مصنف'}`;

    // عرض حالة التوفر - فقط إذا تم تحديدها وليست فارغة أو غير محدد
    if (productDetailAvailability) {
        if (product.availability === 'available') {
            productDetailAvailability.innerHTML = '<span class="text-green-400 font-semibold">متوفر</span>';
        } else if (product.availability === 'sold') {
            productDetailAvailability.innerHTML = '<span class="text-red-400 font-semibold">مباع</span>';
        } else {
            // إذا لم يتم تحديد availability أو كانت فارغة، لا نعرض شيء
            productDetailAvailability.innerHTML = '';
        }
    }

    // إخفاء/إظهار الأزرار حسب حالة المنتج
    if (productDetailButtons) {
        if (product.availability === 'sold') {
            productDetailButtons.style.display = 'none';
        } else {
            productDetailButtons.style.display = 'block';
        }
    }

    // تحديد الصور المتاحة (إما الصور الجديدة أو الصورة القديمة)
    let productImages = [];
    if (product.imageUrls && product.imageUrls.length > 0) {
        productImages = product.imageUrls;
    } else if (product.imageUrl) {
        productImages = [product.imageUrl];
    } else {
        productImages = ['https://placehold.co/600x400/1a012a/ffffff?text=لا توجد صورة'];
    }

    // تحديث عداد الصور
    if (currentImageIndex) currentImageIndex.textContent = '1';
    if (totalImages) totalImages.textContent = productImages.length;

    // عرض الصورة الرئيسية (الأولى)
    productDetailMainImage.src = productImages[0];
    productDetailMainImage.alt = product.name;
    productDetailMainImage.style.objectFit = 'contain';
    productDetailMainImage.style.backgroundColor = 'transparent';
    productDetailMainImage.style.imageRendering = '-webkit-optimize-contrast';

    // إنشاء الصور المصغرة
    productDetailThumbnails.innerHTML = '';
    productImages.forEach((imageUrl, index) => {
        const thumbnailHtml = `
            <div class="cursor-pointer border-2 border-transparent hover:border-purple-400 rounded-lg overflow-hidden transition duration-200 ${index === 0 ? 'border-purple-600' : ''}" data-image-index="${index}">
                <img src="${imageUrl}" alt="${product.name} ${index + 1}" class="w-12 h-12 object-contain bg-transparent" onerror="this.onerror=null;this.src='https://placehold.co/100x100/1a012a/ffffff?text=${index + 1}';" style="image-rendering: -webkit-optimize-contrast;">
            </div>
        `;
        productDetailThumbnails.insertAdjacentHTML('beforeend', thumbnailHtml);
    });

    // إضافة أحداث النقر للصور المصغرة
    productDetailThumbnails.querySelectorAll('[data-image-index]').forEach(thumbnail => {
        thumbnail.addEventListener('click', (e) => {
            const imageIndex = parseInt(e.currentTarget.dataset.imageIndex);
            productDetailMainImage.src = productImages[imageIndex];
            productDetailMainImage.style.objectFit = 'contain';
            productDetailMainImage.style.backgroundColor = 'transparent';
            productDetailMainImage.style.imageRendering = '-webkit-optimize-contrast';

            // تحديث عداد الصورة الحالية
            if (currentImageIndex) currentImageIndex.textContent = imageIndex + 1;

            // تحديث الحد المميز للصورة المختارة
            productDetailThumbnails.querySelectorAll('[data-image-index]').forEach(thumb => {
                thumb.classList.remove('border-purple-600');
                thumb.classList.add('border-transparent');
            });
            e.currentTarget.classList.remove('border-transparent');
            e.currentTarget.classList.add('border-purple-600');
        });
    });

    uiElements.addToCartDetailBtn.dataset.productId = product.id;
    uiElements.addToCartDetailBtn.dataset.productName = product.name;
    uiElements.addToCartDetailBtn.dataset.productPrice = product.price;
    uiElements.addToCartDetailBtn.dataset.productImage = productImages[0];

    if (uiElements.buyNowDetailBtn) {
        uiElements.buyNowDetailBtn.dataset.productId = product.id;
        uiElements.buyNowDetailBtn.dataset.productName = product.name;
        uiElements.buyNowDetailBtn.dataset.productPrice = product.price;
        uiElements.buyNowDetailBtn.dataset.productImage = productImages[0];
    }

    // تطبيق/إزالة كلاس حذف الخلفية البيضاء على المودال
    if (product.removeWhiteBackground) {
        uiElements.productDetailModal.classList.add('product-detail-remove-white-bg');
    } else {
        uiElements.productDetailModal.classList.remove('product-detail-remove-white-bg');
    }

    uiElements.productDetailModal.classList.remove('hidden');

    // إعادة تعيين scroll إلى الأعلى
    const modalContent = uiElements.productDetailModal.querySelector('.overflow-y-auto');
    if (modalContent) {
        modalContent.scrollTop = 0;
    }
};

// Category dropdowns
const populateCategoryDropdowns = () => {
    if (!uiElements.categoriesDropdown || !uiElements.productCategorySelect || !uiElements.editProductCategorySelect) {
        console.error("One or more category dropdown elements not found.");
        return;
    }
    const currentDropdownItems = uiElements.categoriesDropdown.querySelectorAll('.category-filter-btn:not([data-category-id="all"])');
    currentDropdownItems.forEach(item => item.remove());

    uiElements.productCategorySelect.innerHTML = '<option value="">اختر تصنيفًا</option>';
    uiElements.editProductCategorySelect.innerHTML = '<option value="">اختر تصنيفًا</option>';

    categoriesData.forEach(cat => {
        const categoryItem = document.createElement('div');
        categoryItem.classList.add('category-filter-btn', 'flex', 'items-center', 'justify-between', 'w-full', 'px-4', 'py-2', 'text-white', 'hover:bg-purple-700');
        categoryItem.dataset.categoryId = cat.id;

        const categoryName = document.createElement('span');
        categoryName.textContent = cat.name;
        categoryName.classList.add('flex-1', 'text-right', 'cursor-pointer');
        categoryName.dataset.categoryId = cat.id;

        const adminButtons = document.createElement('div');
        adminButtons.classList.add('flex', 'gap-1', 'ml-2');

        if (isAdmin) {
            // زر التعديل
            const editBtn = document.createElement('button');
            editBtn.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
            `;
            editBtn.classList.add('edit-category-btn', 'text-blue-400', 'hover:text-blue-300', 'p-1', 'rounded');
            editBtn.dataset.categoryId = cat.id;
            editBtn.dataset.categoryName = cat.name;
            editBtn.title = 'تعديل التصنيف';

            // زر الحذف
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
            `;
            deleteBtn.classList.add('delete-category-btn', 'text-red-400', 'hover:text-red-300', 'p-1', 'rounded');
            deleteBtn.dataset.categoryId = cat.id;
            deleteBtn.dataset.categoryName = cat.name;
            deleteBtn.title = 'حذف التصنيف';

            adminButtons.appendChild(editBtn);
            adminButtons.appendChild(deleteBtn);
        }

        categoryItem.appendChild(categoryName);
        categoryItem.appendChild(adminButtons);
        uiElements.categoriesDropdown.appendChild(categoryItem);

        const addProductOption = document.createElement('option');
        addProductOption.value = cat.id;
        addProductOption.textContent = cat.name;
        uiElements.productCategorySelect.appendChild(addProductOption);

        const editProductOption = document.createElement('option');
        editProductOption.value = cat.id;
        editProductOption.textContent = cat.name;
        uiElements.editProductCategorySelect.appendChild(editProductOption);
    });

    // إضافة أحداث النقر لأسماء التصنيفات وأزرار التصنيف
    document.querySelectorAll('.category-filter-btn').forEach(filterBtn => {
        // إضافة حدث النقر للعنصر الكامل أو النص بداخله
        const clickHandler = (e) => {
            e.stopPropagation();
            
            // البحث عن categoryId في العنصر نفسه أو في العنصر الفرعي
            let categoryId = e.target.dataset.categoryId;
            if (!categoryId && e.target.closest('.category-filter-btn')) {
                categoryId = e.target.closest('.category-filter-btn').dataset.categoryId;
            }
            
            if (categoryId) {
                filterProductsByCategory(categoryId);
                uiElements.categoriesDropdown.classList.add('hidden');
            }
        };
        
        filterBtn.addEventListener('click', clickHandler);
        
        // إضافة نفس المعالج للنص بداخل العنصر
        const spanElement = filterBtn.querySelector('span');
        if (spanElement) {
            spanElement.addEventListener('click', clickHandler);
        }
    });

    // إضافة أحداث النقر لأزرار التعديل والحذف
    if (isAdmin) {
        document.querySelectorAll('.edit-category-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const categoryId = e.target.closest('button').dataset.categoryId;
                const categoryName = e.target.closest('button').dataset.categoryName;
                openEditCategoryModal(categoryId, categoryName);
            });
        });

        document.querySelectorAll('.delete-category-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const categoryId = e.target.closest('button').dataset.categoryId;
                const categoryName = e.target.closest('button').dataset.categoryName;
                await deleteCategory(categoryId, categoryName);
            });
        });
    }
};

const filterProductsByCategory = (categoryId) => {
    const filtered = productsData.filter(product => {
        return categoryId === 'all' || product.category === categoryId;
    });
    
    // التحقق من اسم التصنيف وإضافة كلاس خاص للماوس بادات
    const bodyElement = document.body;
    
    // إزالة جميع كلاسات التصنيفات السابقة
    bodyElement.classList.remove('mousepads-category');
    
    // إضافة كلاس الماوس بادات فقط إذا كان التصنيف محدد وليس "الكل"
    if (categoryId !== 'all') {
        const category = categoriesData.find(cat => cat.id === categoryId);
        if (category && category.name && category.name.includes('ماوس باد')) {
            bodyElement.classList.add('mousepads-category');
        }
    }
    
    displayProducts(filtered);
};

// Shopping cart
const displayCart = () => {
    // البحث عن العناصر مرة أخرى إذا لم تكن موجودة
    if (!uiElements.cartItemsContainer) {
        uiElements.cartItemsContainer = document.getElementById('cart-items');
    }
    if (!uiElements.cartTotalElement) {
        uiElements.cartTotalElement = document.getElementById('cart-total');
    }
    if (!uiElements.cartSummaryDiv) {
        uiElements.cartSummaryDiv = document.getElementById('cart-summary');
    }
    if (!uiElements.checkoutButton) {
        uiElements.checkoutButton = document.getElementById('checkout-btn');
    }
    if (!uiElements.headerCartCount) {
        uiElements.headerCartCount = document.getElementById('header-cart-count');
    }

    console.log("displayCart: cartItemsContainer found:", !!uiElements.cartItemsContainer);

    if (!uiElements.cartItemsContainer || !uiElements.cartTotalElement || !uiElements.cartSummaryDiv || !uiElements.checkoutButton || !uiElements.headerCartCount) {
        console.error("Error: One or more cart UI elements not found when trying to display cart.");
        if (!uiElements.cartItemsContainer) console.error("cartItemsContainer is null.");
        if (!uiElements.cartTotalElement) console.error("cartTotalElement is null.");
        if (!uiElements.cartSummaryDiv) console.error("cartSummaryDiv is null.");
        if (!uiElements.checkoutButton) console.error("checkoutButton is null.");
        if (!uiElements.headerCartCount) console.error("headerCartCount is null.");
        return;
    }

    uiElements.cartItemsContainer.innerHTML = '';
    let total = 0;
    let itemCount = 0;

    if (currentCart.length === 0) {
        uiElements.cartItemsContainer.innerHTML = '<p class="text-center text-purple-300">سلة التسوق فارغة.</p>';
        uiElements.cartSummaryDiv.classList.add('hidden');
        uiElements.checkoutButton.classList.add('hidden');
    } else {
        // التحقق من وجود منتجات بدون توصيل مجاني
        let hasNonFreeDeliveryItems = false;

        currentCart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            itemCount += item.quantity;

            // البحث عن المنتج في قاعدة البيانات للتحقق من التوصيل المجاني
            const productData = productsData.find(p => p.id === item.productId);
            if (productData && !productData.freeDelivery) {
                hasNonFreeDeliveryItems = true;
            }

            const formattedItemPrice = Math.round(item.price).toLocaleString('en-US');
            const formattedItemTotal = Math.round(itemTotal).toLocaleString('en-US');

            // عرض علامة التوصيل المجاني إذا كان المنتج يحتوي عليه
            const freeDeliveryBadge = (productData && productData.freeDelivery) ? 
                '<span class="text-xs bg-green-600 text-white px-2 py-1 rounded ml-2">توصيل مجاني</span>' : '';

            const cartItemHtml = `
                <div class="flex items-center justify-between border-b border-purple-700 py-3">
                    <div class="flex items-center">
                        <img src="${item.imageUrl || 'https://placehold.co/50x50/1a012a/ffffff?text=Item'}" alt="${item.name}" class="w-12 h-12 object-cover rounded-md ml-4" onerror="this.onerror=null;this.src='https://placehold.co/50x50/1a012a/ffffff?text=Item';">
                        <div>
                            <h4 class="font-semibold text-white">${item.name}</h4>
                            <div class="flex items-center">
                                <p class="text-sm text-purple-300">${formattedItemPrice} د.ع x ${item.quantity}</p>
                                ${freeDeliveryBadge}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center">
                        <span class="font-semibold text-white">${formattedItemTotal} د.ع</span>
                        <button data-item-id="${item.id}" class="remove-from-cart-btn mr-4 text-red-500 hover:text-red-700 transition duration-200 focus:outline-none">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>
            `;
            uiElements.cartItemsContainer.insertAdjacentHTML('beforeend', cartItemHtml);
        });

        // تحديد رسوم التوصيل
        const deliveryFee = hasNonFreeDeliveryItems ? 5000 : 0;
        const grandTotal = total + deliveryFee;

        // عرض تفاصيل المجموع
        let summaryHtml = `
            <div class="flex justify-between items-center text-lg font-semibold">
                <span>المجموع الفرعي:</span>
                <span>${Math.round(total).toLocaleString('en-US')} د.ع</span>
            </div>
        `;

        if (hasNonFreeDeliveryItems) {
            summaryHtml += `
                <div class="flex justify-between items-center text-sm text-purple-300 mt-2">
                    <span>رسوم التوصيل:</span>
                    <span>${Math.round(deliveryFee).toLocaleString('en-US')} د.ع</span>
                </div>
                <div class="flex justify-between items-center text-xl font-bold text-green-400 mt-2 pt-2 border-t border-purple-600">
                    <span>المجموع الكلي (مع التوصيل):</span>
                    <span>${Math.round(grandTotal).toLocaleString('en-US')} د.ع</span>
                </div>
            `;
        } else {
            summaryHtml += `
                <div class="flex justify-between items-center text-sm text-green-400 mt-2">
                    <span>التوصيل:</span>
                    <span>مجاني</span>
                </div>
                <div class="flex justify-between items-center text-xl font-bold text-green-400 mt-2 pt-2 border-t border-purple-600">
                    <span>المجموع الكلي:</span>
                    <span>${Math.round(total).toLocaleString('en-US')} د.ع</span>
                </div>
            `;
        }

        if (userId && currentUserProfile) {
            uiElements.cartSummaryDiv.classList.remove('hidden');
            uiElements.cartSummaryDiv.innerHTML = summaryHtml;
            uiElements.checkoutButton.classList.remove('hidden');
        } else {
            uiElements.cartSummaryDiv.classList.add('hidden');
            uiElements.checkoutButton.classList.add('hidden');
            uiElements.cartItemsContainer.insertAdjacentHTML('beforeend', '<p class="text-center text-sm text-purple-300 mt-4">يرجى تسجيل الدخول لإتمام عملية الشراء.</p>');
        }
    }

    uiElements.cartTotalElement.textContent = `${Math.round(total).toLocaleString('en-US')} د.ع`;
    uiElements.headerCartCount.textContent = itemCount;

    document.querySelectorAll('.remove-from-cart-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const itemId = e.target.closest('button').dataset.itemId;
            await removeFromCart(itemId);
        });
    });
};

const addToCart = async (product) => {
    if (!userId) {
        alertUserMessage("الرجاء تسجيل الدخول أولاً لإضافة منتجات إلى السلة.");
        return;
    }
    try {
        const cartItemRef = doc(db, `users/${userId}/cart`, product.id);
        const docSnap = await getDoc(cartItemRef);

        if (docSnap.exists()) {
            await updateDoc(cartItemRef, {
                quantity: docSnap.data().quantity + 1
            });
            alertUserMessage(`تم تحديث كمية "${product.name}" في السلة.`, 'success');
        } else {
            await setDoc(cartItemRef, {
                productId: product.id,
                name: product.name,
                price: product.price,
                imageUrl: product.imageUrl,
                quantity: 1,
                addedAt: new Date().toISOString()
            });
            alertUserMessage(`تمت إضافة "${product.name}" إلى السلة.`, 'success');
        }
    } catch (error) {
        console.error("Error adding to cart:", error);
        alertUserMessage(`فشل إضافة المنتج إلى السلة: ${error.message}`, 'error');
    }
};

const removeFromCart = async (itemId) => {
    if (!userId) {
        alertUserMessage("يجب تسجيل الدخول لإزالة المنتجات من السلة.", 'error');
        return;
    }
    try {
        const cartItemRef = doc(db, `users/${userId}/cart`, itemId);
        const docSnap = await getDoc(cartItemRef);

        if (docSnap.exists() && docSnap.data().quantity > 1) {
            await updateDoc(cartItemRef, { quantity: docSnap.data().quantity - 1 });
            alertUserMessage(`تم تقليل كمية العنصر في السلة.`, 'success');
        } else {
            await deleteDoc(cartItemRef);
            alertUserMessage(`تم حذف العنصر من السلة.`, 'success');
        }
    } catch (error) {
        console.error("Error removing from cart:", error);
        alertUserMessage(`فشل حذف العنصر من السلة: ${error.message}`, 'error');
    }
};

// Developer management functions
const addDeveloper = async (newUID) => {
    if (userId !== MAIN_DEVELOPER_UID) {
        alertUserMessage("فقط المطور الرئيسي يمكنه إضافة مطورين جدد.", 'error');
        return;
    }

    if (!newUID || newUID.trim() === '') {
        alertUserMessage("الرجاء إدخال UID صحيح.", 'error');
        return;
    }

    const trimmedUID = newUID.trim();

    if (developerUIDs.includes(trimmedUID)) {
        alertUserMessage("هذا المطور موجود مسبقاً في القائمة.", 'warning');
        return;
    }

    try {
        const updatedUIDs = [...developerUIDs, trimmedUID];
        const developersDocRef = doc(db, `settings`, 'developers');
        await setDoc(developersDocRef, { uids: updatedUIDs });

        developerUIDs = updatedUIDs;
        alertUserMessage("تم إضافة المطور بنجاح!", 'success');
        displayDevelopersList();
    } catch (error) {
        console.error("Error adding developer:", error);
        alertUserMessage(`فشل إضافة المطور: ${error.message}`, 'error');
    }
};

const removeDeveloper = async (uidToRemove) => {
    if (userId !== MAIN_DEVELOPER_UID) {
        alertUserMessage("فقط المطور الرئيسي يمكنه حذف المطورين.", 'error');
        return;
    }

    if (uidToRemove === MAIN_DEVELOPER_UID) {
        alertUserMessage("لا يمكن حذف المطور الرئيسي.", 'error');
        return;
    }

    const confirmRemove = await showConfirmationMessage(`هل أنت متأكد من حذف هذا المطور؟\nUID: ${uidToRemove}`);
    if (!confirmRemove) return;

    try {
        const updatedUIDs = developerUIDs.filter(uid => uid !== uidToRemove);
        const developersDocRef = doc(db, `settings`, 'developers');
        await setDoc(developersDocRef, { uids: updatedUIDs });

        developerUIDs = updatedUIDs;
        alertUserMessage("تم حذف المطور بنجاح!", 'success');
        displayDevelopersList();
    } catch (error) {
        console.error("Error removing developer:", error);
        alertUserMessage(`فشل حذف المطور: ${error.message}`, 'error');
    }
};

const displayDevelopersList = () => {
    const developersList = document.getElementById('developers-list');
    if (!developersList) return;

    developersList.innerHTML = '';

    developerUIDs.forEach(uid => {
        const isMainDeveloper = uid === MAIN_DEVELOPER_UID;
        const developerItem = `
            <div class="flex items-center justify-between p-3 bg-purple-800 rounded-lg">
                <div class="flex-1">
                    <span class="text-white font-medium">${uid}</span>
                    ${isMainDeveloper ? '<span class="text-green-400 text-xs mr-2">(المطور الرئيسي)</span>' : ''}
                </div>
                ${!isMainDeveloper ? `
                    <button onclick="removeDeveloper('${uid}')" class="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded">
                        حذف
                    </button>
                ` : ''}
            </div>
        `;
        developersList.insertAdjacentHTML('beforeend', developerItem);
    });
};

// Admin category functions
const openEditCategoryModal = (categoryId, categoryName) => {
    if (!isAdmin) return;

    // إنشاء مودال التعديل ديناميكياً أو استخدام مودال موجود
    const editCategoryNameInput = document.getElementById('edit-category-name');
    const editCategoryIdInput = document.getElementById('edit-category-id');
    const editCategoryModal = document.getElementById('edit-category-modal');

    if (editCategoryNameInput && editCategoryIdInput && editCategoryModal) {
        editCategoryIdInput.value = categoryId;
        editCategoryNameInput.value = categoryName;
        editCategoryModal.classList.remove('hidden');
    } else {
        // إنشاء prompt بسيط كبديل
        const newName = prompt(`تعديل اسم التصنيف "${categoryName}":`, categoryName);
        if (newName && newName.trim() && newName.trim() !== categoryName) {
            updateCategory(categoryId, newName.trim());
        }
    }
};

const updateCategory = async (categoryId, newName) => {
    if (!isAdmin) {
        alertUserMessage("ليس لديك صلاحية تعديل التصنيفات.");
        return;
    }

    try {
        const categoryDocRef = doc(db, `categories`, categoryId);
        await updateDoc(categoryDocRef, {
            name: newName
        });
        alertUserMessage('تم تعديل التصنيف بنجاح!', 'success');
    } catch (error) {
        console.error("Error updating category:", error);
        alertUserMessage(`فشل تعديل التصنيف: ${error.message}`, 'error');
    }
};

const deleteCategory = async (categoryId, categoryName) => {
    if (!isAdmin) {
        alertUserMessage("ليس لديك صلاحية حذف التصنيفات.");
        return;
    }

    const confirmDelete = await showConfirmationMessage(`هل أنت متأكد أنك تريد حذف التصنيف "${categoryName}"؟ هذا الإجراء لا يمكن التراجع عنه.`);
    if (!confirmDelete) {
        return;
    }

    try {
        // التحقق من وجود منتجات تستخدم هذا التصنيف
        const productsUsingCategory = productsData.filter(product => product.category === categoryId);
        if (productsUsingCategory.length > 0) {
            const forceDelete = await showConfirmationMessage(`يوجد ${productsUsingCategory.length} منتج يستخدم هذا التصنيف. هل تريد المتابعة؟ سيتم تعيين هذه المنتجات كـ "غير مصنف".`);
            if (!forceDelete) {
                return;
            }

            // تحديث المنتجات لإزالة التصنيف المحذوف
            for (const product of productsUsingCategory) {
                const productDocRef = doc(db, `products`, product.id);
                await updateDoc(productDocRef, {
                    category: null
                });
            }
        }

        const categoryDocRef = doc(db, `categories`, categoryId);
        await deleteDoc(categoryDocRef);
        alertUserMessage("تم حذف التصنيف بنجاح.", 'success');

        // إخفاء القائمة المنبثقة
        if (uiElements.categoriesDropdown) {
            uiElements.categoriesDropdown.classList.add('hidden');
        }
    } catch (error) {
        console.error("Error deleting category:", error);
        alertUserMessage(`فشل حذف التصنيف: ${error.message}`, 'error');
    }
};

// Admin functions
const openEditProductModal = (product) => {
    if (!isAdmin) return;
    if (!uiElements.editProductIdInput || !uiElements.editProductNameInput || !uiElements.editProductDescriptionInput || !uiElements.editProductPriceInput || !uiElements.editProductCategorySelect || !uiElements.editProductMessage || !uiElements.editProductModal) {
         console.error("One or more edit product modal elements not found.");
         return;
    }

    uiElements.editProductIdInput.value = product.id;
    uiElements.editProductNameInput.value = product.name;
    uiElements.editProductDescriptionInput.value = product.description;
    uiElements.editProductPriceInput.value = product.price;
    uiElements.editProductCategorySelect.value = product.category || '';

    // تعبئة حقل التوصيل المجاني
    const editFreeDeliveryCheckbox = document.getElementById('edit-product-free-delivery');
    if (editFreeDeliveryCheckbox) {
        editFreeDeliveryCheckbox.checked = product.freeDelivery || false;
    }

    // تعبئة حقل حذف الخلفية البيضاء
    const editRemoveWhiteBgCheckbox = document.getElementById('edit-product-remove-white-bg');
    if (editRemoveWhiteBgCheckbox) {
        editRemoveWhiteBgCheckbox.checked = product.removeWhiteBackground || false;
    }

    // تعبئة حقل حالة التوفر
    const editAvailabilitySelect = document.getElementById('edit-product-availability');
    if (editAvailabilitySelect) {
        editAvailabilitySelect.value = product.availability || '';
    }

    // تعبئة حقول الصور الخمسة
    for (let i = 1; i <= 5; i++) {
        const imageInput = document.getElementById(`edit-product-image-url-${i}`);
        if (imageInput) {
            if (product.imageUrls && product.imageUrls[i-1]) {
                imageInput.value = product.imageUrls[i-1];
            } else if (i === 1 && product.imageUrl) {
                // إذا كان المنتج يستخدم النظام القديم، ضع الصورة في الحقل الأول
                imageInput.value = product.imageUrl;
            } else {
                imageInput.value = '';
            }
        }
    }

    uiElements.editProductMessage.textContent = '';
    uiElements.editProductModal.classList.remove('hidden');
};

const deleteProduct = async (productId) => {
    if (!isAdmin) {
        alertUserMessage("ليس لديك صلاحية حذف المنتجات.");
        return;
    }

    const confirmDelete = await showConfirmationMessage("هل أنت متأكد أنك تريد حذف هذا المنتج؟ هذا الإجراء لا يمكن التراجع عنه.");
    if (!confirmDelete) {
        return;
    }

    try {
        const productDocRef = doc(db, `products`, productId);
        await deleteDoc(productDocRef);
        alertUserMessage("تم حذف المنتج بنجاح.", 'success');
    } catch (error) {
        console.error("Error deleting product:", error);
        alertUserMessage(`فشل حذف المنتج: ${error.message}`, 'error');
    }
};

// Reviews display
const displayReviews = (reviews) => {
    // البحث عن العنصر مرة أخرى إذا لم يكن موجوداً
    if (!uiElements.reviewsList) {
        uiElements.reviewsList = document.getElementById('reviews-list');
    }

    console.log("displayReviews: reviewsList found:", !!uiElements.reviewsList);
    if (!uiElements.reviewsList) {
        console.error("reviewsList element not found when trying to display reviews.");
        return;
    }
    uiElements.reviewsList.innerHTML = '';
    if (reviews.length === 0) {
        uiElements.reviewsList.innerHTML = '<p class="text-center text-purple-300">لا توجد تقييمات حتى الآن.</p>';
        return;
    }

    reviews.sort((a, b) => (b.createdAt && a.createdAt) ? new Date(b.createdAt) - new Date(a.createdAt) : 0);

    reviews.forEach(review => {
        // التحقق من صلاحية الحذف: المستخدم الحالي هو صاحب التقييم أو أدمن
        const canDeleteReview = userId && ((userId === review.userId) || isAdmin);
        const reviewHtml = `
            <div class="bg-purple-800 p-4 rounded-lg shadow-md border border-purple-700" data-review-id="${review.id}">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <p class="text-white font-semibold">${review.userName || 'مستخدم غير معروف'}</p>
                        ${canDeleteReview ? `<button data-review-id="${review.id}" class="delete-review-btn text-red-500 hover:text-red-700 transition duration-200 focus:outline-none" title="حذف التقييم">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>` : ''}
                    </div>
                    <div class="flex text-yellow-300">
                        ${Array(review.rating).fill().map(() => `<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`).join('')}
                    </div>
                </div>
                <p class="text-purple-300 text-sm mt-2">${review.text}</p>
                <p class="text-gray-500 text-xs mt-2">
                    ${review.createdAt ? new Date(review.createdAt).toLocaleDateString('ar-IQ') : 'تاريخ غير متوفر'}
                </p>
            </div>
        `;
        uiElements.reviewsList.insertAdjacentHTML('beforeend', reviewHtml);
    });
    document.querySelectorAll('.delete-review-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const reviewId = e.target.closest('button').dataset.reviewId;
            const confirmDelete = await showConfirmationMessage("هل أنت متأكد أنك تريد حذف هذا التقييم؟");
            if (confirmDelete) {
                await deleteReview(reviewId);
            }
        });
    });
};

const deleteReview = async (reviewId) => {
    if (!userId) {
        alertUserMessage("يرجى تسجيل الدخول لحذف التقييم.", 'error');
        return;
    }

    if (!currentUserProfile) {
        alertUserMessage("يرجى إكمال تسجيل الدخول أولاً.", 'error');
        return;
    }

    try {
        // التحقق من أن التقييم يخص المستخدم الحالي
        const reviewToDelete = reviewsData.find(review => review.id === reviewId);
        if (!reviewToDelete) {
            alertUserMessage("التقييم غير موجود.", 'error');
            return;
        }

        console.log("Review data:", reviewToDelete);
        console.log("Current user ID:", userId);
        console.log("Review user ID:", reviewToDelete.userId);
        console.log("Is admin:", isAdmin);

        if (reviewToDelete.userId !== userId && !isAdmin) {
            alertUserMessage("ليس لديك صلاحية لحذف هذا التقييم. يمكنك حذف تقييماتك فقط.", 'error');
            return;
        }

        const reviewDocRef = doc(db, `reviews`, reviewId);
        await deleteDoc(reviewDocRef);
        alertUserMessage("تم حذف التقييم بنجاح.", 'success');
    } catch (error) {
        console.error("Error deleting review:", error);
        if (error.code === 'permission-denied') {
            alertUserMessage("خطأ في الأذونات: تأكد من أن قواعد أمان Firebase تسمح لك بحذف تقييماتك الخاصة.", 'error');
        } else {
            alertUserMessage(`فشل حذف التقييم: ${error.message}`, 'error');
        }
    }
};

// Direct purchase checkout logic
const populateCheckoutModalDirectPurchase = (product) => {
    if (!uiElements.checkoutNameInput || !uiElements.checkoutPhoneInput || !uiElements.checkoutGovernorateSelect || !uiElements.checkoutDistrictInput || !uiElements.checkoutNotesTextarea || !uiElements.checkoutProductsList || !uiElements.checkoutGrandTotal) {
        console.error("One or more checkout modal elements not found.");
        return;
    }

    if (!currentUserProfile || !userId) {
        alertUserMessage("يرجى تسجيل الدخول أولاً لتعبئة معلومات الشحن.", 'warning');
        return;
    }

    uiElements.checkoutNameInput.value = currentUserProfile.fullName || '';
    uiElements.checkoutPhoneInput.value = (currentUserProfile.phoneNumber || '').replace('+964', '');
    uiElements.checkoutGovernorateSelect.value = currentUserProfile.governorate || '';
    uiElements.checkoutDistrictInput.value = currentUserProfile.district || '';
    uiElements.checkoutNotesTextarea.value = '';

    uiElements.checkoutProductsList.innerHTML = '';
    const itemTotal = product.price;
    const formattedItemTotal = Math.round(itemTotal).toLocaleString('en-US');

    // استخدام الصورة الرئيسية (الأولى) من مجموعة الصور
    const mainImageUrl = (product.imageUrls && product.imageUrls.length > 0) ? product.imageUrls[0] : product.imageUrl;

    // عرض علامة التوصيل المجاني إذا كان المنتج يحتوي عليه
    const freeDeliveryBadge = product.freeDelivery ? 
        '<span class="text-xs bg-green-600 text-white px-1 py-0.5 rounded mr-2">توصيل مجاني</span>' : '';

    const productItemHtml = `
        <div class="flex items-center justify-between mb-2">
            <div class="flex items-center">
                <img src="${mainImageUrl || 'https://placehold.co/40x40/1a012a/ffffff?text=Item'}" alt="${product.name}" class="w-10 h-10 object-cover rounded-md ml-2" onerror="this.onerror=null;this.src='https://placehold.co/40x40/1a012a/ffffff?text=Item';">
                <div class="flex flex-col">
                    <span class="text-sm font-medium text-white">${product.name} (x1)</span>
                    ${freeDeliveryBadge}
                </div>
            </div>
            <span class="text-sm font-medium text-white">${formattedItemTotal} د.ع</span>
        </div>
    `;
    uiElements.checkoutProductsList.insertAdjacentHTML('beforeend', productItemHtml);

    // تحديد رسوم التوصيل بناءً على خاصية التوصيل المجاني للمنتج
    const deliveryFee = product.freeDelivery ? 0 : 5000;
    const grandTotal = itemTotal + deliveryFee;

    // عرض تفاصيل المجموع
    let summaryHtml = `
        <div class="border-t border-purple-600 pt-2 mt-2">
            <div class="flex justify-between text-sm">
                <span>المجموع الفرعي:</span>
                <span>${formattedItemTotal} د.ع</span>
            </div>
    `;

    if (!product.freeDelivery) {
        summaryHtml += `
            <div class="flex justify-between text-sm mt-1">
                <span>رسوم التوصيل:</span>
                <span>${Math.round(deliveryFee).toLocaleString('en-US')} د.ع</span>
            </div>
        `;
    } else {
        summaryHtml += `
            <div class="flex justify-between text-sm text-green-400 mt-1">
                <span>التوصيل:</span>
                <span>مجاني</span>
            </div>
        `;
    }

    summaryHtml += `</div>`;
    uiElements.checkoutProductsList.insertAdjacentHTML('beforeend', summaryHtml);

    uiElements.checkoutGrandTotal.textContent = `${Math.round(grandTotal).toLocaleString('en-US')} د.ع`;
};

// Checkout logic
const populateCheckoutModal = () => {
    if (!uiElements.checkoutNameInput || !uiElements.checkoutPhoneInput || !uiElements.checkoutGovernorateSelect || !uiElements.checkoutDistrictInput || !uiElements.checkoutNotesTextarea || !uiElements.checkoutProductsList || !uiElements.checkoutGrandTotal) {
        console.error("One or more checkout modal elements not found.");
        return;
    }

    if (!currentUserProfile || !userId) {
        alertUserMessage("يرجى تسجيل الدخول أولاً لتعبئة معلومات الشحن.", 'warning');
        return;
    }
    if (currentCart.length === 0) {
        alertUserMessage("سلة التسوق فارغة. الرجاء إضافة منتجات قبل إتمام الشراء.", 'warning');
        return;
    }

    uiElements.checkoutNameInput.value = currentUserProfile.fullName || '';
    uiElements.checkoutPhoneInput.value = (currentUserProfile.phoneNumber || '').replace('+964', '');
    uiElements.checkoutGovernorateSelect.value = currentUserProfile.governorate || '';
    uiElements.checkoutDistrictInput.value = currentUserProfile.district || '';
    uiElements.checkoutNotesTextarea.value = '';

    uiElements.checkoutProductsList.innerHTML = '';
    let orderSubtotal = 0;
    let hasNonFreeDeliveryItems = false;

    currentCart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        orderSubtotal += itemTotal;

        // البحث عن المنتج في قاعدة البيانات للتحقق من التوصيل المجاني
        const productData = productsData.find(p => p.id === item.productId);
        if (productData && !productData.freeDelivery) {
            hasNonFreeDeliveryItems = true;
        }

        const formattedItemTotal = Math.round(itemTotal).toLocaleString('en-US');

        // عرض علامة التوصيل المجاني إذا كان المنتج يحتوي عليه
        const freeDeliveryBadge = (productData && productData.freeDelivery) ? 
            '<span class="text-xs bg-green-600 text-white px-1 py-0.5 rounded mr-2">توصيل مجاني</span>' : '';

        const productItemHtml = `
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center">
                    <img src="${item.imageUrl || 'https://placehold.co/40x40/1a012a/ffffff?text=Item'}" alt="${item.name}" class="w-10 h-10 object-cover rounded-md ml-2" onerror="this.onerror=null;this.src='https://placehold.co/40x40/1a012a/ffffff?text=Item';">
                    <div class="flex flex-col">
                        <span class="text-sm font-medium text-white">${item.name} (x${item.quantity})</span>
                        ${freeDeliveryBadge}
                    </div>
                </div>
                <span class="text-sm font-medium text-white">${formattedItemTotal} د.ع</span>
            </div>
        `;
        uiElements.checkoutProductsList.insertAdjacentHTML('beforeend', productItemHtml);
    });

    // تحديد رسوم التوصيل
    const deliveryFee = hasNonFreeDeliveryItems ? 5000 : 0;
    const grandTotal = orderSubtotal + deliveryFee;

    // عرض تفاصيل المجموع
    let summaryHtml = `
        <div class="border-t border-purple-600 pt-2 mt-2">
            <div class="flex justify-between text-sm">
                <span>المجموع الفرعي:</span>
                <span>${Math.round(orderSubtotal).toLocaleString('en-US')} د.ع</span>
            </div>
    `;

    if (hasNonFreeDeliveryItems) {
        summaryHtml += `
            <div class="flex justify-between text-sm mt-1">
                <span>رسوم التوصيل:</span>
                <span>${Math.round(deliveryFee).toLocaleString('en-US')} د.ع</span>
            </div>
        `;
    } else {
        summaryHtml += `
            <div class="flex justify-between text-sm text-green-400 mt-1">
                <span>التوصيل:</span>
                <span>مجاني</span>
            </div>
        `;
    }

    summaryHtml += `</div>`;
    uiElements.checkoutProductsList.insertAdjacentHTML('beforeend', summaryHtml);

    uiElements.checkoutGrandTotal.textContent = `${Math.round(grandTotal).toLocaleString('en-US')} د.ع`;
};

// Event listeners setup
const setupEventListeners = () => {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
            }
        });
    });
    document.querySelectorAll('.modal-close-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.target.closest('.modal-overlay').classList.add('hidden');
        });
    });

    // Message box confirm/cancel buttons
    if (uiElements.messageBoxConfirmBtn) {
        uiElements.messageBoxConfirmBtn.addEventListener('click', () => {
            if (resolveMessageBoxPromise) {
                resolveMessageBoxPromise(true);
                resolveMessageBoxPromise = null;
            }
            if (uiElements.messageBox) uiElements.messageBox.classList.add('hidden');
        });
    }
    if (uiElements.messageBoxCancelBtn) {
        uiElements.messageBoxCancelBtn.addEventListener('click', () => {
            if (resolveMessageBoxPromise) {
                resolveMessageBoxPromise(false);
                resolveMessageBoxPromise = null;
            }
            if (uiElements.messageBox) uiElements.messageBox.classList.add('hidden');
        });
    }

    // Login/Profile buttons
    if (uiElements.loginProfileBtn) {
        uiElements.loginProfileBtn.addEventListener('click', () => {
            if (currentUserProfile) {
                // تغيير كلمة "حسابي" إلى أيقونة بروفايل
                uiElements.loginProfileBtn.innerHTML = '<img id="profile-icon" src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" alt="Profile" class="w-6 h-6">';
                if (uiElements.profileDetailsModal) uiElements.profileDetailsModal.classList.remove('hidden');
            } else {
                if (uiElements.loginModal) uiElements.loginModal.classList.remove('hidden');
            }
        });
    }

    // Login form
    if (uiElements.loginForm) {
        uiElements.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!firebaseInitialized || !auth || !db) {
                alertUserMessage("نظام تسجيل الدخول غير جاهز بعد. الرجاء المحاولة مرة أخرى بعد قليل.", 'warning');
                return;
            }

            const fullName = uiElements.fullNameInput.value.trim();
            let phoneNumberDigits = uiElements.phoneNumberInput.value.trim();

            if (!fullName || !phoneNumberDigits) {
                alertUserMessage('الرجاء تعبئة جميع الحقول.', 'error');
                return;
            }

            const phoneRegex = /^[0-9]{11}$/;
            if (!phoneRegex.test(phoneNumberDigits)) {
                alertUserMessage('الرجاء إدخال 11 رقمًا فقط لرقم الهاتف بعد 964.', 'error');
                return;
            }

            const fullPhoneNumber = `+964${phoneNumberDigits}`;
            console.log("Attempting to register/login with:", { fullName, fullPhoneNumber });

            try {
                // البحث عن مستخدم موجود بنفس المعلومات
                const existingUser = await findExistingUser(fullName, fullPhoneNumber);

                if (existingUser) {
                    // المستخدم موجود، تسجيل دخول للحساب الموجود
                    console.log("Existing user found, switching to existing account:", existingUser.userId);

                    // تسجيل الخروج من الحساب المجهول الحالي إذا كان مختلفاً
                    if (userId && userId !== existingUser.userId) {
                        console.log("Signing out from current anonymous account to switch to existing account");
                        await signOut(auth);
                    }

                    // تعيين المستخدم الموجود
                    userId = existingUser.userId;
                    currentUserProfile = existingUser.data;

                    // محاكاة تسجيل الدخول للمستخدم الموجود
                    // هنا نحتاج لتسجيل الدخول بطريقة مختلفة أو إدارة الجلسة بشكل مخصص

                    // تحديث UI
                    if (uiElements.profileDetailsName) uiElements.profileDetailsName.textContent = existingUser.data.fullName || 'مستخدم';
                    if (uiElements.profileDetailsPhone) uiElements.profileDetailsPhone.textContent = existingUser.data.phoneNumber || 'N/A';
                    if (uiElements.profileDetailsImage) uiElements.profileDetailsImage.src = existingUser.data.profilePicUrl || 'https://placehold.co/100x100/eeeeee/333333?text=User';

                    if (existingUser.data.createdAt) {
                        const date = new Date(existingUser.data.createdAt);
                        if (uiElements.profileDetailsRegisteredDate) uiElements.profileDetailsRegisteredDate.textContent = `تاريخ التسجيل: ${date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })} في ${date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
                    }

                    // إعداد Real-time listeners للحساب الموجود
                    setupRealtimeListeners();

                    alertUserMessage(`مرحباً بعودتك ${existingUser.data.fullName}! تم تسجيل دخولك للحساب الموجود.`, 'success');
                } else {
                    // مستخدم جديد، التحقق من وجود UID حالي أو إنشاء واحد جديد
                    if (!userId) {
                        if (!auth.currentUser) {
                            await signInAnonymously(auth);
                        }
                        userId = auth.currentUser.uid;
                    }

                    console.log("Creating new user with UID:", userId);

                    // التحقق من عدم وجود ملف شخصي لهذا UID مسبقاً
                    const existingProfileRef = doc(db, `users/${userId}/userProfile`, userId);
                    const existingProfileSnap = await getDoc(existingProfileRef);

                    if (existingProfileSnap.exists()) {
                        // يوجد ملف شخصي مسبق، قم بتحديثه
                        await updateDoc(existingProfileRef, {
                            fullName: fullName,
                            phoneNumber: fullPhoneNumber,
                            updatedAt: new Date().toISOString()
                        });
                        console.log("Updated existing user profile in Firestore.");
                        alertUserMessage('تم تحديث بيانات حسابك بنجاح!', 'success');
                    } else {
                        // إنشاء ملف شخصي جديد
                        const newUserData = {
                            fullName: fullName,
                            phoneNumber: fullPhoneNumber,
                            profilePicUrl: 'https://placehold.co/100x100/eeeeee/333333?text=User',
                            createdAt: new Date().toISOString()
                        };

                        await setDoc(existingProfileRef, newUserData);
                        console.log("New user profile created in Firestore.");
                        alertUserMessage('تم إنشاء حساب جديد بنجاح!', 'success');
                    }

                    // تحديث currentUserProfile
                    const updatedProfileSnap = await getDoc(existingProfileRef);
                    currentUserProfile = updatedProfileSnap.data();
                }

                // التحقق من المطور بناءً على UID
                if (developerUIDs.includes(userId)) {
                     // تحديث حالة الأدمن فوراً
                     isAdmin = true;
                     if (uiElements.developerButtons) uiElements.developerButtons.classList.remove('hidden');
                     if (uiElements.developerStatus) uiElements.developerStatus.classList.remove('hidden');
                     console.log("Admin status updated immediately based on UID.");
                }

                await fetchAdminStatus();

                // تغيير كلمة "حسابي" إلى أيقونة بروفايل بعد تسجيل الدخول
                uiElements.loginProfileBtn.innerHTML = '<img id="profile-icon" src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" alt="Profile" class="w-6 h-6">';

                // تحديث UI العامة
                if (uiElements.loginProfileText) uiElements.loginProfileText.textContent = 'حسابي';
                if (uiElements.profileDetailsLogoutBtn) uiElements.profileDetailsLogoutBtn.classList.remove('hidden');
                if (uiElements.profileDetailsLoginBtn) uiElements.profileDetailsLoginBtn.classList.add('hidden');

                // إذا كان المستخدم أدمن، أظهر رسالة خاصة وعدد المستخدمين
                if (developerUIDs.includes(userId)) {
                    setTimeout(() => {
                        const adminType = userId === MAIN_DEVELOPER_UID ? 'المطور الرئيسي' : 'مطور';
                        alertUserMessage(`مرحباً ${adminType}! تم تفعيل صلاحيات الإدارة.`, 'success');
                    }, 2000);
                    setTimeout(() => {
                        fetchAndDisplayUserCount();
                    }, 3000);
                }

                setTimeout(() => {
                    if (uiElements.loginModal) uiElements.loginModal.classList.add('hidden');
                    if (uiElements.loginMessage) uiElements.loginMessage.textContent = '';
                }, 1500);

            } catch (error) {
                console.error("Error during registration/login:", error);
                alertUserMessage(`فشل التسجيل/تسجيل الدخول: ${error.message}`, 'error');
            }
        });
    }

    // Logout/Login buttons in profile modal
    if (uiElements.profileDetailsLogoutBtn) {
        uiElements.profileDetailsLogoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                console.log("User signed out.");
                // تغيير أيقونة البروفايل إلى كلمة "حسابي" بعد تسجيل الخروج
                uiElements.loginProfileBtn.textContent = 'حسابي';
                if (uiElements.profileDetailsModal) uiElements.profileDetailsModal.classList.add('hidden');
            }
            catch (error) {
                console.error("Error signing out:", error);
                alertUserMessage("حدث خطأ أثناء تسجيل الخروج.", 'error');
            }
        });
    }
    if (uiElements.profileDetailsLoginBtn) {
        uiElements.profileDetailsLoginBtn.addEventListener('click', () => {
            if (uiElements.profileDetailsModal) uiElements.profileDetailsModal.classList.add('hidden');
            if (uiElements.loginModal) uiElements.loginModal.classList.remove('hidden');
        });
    }

    // Cart buttons
    if (uiElements.headerCartBtn) {
        uiElements.headerCartBtn.addEventListener('click', () => {
            if (uiElements.shoppingCartModal) uiElements.shoppingCartModal.classList.remove('hidden');
        });
    }

    // Product detail modal add to cart
    if (uiElements.addToCartDetailBtn) {
        uiElements.addToCartDetailBtn.addEventListener('click', async () => {
            const productId = uiElements.addToCartDetailBtn.dataset.productId;
            const productToAdd = productsData.find(p => p.id === productId);
            if (productToAdd && userId) {
                await addToCart(productToAdd);
                if (uiElements.productDetailModal) uiElements.productDetailModal.classList.add('hidden');
            } else if (!userId) {
                alertUserMessage("الرجاء تسجيل الدخول أولاً لإضافة منتجات إلى السلة.");
            }
        });
    }

    // Product detail modal buy now
    if (uiElements.buyNowDetailBtn) {
        uiElements.buyNowDetailBtn.addEventListener('click', async () => {
            if (!userId || !currentUserProfile) {
                alertUserMessage("الرجاء تسجيل الدخول أولاً لإتمام عملية الشراء.", 'warning');
                return;
            }

            const productId = uiElements.buyNowDetailBtn.dataset.productId;
            const productToBuy = productsData.find(p => p.id === productId);

            if (productToBuy) {
                // استخدام الصورة الرئيسية (الأولى) من مجموعة الصور
                const mainImageUrl = (productToBuy.imageUrls && productToBuy.imageUrls.length > 0) ? productToBuy.imageUrls[0] : productToBuy.imageUrl;

                // Create temporary cart with single product
                const tempCart = [{
                    id: productToBuy.id,
                    productId: productToBuy.id,
                    name: productToBuy.name,
                    price: productToBuy.price,
                    imageUrl: mainImageUrl,
                    quantity: 1
                }];

                // حفظ بيانات الطلب المؤقتة
                orderCartData = [...tempCart];

                // Populate checkout modal with single product
                populateCheckoutModalDirectPurchase(productToBuy);

                // Close product detail modal and open checkout
                if (uiElements.productDetailModal) uiElements.productDetailModal.classList.add('hidden');
                if (uiElements.checkoutModal) uiElements.checkoutModal.classList.remove('hidden');
            }
        });
    }

    // Checkout button
    if (uiElements.checkoutButton) {
        uiElements.checkoutButton.addEventListener('click', async () => {
            if (!userId || !currentUserProfile) {
                alertUserMessage("الرجاء تسجيل الدخول أولاً لإتمام عملية الشراء.", 'warning');
                return;
            }
            if (currentCart.length === 0) {
                alertUserMessage("سلة التسوق فارغة. الرجاء إضافة منتجات.", 'warning');
                return;
            }

            // حفظ بيانات السلة الحالية
            orderCartData = [...currentCart];

            populateCheckoutModal();
            if (uiElements.checkoutModal) uiElements.checkoutModal.classList.remove('hidden');
        });
    }

    // Checkout form
    if (uiElements.checkoutForm) {
        uiElements.checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const fullName = uiElements.checkoutNameInput.value.trim();
            const governorate = uiElements.checkoutGovernorateSelect.value;
            const district = uiElements.checkoutDistrictInput.value.trim();
            const phoneNumberDigits = uiElements.checkoutPhoneInput.value.trim();
            const notes = uiElements.checkoutNotesTextarea.value.trim();
            const fullPhoneNumber = `+964${phoneNumberDigits}`;

            if (!fullName || !governorate || !district || !phoneNumberDigits) {
                alertUserMessage('الرجاء تعبئة جميع الحقول المطلوبة.', 'error');
                return;
            }

            const phoneRegex = /^[0-9]{11}$/;
            if (!phoneRegex.test(phoneNumberDigits)) {
                alertUserMessage('الرجاء إدخال 11 رقمًا صحيحًا لرقم الهاتف بعد 964.', 'error');
                return;
            }

            try {
                // استخدام البيانات المحفوظة أو السلة الحالية
                const cartToProcess = orderCartData.length > 0 ? orderCartData : currentCart;

                if (cartToProcess.length === 0) {
                    alertUserMessage('لا توجد منتجات في الطلب.', 'error');
                    return;
                }

                let orderMessage = `✅ *طلب جديد!* ✅\n\n`;
                orderMessage += `*معلومات العميل:*\n`;
                orderMessage += `الاسم: ${fullName}\n`;
                orderMessage += `رقم الهاتف: ${fullPhoneNumber}\n`;
                orderMessage += `المحافظة: ${governorate}\n`;
                orderMessage += `القضاء/المدينة: ${district}\n`;
                orderMessage += `ملاحظات العميل: ${notes || 'لا توجد'}\n\n`;

                if (currentUserProfile) {
                    orderMessage += `معرف المستخدم (UID): ${userId}\n`;
                    orderMessage += `الاسم المسجل: ${currentUserProfile.fullName}\n`;
                    orderMessage += `رقم الهاتف المسجل: ${currentUserProfile.phoneNumber}\n`;
                    if (currentUserProfile.createdAt) {
                        const regDate = new Date(currentUserProfile.createdAt);
                        orderMessage += `تاريخ التسجيل: ${regDate.toLocaleDateString('ar-EG')} ${regDate.toLocaleTimeString('ar-EG')}\n\n`;
                    }
                } else {
                    orderMessage += `معرف المستخدم (UID): ${userId} (مستخدم غير مسجل بملف شخصي كامل)\n\n`;
                }

                orderMessage += `*تفاصيل الطلب:*\n`;
                let cartTotalForBot = 0;
                let hasNonFreeDeliveryItems = false;

                cartToProcess.forEach((item, index) => {
                    // البحث عن المنتج للتحقق من التوصيل المجاني
                    const productData = productsData.find(p => p.id === item.productId);
                    const freeDeliveryText = (productData && productData.freeDelivery) ? ' (توصيل مجاني)' : '';

                    if (productData && !productData.freeDelivery) {
                        hasNonFreeDeliveryItems = true;
                    }

                    orderMessage += `${index + 1}. ${item.name} (${item.quantity}x)${freeDeliveryText} - ${Math.round(item.price).toLocaleString('en-US')} د.ع = ${Math.round(item.price * item.quantity).toLocaleString('en-US')} د.ع\n`;
                    cartTotalForBot += (item.price * item.quantity);
                });

                orderMessage += `\nالمجموع الفرعي: ${Math.round(cartTotalForBot).toLocaleString('en-US')} د.ع\n`;

                const deliveryFee = hasNonFreeDeliveryItems ? 5000 : 0;
                if (hasNonFreeDeliveryItems) {
                    orderMessage += `رسوم التوصيل: 5,000 د.ع\n`;
                    orderMessage += `*المجموع الكلي: ${Math.round(cartTotalForBot + deliveryFee).toLocaleString('en-US')} د.ع (بما في ذلك التوصيل)*\n\n`;
                } else {
                    orderMessage += `رسوم التوصيل: مجاني (جميع المنتجات لها توصيل مجاني)\n`;
                    orderMessage += `*المجموع الكلي: ${Math.round(cartTotalForBot).toLocaleString('en-US')} د.ع*\n\n`;
                }
                orderMessage += `*ملاحظات الدفع والتوصيل:*\n`;
                orderMessage += `الدفع عند الاستلام\n`;
                orderMessage += `التوصيل لجميع محافظات العراق\n`;

                const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
                const telegramPayload = {
                    chat_id: TELEGRAM_CHAT_ID,
                    text: orderMessage,
                    parse_mode: 'Markdown'
                };

                const response = await fetch(telegramApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(telegramPayload)
                });

                const result = await response.json();

                if (result.ok) {
                    alertUserMessage('تم تأكيد الطلب بنجاح! سيتم التواصل معك قريباً.', 'success');
                    if (uiElements.checkoutModal) uiElements.checkoutModal.classList.add('hidden');
                    if (uiElements.shoppingCartModal) uiElements.shoppingCartModal.classList.add('hidden');

                    // تنظيف البيانات المؤقتة
                    orderCartData = [];

                    // حذف السلة فقط إذا كان الطلب من السلة العادية وليس "شراء الآن"
                    if (cartToProcess === currentCart) {
                        const cartItemsRef = collection(db, `users/${userId}/cart`);
                        const cartSnapshot = await getDocs(cartItemsRef);
                        const deleteCartPromises = [];
                        cartSnapshot.forEach(doc => deleteCartPromises.push(deleteDoc(doc.ref)));
                        await Promise.all(deleteCartPromises);
                        console.log("Cart cleared after successful order.");
                    }

                } else {
                    alertUserMessage(`فشل إرسال الطلب عبر تيليجرام: ${result.description || 'خطأ غير معروف'}`, 'error');
                    console.error("Telegram bot error:", result);
                }

            } catch (error) {
                console.error("Error confirming order:", error);
                alertUserMessage(`فشل تأكيد الطلب: ${error.message}`, 'error');
            }
        });
    }

    // Admin add product
    if (uiElements.bottomAddProductBtn) {
        uiElements.bottomAddProductBtn.addEventListener('click', () => {
            if (isAdmin) {
                if (uiElements.addProductModal) uiElements.addProductModal.classList.remove('hidden');
                if (uiElements.addProductForm) uiElements.addProductForm.reset();
                if (uiElements.addProductMessage) uiElements.addProductMessage.textContent = '';
                if (uiElements.productCategorySelect) {
                    uiElements.productCategorySelect.innerHTML = '<option value="">اختر تصنيفًا</option>';
                    categoriesData.forEach(cat => {
                        const option = document.createElement('option');
                        option.value = cat.id;
                        option.textContent = cat.name;
                        uiElements.productCategorySelect.appendChild(option);
                    });
                }
            } else {
                alertUserMessage("ليس لديك صلاحية إضافة منتجات.");
            }
        });
    }

    // Admin add product form
    if (uiElements.addProductForm) {
        uiElements.addProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!isAdmin) {
                alertUserMessage("ليس لديك صلاحية إضافة منتجات.");
                return;
            }
            const name = uiElements.productNameInput.value.trim();
            const description = uiElements.productDescriptionInput.value.trim();
            const price = parseFloat(uiElements.productPriceInput.value);
            const category = uiElements.productCategorySelect.value;
            const freeDelivery = document.getElementById('product-free-delivery').checked;
            const removeWhiteBackground = document.getElementById('product-remove-white-bg').checked;
            const availability = document.getElementById('product-availability').value;

            // جمع روابط الصور الخمسة
            const imageUrls = [];
            for (let i = 1; i <= 5; i++) {
                const imageInput = document.getElementById(`product-image-url-${i}`);
                if (imageInput && imageInput.value.trim()) {
                    imageUrls.push(imageInput.value.trim());
                }
            }

            if (!name || !description || isNaN(price) || price <= 0 || imageUrls.length === 0 || !category) {
                alertUserMessage('الرجاء تعبئة جميع الحقول بشكل صحيح وإدخال رابط الصورة الرئيسية على الأقل.', 'error');
                return;
            }

            try {
                const productsColRef = collection(db, `products`);
                const docRef = await addDoc(productsColRef, {
                    name,
                    description,
                    price,
                    imageUrls, // استخدام مجموعة الصور الجديدة
                    imageUrl: imageUrls[0], // الاحتفاظ بالحقل القديم للتوافق
                    category,
                    freeDelivery,
                    removeWhiteBackground,
                    availability: availability || '',
                    createdAt: new Date().toISOString()
                });
                console.log("Product successfully added to Firestore with ID:", docRef.id);
                alertUserMessage('تم إضافة المنتج بنجاح!', 'success');
                if (uiElements.addProductForm) uiElements.addProductForm.reset();
                setTimeout(() => {
                    if (uiElements.addProductModal) uiElements.addProductModal.classList.add('hidden');
                }, 1500);
            } catch (error) {
                console.error("Error adding product to Firestore: ", error);
                alertUserMessage(`فشل إضافة المنتج: ${error.message}`, 'error');
            }
        });
    }

    // Admin add category
    if (uiElements.bottomAddCategoryBtn) {
         uiElements.bottomAddCategoryBtn.addEventListener('click', () => {
            if (isAdmin) {
                if (uiElements.addCategoryModal) uiElements.addCategoryModal.classList.remove('hidden');
                if (uiElements.newCategoryNameInput) uiElements.newCategoryNameInput.value = '';
                if (uiElements.addCategoryMessage) uiElements.addCategoryMessage.textContent = '';
            } else {
                alertUserMessage("ليس لديك صلاحية إضافة تصنيفات.");
            }
         });
    }

    // Manage developers button
    const manageDevelopersBtn = document.getElementById('manage-developers-btn');
    if (manageDevelopersBtn) {
        manageDevelopersBtn.addEventListener('click', () => {
            if (userId === MAIN_DEVELOPER_UID) {
                const manageDevelopersModal = document.getElementById('manage-developers-modal');
                if (manageDevelopersModal) {
                    manageDevelopersModal.classList.remove('hidden');
                    displayDevelopersList();
                }
            } else {
                alertUserMessage("فقط المطور الرئيسي يمكنه إدارة المطورين.", 'error');
            }
        });
    }

    // Add developer form
    const addDeveloperForm = document.getElementById('add-developer-form');
    if (addDeveloperForm) {
        addDeveloperForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newDeveloperUID = document.getElementById('new-developer-uid').value.trim();
            await addDeveloper(newDeveloperUID);
            document.getElementById('new-developer-uid').value = '';
        });
    }

    // Admin edit category form
    if (uiElements.editCategoryForm) {
        uiElements.editCategoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!isAdmin) {
                alertUserMessage("ليس لديك صلاحية تعديل التصنيفات.");
                return;
            }
            const categoryId = uiElements.editCategoryIdInput.value;
            const newName = uiElements.editCategoryNameInput.value.trim();

            if (!newName) {
                alertUserMessage("الرجاء إدخال اسم التصنيف.", 'error');
                return;
            }

            await updateCategory(categoryId, newName);
            setTimeout(() => {
                if (uiElements.editCategoryModal) uiElements.editCategoryModal.classList.add('hidden');
            }, 1500);
        });
    }

    // Admin add category form
    if (uiElements.addCategoryForm) {
        uiElements.addCategoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!isAdmin) {
                alertUserMessage("ليس لديك صلاحية إضافة تصنيفات.");
                return;
            }
            const categoryName = uiElements.newCategoryNameInput.value.trim();
            if (!categoryName) {
                alertUserMessage("الرجاء إدخال اسم التصنيف.", 'error');
                return;
            }
            try {
                const categoriesColRef = collection(db, `categories`);
                await addDoc(categoriesColRef, {
                    name: categoryName,
                    createdAt: new Date().toISOString()
                });
                alertUserMessage("تم إضافة التصنيف بنجاح!", 'success');
                if (uiElements.addCategoryForm) uiElements.addCategoryForm.reset();
                setTimeout(() => {
                    if (uiElements.addCategoryModal) uiElements.addCategoryModal.classList.add('hidden');
                }, 1500);
            } catch (error) {
                console.error("Error adding category:", error);
                alertUserMessage(`فشل إضافة التصنيف: ${error.message}`, 'error');
            }
        });
    }

    // Admin edit product form
    if (uiElements.editProductForm) {
        uiElements.editProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!isAdmin) {
                alertUserMessage("ليس لديك صلاحية تعديل المنتجات.");
                return;
            }
            const productId = uiElements.editProductIdInput.value;
            const name = uiElements.editProductNameInput.value.trim();
            const description = uiElements.editProductDescriptionInput.value.trim();
            const price = parseFloat(uiElements.editProductPriceInput.value);
            const category = uiElements.editProductCategorySelect.value;
            const freeDelivery = document.getElementById('edit-product-free-delivery').checked;
            const removeWhiteBackground = document.getElementById('edit-product-remove-white-bg').checked;
            const availability = document.getElementById('edit-product-availability').value;

            // جمع روابط الصور الخمسة
            const imageUrls = [];
            for (let i = 1; i <= 5; i++) {
                const imageInput = document.getElementById(`edit-product-image-url-${i}`);
                if (imageInput && imageInput.value.trim()) {
                    imageUrls.push(imageInput.value.trim());
                }
            }

            if (!productId || !name || !description || isNaN(price) || price <= 0 || imageUrls.length === 0 || !category) {
                alertUserMessage('الرجاء تعبئة جميع الحقول بشكل صحيح وإدخال رابط الصورة الرئيسية على الأقل.', 'error');
                return;
            }

            try {
                const productDocRef = doc(db, `products`, productId);
                await updateDoc(productDocRef, {
                    name,
                    description,
                    price,
                    imageUrls, // استخدام مجموعة الصور الجديدة
                    imageUrl: imageUrls[0], // الاحتفاظ بالحقل القديم للتوافق
                    category,
                    freeDelivery,
                    removeWhiteBackground,
                    availability: availability || ''
                });
                alertUserMessage('تم تعديل المنتج بنجاح!', 'success');
                setTimeout(() => {
                    if (uiElements.editProductModal) uiElements.editProductModal.classList.add('hidden');
                }, 1500);
            } catch (error) {
                console.error("Error updating product:", error);
                alertUserMessage(`فشل تعديل المنتج: ${error.message}`, 'error');
            }
        });
    }

    // Reviews
    if (uiElements.bottomReviewsBtn) {
        uiElements.bottomReviewsBtn.addEventListener('click', () => {
            if (uiElements.reviewsModal) uiElements.reviewsModal.classList.remove('hidden');
            displayReviews(reviewsData);
        });
    }
    if (uiElements.addReviewBtn) {
        uiElements.addReviewBtn.addEventListener('click', () => {
            if (userId && currentUserProfile) {
                if (uiElements.addReviewModal) uiElements.addReviewModal.classList.remove('hidden');
                if (uiElements.addReviewForm) uiElements.addReviewForm.reset();
                if (uiElements.reviewRatingDisplay) uiElements.reviewRatingDisplay.textContent = '5';
                if (uiElements.reviewRatingInput) uiElements.reviewRatingInput.value = '5';
            } else {
                alertUserMessage("الرجاء تسجيل الدخول أولاً لإضافة تقييم.", 'warning');
            }
        });
    }
    if (uiElements.reviewRatingInput) {
        uiElements.reviewRatingInput.addEventListener('input', () => {
            if (uiElements.reviewRatingDisplay) uiElements.reviewRatingDisplay.textContent = uiElements.reviewRatingInput.value;
        });
    }

    if (uiElements.addReviewForm) {
        uiElements.addReviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!userId) {
                alertUserMessage("الرجاء تسجيل الدخول لإضافة تقييم.", 'warning');
                return;
            }
            const reviewText = uiElements.reviewTextInput.value.trim();
            const reviewRating = parseInt(uiElements.reviewRatingInput.value);

            if (!reviewText || isNaN(reviewRating) || reviewRating < 1 || reviewRating > 5) {
                alertUserMessage('الرجاء كتابة تقييم وتحديد تقييم من 1 إلى 5 نجوم.', 'error');
                return;
            }

            try {
                await addDoc(collection(db, `reviews`), {
                    userId: userId,
                    userName: currentUserProfile ? currentUserProfile.fullName : 'مستخدم',
                    rating: reviewRating,
                    text: reviewText,
                    createdAt: new Date().toISOString()
                });
                alertUserMessage("تم إضافة تقييمك بنجاح!", 'success');
                if (uiElements.addReviewForm) uiElements.addReviewForm.reset();
                if (uiElements.reviewRatingInput) uiElements.reviewRatingInput.value = '5';
                if (uiElements.reviewRatingDisplay) uiElements.reviewRatingDisplay.textContent = '5';
                setTimeout(() => {
                    if (uiElements.addReviewModal) uiElements.addReviewModal.classList.add('hidden');
                }, 1500);
            } catch (error) {
        console.error("Error adding review:", error);
        if (error.code === 'permission-denied') {
            alertUserMessage("خطأ في الأذونات: يرجى التحقق من قواعد أمان Firebase. تأكد من أن المستخدمين المسجلين يمكنهم إضافة التقييمات.", 'error');
        } else {
            alertUserMessage(`فشل إضافة التقييم: ${error.message}`, 'error');
        }
    }
        });
    }

    // Search functionality
    const performSearch = () => {
        const query = uiElements.mainSearchInput.value.toLowerCase().trim();
        const filtered = productsData.filter(product =>
            product.name.toLowerCase().includes(query) ||
            product.description.toLowerCase().includes(query)
        );
        displayProducts(filtered);
        document.getElementById('products').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    if (uiElements.mainSearchInput) {
        uiElements.mainSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }

    // Categories dropdown toggle
    if (uiElements.bottomCategoriesBtn) {
        uiElements.bottomCategoriesBtn.addEventListener('click', () => {
            if (uiElements.categoriesDropdown) {
                uiElements.categoriesDropdown.classList.toggle('hidden');
            }
        });
    }

    // Home button
    if (uiElements.bottomHomeBtn) {
        uiElements.bottomHomeBtn.addEventListener('click', () => {
            document.getElementById('top').scrollIntoView({ behavior: 'smooth' });
            
            // إزالة كلاس الماوس بادات عند العودة للصفحة الرئيسية
            const bodyElement = document.body;
            bodyElement.classList.remove('mousepads-category');
            
            displayProducts(productsData); // Show all products
        });
    }
};

// Make functions available globally for HTML onclick events
window.removeDeveloper = removeDeveloper;

// Initialize on window load
window.onload = async () => {
    // Wait for DOM to be fully loaded
    await new Promise(resolve => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', resolve);
        } else {
            resolve();
        }
    });

    // Initialize UI elements
    uiElements = {
        // Header elements
        loginProfileBtn: getUiElement('login-profile-btn'),
        loginProfileText: getUiElement('login-profile-text'),
        headerCartBtn: getUiElement('header-cart-btn'),
        headerCartCount: getUiElement('header-cart-count'),
        mainSearchInput: getUiElement('main-search-input'),

        // Products container - IMPORTANT: This was missing!
        productsContainer: getUiElement('products-container'),

        // Modals
        loginModal: getUiElement('login-modal'),
        loginForm: getUiElement('login-form'),
        fullNameInput: getUiElement('full-name'),
        phoneNumberInput: getUiElement('phone-number'),
        loginMessage: getUiElement('login-message'),

        profileDetailsModal: getUiElement('profile-details-modal'),
        profileDetailsImage: getUiElement('profile-details-image'),
        profileDetailsName: getUiElement('profile-details-name'),
        profileDetailsPhone: getUiElement('profile-details-phone'),
        profileDetailsRegisteredDate: getUiElement('profile-details-registered-date'),
        profileDetailsLogoutBtn: getUiElement('profile-details-logout-btn'),
        profileDetailsLoginBtn: getUiElement('profile-details-login-btn'),
        developerStatus: getUiElement('developer-status'),
        userCountDisplay: getUiElement('user-count-display'),
        userCount: getUiElement('user-count'),

        shoppingCartModal: getUiElement('shopping-cart-modal'),
        cartItemsContainer: getUiElement('cart-items'),
        cartTotalElement: getUiElement('cart-total'),
        cartSummaryDiv: getUiElement('cart-summary'),
        checkoutButton: getUiElement('checkout-btn'),

        productDetailModal: getUiElement('product-detail-modal'),
        productDetailName: getUiElement('product-detail-name'),
        // productDetailImage: removed - now using main image and thumbnails
        productDetailCategory: getUiElement('product-detail-category'),
        productDetailDescription: getUiElement('product-detail-description'),
        productDetailPrice: getUiElement('product-detail-price'),
        addToCartDetailBtn: getUiElement('add-to-cart-detail-btn'),
        buyNowDetailBtn: getUiElement('buy-now-detail-btn'),

        checkoutModal: getUiElement('checkout-modal'),
        checkoutForm: getUiElement('checkout-form'),
        checkoutNameInput: getUiElement('checkout-name'),
        checkoutPhoneInput: getUiElement('checkout-phone'),
        checkoutGovernorateSelect: getUiElement('checkout-governorate'),
        checkoutDistrictInput: getUiElement('checkout-district'),
        checkoutNotesTextarea: getUiElement('checkout-notes'),
        checkoutProductsList: getUiElement('checkout-products-list'),
        checkoutGrandTotal: getUiElement('checkout-grand-total'),
        confirmOrderBtn: getUiElement('confirm-order-btn'),
        checkoutMessage: getUiElement('checkout-message'),

        editCategoryModal: getUiElement('edit-category-modal'),
        editCategoryForm: getUiElement('edit-category-form'),
        editCategoryIdInput: getUiElement('edit-category-id'),
        editCategoryNameInput: getUiElement('edit-category-name'),
        editCategoryMessage: getUiElement('edit-category-message'),

        addCategoryModal: getUiElement('add-category-modal'),
        newCategoryNameInput: getUiElement('new-category-name'),
        addCategoryForm: getUiElement('add-category-form'),
        addCategoryMessage: getUiElement('add-category-message'),

        addProductModal: getUiElement('add-product-modal'),
        addProductForm: getUiElement('add-product-form'),
        productNameInput: getUiElement('product-name'),
        productDescriptionInput: getUiElement('product-description'),
        productPriceInput: getUiElement('product-price'),
        // productImageUrlInput: removed - now using multiple inputs
        productCategorySelect: getUiElement('product-category'),
        addProductMessage: getUiElement('add-product-message'),

        editProductModal: getUiElement('edit-product-modal'),
        editProductForm: getUiElement('edit-product-form'),
        editProductIdInput: getUiElement('edit-product-id'),
        editProductNameInput: getUiElement('edit-product-name'),
        editProductDescriptionInput: getUiElement('edit-product-description'),
        editProductPriceInput: getUiElement('edit-product-price'),
        // editProductImageUrlInput: removed - now using multiple inputs
        editProductCategorySelect: getUiElement('edit-product-category'),
        editProductMessage: getUiElement('edit-product-message'),

        reviewsModal: getUiElement('reviews-modal'),
        reviewsList: getUiElement('reviews-list'),
        addReviewBtn: getUiElement('add-review-btn'),

        addReviewModal: getUiElement('add-review-modal'),
        addReviewForm: getUiElement('add-review-form'),
        reviewTextInput: getUiElement('review-text'),
        reviewRatingInput: getUiElement('review-rating'),
        reviewRatingDisplay: getUiElement('review-rating-display'),
        addReviewMessage: getUiElement('add-review-message'),

        // Bottom Navigation
        bottomHomeBtn: getUiElement('bottom-home-btn'),
        bottomCategoriesBtn: getUiElement('bottom-categories-btn'),
        categoriesDropdown: getUiElement('categories-dropdown'),
        bottomReviewsBtn: getUiElement('bottom-reviews-btn'),
        developerButtons: getUiElement('developer-buttons'),
        bottomAddCategoryBtn: getUiElement('bottom-add-category-btn'),
        bottomAddProductBtn: getUiElement('bottom-add-product-btn'),
        manageDevelopersBtn: getUiElement('manage-developers-btn'),

        // Message Box
        messageBox: getUiElement('message-box'),
        messageBoxText: getUiElement('message-box-text'),
        messageBoxConfirmBtn: getUiElement('message-box-confirm'),
        messageBoxCancelBtn: getUiElement('message-box-cancel'),
    };

    // Populate Iraqi Governorates dropdown
    if (uiElements.checkoutGovernorateSelect) {
        iraqiGovernorates.forEach(gov => {
            const option = document.createElement('option');
            option.value = gov;
            option.textContent = gov;
            uiElements.checkoutGovernorateSelect.appendChild(option);
        });
    }

    setupEventListeners();
    await initializeFirebase();
};
