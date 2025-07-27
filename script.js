(function() {

    const firebaseConfig = {
          apiKey: "AIzaSyD96QIYCM54fOjGszqK9nI-jpf55Xd3kWE",
          authDomain: "mark-3203d.firebaseapp.com",
          projectId: "mark-3203d",
          storageBucket: "mark-3203d.firebasestorage.app",
          messagingSenderId: "525805800075",
          appId: "1:525805800075:web:121f8e5fc96f4f245a628e",
          measurementId: "G-SEERQJ9J1B"
    };

    const TELEGRAM_BOT_TOKEN = '7866943018:AAG2aHJ6dbeAaMEqDrnZP8U1VtHfC1O2_cY'; 
    const TELEGRAM_CHAT_ID = '-1002744803377'; // ضع هنا ID الكروب (يبدأ بـ -)

    let discountCodesData = [];
    let appliedDiscount = null;

    let telegramHandler = null;

    const updateUserCompletedOrders = async (userId) => {
        try {
            if (!userId || !db) return;

            const userDocRef = doc(db, `users/${userId}/userProfile`, userId);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const currentOrders = userDocSnap.data().completedOrders || 0;
                await updateDoc(userDocRef, {
                    completedOrders: currentOrders + 1
                });
                console.log(`تم تحديث عدد الطلبات المكتملة للمستخدم ${userId}: ${currentOrders + 1}`);

                if (userId === window.currentUserId) {
                    await fetchUserProfile(userId);
                }
            }
        } catch (error) {
            console.error("خطأ في تحديث النقاط:", error);
        }
    };

    window.updateUserCompletedOrders = updateUserCompletedOrders;

    let app;
    let auth;
    let db;
    let userId = null;
    let isAdmin = false;
    let firebaseInitialized = false;
    let currentUserProfile = null;
    window.currentUserId = null;
    let welcomeModalShown = false;
    let productRatingsData = [];

    let firebaseReadyPromise;
    let resolveFirebaseReady;

    let getAuth, signInAnonymously, onAuthStateChanged, signOut;
    let getFirestore, doc, getDoc, setDoc, addDoc, collection, query, onSnapshot, deleteDoc, updateDoc, getDocs;
    let getAnalytics;

    firebaseReadyPromise = new Promise(resolve => {
        resolveFirebaseReady = resolve;
    });

    let uiElements = {};

    let currentCart = [];
    let productsData = [];
    let reviewsData = [];
    let currentReviewIndex = 0;
    let reviewAutoChangeInterval;
    let offersData = [];
    let currentOfferIndex = 0;
    let userFavorites = [];

    const notificationMessages = [
        { text: "استمتع بتجربتك معنا. اطلب الان! &#128522;", iconHtml: '<svg class="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>' },
        { text: "جوده لا مثيل لها و ضمان.", iconHtml: '<svg class="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' },
    ];
    let notificationInterval;
    let currentNotificationIndex = 0;


    const updateNotification = () => {
        if (uiElements.notificationText && uiElements.notificationIconContainer) {
            const notification = notificationMessages[currentNotificationIndex];
            uiElements.notificationText.innerHTML = notification.text;
            uiElements.notificationIconContainer.innerHTML = notification.iconHtml;
            currentNotificationIndex = (currentNotificationIndex + 1) % notificationMessages.length;
        }
    };


    const setupRealtimeListeners = () => {

        const productsColRef = collection(db, `products`);
        onSnapshot(productsColRef, (snapshot) => {
            productsData = [];
            snapshot.forEach((doc) => {
                productsData.push({ id: doc.id, ...doc.data() });
            });
            console.log("Products data fetched:", productsData);
            // ترتيب المنتجات من الأحدث إلى الأقدم بناءً على تاريخ الإضافة
            const sortedProducts = [...productsData].sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt.seconds * 1000) : new Date(0);
                const dateB = b.createdAt ? new Date(b.createdAt.seconds * 1000) : new Date(0);
                return dateB - dateA; // ترتيب تنازلي (من الأحدث للأقدم)
            });

            // عرض أحدث 10 منتجات فقط في الصفحة الرئيسية
            displayProducts(sortedProducts.slice(0, 10));

            // إضافة زر لعرض جميع المنتجات
            const showAllContainer = document.getElementById('show-all-products-container');
            if (showAllContainer) {
                if (productsData.length > 10) {
                    showAllContainer.innerHTML = `
                        <button id="show-all-products-btn" class="bg-indigo-600 text-white py-3 px-8 rounded-lg font-semibold hover:bg-indigo-700 transition duration-300 shadow-md transform hover:scale-105">
                            عرض جميع المنتجات (${productsData.length})
                        </button>
                    `;
                    document.getElementById('show-all-products-btn').addEventListener('click', () => {
                        displayProducts(productsData, true);
                        showAllContainer.innerHTML = '';
                    });

                } else {
                    showAllContainer.innerHTML = '';
                }
            }
        }, (error) => {
            console.error("Error fetching products:", error);
            uiElements.productsContainer.innerHTML = '<p class="col-span-full text-center text-red-500">فشل تحميل المنتجات.</p>';
        });

        if (userId) {
            const cartColRef = collection(db, `users/${userId}/cart`);
            onSnapshot(cartColRef, (snapshot) => {
                currentCart = [];
                snapshot.forEach((doc) => {
                    currentCart.push({ id: doc.id, ...doc.data() });
                });
                console.log("Cart data fetched:", currentCart);
                displayCart();
            }, (error) => {
                console.error("Error fetching cart:", error);
            });
        }
    };

    const initializeFirebase = async () => {
        try {
            if (typeof window.firebase === 'undefined') {
                console.error("Firebase SDK not loaded properly");
                if (resolveFirebaseReady) resolveFirebaseReady(false);
                return;
            }

            if (!window.firebase.initializeApp || !window.firebase.auth || !window.firebase.firestore || !window.firebase.analytics) {
                console.error("Firebase services not available");
                if (resolveFirebaseReady) resolveFirebaseReady(false);
                return;
            }

            const { initializeApp } = window.firebase;

            ({ getAuth, signInAnonymously, onAuthStateChanged, signOut } = window.firebase.auth);
            ({ getFirestore, doc, getDoc, setDoc, addDoc, collection, query, onSnapshot, deleteDoc, updateDoc, getDocs } = window.firebase.firestore);
            ({ getAnalytics } = window.firebase.analytics);

            if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
                console.error("Custom Firebase config is missing or incomplete. Please update MY_FIREBASE_CONFIG with your project details.");
                alertUserMessage("خطأ: إعدادات Firebase الخاصة بك مفقودة أو غير مكتملة. الرجاء تحديثها في الكود.", 'error');
                resolveFirebaseReady(false);
                return;
            }

            app = initializeApp(firebaseConfig);
            console.log("Firebase app initialized successfully");

            if (!app) {
                console.error("Firebase app object is undefined after initialization. Check config or Firebase SDK loading.");
                alertUserMessage("فشل تهيئة تطبيق Firebase بشكل صحيح. الرجاء مراجعة الإعدادات.", 'error');
                resolveFirebaseReady(false);
                return;
            }

            auth = getAuth(app);
            db = getFirestore(app);
            const analytics = getAnalytics(app);

            if (!auth || !db) {
                console.error("Failed to initialize Firebase services");
                alertUserMessage("فشل تهيئة خدمات Firebase", 'error');
                resolveFirebaseReady(false);
                return;
            }

            firebaseInitialized = true;
            console.log("Firebase services (app, auth, db) initialized with custom config.");

            const userCredential = await signInAnonymously(auth);
            console.log("Anonymous sign-in successful:", userCredential.user.uid);

            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (user) {
                    userId = user.uid;
                    window.currentUserId = userId;
                    console.log("Authenticated with UID:", userId);
                    await fetchUserProfile(userId);
                    await fetchAdminStatus();
                    setupRealtimeListeners();
                    fetchUserFavorites();
            fetchProductRatings();
                } else {
                    userId = null;
                    window.currentUserId = null;
                    isAdmin = false;
                    console.log("User logged out or not authenticated.");
                    updateUIForLoggedOutUser();
                }
                if (firebaseReadyPromise && !firebaseReadyPromise._isResolved) {
                     resolveFirebaseReady(true);
                     firebaseReadyPromise._isResolved = true;
                }
            });

            setTimeout(() => {
                if (firebaseReadyPromise && !firebaseReadyPromise._isResolved) {
                    resolveFirebaseReady(true);
                    firebaseReadyPromise._isResolved = true;
                }
            }, 5000);

        } catch (error) {
            console.error("Error initializing Firebase (outer catch):", error);
            alertUserMessage(`خطأ فادح أثناء تهيئة Firebase: ${error.message}. تأكد من أن إعداداتك صحيحة وأن Firebase مُمكّن.`, 'error');
            resolveFirebaseReady(false);
        }
    };

    const fetchUserProfile = async (uid) => {
        try {
            const userDocRef = doc(db, `users/${uid}/userProfile`, uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                currentUserProfile = userData;
                uiElements.profileDetailsName.textContent = userData.fullName || 'Guest User';
                uiElements.profileDetailsPhone.textContent = userData.phoneNumber || 'N/A';
                uiElements.profileDetailsImage.src = userData.profilePicUrl || 'https://placehold.co/100x100/eeeeee/333333?text=User';

                if (userData.createdAt) {
                    const date = new Date(userData.createdAt);
                    uiElements.profileDetailsRegisteredDate.textContent = `تاريخ التسجيل: ${date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })} في ${date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
                } else {
                    uiElements.profileDetailsRegisteredDate.textContent = 'تاريخ التسجيل: غير متوفر';
                }


                const completedOrders = userData.completedOrders || 0;
                uiElements.profileDetailsCompletedOrders.textContent = `العمليات الشراء المكتملة: ${completedOrders}`;

                uiElements.profileDetailsLogoutBtn.classList.remove('hidden');
                uiElements.profileDetailsLoginBtn.classList.add('hidden');

                // إظهار أزرار التعديل للمستخدم الحالي فقط وحسب حالة التعديل
                if (window.currentUserId && window.currentUserId === userId) {
                    // إظهار زر تعديل الاسم فقط إذا لم يتم تعديله مسبقاً
                    const editNameBtn = document.getElementById('edit-name-btn');
                    if (editNameBtn) {
                        if (userData.nameChanged) {
                            editNameBtn.classList.add('hidden');
                        } else {
                            editNameBtn.classList.remove('hidden');
                        }
                    }

                    // إظهار زر تعديل الهاتف فقط إذا لم يتم تعديله مسبقاً
                    const editPhoneBtn = document.getElementById('edit-phone-btn');
                    if (editPhoneBtn) {
                        if (userData.phoneChanged) {
                            editPhoneBtn.classList.add('hidden');
                        } else {
                            editPhoneBtn.classList.remove('hidden');
                        }
                    }
                } else {
                    document.getElementById('edit-name-btn').classList.add('hidden');
                    document.getElementById('edit-phone-btn').classList.add('hidden');
                }

                updateAddReviewButtonVisibility();

            } else {
                currentUserProfile = null;
                uiElements.profileDetailsName.textContent = 'مستخدم غير مسجل';
                uiElements.profileDetailsPhone.textContent = 'الرجاء تسجيل الدخول';
                uiElements.profileDetailsRegisteredDate.textContent = '';
                uiElements.profileDetailsImage.src = 'https://placehold.co/100x100/eeeeee/333333?text=User';
                uiElements.profileDetailsLogoutBtn.classList.add('hidden');
                uiElements.profileDetailsLoginBtn.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            alertUserMessage(`خطأ في جلب بيانات الملف الشخصي: ${error.message}`, 'error');
        }
    };

    const fetchAdminStatus = async () => {
        try {
            const settingsDocRef = doc(db, `settings`, 'appSettings');
            const settingsDocSnap = await getDoc(settingsDocRef);
            if (settingsDocSnap.exists()) {
                const settingsData = settingsDocSnap.data();
                if (settingsData.adminId === userId) {
                    isAdmin = true;
                    uiElements.adminControlsSection.classList.remove('hidden');
                    console.log("Current user is admin.");
                } else {
                    isAdmin = false;
                    uiElements.adminControlsSection.classList.add('hidden');
                    console.log("Current user is not admin.");
                }
            } else {
                if (userId) {
                    await setDoc(settingsDocRef, {
                        adminId: userId,
                        createdAt: new Date().toISOString()
                    });
                    isAdmin = true;
                    uiElements.adminControlsSection.classList.remove('hidden');
                    console.log("First user registered as admin.");
                } else {
                    isAdmin = false;
                    uiElements.adminControlsSection.classList.add('hidden');
                    console.log("No admin set yet.");
                }
            }
        }
        catch (error) {
            console.error("Error fetching admin status:", error);
            isAdmin = false;
            uiElements.adminControlsSection.classList.add('hidden');
        }
    };

    const updateUIForLoggedOutUser = () => {
        uiElements.adminControlsSection.classList.add('hidden');
        uiElements.productsContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">الرجاء تسجيل الدخول لعرض المنتجات.</p>';
        uiElements.cartItemsContainer.innerHTML = '<p class="text-center text-gray-500">الرجاء تسجيل الدخول لعرض سلة التسوق.</p>';
        uiElements.cartCountBottom.textContent = '0';
        uiElements.cartTotalElement.textContent = '0 د.ع';
        uiElements.cartSummaryDiv.classList.add('hidden');
        uiElements.checkoutButton.classList.add('hidden');

        uiElements.profileDetailsName.textContent = 'مستخدم غير مسجل';
        uiElements.profileDetailsPhone.textContent = 'الرجاء تسجيل الدخول';
        uiElements.profileDetailsRegisteredDate.textContent = '';
        uiElements.profileDetailsImage.src = 'https://placehold.co/100x100/eeeeee/333333?text=User';
        uiElements.profileDetailsLogoutBtn.classList.add('hidden');
        uiElements.profileDetailsLoginBtn.classList.remove('hidden');

        if (uiElements.addReviewBtn) {
            uiElements.addReviewBtn.classList.add('hidden');
        }
    };

    // دالة مساعدة لترتيب المنتجات وعرض أحدثها فقط
    const getLatestProducts = (products, limit = 10) => {
        return [...products].sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt.seconds * 1000) : new Date(0);
            const dateB = b.createdAt ? new Date(b.createdAt.seconds * 1000) : new Date(0);
            return dateB - dateA; // ترتيب تنازلي (من الأحدث للأقدم)
        }).slice(0, limit);
    };

    const displayProducts = (products, showAll = false) => {
        uiElements.productsContainer.innerHTML = '';
        if (products.length === 0) {
            uiElements.productsContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">لا توجد منتجات لعرضها حاليًا.</p>';
            return;
        }
        products.forEach(product => {
            const formattedPrice = product.price.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});

            let availabilityHTML = '';
            let isAvailable = true;
            if (product.availability === 'sold-out') {
                availabilityHTML = '<span class="availability-badge bg-red-500 text-white">مباع</span>';
                isAvailable = false;
            } else if (product.availability === 'available') {
                availabilityHTML = '<span class="availability-badge bg-green-500 text-white">متوفر</span>';
            }

            const freeDeliveryHTML = product.freeDelivery ? '<span class="free-delivery-badge bg-blue-500 text-white">توصيل مجاني</span>' : '';

            const isFavorite = userFavorites.includes(product.id);
            const favoriteColor = isFavorite ? 'text-red-500' : 'text-gray-400';


            const category = categoriesData.find(cat => cat.id === product.categoryId);
            const categoryHTML = category ? `<p class="text-xs text-gray-600 mb-1">التصنيف: ${category.name}</p>` : '';

            // حساب متوسط التقييمات للمنتج
            const productRatings = productRatingsData.filter(rating => rating.productId === product.id);
            let averageRating = 0;
            let ratingHTML = '';

            if (productRatings.length > 0) {
                const totalRating = productRatings.reduce((sum, rating) => sum + rating.rating, 0);
                averageRating = totalRating / productRatings.length;

                ratingHTML = `
                    <div class="flex items-center justify-center mb-2">
                        <div class="flex">
                            ${Array(5).fill(0).map((_, i) => `
                                <svg class="w-4 h-4 ${i < Math.round(averageRating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.729c-.783-.57-.381-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z"/>
                                </svg>
                            `).join('')}
                        </div>
                        <span class="text-sm text-gray-600 mr-2">(${productRatings.length})</span>
                    </div>
                `;
            }

            const productCard = `
                <div id="product-${product.id}" class="product-card bg-white rounded-2xl shadow-xl overflow-hidden transform transition duration-300 hover:scale-105 hover:shadow-2xl cursor-pointer">
                    <div class="relative product-image-container" data-product-id="${product.id}">
                        <img src="${product.imageUrl || 'https://placehold.co/600x400/eeeeee/333333?text=Product'}" alt="${product.name}" class="w-full h-64 object-contain bg-gray-50" onerror="this.onerror=null;this.src='https://placehold.co/600x400/eeeeee/333333?text=Product';">
                        ${availabilityHTML}
                        ${freeDeliveryHTML}
                        <div class="absolute top-2 right-2">
                            <button data-product-id="${product.id}" class="favorite-btn ${favoriteColor} hover:text-red-500 transition duration-300 bg-white rounded-full p-2 shadow-lg">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                                </svg>
                            </button>
                        </div>
                        <div class="absolute top-2 left-2">
                            <span class="text-sm font-semibold text-gray-700 bg-white px-3 py-1 rounded-full shadow-lg">${product.brand || 'براند'}</span>
                        </div>
                    </div>
                    <div class="p-4 product-info-section" data-product-id="${product.id}">
                        ${ratingHTML}
                        <h3 class="text-lg font-semibold text-gray-900">${product.name}</h3>
                        ${categoryHTML}
                        <p class="text-xs text-gray-500 mb-2">اضغط على المنتج لتعرف كافة التفاصيل</p>
                        <div class="flex justify-center items-center mb-3">
                            ${product.hasDiscount && product.originalPrice ? `
                                <div class="price-container">
                                    <span class="original-price">${product.originalPrice.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} د.ع</span>
                                    <span class="discounted-price">${formattedPrice} د.ع</span>
                                </div>
                            ` : `
                                <span class="text-xl font-bold text-indigo-700">${formattedPrice} د.ع</span>
                            `}
                        </div>
                        ${isAvailable ? `
                        <div class="flex gap-2">
                            <button data-product-id="${product.id}" class="add-to-cart-btn flex-1 bg-indigo-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-indigo-700 transition duration-300 flex items-center justify-center gap-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 0a2 2 0 100 4 2 2 0 000-4z"></path>
                                </svg>
                                <span class="text-sm">للسلة</span>
                            </button>
                            <button data-product-id="${product.id}" class="buy-now-btn flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition duration-300 flex items-center justify-center gap-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                                </svg>
                                <span class="text-sm">اشتري</span>
                            </button>
                        </div>
                        ` : ''}
                        ${isAdmin ? `
                        <div class="flex gap-2 mt-2">
                            <button data-product-id="${product.id}" class="edit-single-product-btn w-1/2 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition duration-300 shadow-md">
                                تعديل
                            </button>
                            <button data-product-id="${product.id}" class="delete-single-product-btn w-1/2 bg-red-500 text-white py-2 rounded-lg font-semibold hover:bg-red-600 transition duration-300 shadow-md">
                                حذف
                            </button>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
            uiElements.productsContainer.innerHTML += productCard;
        });

        document.querySelectorAll('.product-info-section, .product-image-container').forEach(element => {
            element.addEventListener('click', (e) => {
                if (e.target.closest('button')) {
                    return;
                }
                const productId = e.currentTarget.dataset.productId;
                const product = productsData.find(p => p.id === productId);
                if (product) {
                    openProductDetailsModal(product);
                }
            });
        });

        document.querySelectorAll('.add-to-cart-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const productId = e.currentTarget.dataset.productId;
                const productToAdd = productsData.find(p => p.id === productId);
                if (productToAdd && userId) {
                    await addToCart(productToAdd);
                } else if (!userId) {
                    alertUserMessage("الرجاء تسجيل الدخول أولاً لإضافة منتجات إلى السلة.");
                }
            });
        });

        document.querySelectorAll('.buy-now-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const productId = e.currentTarget.dataset.productId;
                const productToBuy = productsData.find(p => p.id === productId);
                if (!userId) {
                    alertUserMessage("يجب تسجيل الدخول لتتمكن من الشراء الآن.", 'warning');
                    return;
                }
                if (productToBuy && userId && currentUserProfile) {
                    await addToCart(productToBuy);
                    populateCheckoutModal();
                    uiElements.checkoutModal.classList.remove('hidden');
                }
            });
        });

        document.querySelectorAll('.favorite-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!userId) {
                    alertUserMessage("الرجاء تسجيل الدخول أولاً لإضافة المنتجات إلى المفضلات.", 'warning');
                    return;
                }
                const productId = e.currentTarget.dataset.productId;
                await toggleFavorite(productId);
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

    const displayCart = () => {
        uiElements.cartItemsContainer.innerHTML = '';
        let total = 0;
        let itemCount = 0;

        if (currentCart.length === 0) {
            uiElements.cartItemsContainer.innerHTML = '<p class="text-center text-gray-500">سلة التسوق فارغة.</p>';
            uiElements.cartSummaryDiv.classList.add('hidden');
            uiElements.checkoutButton.classList.add('hidden');
        } else {
            currentCart.forEach(item => {
                const itemTotal = item.price * item.quantity;
                total += itemTotal;
                itemCount += item.quantity;
                const formattedItemPrice = item.price.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
                const formattedItemTotal = itemTotal.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});

                const cartItemHtml = `
                    <div class="flex items-center justify-between border-b border-gray-200 py-3">
                        <div class="flex items-center">
                            <img src="${item.imageUrl || 'https://placehold.co/50x50/eeeeee/333333?text=Item'}" alt="${item.name}" class="w-12 h-12 object-cover rounded-md me-4" onerror="this.onerror=null;this.src='https://placehold.co/50x50/eeeeee/333333?text=Item';">
                            <div>
                                <h4 class="font-semibold text-gray-800">${item.name}</h4>
                                <p class="text-sm text-gray-600">${formattedItemPrice} د.ع x ${item.quantity}</p>
                            </div>
                        </div>
                        <div class="flex items-center">
                            <span class="font-semibold text-gray-900">${formattedItemTotal} د.ع</span>
                            <button data-item-id="${item.id}" class="remove-from-cart-btn ms-4 text-red-500 hover:text-red-700 transition duration-200 focus:outline-none">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </div>
                `;
                uiElements.cartItemsContainer.innerHTML += cartItemHtml;
            });
            if (userId && currentUserProfile) {
                uiElements.cartSummaryDiv.classList.remove('hidden');
                uiElements.checkoutButton.classList.remove('hidden');
            } else {
                uiElements.cartSummaryDiv.classList.add('hidden');
                uiElements.checkoutButton.classList.add('hidden');
                uiElements.cartItemsContainer.innerHTML += '<p class="text-center text-sm text-gray-500 mt-4">يرجى تسجيل الدخول لإتمام عملية الشراء.</p>';
            }
        }

        uiElements.cartTotalElement.textContent = `${total.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} د.ع`;
        uiElements.cartCountBottom.textContent = itemCount;

        // تحديث عداد السلة في صفحة المنتج
        const productPageCartCount = document.getElementById('product-page-cart-count');
        if (productPageCartCount) {
            productPageCartCount.textContent = itemCount;
        }

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

    const openEditProductModal = (product) => {
        if (!isAdmin) return;
        if (!uiElements.editProductIdInput || !uiElements.editProductNameInput || !uiElements.editProductDescriptionInput || !uiElements.editProductPriceInput || !uiElements.editProductImageUrlInput || !uiElements.editProductMessage || !uiElements.editProductModal) {
            console.error("Edit product modal elements are not fully available.");
            alertUserMessage("لا يمكن فتح نافذة التعديل. خطأ في عناصر الواجهة.", 'error');
            return;
        }

        uiElements.editProductIdInput.value = product.id;
        uiElements.editProductNameInput.value = product.name;
        uiElements.editProductDescriptionInput.value = product.description;
        uiElements.editProductPriceInput.value = product.price;
        uiElements.editProductImageUrlInput.value = product.imageUrl;


        const hasDiscountCheckbox = document.getElementById('edit-product-has-discount');
        const originalPriceInput = document.getElementById('edit-product-original-price');
        const originalPriceContainer = document.getElementById('edit-original-price-container');

        if (product.hasDiscount) {
            hasDiscountCheckbox.checked = true;
            originalPriceInput.value = product.originalPrice || '';
            originalPriceContainer.classList.remove('hidden');
        } else {
            hasDiscountCheckbox.checked = false;
            originalPriceInput.value = '';
            originalPriceContainer.classList.add('hidden');
        }

        uiElements.editProductMessage.textContent = '';
        uiElements.editProductModal.classList.remove('hidden');
    };

    const deleteProduct = async (productId) => {
        if (!isAdmin){
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

    const populateCheckoutModal = () => {
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
        uiElements.checkoutDiscountCodeInput.value = '';
        appliedDiscount = null;

        if (uiElements.discountMessage) {
            uiElements.discountMessage.textContent = '';
            uiElements.discountMessage.className = 'text-sm mt-1 hidden';
        }

        updateCheckoutProductsList();
    };

    const updateCheckoutProductsList = () => {
        if (!uiElements.checkoutProductsList) return;

        uiElements.checkoutProductsList.innerHTML = '';
        let subtotal = 0;

        currentCart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;
            const formattedItemTotal = itemTotal.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
            const productItemHtml = `
                <div class="flex items-center space-x-2">
                    <img src="${item.imageUrl || 'https://placehold.co/40x40/eeeeee/333333?text=Item'}" alt="${item.name}" class="w-10 h-10 object-cover rounded-md" onerror="this.onerror=null;this.src='https://placehold.co/40x40/eeeeee/333333?text=Item';">
                    <span class="text-sm font-medium text-gray-800">${item.name} (x${item.quantity}) - ${formattedItemTotal} د.ع</span>
                </div>
            `;
            uiElements.checkoutProductsList.innerHTML += productItemHtml;
        });

        let discountAmount = 0;
        if (appliedDiscount) {
            discountAmount = Math.round(subtotal * (appliedDiscount.percentage / 100));
        }

        const finalSubtotal = subtotal - discountAmount;
        const deliveryFee = 5000;
        const total = finalSubtotal + deliveryFee;

        const pricingSummaryHtml = `
            <div class="mt-4 p-3 bg-gray-100 rounded-lg border-t">
                <div class="flex justify-between text-sm">
                    <span>المجموع الفرعي:</span>
                    <span>${subtotal.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} د.ع</span>
                </div>
                ${appliedDiscount ? `
                <div class="flex justify-between text-sm text-green-600">
                    <span>خصم (${appliedDiscount.code}):</span>
                    <span>-${discountAmount.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} د.ع</span>
                </div>
                ` : ''}
                <div class="flex justify-between text-sm">
                    <span>رسوم التوصيل:</span>
                    <span>${deliveryFee.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} د.ع</span>
                </div>
                <div class="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                    <span>المجموع الكلي:</span>
                    <span>${total.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} د.ع</span>
                </div>
            </div>
        `;

        uiElements.checkoutProductsList.innerHTML += pricingSummaryHtml;
    };

    let categoriesData = [];

    const fetchCategories = async () => {
        try {
            const categoriesColRef = collection(db, `categories`);
            onSnapshot(categoriesColRef, (snapshot) => {
                categoriesData = [];
                snapshot.forEach((doc) => {
                    categoriesData.push({ id: doc.id, ...doc.data() });
                });
                console.log("Categories data fetched:", categoriesData);
                displayCategories(categoriesData);
                populateCategoryOptions();
            }, (error) => {
                console.error("Error fetching categories:", error);
                uiElements.categoriesList.innerHTML = '<p class="text-center text-red-500">فشل تحميل التصنيفات.</p>';
            });
        } catch (error) {
            console.error("Error setting up categories listener:", error);
        }
    };

    const displayCategories = (categories) => {
        // تنظيف التصنيفات في الصفحة الرئيسية
        const mainCategoriesContainer = document.getElementById('categories-container');
        if (mainCategoriesContainer) {
            mainCategoriesContainer.innerHTML = '';
        }

        // تنظيف التصنيفات في النافذة المنبثقة
        const categoriesModalList = document.getElementById('categories-list-modal');
        const categoriesList = document.getElementById('categories-list');

        if (categoriesModalList) {
            categoriesModalList.innerHTML = '';
        }
        if (categoriesList) {
            categoriesList.innerHTML = '';
        }

        if (categories.length === 0) {
            if (mainCategoriesContainer) {
                mainCategoriesContainer.innerHTML = '<div class="text-center text-gray-500 col-span-full">لا توجد تصنيفات حالياً</div>';
            }
            if (categoriesModalList) {
                categoriesModalList.innerHTML = '<div class="text-center text-gray-500 col-span-full">لا توجد تصنيفات حالياً</div>';
            }
            if (categoriesList) {
                categoriesList.innerHTML = '<div class="text-center text-gray-500">لا توجد تصنيفات حالياً</div>';
            }
            return;
        }

        categories.forEach(category => {
            // عرض التصنيفات في الصفحة الرئيسية مع الصور
            if (mainCategoriesContainer) {
                const categoryItemHtml = `
                    <div class="category-item relative cursor-pointer transform transition-all duration-200 hover:scale-105" data-category-id="${category.id}">
                        <div class="relative aspect-square rounded-lg overflow-hidden shadow-md">
                            <img src="${category.imageUrl || 'https://placehold.co/150x150/e5e7eb/6b7280?text=' + encodeURIComponent(category.name)}" 
                                 alt="${category.name}" 
                                 class="w-full h-full object-contain bg-white"
                                 onerror="this.onerror=null;this.src='https://placehold.co/150x150/e5e7eb/6b7280?text=' + encodeURIComponent('${category.name}');">
                            <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                                <span class="category-name text-white text-sm font-semibold text-center block">${category.name}</span>
                            </div>
                            ${isAdmin ? `
                                <div class="absolute top-2 right-2 flex gap-1">
                                    <button onclick="openEditCategoryModal('${category.id}', '${category.name.replace(/'/g, "\\'")}', '${category.imageUrl || ''}')" class="bg-blue-500 hover:bg-blue-600 text-white p-1 rounded-full text-xs">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                        </svg>
                                    </button>
                                    <button onclick="deleteCategory('${category.id}')" class="bg-red-500 hover:bg-red-600 text-white p-1 rounded-full text-xs">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                        </svg>
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
                mainCategoriesContainer.innerHTML += categoryItemHtml;
            }

            // إضافة التصنيفات إلى القائمة المنبثقة
            const modalCategoryHtml = `
                <div class="category-item bg-white rounded-lg p-4 text-center shadow-md hover:shadow-lg transition-all cursor-pointer" data-category-id="${category.id}">
                    <div class="relative mb-3">
                        <img src="${category.imageUrl || 'https://placehold.co/80x80/e5e7eb/6b7280?text=' + encodeURIComponent(category.name)}" 
                             alt="${category.name}" 
                             class="w-16 h-16 object-contain bg-white rounded-lg mx-auto"
                             onerror="this.onerror=null;this.src='https://placehold.co/80x80/e5e7eb/6b7280?text=' + encodeURIComponent('${category.name}');">
                    </div>
                    <span class="category-name text-gray-800 text-sm font-medium">${category.name}</span>
                </div>
            `;

            if (categoriesModalList) {
                categoriesModalList.innerHTML += modalCategoryHtml;
            }

            // إضافة نفس التصنيف إلى categories-list للتوافق مع النافذة القديمة
            if (categoriesList) {
                const listCategoryHtml = `
                    <div class="category-item relative cursor-pointer transform transition-all duration-200 hover:scale-105 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg p-4 mb-3" data-category-id="${category.id}">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center">
                                <img src="${category.imageUrl || 'https://placehold.co/50x50/e5e7eb/6b7280?text=' + encodeURIComponent(category.name)}" 
                                     alt="${category.name}" 
                                     class="w-12 h-12 object-contain bg-white rounded-lg mr-3"
                                     onerror="this.onerror=null;this.src='https://placehold.co/50x50/e5e7eb/6b7280?text=' + encodeURIComponent('${category.name}');">
                                <span class="category-name text-white text-lg font-medium">${category.name}</span>
                            </div>
                            ${isAdmin ? `
                                <div class="flex gap-2">
                                    <button onclick="openEditCategoryModal('${category.id}', '${category.name.replace(/'/g, "\\'")}', '${category.imageUrl || ''}')" class="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full text-sm">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                        </svg>
                                    </button>
                                    <button onclick="deleteCategory('${category.id}')" class="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full text-sm">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                        </svg>
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
                categoriesList.innerHTML += listCategoryHtml;
            }
        });

        // إضافة مستمعي الأحداث للتصنيفات في الصفحة الرئيسية
        if (mainCategoriesContainer) {
            mainCategoriesContainer.querySelectorAll('.category-item').forEach(categoryItem => {
                categoryItem.addEventListener('click', (e) => {
                    // تجنب تنفيذ الحدث إذا تم النقر على أزرار الإدارة
                    if (e.target.closest('button')) {
                        return;
                    }
                    const categoryId = e.currentTarget.dataset.categoryId;
                    filterProductsByCategory(categoryId);
                    // استعادة عنوان "أحدث المنتجات" عند التصفية
                    const productsTitle = document.querySelector('#products h2');
                    if (productsTitle) {
                        const selectedCategory = categories.find(cat => cat.id === categoryId);
                        productsTitle.textContent = selectedCategory ? `منتجات ${selectedCategory.name}` : 'أحدث المنتجات';
                    }
                });
            });
        }

        // إضافة مستمعي الأحداث للقائمة المنبثقة
        if (categoriesModalList) {
            categoriesModalList.querySelectorAll('.category-item').forEach(categoryItem => {
                categoryItem.addEventListener('click', (e) => {
                    if (e.target.closest('button')) {
                        return;
                    }
                    const categoryId = e.currentTarget.dataset.categoryId;
                    filterProductsByCategory(categoryId);
                    // استعادة عنوان "أحدث المنتجات" عند التصفية
                    const productsTitle = document.querySelector('#products h2');
                    if (productsTitle) {
                        const selectedCategory = categories.find(cat => cat.id === categoryId);
                        productsTitle.textContent = selectedCategory ? `منتجات ${selectedCategory.name}` : 'أحدث المنتجات';
                    }
                    uiElements.categoriesModal.classList.add('hidden');
                });
            });
        }

        // إضافة مستمعي الأحداث لـ categories-list
        if (categoriesList) {
            categoriesList.querySelectorAll('.category-item').forEach(categoryItem => {
                categoryItem.addEventListener('click', (e) => {
                    if (e.target.closest('button')) {
                        return;
                    }
                    const categoryId = e.currentTarget.dataset.categoryId;
                    filterProductsByCategory(categoryId);
                    // استعادة عنوان "أحدث المنتجات" عند التصفية
                    const productsTitle = document.querySelector('#products h2');
                    if (productsTitle) {
                        const selectedCategory = categories.find(cat => cat.id === categoryId);
                        productsTitle.textContent = selectedCategory ? `منتجات ${selectedCategory.name}` : 'أحدث المنتجات';
                    }
                    uiElements.categoriesModal.classList.add('hidden');
                });
            });
        }
    };

    window.openEditCategoryModal = (categoryId, currentName, currentImageUrl) => {
        if (!isAdmin) return;

        // إنشاء نافذة تعديل التصنيف
        const editCategoryModal = document.createElement('div');
        editCategoryModal.className = 'modal-overlay';
        editCategoryModal.innerHTML = `
            <div class="modal-content bg-gray-800 max-w-md">
                <span class="modal-close-btn cursor-pointer text-2xl">&times;</span>
                <h3 class="text-2xl font-bold text-center text-gray-900 mb-6">تعديل التصنيف</h3>
                <form id="edit-category-form" class="space-y-4">
                    <div>
                        <label for="edit-category-name" class="block text-sm font-medium text-gray-700 mb-2">اسم التصنيف</label>
                        <input type="text" id="edit-category-name" value="${currentName}" 
                               class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900" 
                               required minlength="2" maxlength="50">
                    </div>
                    <div>
                        <label for="edit-category-image" class="block text-sm font-medium text-gray-700 mb-2">صورة التصنيف (URL)</label>
                        <input type="url" id="edit-category-image" value="${currentImageUrl || ''}" 
                               class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900" 
                               placeholder="أدخل رابط الصورة">
                    </div>
                    <div class="mt-2">
                        <div id="edit-category-image-preview" class="w-full h-40 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
                            ${currentImageUrl ? `<img src="${currentImageUrl}" alt="معاينة" class="max-w-full max-h-full object-contain">` : '<span class="text-gray-400">معاينة الصورة ستظهر هنا</span>'}
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <button type="submit" class="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-300">
                            حفظ التغييرات
                        </button>
                        <button type="button" class="flex-1 bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition duration-300" onclick="this.closest('.modal-overlay').remove()">
                            إلغاء
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(editCategoryModal);

        // إضافة معاينة الصورة
        const imageInput = editCategoryModal.querySelector('#edit-category-image');
        const imagePreview = editCategoryModal.querySelector('#edit-category-image-preview');

        imageInput.addEventListener('input', (e) => {
            const imageUrl = e.target.value.trim();
            if (imageUrl) {
                imagePreview.innerHTML = `<img src="${imageUrl}" alt="معاينة" class="max-w-full max-h-full object-contain" onerror="this.parentElement.innerHTML='<span class=&quot;text-red-400&quot;>خطأ في تحميل الصورة</span>';">`;
            } else {
                imagePreview.innerHTML = '<span class="text-gray-400">معاينة الصورة ستظهر هنا</span>';
            }
        });

        // إضافة الأحداث
        editCategoryModal.querySelector('.modal-close-btn').addEventListener('click', () => {
            editCategoryModal.remove();
        });

        editCategoryModal.addEventListener('click', (e) => {
            if (e.target === editCategoryModal) {
                editCategoryModal.remove();
            }
        });

        editCategoryModal.querySelector('#edit-category-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = document.getElementById('edit-category-name').value.trim();
            const newImageUrl = document.getElementById('edit-category-image').value.trim();

            if (newName.length < 2) {
                alertUserMessage('يجب أن يكون اسم التصنيف حرفين على الأقل.', 'error');
                return;
            }

            try {
                const categoryDocRef = doc(db, 'categories', categoryId);
                const updateData = { name: newName };
                if (newImageUrl) {
                    updateData.imageUrl = newImageUrl;
                }
                await updateDoc(categoryDocRef, updateData);
                alertUserMessage('تم تعديل التصنيف بنجاح!', 'success');
                editCategoryModal.remove();
            } catch (error) {
                console.error('Error updating category:', error);
                alertUserMessage(`فشل تعديل التصنيف: ${error.message}`, 'error');
            }
        });
    };

    // الحفاظ على الدالة القديمة للتوافق
    window.editCategory = (categoryId, currentName) => {
        const category = categoriesData.find(cat => cat.id === categoryId);
        window.openEditCategoryModal(categoryId, currentName, category?.imageUrl || '');
    };

    window.deleteCategory = async (categoryId) => {
        if (!isAdmin) return;

        const confirmDelete = await showConfirmationMessage('هل أنت متأكد من حذف هذا التصنيف؟');
        if (!confirmDelete) return;

        try {
            const categoryDocRef = doc(db, 'categories', categoryId);
            await deleteDoc(categoryDocRef);
            alertUserMessage('تم حذف التصنيف بنجاح!', 'success');
        } catch (error) {
            console.error('Error deleting category:', error);
            alertUserMessage(`فشل حذف التصنيف: ${error.message}`, 'error');
        }
    };

    const filterProductsByCategory = (categoryId) => {
        const filteredProducts = productsData.filter(product => 
            product.categoryId === categoryId || !categoryId
        );
        displayProducts(filteredProducts);

        if (filteredProducts.length === 0) {
            uiElements.productsContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">لا توجد منتجات في هذا التصنيف.</p>';
        }
    };

    const fetchUserFavorites = async () => {
        if (!userId) return;
        try {
            const favoritesColRef = collection(db, `users/${userId}/favorites`);
            onSnapshot(favoritesColRef, (snapshot) => {
                userFavorites = [];
                snapshot.forEach((doc) => {
                    userFavorites.push(doc.id);
                });
                console.log("User favorites fetched:", userFavorites);
                // عرض أحدث 10 منتجات فقط
                displayProducts(getLatestProducts(productsData));
            }, (error) => {
                console.error("Error fetching favorites:", error);
            });
        } catch (error) {
            console.error("Error setting up favorites listener:", error);
        }
    };

    const toggleFavorite = async (productId) => {
        if (!userId) {
            alertUserMessage("الرجاء تسجيل الدخول أولاً لإضافة المنتجات إلى المفضلات.");
            return;
        }

        try {
            const favoriteDocRef = doc(db, `users/${userId}/favorites`, productId);
            const docSnap = await getDoc(favoriteDocRef);

            if (docSnap.exists()) {
                await deleteDoc(favoriteDocRef);
                alertUserMessage("تم حذف المنتج من المفضلات.", 'success');
            } else {
                const product = productsData.find(p => p.id === productId);
                await setDoc(favoriteDocRef, {
                    productId: productId,
                    name: product.name,
                    price: product.price,
                    imageUrl: product.imageUrl,
                    addedAt: new Date().toISOString()
                });
                alertUserMessage("تم إضافة المنتج إلى المفضلات.", 'success');
            }
        } catch (error) {
            console.error("Error toggling favorite:", error);
            alertUserMessage(`فشل في تحديث المفضلات: ${error.message}`, 'error');
        }
    };

    const showFavoriteProducts = () => {
        const favoriteProducts = productsData.filter(product => 
            userFavorites.includes(product.id)
        );

        // تغيير العنوان إلى "المنتجات المفضلة"
        const productsTitle = document.querySelector('#products h2');
        if (productsTitle) {
            productsTitle.textContent = 'المنتجات المفضلة';
        }

        // إخفاء زر عرض جميع المنتجات نهائياً في صفحة المفضلات
        const showAllContainer = document.getElementById('show-all-products-container');
        if (showAllContainer) {
            showAllContainer.style.display = 'none';
        }

        if (favoriteProducts.length === 0) {
            uiElements.productsContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">لا توجد منتجات في المفضلات.</p>';
            return;
        }

        // عرض المنتجات المفضلة فقط
        displayProducts(favoriteProducts);
    };

    let currentProduct = null;

    const showProductPage = (product) => {
        currentProduct = product;

        // إخفاء الصفحة الرئيسية وإظهار صفحة المنتج
        document.getElementById('home-page').classList.add('hidden');
        document.getElementById('product-page').classList.remove('hidden');

        // تعبئة تفاصيل المنتج
        populateProductPage(product);

        // تحديث URL
        window.history.pushState({productId: product.id}, product.name, `#product-${product.id}`);

        // التمرير لأعلى
        window.scrollTo(0, 0);
    };

    const populateProductPage = (product) => {
        // الصورة الرئيسية
        const mainImage = document.getElementById('product-page-main-image');
        mainImage.src = product.imageUrl || 'https://placehold.co/600x400/eeeeee/333333?text=Product';
        mainImage.alt = product.name;

        // الصور المصغرة
        const thumbnailsContainer = document.getElementById('product-page-thumbnails');
        thumbnailsContainer.innerHTML = '';

        const images = [product.imageUrl];
        if (product.imageUrls && Array.isArray(product.imageUrls)) {
            images.push(...product.imageUrls.filter(url => url && url.trim()));
        }

        images.forEach((imageUrl, index) => {
            if (imageUrl) {
                const thumbnail = document.createElement('img');
                thumbnail.src = imageUrl;
                thumbnail.className = 'w-16 h-16 object-cover rounded cursor-pointer border-2 border-transparent hover:border-indigo-500 transition-all duration-200';
                if (index === 0) {
                    thumbnail.classList.add('border-indigo-500');
                }
                thumbnail.addEventListener('click', () => {
                    mainImage.src = imageUrl;
                    // إزالة الحدود من جميع الصور المصغرة
                    thumbnailsContainer.querySelectorAll('img').forEach(img => {
                        img.classList.remove('border-indigo-500');
                        img.classList.add('border-transparent');
                    });
                    // إضافة الحد للصورة المختارة
                    thumbnail.classList.remove('border-transparent');
                    thumbnail.classList.add('border-indigo-500');
                });
                thumbnailsContainer.appendChild(thumbnail);
            }
        });

        // اسم المنتج والبراند
        document.getElementById('product-page-name').textContent = product.name;
        document.getElementById('product-page-brand').textContent = product.brand || 'براند';

        // التقييم
        const ratingContainer = document.getElementById('product-page-rating');
        const productRatings = productRatingsData.filter(rating => rating.productId === product.id);

        if (productRatings.length > 0) {
            const totalRating = productRatings.reduce((sum, rating) => sum + rating.rating, 0);
            const averageRating = totalRating / productRatings.length;

            ratingContainer.innerHTML = `
                <div class="flex items-center">
                    <div class="flex">
                        ${Array(5).fill(0).map((_, i) => `
                            <svg class="w-5 h-5 ${i < Math.round(averageRating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.729c-.783-.57-.381-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z"/>
                            </svg>
                        `).join('')}
                    </div>
                    <span class="text-sm text-gray-600 mr-2">(${productRatings.length})</span>
                </div>
            `;
        } else {
            ratingContainer.innerHTML = '<span class="text-sm text-gray-500">لا يوجد تقييمات</span>';
        }

        // التصنيف
        const category = categoriesData.find(cat => cat.id === product.categoryId);
        document.getElementById('product-page-category').textContent = category ? category.name : 'غير محدد';

        // السعر
        const priceElement = document.getElementById('product-page-price');
        if (product.hasDiscount && product.originalPrice) {
            priceElement.innerHTML = `
                <div class="space-y-1">
                    <div class="text-sm text-red-500 line-through">${product.originalPrice.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} د.ع</div>
                    <div class="text-2xl font-bold text-green-600">${product.price.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} د.ع</div>
                </div>
            `;
        } else {
            priceElement.innerHTML = `<div class="text-2xl font-bold text-indigo-600">${product.price.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} د.ع</div>`;
        }

        // حالة التوفر
        const availabilityElement = document.getElementById('product-page-availability');
        const freeDeliveryElement = document.getElementById('product-page-free-delivery');

        if (product.availability === 'sold-out') {
            availabilityElement.textContent = 'مباع';
            availabilityElement.className = 'px-4 py-2 bg-red-100 text-red-800 rounded-full text-sm font-semibold';
        } else if (product.availability === 'available') {
            availabilityElement.textContent = 'متوفر';
            availabilityElement.className = 'px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-semibold';
        } else {
            availabilityElement.textContent = 'غير محدد';
            availabilityElement.className = 'px-4 py-2 bg-gray-100 text-gray-800 rounded-full text-sm font-semibold';
        }

        if (product.freeDelivery) {
            freeDeliveryElement.classList.remove('hidden');
        } else {
            freeDeliveryElement.classList.add('hidden');
        }

        // وصف المنتج
        document.getElementById('product-page-description').textContent = product.description || 'لا يوجد وصف متاح';

        // تحديث الأزرار
        updateProductPageButtons(product);

        // عرض المنتجات ذات الصلة
        displayRelatedProducts(product);

        // تحديث عداد السلة
        const cartCount = document.getElementById('product-page-cart-count');
        if (cartCount) {
            const itemCount = currentCart.reduce((total, item) => total + item.quantity, 0);
            cartCount.textContent = itemCount;
        }
    };

    const updateProductPageButtons = (product) => {
        const addToCartBtn = document.getElementById('product-page-add-to-cart');
        const buyNowBtn = document.getElementById('product-page-buy-now');
        const favoriteBtn = document.getElementById('product-page-favorite');
        const rateBtn = document.getElementById('product-page-rate');

        // زر إضافة للسلة
        addToCartBtn.onclick = async () => {
            if (!userId) {
                alertUserMessage("الرجاء تسجيل الدخول أولاً لإضافة منتجات إلى السلة.");
                return;
            }
            await addToCart(product);
        };

        // زر الشراء الآن
        buyNowBtn.onclick = async () => {
            if (!userId) {
                alertUserMessage("يجب تسجيل الدخول لتتمكن من الشراء الآن.", 'warning');
                return;
            }
            if (currentUserProfile) {
                await addToCart(product);
                populateCheckoutModal();
                uiElements.checkoutModal.classList.remove('hidden');
            }
        };

        // زر المفضلة
        const isFavorite = userFavorites.includes(product.id);
        favoriteBtn.innerHTML = isFavorite 
            ? '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>المفضلة'
            : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>المفضلة';

        favoriteBtn.className = isFavorite 
            ? 'flex-1 bg-red-100 text-red-700 py-3 px-6 rounded-lg font-semibold hover:bg-red-200 transition duration-300 flex items-center justify-center gap-2'
            : 'flex-1 bg-pink-100 text-pink-700 py-3 px-6 rounded-lg font-semibold hover:bg-pink-200 transition duration-300 flex items-center justify-center gap-2';

        favoriteBtn.onclick = async () => {
            if (!userId) {
                alertUserMessage("الرجاء تسجيل الدخول أولاً لإضافة المنتجات إلى المفضلات.", 'warning');
                return;
            }
            await toggleFavorite(product.id);
            updateProductPageButtons(product); // إعادة تحديث الأزرار
        };

        // زر التقييم
        if (userId && currentUserProfile) {
            rateBtn.classList.remove('hidden');
            rateBtn.onclick = () => {
                openProductRatingModal(product.id);
            };
        } else {
            rateBtn.classList.add('hidden');
        }

        // إخفاء الأزرار إذا كان المنتج مباع
        if (product.availability === 'sold-out') {
            addToCartBtn.disabled = true;
            buyNowBtn.disabled = true;
            addToCartBtn.classList.add('opacity-50', 'cursor-not-allowed');
            buyNowBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    };

    const displayRelatedProducts = (currentProduct) => {
        const relatedContainer = document.getElementById('related-products');
        if (!relatedContainer) return;

        // البحث عن المنتجات من نفس التصنيف
        const relatedProducts = productsData.filter(product => 
            product.categoryId === currentProduct.categoryId && 
            product.id !== currentProduct.id
        ).slice(0, 4); // عرض 4 منتجات فقط

        if (relatedProducts.length === 0) {
            relatedContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">لا توجد منتجات ذات صلة</p>';
            return;
        }

        relatedContainer.innerHTML = '';
        relatedProducts.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer';

            const formattedPrice = product.price.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});

            productCard.innerHTML = `
                <div class="aspect-square bg-gray-100">
                    <img src="${product.imageUrl || 'https://placehold.co/200x200/eeeeee/333333?text=Product'}" 
                         alt="${product.name}" 
                         class="w-full h-full object-contain"
                         onerror="this.src='https://placehold.co/200x200/eeeeee/333333?text=Product';">
                </div>
                <div class="p-4">
                    <h4 class="font-semibold text-gray-900 mb-1 line-clamp-2">${product.name}</h4>
                    <p class="text-indigo-600 font-bold">${formattedPrice} د.ع</p>
                </div>
            `;

            productCard.addEventListener('click', () => {
                showProductPage(product);
            });

            relatedContainer.appendChild(productCard);
        });
    };

    const goToHome = () => {
        document.getElementById('product-page').classList.add('hidden');
        document.getElementById('home-page').classList.remove('hidden');

        // استعادة عنوان "أحدث المنتجات"
        const productsTitle = document.querySelector('#products h2');
        if (productsTitle) {
            productsTitle.textContent = 'أحدث المنتجات';
        }

        // إظهار زر عرض جميع المنتجات مرة أخرى
        const showAllContainer = document.getElementById('show-all-products-container');
        if (showAllContainer) {
            showAllContainer.style.display = 'block';
        }

        // عرض أحدث 10 منتجات مع زر عرض جميع المنتجات
        if (productsData && productsData.length > 0) {
            displayProducts(getLatestProducts(productsData));

            if (showAllContainer) {
                if (productsData.length > 10) {
                    showAllContainer.innerHTML = `
                        <button id="show-all-products-btn" class="bg-indigo-600 text-white py-3 px-8 rounded-lg font-semibold hover:bg-indigo-700 transition duration-300 shadow-md transform hover:scale-105">
                            عرض جميع المنتجات 
                        </button>
                    `;
                    document.getElementById('show-all-products-btn').addEventListener('click', () => {
                        displayProducts(productsData, true);
                        showAllContainer.innerHTML = '';
                    });
                } else {
                    showAllContainer.innerHTML = '';
                }
            }
        }

        // إخفاء أي نوافذ منبثقة قد تكون مفتوحة
        document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => {
            modal.classList.add('hidden');
        });

        // التمرير إلى أعلى الصفحة
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // تحديث URL
        window.history.pushState({}, 'وصيلي', '/');

        currentProduct = null;
    };

    // استبدال دالة فتح النافذة المنبثقة بصفحة المنتج
    const openProductDetailsModal = (product) => {
        showProductPage(product);
    };

    let currentReviewDisplayIndex = 0;
    const displayReview = (review) => {
        if (!review) {
            uiElements.reviewsContainer.innerHTML = '<p class="w-full flex-shrink-0 text-gray-500">لا توجد تقييمات لعرضها حاليًا.</p>';
            return;
        }

        const rating = parseInt(review.rating) || 0;
        const starHtml = Array(5).fill(0).map((_, i) => `
            <svg class="w-5 h-5 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-400'}" fill="${i < rating ? 'currentColor' : 'none'}" stroke="${i < rating ? 'none' : 'currentColor'}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.729c-.783-.57-.381-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z"></path>
            </svg>
        `).join('');

        let actionButtons = '';
        if (userId === review.userId || isAdmin) {
            actionButtons = `
                <div class="review-actions">
                    ${userId === review.userId ? `
                        <button onclick="editReview('${review.id}')" class="review-action-btn edit-btn">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                    ` : ''}
                    ${(userId === review.userId || isAdmin) ? `
                        <button onclick="deleteReview('${review.id}')" class="review-action-btn delete-btn">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            `;
        }

        uiElements.reviewsContainer.innerHTML = `
            <div class="review-card flex-shrink-0 w-full">
                ${actionButtons}
                <img src="${review.userProfilePic || 'https://placehold.co/100x100/eeeeee/333333?text=User'}" alt="${review.userName}" class="w-24 h-24 rounded-full object-cover border-4 border-indigo-500 mb-4">
                <p class="text-xl font-semibold reviewer-name mb-2">${review.userName}</p>
                <div class="flex justify-center items-center star-rating mb-4">
                    ${starHtml}
                </div>
                <p class="review-text text-lg italic">"${review.reviewText}"</p>
            </div>
        `;
    };

    window.editReview = async (reviewId) => {
        const review = reviewsData.find(r => r.id === reviewId);
        if (!review || (userId !== review.userId && !isAdmin)) return;

        // إنشاء نافذة تعديل التقييم
        const editReviewModal = document.createElement('div');
        editReviewModal.className = 'modal-overlay';
        editReviewModal.innerHTML = `
            <div class="modal-content bg-gray-800 max-w-lg">
                <span class="modal-close-btn cursor-pointer text-2xl">&times;</span>
                <h3 class="text-2xl font-bold text-center text-gray-900 mb-6">تعديل التقييم</h3>
                <form id="edit-review-form" class="space-y-6">
                    <div>
                        <label for="edit-review-text" class="block text-sm font-medium text-gray-700 mb-2">نص التقييم</label>
                        <textarea id="edit-review-text" rows="4" 
                                  class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900" 
                                  required maxlength="500">${review.reviewText}</textarea>
                        <p class="text-xs text-gray-500 mt-1">الحد الأقصى 500 حرف</p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-3">التقييم (اختر عدد النجوم)</label>
                        <div class="flex justify-center gap-2">
                            ${Array(5).fill(0).map((_, i) => `
                                <button type="button" class="star-btn w-12 h-12 text-3xl ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400 transition-colors duration-200" data-rating="${i + 1}">
                                    ★
                                </button>
                            `).join('')}
                        </div>
                        <input type="hidden" id="edit-review-rating" value="${review.rating}">
                        <p class="text-center text-sm text-gray-600 mt-2">التقييم الحالي: <span id="current-rating-text">${review.rating}</span> من 5 نجوم</p>
                    </div>

                    <div class="flex gap-3">
                        <button type="submit" class="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-300">
                            حفظ التعديلات
                        </button>
                        <button type="button" class="flex-1 bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition duration-300" onclick="this.closest('.modal-overlay').remove()">
                            إلغاء
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(editReviewModal);

        // إضافة الأحداث للنجوم
        const starBtns = editReviewModal.querySelectorAll('.star-btn');
        const ratingInput = editReviewModal.querySelector('#edit-review-rating');
        const currentRatingText = editReviewModal.querySelector('#current-rating-text');

        starBtns.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                const rating = index + 1;
                ratingInput.value = rating;
                currentRatingText.textContent = rating;

                // تحديث ألوان النجوم
                starBtns.forEach((star, i) => {
                    if (i < rating) {
                        star.classList.remove('text-gray-300');
                        star.classList.add('text-yellow-400');
                    } else {
                        star.classList.remove('text-yellow-400');
                        star.classList.add('text-gray-300');
                    }
                });
            });
        });

        // إغلاق النافذة
        editReviewModal.querySelector('.modal-close-btn').addEventListener('click', () => {
            editReviewModal.remove();
        });

        editReviewModal.addEventListener('click', (e) => {
            if (e.target === editReviewModal) {
                editReviewModal.remove();
            }
        });

        // إرسال النموذج
        editReviewModal.querySelector('#edit-review-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newText = document.getElementById('edit-review-text').value.trim();
            const newRating = parseInt(document.getElementById('edit-review-rating').value);

            if (!newText) {
                alertUserMessage('الرجاء إدخال نص التقييم.', 'error');
                return;
            }

            if (newRating < 1 || newRating > 5) {
                alertUserMessage('الرجاء اختيار تقييم من 1 إلى 5 نجوم.', 'error');
                return;
            }

            try {
                const reviewDocRef = doc(db, 'reviews', reviewId);
                await updateDoc(reviewDocRef, {
                    reviewText: newText,
                    rating: newRating
                });
                alertUserMessage('تم تعديل التقييم بنجاح!', 'success');
                editReviewModal.remove();
            } catch (error) {
                console.error('Error updating review:', error);
                alertUserMessage(`فشل تعديل التقييم: ${error.message}`, 'error');
            }
        });
    };

    window.deleteReview = async (reviewId) => {
        const review = reviewsData.find(r => r.id === reviewId);
        if (!review || (userId !== review.userId && !isAdmin)) return;

        const confirmDelete = await showConfirmationMessage('هل أنت متأكد من حذف هذا التقييم؟');
        if (!confirmDelete) return;

        try {
            const reviewDocRef = doc(db, 'reviews', reviewId);
            await deleteDoc(reviewDocRef);
            alertUserMessage('تم حذف التقييم بنجاح!', 'success');
        } catch (error) {
            console.error('Error deleting review:', error);
            alertUserMessage(`فشل حذف التقييم: ${error.message}`, 'error');
        }
    };

    const showNextReview = () => {
        currentReviewDisplayIndex = (currentReviewDisplayIndex + 1) % reviewsData.length;
        displayReview(reviewsData[currentReviewDisplayIndex]);
    };

    const showPrevReview = () => {
        currentReviewDisplayIndex = (currentReviewDisplayIndex - 1 + reviewsData.length) % reviewsData.length;
        displayReview(reviewsData[currentReviewDisplayIndex]);
    };

    const fetchReviews = async () => {
        try {
            const reviewsColRef = collection(db, `reviews`);
            onSnapshot(reviewsColRef, (snapshot) => {
                reviewsData = [];
                snapshot.forEach((doc) => {
                    reviewsData.push({ id: doc.id, ...doc.data() });
                });
                console.log("Reviews data fetched:", reviewsData);
                if (reviewsData.length > 0) {
                    displayReview(reviewsData[currentReviewIndex]);
                    startReviewAutoChange();
                } else {
                    displayReview(null);
                    stopReviewAutoChange();
                }
            }, (error) => {
                console.error("Error fetching reviews:", error);
                uiElements.reviewsContainer.innerHTML = '<p class="w-full flex-shrink-0 text-red-500">فشل تحميل التقييمات.</p>';
            });
        } catch (error) {
            console.error("Error setting up reviews listener:", error);
        }
    };

    const startReviewAutoChange = () => {
        if (reviewAutoChangeInterval) {
            clearInterval(reviewAutoChangeInterval);
        }
        if (reviewsData.length > 1) {
            reviewAutoChangeInterval = setInterval(() => {
                showNextReview();
            }, 3500); // تغيير كل 3 ثوان
        }
    };

    const stopReviewAutoChange = () => {
        if (reviewAutoChangeInterval) {
            clearInterval(reviewAutoChangeInterval);
            reviewAutoChangeInterval = null;
        }
    };

    const fetchOffers = async () => {
        try {
            const offersColRef = collection(db, 'offers');
            onSnapshot(offersColRef, (snapshot) => {
                offersData = [];
                snapshot.forEach((doc) => {
                    offersData.push({ id: doc.id, ...doc.data() });
                });
                console.log("Offers data fetched:", offersData);
                displayOffers();
            }, (error) => {
                console.error("Error fetching offers:", error);
            });
        } catch (error) {
            console.error("Error setting up offers listener:", error);
        }
    };

    const fetchProductRatings = async () => {
        try {
            const ratingsColRef = collection(db, 'productRatings');
            onSnapshot(ratingsColRef, (snapshot) => {
                productRatingsData = [];
                snapshot.forEach((doc) => {
                    productRatingsData.push({ id: doc.id, ...doc.data() });
                });
                console.log("Product ratings data fetched:", productRatingsData);
                // إعادة عرض المنتجات لتحديث التقييمات
                if (productsData.length > 0) {
                    // عرض أحدث 10 منتجات فقط
                    displayProducts(getLatestProducts(productsData));
                }
            }, (error) => {
                console.error("Error fetching product ratings:", error);
            });
        } catch (error) {
            console.error("Error setting up product ratings listener:", error);
        }
    };

    const fetchDiscountCodes = async () => {
        try {
            const discountCodesColRef = collection(db, 'discountCodes');
            onSnapshot(discountCodesColRef, (snapshot) => {
                discountCodesData = [];
                snapshot.forEach((doc) => {
                    discountCodesData.push({ id: doc.id, ...doc.data() });
                });
                console.log("Discount codes data fetched:", discountCodesData);
                displayDiscountCodes();
            }, (error) => {
                console.error("Error fetching discount codes:", error);
            });
        } catch (error) {
            console.error("Error setting up discount codes listener:", error);
        }
    };

    const displayDiscountCodes = () => {
        if (!uiElements.discountCodesList) return;

        if (discountCodesData.length === 0) {
            uiElements.discountCodesList.innerHTML = '<p class="text-center text-gray-500">لا توجد أكواد خصم حالياً.</p>';
            return;
        }

        uiElements.discountCodesList.innerHTML = '';
        discountCodesData.forEach(discountCode => {
            const discountCodeItemHtml = `
                <div class="discount-code-item">
                    <div class="discount-code-info">
                        <div class="discount-code-name">${discountCode.code}</div>
                        <div class="discount-code-percentage">خصم ${discountCode.percentage}%</div>
                    </div>
                    <div class="discount-code-actions">
                        <button onclick="editDiscountCode('${discountCode.id}', '${discountCode.code}', ${discountCode.percentage})">تعديل</button>
                        <button onclick="deleteDiscountCode('${discountCode.id}')">حذف</button>
                    </div>
                </div>
            `;
            uiElements.discountCodesList.innerHTML += discountCodeItemHtml;
        });
    };

    window.editDiscountCode = async (id, currentCode, currentPercentage) => {
        if (!isAdmin) return;

        const newCode = prompt('كود الخصم الجديد:', currentCode);
        const newPercentage = prompt('نسبة الخصم الجديدة (1-100):', currentPercentage);

        if (newCode && newPercentage && parseInt(newPercentage) >= 1 && parseInt(newPercentage) <= 100) {
            try {
                const discountCodeDocRef = doc(db, 'discountCodes', id);
                await updateDoc(discountCodeDocRef, {
                    code: newCode.toUpperCase(),
                    percentage: parseInt(newPercentage)
                });
                alertUserMessage('تم تعديل كود الخصم بنجاح!', 'success');
            } catch (error) {
                console.error('Error updating discount code:', error);
                alertUserMessage(`فشل تعديل كود الخصم: ${error.message}`, 'error');
            }
        }
    };

    window.deleteDiscountCode = async (id) => {
        if (!isAdmin) return;

        const confirmDelete = await showConfirmationMessage('هل أنت متأكد من حذف كود الخصم؟');
        if (!confirmDelete) return;

        try {
            const discountCodeDocRef = doc(db, 'discountCodes', id);
            await deleteDoc(discountCodeDocRef);
            alertUserMessage('تم حذف كود الخصم بنجاح!', 'success');
        } catch (error) {
            console.error('Error deleting discount code:', error);
            alertUserMessage(`فشل حذف كود الخصم: ${error.message}`, 'error');
        }
    };

    const validateDiscountCode = async (code) => {
        const discountCode = discountCodesData.find(dc => dc.code.toLowerCase() === code.toLowerCase());
        return discountCode || null;
    };

    const displayOffers = () => {
        if (!uiElements.offersContainer) return;

        if (offersData.length === 0) {
            uiElements.offersContainer.classList.add('hidden');
            return;
        }

        uiElements.offersContainer.classList.remove('hidden');
        displayCurrentOffer();

        if (uiElements.offersContainer.autoRotateInterval) {
            clearInterval(uiElements.offersContainer.autoRotateInterval);
        }

        if (offersData.length > 1) {
            uiElements.offersContainer.autoRotateInterval = setInterval(() => {
                showNextOffer();
            }, 3000);
        }
    };

    const displayCurrentOffer = () => {
        if (!uiElements.offersSlider || offersData.length === 0) return;

        const offer = offersData[currentOfferIndex];

        let adminControls = '';
        if (isAdmin) {
            adminControls = `
                <div class="offer-admin-controls">
                    <button onclick="editOffer('${offer.id}')" class="admin-action-btn admin-edit-btn">
                         <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    <button onclick="deleteOffer('${offer.id}')" class="admin-action-btn admin-delete-btn">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            `;
        }

        let indicators = '';
        if (offersData.length > 1) {
            indicators = `
                <div class="offer-indicators">
                    ${offersData.map((_, index) => `
                        <div class="offer-indicator ${index === currentOfferIndex ? 'active' : ''}" 
                             onclick="goToOfferSlide(${index})"></div>
                    `).join('')}
                </div>
            `;
        }

        uiElements.offersSlider.innerHTML = `
            <div class="offer-slide flex-shrink-0 w-full relative">
                <img src="${offer.imageUrl}" alt="عرض" class="w-full h-96 object-cover rounded-lg shadow-lg">
                ${adminControls}
                ${indicators}
            </div>
        `;
    };

    window.goToOfferSlide = (index) => {
        currentOfferIndex = index;
        displayCurrentOffer();
    };

    window.editOffer = async (offerId) => {
        if (!isAdmin) return;
        const offer = offersData.find(o => o.id === offerId);
        if (!offer) return;

        const newImageUrl = prompt('رابط الصورة الجديد:', offer.imageUrl);
        if (newImageUrl && newImageUrl !== offer.imageUrl) {
            try {
                const offerDocRef = doc(db, 'offers', offerId);
                await updateDoc(offerDocRef, { imageUrl: newImageUrl });
                alertUserMessage('تم تعديل العرض بنجاح!', 'success');
            } catch (error){
                console.error('Error updating offer:', error);
                alertUserMessage(`فشل تعديل العرض: ${error.message}`, 'error');
            }
        }
    };

    window.deleteOffer = async (offerId) => {
        if (!isAdmin) return;

        const confirmDelete = await showConfirmationMessage('هل أنت متأكد من حذف هذا العرض؟');
        if (!confirmDelete) return;

        try {
            const offerDocRef = doc(db, 'offers', offerId);
            await deleteDoc(offerDocRef);
            alertUserMessage('تم حذف العرض بنجاح!', 'success');
        } catch (error) {
            console.error('Error deleting offer:', error);
            alertUserMessage(`فشل حذف العرض: ${error.message}`, 'error');
        }
    };

    const showNextOffer = () => {
        if (offersData.length <= 1) return;
        currentOfferIndex = (currentOfferIndex + 1) % offersData.length;
        displayCurrentOffer();
    };

    const showPrevOffer = () => {
        if (offersData.length <= 1) return;
        currentOfferIndex = (currentOfferIndex - 1 + offersData.length) % offersData.length;
        displayCurrentOffer();
    };

    let resolveMessageBoxPromise;

    const alertUserMessage = (message, type = 'info') => {
        if (!uiElements.messageBox || !uiElements.messageBoxText || !uiElements.messageBoxConfirmBtn || !uiElements.messageBoxCancelBtn) {
            console.error("Message box elements are not available.");
            return;
        }

        uiElements.messageBoxText.textContent = message;
        uiElements.messageBoxConfirmBtn.classList.add('hidden');
        uiElements.messageBoxCancelBtn.classList.add('hidden');

        uiElements.messageBox.className = 'fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-[1001] flex flex-col items-center gap-2 max-w-sm';
        uiElements.messageBoxText.className = 'text-center';

        if (type === 'success') {
            uiElements.messageBox.classList.add('bg-green-600', 'text-white');
        } else if (type === 'error') {
            uiElements.messageBox.classList.add('bg-red-600', 'text-white');
        } else if (type === 'warning') {
            uiElements.messageBox.classList.add('bg-yellow-600', 'text-white');
        } else {
            uiElements.messageBox.classList.add('bg-blue-600', 'text-white');
        }

        uiElements.messageBox.classList.remove('hidden');

        if (uiElements.messageBox.timeoutId) {
            clearTimeout(uiElements.messageBox.timeoutId);
        }
        uiElements.messageBox.timeoutId = setTimeout(() => {
            uiElements.messageBox.classList.add('hidden');
        }, 3000);
    };

    const showConfirmationMessage = (message) => {
        if (!uiElements.messageBox || !uiElements.messageBoxText || !uiElements.messageBoxConfirmBtn || !uiElements.messageBoxCancelBtn) {
            console.error("Message box elements are not available for confirmation.");
            return Promise.resolve(false);
        }

        return new Promise(resolve => {
            uiElements.messageBoxText.textContent = message;
            uiElements.messageBoxConfirmBtn.classList.remove('hidden');
            uiElements.messageBoxCancelBtn.classList.remove('hidden');

            uiElements.messageBox.className = 'fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-[1001] flex flex-col items-center gap-2 max-w-sm';
            uiElements.messageBoxText.className = 'text-center';
            uiElements.messageBox.classList.add('bg-yellow-600', 'text-white');

            if (uiElements.messageBox.timeoutId) {
                clearTimeout(uiElements.messageBox.timeoutId);
                uiElements.messageBox.timeoutId = null;
            }

            resolveMessageBoxPromise = resolve;
        });
    };

    const setupEventListeners = () => {
        if (uiElements.closeLoginModal) {
            uiElements.closeLoginModal.addEventListener('click', () => {
                uiElements.loginModal.classList.add('hidden');
                uiElements.loginMessage.textContent = '';
            });
        }

        if (uiElements.loginForm) {
            uiElements.loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log("Login form submitted!");

                if (!firebaseInitialized || !auth || !db) {
                    alertUserMessage("نظام تسجيل الدخول غير جاهز بعد. الرجاء المحاولة مرة أخرى بعد قليل.", 'warning');
                    return;
                }

                const fullName = uiElements.fullNameInput.value.trim();
                let phoneNumberDigits = uiElements.phoneNumberInput.value.trim();
                const gender = document.getElementById('gender').value;

                if (!fullName || !phoneNumberDigits || !gender) {
                    alertUserMessage('الرجاء تعبئة جميع الحقول.', 'error');
                    return;
                }

                const phoneRegex = /^[0-9]{11}$/;
                if (!phoneRegex.test(phoneNumberDigits)) {
                    alertUserMessage('الرجاء إدخال 11 رقمًا فقط لرقم الهاتف.', 'error');
                    return;
                }

                const fullPhoneNumber = '+964' + phoneNumberDigits;
                console.log("Attempting to register/login with:", { fullName, fullPhoneNumber });

                try {
                    // البحث عن مستخدم موجود برقم الهاتف نفسه
                    const usersRef = collection(db, 'users');
                    const allUsersSnapshot = await getDocs(usersRef);
                    let existingUserId = null;
                    let existingUserData = null;

                    // البحث في جميع المستخدمين للعثور على رقم الهاتف
                    for (const userDoc of allUsersSnapshot.docs) {
                        const userProfileRef = doc(db, `users/${userDoc.id}/userProfile`, userDoc.id);
                        const userProfileSnap = await getDoc(userProfileRef);

                        if (userProfileSnap.exists() && userProfileSnap.data().phoneNumber === fullPhoneNumber) {
                            existingUserId = userDoc.id;
                            existingUserData = userProfileSnap.data();
                            console.log("Found existing user with same phone number:", existingUserId);
                            break;
                        }
                    }

                    if (existingUserId) {
                        // إذا وُجد مستخدم برقم الهاتف نفسه، قم بتسجيل الدخول إليه
                        if (!userId && auth.currentUser) {
                            await signOut(auth);
                        }

                        await signInAnonymously(auth);
                        const newAnonymousUser = auth.currentUser;

                        // نسخ بيانات المستخدم الموجود إلى المستخدم الحالي
                        userId = newAnonymousUser.uid;
                        window.currentUserId = userId;

                        const newUserDocRef = doc(db, `users/${userId}/userProfile`, userId);
                        await setDoc(newUserDocRef, {
                            ...existingUserData,
                            fullName: fullName, // تحديث الاسم إذا كان مختلفاً
                            gender: gender, // تحديث الجنس إذا كان مختلفاً
                            profilePicUrl: gender === 'male' ? './boy.png' : './girl.png',
                            lastLogin: new Date().toISOString()
                        });

                        // نسخ السلة والمفضلات من الحساب الموجود
                        try {
                            const oldCartRef = collection(db, `users/${existingUserId}/cart`);
                            const oldCartSnapshot = await getDocs(oldCartRef);

                            for (const cartDoc of oldCartSnapshot.docs) {
                                const newCartRef = doc(db, `users/${userId}/cart`, cartDoc.id);
                                await setDoc(newCartRef, cartDoc.data());
                            }

                            const oldFavoritesRef = collection(db, `users/${existingUserId}/favorites`);
                            const oldFavoritesSnapshot = await getDocs(oldFavoritesRef);

                            for (const favDoc of oldFavoritesSnapshot.docs) {
                                const newFavRef = doc(db, `users/${userId}/favorites`, favDoc.id);
                                await setDoc(newFavRef, favDoc.data());
                            }
                        } catch (copyError) {
                            console.warn("خطأ في نسخ البيانات:", copyError);
                        }

                        alertUserMessage('مرحباً بعودتك! تم تسجيل الدخول بنجاح.', 'success');

                    } else {
                        // إنشاء مستخدم جديد
                        if (!userId && auth.currentUser) {
                            userId = auth.currentUser.uid;
                        } else if (!userId) {
                            await signInAnonymously(auth);
                            userId = auth.currentUser.uid;
                        }

                        const profilePicUrl = gender === 'male' ? './boy.png' : './girl.png';
                        const userDocRef = doc(db, `users/${userId}/userProfile`, userId);

                        await setDoc(userDocRef, {
                            fullName: fullName,
                            phoneNumber: fullPhoneNumber,
                            gender: gender,
                            profilePicUrl: profilePicUrl,
                            createdAt: new Date().toISOString(),
                            completedOrders: 0,
                            nameChanged: false,
                            phoneChanged: false
                        });

                        console.log("Created new user profile:", userId);
                        alertUserMessage('تم إنشاء حساب جديد بنجاح!', 'success');
                    }

                    await fetchAdminStatus();
                    console.log("Admin status checked after registration. Is Admin:", isAdmin);

                    setTimeout(() => {
                        uiElements.loginModal.classList.add('hidden');
                        uiElements.loginMessage.textContent = '';
                        fetchUserProfile(userId);
                    }, 1500);

                } catch (error) {
                    console.error("Error during registration/login:", error);
                    alertUserMessage(`فشل التسجيل/تسجيل الدخول: ${error.message}`, 'error');
                }
            });
        }

        if (uiElements.profileDetailsLogoutBtn) {
            uiElements.profileDetailsLogoutBtn.addEventListener('click', async () => {
                try {
                    await signOut(auth);
                    console.log("User signed out.");
                    uiElements.profileDetailsModal.classList.add('hidden');
                }
                catch (error) {
                    console.error("Error signing out:", error);
                }
            });
        }

        if (uiElements.profileDetailsLoginBtn) {
            uiElements.profileDetailsLoginBtn.addEventListener('click', () => {
                uiElements.profileDetailsModal.classList.add('hidden');
                uiElements.loginModal.classList.remove('hidden');
            });
        }

        if (uiElements.addProductBtn) {
            uiElements.addProductBtn.addEventListener('click', () => {
                if (isAdmin) {
                    uiElements.addProductModal.classList.remove('hidden');
                    uiElements.addProductForm.reset();
                    uiElements.addProductMessage.textContent = '';
                } else {
                    alertUserMessage("ليس لديك صلاحية إضافة منتجات.");
                }
            });
        }

        if (uiElements.closeAddProductModal) {
            uiElements.closeAddProductModal.addEventListener('click', () => {
                uiElements.addProductModal.classList.add('hidden');
            });
        }

        if (uiElements.addProductForm) {
            uiElements.addProductForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log("Add Product form submitted!");
                if (!isAdmin) {
                    alertUserMessage("ليس لديك صلاحية إضافة منتجات.");
                    return;
                }
                const brand = document.getElementById('product-brand').value.trim();
                const name = uiElements.productNameInput.value.trim();
                const description = uiElements.productDescriptionInput.value.trim();
                const price = parseFloat(uiElements.productPriceInput.value);
                const availability = document.getElementById('product-availability').value;
                const freeDelivery = document.getElementById('product-free-delivery').checked;
                const imageUrl = uiElements.productImageUrlInput.value.trim();
                const categoryId = document.getElementById('product-category').value;
                const hasDiscount = document.getElementById('product-has-discount').checked;
                const originalPrice = hasDiscount ? parseFloat(document.getElementById('product-original-price').value) : null;

                const imageUrls = [];
                for (let i = 2; i <= 5; i++) {
                    const additionalImageUrl = document.getElementById(`product-image-url-${i}`).value.trim();
                    if (additionalImageUrl) {
                        imageUrls.push(additionalImageUrl);
                    }
                }

                if (!brand || !name || !description || isNaN(price) || price <= 0 || !imageUrl) {
                    alertUserMessage('الرجاء تعبئة جميع الحقول المطلوبة بشكل صحيح.', 'error');
                    return;
                }

                try {
                    const productsColRef = collection(db, `products`);
                    const productData = {
                        brand,
                        name,
                        description,
                        price,
                        availability,
                        freeDelivery,
                        imageUrl,
                        categoryId: categoryId || null,
                        hasDiscount,
                        originalPrice,
                        createdAt: new Date().toISOString()
                    };

                    if (imageUrls.length > 0) {
                        productData.imageUrls = imageUrls;
                    }

                    const docRef = await addDoc(productsColRef, productData);
                    console.log("Product successfully added to Firestore with ID:", docRef.id);
                    alertUserMessage('تم إضافة المنتج بنجاح!', 'success');
                    uiElements.addProductForm.reset();
                    setTimeout(() => {
                        uiElements.addProductModal.classList.add('hidden');
                        uiElements.addProductMessage.textContent = '';
                    }, 1500);
                } catch (error) {
                    console.error("Error adding product to Firestore:", error);
                    alertUserMessage(`فشل إضافة المنتج: ${error.message}`, 'error');
                }
            });
        }

        if (uiElements.deleteProductsBtn) {
            uiElements.deleteProductsBtn.addEventListener('click', async () => {
                if (!isAdmin) {
                    alertUserMessage("ليس لديك صلاحية حذف المنتجات.");
                    return;
                }

                if (productsData.length === 0) {
                    alertUserMessage("لا توجد منتجات لحذفها.");
                    return;
                }

                const confirmDelete = await showConfirmationMessage("هل أنت متأكد أنك تريد حذف جميع المنتجات؟ هذا الإجراء لا يمكن التراجع عنه.");
                if (!confirmDelete) {
                    return;
                }

                try {
                    const productsColRef = collection(db, `products`);
                    const querySnapshot = await getDocs(productsColRef);
                    const deletePromises = [];
                    querySnapshot.forEach((doc) => {
                        deletePromises.push(deleteDoc(doc.ref));
                    });
                    await Promise.all(deletePromises);
                    alertUserMessage("تم حذف جميع المنتجات بنجاح.", 'success');
                } catch (error) {
                    console.error("Error deleting all products:", error);
                    alertUserMessage(`فشل حذف المنتجات: ${error.message}`, 'error');
                }
            });
        }

        if (uiElements.editProductBtn) {
            uiElements.editProductBtn.addEventListener('click', () => {
                if (!isAdmin) {
                    alertUserMessage("ليس لديك صلاحية تعديل المنتجات.");
                    return;
                }
                alertUserMessage("لاستخدام التعديل، انقر على زر 'تعديل المنتج' أسفل المنتج المحدد الذي ترغب في تعديله.");
            });
        }

        if (uiElements.addCategoryBtn) {
            uiElements.addCategoryBtn.addEventListener('click', () => {
                if (isAdmin) {
                    uiElements.addCategoryModal.classList.remove('hidden');
                } else {
                    alertUserMessage("ليس لديك صلاحية إضافة تصنيفات.");
                }
            });
        }

        const openAddCategoryModal = () => {
            if (!uiElements.addCategoryModal) {
                console.error("Add category modal element is not available.");
                alertUserMessage("لا يمكن فتح نافذة إضافة تصنيف. خطأ في عناصر الواجهة.", 'error');
                return;
            }
            uiElements.addCategoryModal.classList.remove('hidden');
        };

        if (uiElements.closeAddCategoryModal) {
            uiElements.closeAddCategoryModal.addEventListener('click', () => {
                uiElements.addCategoryModal.classList.add('hidden');
            });
        }

        if (uiElements.addCategoryForm) {
            // إضافة معاينة الصورة
            const categoryImageInput = document.getElementById('category-image');
            const imagePreview = document.getElementById('category-image-preview');

            if (categoryImageInput && imagePreview) {
                categoryImageInput.addEventListener('input', (e) => {
                    const imageUrl = e.target.value.trim();
                    if (imageUrl) {
                        imagePreview.innerHTML = `<img src="${imageUrl}" alt="معاينة التصنيف" class="w-full h-full object-cover rounded-md" onerror="this.parentElement.innerHTML='<span class=&quot;text-red-400&quot;>خطأ في تحميل الصورة</span>';">`;
                    } else {
                        imagePreview.innerHTML = '<span class="text-gray-400">معاينة الصورة ستظهر هنا</span>';
                    }
                });
            }

            uiElements.addCategoryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!isAdmin) {
                    alertUserMessage("ليس لديك صلاحية إضافة تصنيفات.");
                    return;
                }
                const categoryName = document.getElementById('category-name').value.trim();
                const categoryImage = document.getElementById('category-image').value.trim();

                if (!categoryName || !categoryImage) {
                    alertUserMessage('الرجاء إدخال اسم التصنيف وصورة التصنيف.', 'error');
                    return;
                }

                try {
                    const categoriesColRef = collection(db, `categories`);
                    await addDoc(categoriesColRef, {
                        name: categoryName,
                        imageUrl: categoryImage,
                        createdAt: new Date().toISOString()
                    });
                    alertUserMessage('تم إضافة التصنيف بنجاح!', 'success');
                    uiElements.addCategoryForm.reset();
                    if (imagePreview) {
                        imagePreview.innerHTML = '<span class="text-gray-400">معاينة الصورة ستظهر هنا</span>';
                    }
                    uiElements.addCategoryModal.classList.add('hidden');
                } catch (error) {
                    console.error("Error adding category:", error);
                    alertUserMessage(`فشل إضافة التصنيف: ${error.message}`, 'error');
                }
            });
        }

        if (uiElements.bottomCartBtn) {
            uiElements.bottomCartBtn.addEventListener('click', () => {
                uiElements.shoppingCartModal.classList.remove('hidden');
            });
        }

        if (uiElements.closeShoppingCartModal) {
            uiElements.closeShoppingCartModal.addEventListener('click', () => {
                uiElements.shoppingCartModal.classList.add('hidden');
            });
        }

        if (uiElements.checkoutButton) {
            uiElements.checkoutButton.addEventListener('click', async () => {
                console.log("Checkout button clicked. User ID:", userId, "Profile:", currentUserProfile);
                if (!userId || !currentUserProfile) {
                    alertUserMessage("الرجاء تسجيل الدخول أولاً لإتمام عملية الشراء.", 'warning');
                    return;
                }
                if (currentCart.length === 0) {
                    alertUserMessage("سلة التسوق فارغة. الرجاء إضافة منتجات.", 'warning');
                    return;
                }
                populateCheckoutModal();
                uiElements.checkoutModal.classList.remove('hidden');
            });
        }

        if (uiElements.closeCheckoutModal) {
            uiElements.closeCheckoutModal.addEventListener('click', () => {
                uiElements.checkoutModal.classList.add('hidden');
                uiElements.checkoutMessage.textContent = '';
            });
        }
        if (uiElements.checkoutForm) {
            uiElements.checkoutForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log("Checkout form submitted.");

                const fullName = uiElements.checkoutNameInput.value.trim();
                const governorate = uiElements.checkoutGovernorateSelect.value;
                const district = uiElements.checkoutDistrictInput.value.trim();
                const phoneNumberDigits = uiElements.checkoutPhoneInput.value.trim();
                const notes = uiElements.checkoutNotesTextarea.value.trim();
                const fullPhoneNumber = '+964' + phoneNumberDigits;

                if (!fullName || !governorate || !district || !phoneNumberDigits) {
                    alertUserMessage('الرجاء تعبئة جميع الحقول المطلوبة.', 'error');
                    return;
                }

                const phoneRegex = /^[0-9]{11}$/;
                if (!phoneRegex.test(phoneNumberDigits)) {
                    alertUserMessage('الرجاء إدخال 11 رقمًا صحيحًا لرقم الهاتف بعد +964.', 'error');
                    return;
                }

                try {

                    let cartTotalForBot = 0;
                    currentCart.forEach((item) => {
                        cartTotalForBot += (item.price * item.quantity);
                    });

                    let discountAmount = 0;
                    if (appliedDiscount) {
                        discountAmount = Math.round(cartTotalForBot * (appliedDiscount.percentage / 100));
                    }

                    const finalSubtotal = cartTotalForBot - discountAmount;
                    const deliveryFee = 5000;
                    const finalTotal = finalSubtotal + deliveryFee;

                    let orderMessage = `🛒 *طلب جديد* 🛒\n\n`;
                    orderMessage += `*معلومات العميل:*\n`;
                    orderMessage += `الاسم: ${fullName}\n`;
                    orderMessage += `رقم الهاتف: ${fullPhoneNumber}\n`;
                    orderMessage += `المحافظة: ${governorate}\n`;
                    orderMessage += `القضاء/المدينة: ${district}\n`;
                    orderMessage += `ملاحظات العميل: ${notes || 'لا توجد'}\n\n`;

                    if (currentUserProfile) {
                        orderMessage += `معرف المستخدم: ${userId}\n`;
                        orderMessage += `الاسم المسجل: ${currentUserProfile.fullName}\n`;
                        orderMessage += `رقم الهاتف المسجل: ${currentUserProfile.phoneNumber}\n`;
                        if (currentUserProfile.createdAt) {
                            const regDate = new Date(currentUserProfile.createdAt);
                            orderMessage += `تاريخ التسجيل: ${regDate.toLocaleDateString('ar-EG')} ${regDate.toLocaleTimeString('ar-EG')}\n\n`;
                        }
                    } else {
                        orderMessage += `معرف المستخدم: ${userId} (مستخدم غير مسجل بملف شخصي كامل)\n\n`;
                    }

                    orderMessage += `*تفاصيل الطلب:*\n`;
                    currentCart.forEach((item, index) => {
                        orderMessage += `${index + 1}. ${item.name} (${item.quantity}x) - ${item.price.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} د.ع = ${(item.price * item.quantity).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} د.ع\n`;
                    });

                    orderMessage += `\nالمجموع الفرعي: ${cartTotalForBot.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} د.ع\n`;

                    if (appliedDiscount) {
                        orderMessage += `خصم (${appliedDiscount.code}): -${discountAmount.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} د.ع\n`;
                    }

                    orderMessage += `رسوم التوصيل: ${deliveryFee.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} د.ع\n`;
                    orderMessage += `*المجموع الكلي: ${finalTotal.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} د.ع*\n\n`;



                    if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === '7570266115:AAGZUk96YHFewLpDlqkVpbDT6PwyZJ2ZVmE' || 
                        !TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID === '7348531151') {
                        console.warn("Telegram credentials may be invalid or example values");
                    }

                    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
                    const telegramPayload = {
                        chat_id: TELEGRAM_CHAT_ID,
                        text: orderMessage,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: "❌ لم يتم الطلب",
                                        callback_data: `order_failed_${userId}`
                                    },
                                    {
                                        text: "✅ تم الطلب",
                                        callback_data: `order_completed_${userId}`
                                    }
                                ]
                            ]
                        }
                    };

                    console.log("Sending to Telegram:", telegramPayload);

                    try {
                        const response = await fetch(telegramApiUrl, {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify(telegramPayload)
                        });

                        const result = await response.json();
                        console.log("Telegram response:", result);

                        if (response.ok && result.ok) {
                            alertUserMessage('تم تأكيد الطلب بنجاح! سيتم التواصل معك قريباً.', 'success');
                            uiElements.checkoutModal.classList.add('hidden');
                            uiElements.shoppingCartModal.classList.add('hidden');


                            const cartItemsRef = collection(db, `users/${userId}/cart`);
                            const cartSnapshot = await getDocs(cartItemsRef);
                            const deleteCartPromises = [];
                            cartSnapshot.forEach(doc => deleteCartPromises.push(deleteDoc(doc.ref)));
                            await Promise.all(deleteCartPromises);

         appliedDiscount = null;
                            console.log("Cart cleared after successful order.");

                        } else {
                            console.error("Telegram send failed:", result);
                            alertUserMessage('تم حفظ الطلب محلياً، لكن قد تكون هناك مشكلة في إرسال الإشعار.', 'warning');

           const cartItemsRef = collection(db, `users/${userId}/cart`);
                            const cartSnapshot = await getDocs(cartItemsRef);
                            const deleteCartPromises = [];
                            cartSnapshot.forEach(doc => deleteCartPromises.push(deleteDoc(doc.ref)));
                            await Promise.all(deleteCartPromises);

                            uiElements.checkoutModal.classList.add('hidden');
                            uiElements.shoppingCartModal.classList.add('hidden');
                            appliedDiscount = null;
                        }
                    } catch (telegramError) {
                        console.error("Telegram API error:", telegramError);
                        alertUserMessage('تم حفظ الطلب، لكن قد تكون هناك مشكلة في الإشعارات.', 'warning');

                        const cartItemsRef = collection(db, `users/${userId}/cart`);
                        const cartSnapshot = await getDocs(cartItemsRef);
                        const deleteCartPromises = [];
                        cartSnapshot.forEach(doc => deleteCartPromises.push(deleteDoc(doc.ref)));
                        await Promise.all(deleteCartPromises);

                        uiElements.checkoutModal.classList.add('hidden');
                        uiElements.shoppingCartModal.classList.add('hidden');
                        appliedDiscount = null;
                    }

                } catch (error) {
                    console.error("Error confirming order:", error);
                    alertUserMessage(`فشل تأكيد الطلب: ${error.message}`, 'error');
                }
            });
        }

        if (uiElements.bottomProfileBtn) {
            uiElements.bottomProfileBtn.addEventListener('click', () => {
                if (!userId || !currentUserProfile) {
                    uiElements.profileDetailsLoginBtn.classList.remove('hidden');
                    uiElements.profileDetailsLogoutBtn.classList.add('hidden');
                    uiElements.profileDetailsName.textContent = 'مستخدم غير مسجل';
                    uiElements.profileDetailsPhone.textContent = 'الرجاء تسجيل الدخول';
                    uiElements.profileDetailsRegisteredDate.textContent = '';
                    uiElements.profileDetailsImage.src = 'https://placehold.co/100x100/eeeeee/333333?text=User';
                } else {
                    uiElements.profileDetailsLoginBtn.classList.add('hidden');
                    uiElements.profileDetailsLogoutBtn.classList.remove('hidden');
                    fetchUserProfile(userId);
                }
                uiElements.profileDetailsModal.classList.remove('hidden');
            });
        }

        if (uiElements.closeProfileDetailsModal) {
            uiElements.closeProfileDetailsModal.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                uiElements.profileDetailsModal.classList.add('hidden');
            });
        }

        if (uiElements.bottomHomeBtn) {
            uiElements.bottomHomeBtn.addEventListener('click', () => {
                goToHome();
            });
        }

        // أزرار صفحة المنتج
        const backToHomeBtn = document.getElementById('back-to-home-btn');
        if (backToHomeBtn) {
            backToHomeBtn.addEventListener('click', () => {
                goToHome();
            });
        }

        const productPageCartBtn = document.getElementById('product-page-cart-btn');
        if (productPageCartBtn) {
            productPageCartBtn.addEventListener('click', () => {
                uiElements.shoppingCartModal.classList.remove('hidden');
            });
        }

        if (uiElements.bottomCategoriesBtn) {
            uiElements.bottomCategoriesBtn.addEventListener('click', () => {
                uiElements.categoriesModal.classList.remove('hidden');
            });
        }
        if (uiElements.closeCategoriesModal) {
            uiElements.closeCategoriesModal.addEventListener('click', () => {
                uiElements.categoriesModal.classList.add('hidden');
            });
        }

        if (uiElements.bottomSearchBtn) {
            uiElements.bottomSearchBtn.addEventListener('click', () => {
                uiElements.searchModal.classList.remove('hidden');
                uiElements.searchInput.value = '';
                uiElements.searchResultsContainer.innerHTML = '<p class="text-center text-gray-500">ابدأ البحث لعرض النتائج.</p>';
            });
        }
        if (uiElements.closeSearchModal) {
            uiElements.closeSearchModal.addEventListener('click', () => {
                uiElements.searchModal.classList.add('hidden');
            });
        }
        if (uiElements.searchInput && uiElements.searchResultsContainer) {
            const performSearch = () => {
                const query = uiElements.searchInput.value.toLowerCase().trim();
                if (query === '') {
                    uiElements.searchResultsContainer.innerHTML = '<p class="text-center text-gray-500">ابدأ البحث بكتابة اسم المنتج...</p>';
                    return;
                }

                const filtered = productsData.filter(product =>
                    product.name.toLowerCase().includes(query) ||
                    product.description.toLowerCase().includes(query)
                );

                uiElements.searchResultsContainer.innerHTML = '';
                if (filtered.length === 0) {
                    uiElements.searchResultsContainer.innerHTML = '<p class="text-center text-gray-500">لا توجد نتائج مطابقة لبحثك.</p>';
                } else {
                    filtered.forEach(product => {
                        const resultItem = `
                            <div class="search-result-item flex items-center justify-between border-b border-gray-200 py-3 px-2" data-product-id="${product.id}">
                                <div class="flex items-center">
                                    <img src="${product.imageUrl || 'https://placehold.co/50x50/eeeeee/333333?text=Item'}" alt="${product.name}" class="w-12 h-12 object-cover rounded-md me-4" onerror="this.onerror=null;this.src='https://placehold.co/50x50/eeeeee/333333?text=Item';">
                                    <div>
                                        <h4 class="font-semibold text-gray-800">${product.name}</h4>
                                        <p class="text-sm text-gray-600">${product.description.substring(0, 50)}...</p>
                                    </div>
                                </div>
                                <span class="font-semibold text-gray-900">${product.price.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} د.ع</span>
                            </div>
                        `;
                        uiElements.searchResultsContainer.innerHTML += resultItem;
                    });

                    uiElements.searchResultsContainer.querySelectorAll('.search-result-item').forEach(item => {
                        item.addEventListener('click', (e) => {
                            const productId = e.currentTarget.dataset.productId;
                            const targetProductElement = document.getElementById(`product-${productId}`);
                            if (targetProductElement) {
                                uiElements.searchModal.classList.add('hidden');
                                targetProductElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        });
                    });
                }
            };

            uiElements.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    performSearch();
                }
            });
            uiElements.searchInput.addEventListener('input', performSearch);
        }

        if (uiElements.closeProductDetailsModal) {
            uiElements.closeProductDetailsModal.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                uiElements.productDetailsModal.classList.add('hidden');
            });
        }

        if (uiElements.productDetailsModal) {
            uiElements.productDetailsModal.addEventListener('click', (e) => {
                if (e.target === uiElements.productDetailsModal) {
                    uiElements.productDetailsModal.classList.add('hidden');
                }
            });
        }

        if (uiElements.productDetailsAddToCart) {
            uiElements.productDetailsAddToCart.addEventListener('click', async (e) => {
                const productId = e.currentTarget.dataset.productId;
                const productToAdd = productsData.find(p => p.id === productId);
                if (productToAdd && userId) {
                    await addToCart(productToAdd);
                    uiElements.productDetailsModal.classList.add('hidden');
                } else if (!userId) {
                    alertUserMessage("الرجاء تسجيل الدخول أولاً لإضافة منتجات إلى السلة.");
                }
            });
        }

        if (uiElements.productDetailsBuyNow) {
            uiElements.productDetailsBuyNow.addEventListener('click', async (e) => {
                const productId = e.currentTarget.dataset.productId;
                const productToBuy = productsData.find(p => p.id === productId);
                if (!userId) {
                    alertUserMessage("يجب تسجيل الدخول لتتمكن من الشراء الآن.", 'warning');
                    return;
                }
                if (productToBuy && userId && currentUserProfile) {
                    await addToCart(productToBuy);
                    populateCheckoutModal();
                    uiElements.productDetailsModal.classList.add('hidden');
                    uiElements.checkoutModal.classList.remove('hidden');
                }
            });
        }

        if (uiElements.productDetailsFavoriteBtn) {
            uiElements.productDetailsFavoriteBtn.addEventListener('click', async (e) => {
                const productId = e.currentTarget.dataset.productId;
                await toggleFavorite(productId);
                const product = productsData.find(p => p.id === productId);
                if (product) {
                    const isFavorite = userFavorites.includes(productId);
                    e.currentTarget.innerHTML = isFavorite
                        ? '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>'
                        : '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>';
                    e.currentTarget.className = isFavorite
                        ? 'text-red-500 hover:text-red-600 transition duration-300'
                        : 'text-gray-400 hover:text-red-500 transition duration-300';
                }});
        }

        document.addEventListener('click', (e) => {
            if (e.target.closest('.favorites-filter-btn')) {
                showFavoriteProducts();
                uiElements.categoriesModal.classList.add('hidden');
            }
        });

        // إضافة حدث للزر المفضلات في الشريط السفلي
        if (uiElements.bottomFavoritesBtn) {
            uiElements.bottomFavoritesBtn.addEventListener('click', () => {
                showFavoriteProducts();
            });
        }

        // أحداث تبديل عرض المنتجات
        const gridViewBtn = document.getElementById('grid-view-btn');
        const listViewBtn = document.getElementById('list-view-btn');
        const productsContainer = document.getElementById('products-container');

        if (gridViewBtn && listViewBtn && productsContainer) {
            gridViewBtn.addEventListener('click', () => {
                // تفعيل عرض الشبكة
                productsContainer.classList.remove('products-list-view');
                productsContainer.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8';

                gridViewBtn.classList.add('active', 'bg-indigo-600', 'text-white');
                gridViewBtn.classList.remove('bg-gray-300', 'text-gray-700');

                listViewBtn.classList.remove('active', 'bg-indigo-600', 'text-white');
                listViewBtn.classList.add('bg-gray-300', 'text-gray-700');
            });

            listViewBtn.addEventListener('click', () => {
                // تفعيل عرض القائمة
                productsContainer.className = 'products-list-view';

                listViewBtn.classList.add('active', 'bg-indigo-600', 'text-white');
                listViewBtn.classList.remove('bg-gray-300', 'text-gray-700');

                gridViewBtn.classList.remove('active', 'bg-indigo-600', 'text-white');
                gridViewBtn.classList.add('bg-gray-300', 'text-gray-700');
            });
        }

        document.addEventListener('click', (e) => {
            if (e.target.closest('.all-products-filter-btn')) {
                displayProducts(productsData, true); // تمرير true لعرض جميع المنتجات
                uiElements.categoriesModal.classList.add('hidden');
            }
        });

        // إغلاق القوائم المنبثقة بالنقر خارجها
        document.addEventListener('click', (e) => {
            const modals = [
                uiElements.searchModal,
                uiElements.categoriesModal,
                uiElements.loginModal,
                uiElements.addProductModal,
                uiElements.editProductModal,
                uiElements.shoppingCartModal,
                uiElements.checkoutModal,
                uiElements.profileDetailsModal,
                uiElements.productDetailsModal,
                uiElements.addReviewModal,
                uiElements.addCategoryModal,
                uiElements.addOfferModal,
                uiElements.discountCodesModal,
                uiElements.welcomeModal
            ];

            modals.forEach(modal => {
                if (modal && !modal.classList.contains('hidden') && e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        });

        // إضافة أحداث إغلاق محسنة لجميع أزرار الإغلاق
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-close-btn') || e.target.closest('.modal-close-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const modal = e.target.closest('.modal-overlay');
                if (modal) {
                    modal.classList.add('hidden');
                }
            }
        });

        if (uiElements.addReviewBtn) {
            uiElements.addReviewBtn.addEventListener('click', () => {
                uiElements.addReviewModal.classList.remove('hidden');
            });
        }

        if (uiElements.closeAddReviewModal) {
            uiElements.closeAddReviewModal.addEventListener('click', () => {
                uiElements.addReviewModal.classList.add('hidden');
            });
        }

        if (uiElements.addReviewForm) {
            uiElements.addReviewForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                if (!userId) {
                    alertUserMessage('يجب تسجيل الدخول لإضافة تقييم.', 'warning');
                    return;
                }

                const userName = document.getElementById('review-user-name').value.trim();
                const rating = parseInt(document.getElementById('review-rating-number').value);
                const reviewText = document.getElementById('review-text').value.trim();

                if (!userName || !rating || !reviewText || rating < 1 || rating > 5) {
                    alertUserMessage('الرجاء تعبئة جميع الحقول بشكل صحيح (التقييم من 1 إلى 5).', 'error');
                    return;
                }

                try {
                    const reviewsColRef = collection(db, 'reviews');
                    await addDoc(reviewsColRef, {
                        userName: userName,
                        rating: rating,
                        reviewText: reviewText,
                        userId: userId,
                        userProfilePic: currentUserProfile?.profilePicUrl || 'https://placehold.co/100x100/eeeeee/333333?text=User',
                        createdAt: new Date().toISOString()
                    });

                    alertUserMessage('تم إضافة التقييم بنجاح!', 'success');
                    uiElements.addReviewForm.reset();
                    uiElements.addReviewModal.classList.add('hidden');
                } catch (error) {
                    console.error('Error adding review:', error);
                    alertUserMessage(`فشل إضافة التقييم: ${error.message}`, 'error');
                }
            });
        }



        if (uiElements.addOfferBtn) {
            uiElements.addOfferBtn.addEventListener('click', () => {
                if (isAdmin) {
                    uiElements.addOfferModal.classList.remove('hidden');
                } else {
                    alertUserMessage("ليس لديك صلاحية إضافة عروض.");
                }
            });
        }

        if (uiElements.closeAddOfferModal) {
            uiElements.closeAddOfferModal.addEventListener('click', () => {
                uiElements.addOfferModal.classList.add('hidden');
            });
        }

        if (uiElements.addOfferForm) {
            uiElements.addOfferForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!isAdmin) {
                    alertUserMessage("ليس لديك صلاحية إضافة عروض.");
                    return;
                }

                const imageUrl = document.getElementById('offer-image-url').value.trim();

                if (!imageUrl) {
                    alertUserMessage('الرجاء إدخال رابط الصورة.', 'error');
                    return;
                }

                try {
                    const offersColRef = collection(db, 'offers');
                    await addDoc(offersColRef, {
                        imageUrl: imageUrl,
                        createdAt: new Date().toISOString()
                    });

                    alertUserMessage('تم إضافة العرض بنجاح!', 'success');
                    uiElements.addOfferForm.reset();
                    uiElements.addOfferModal.classList.add('hidden');
                } catch (error) {
                    console.error('Error adding offer:', error);
                    alertUserMessage(`فشل إضافة العرض: ${error.message}`, 'error');
                }
            });
        }

        if (uiElements.manageDiscountCodesBtn) {
            uiElements.manageDiscountCodesBtn.addEventListener('click', () => {
                if (isAdmin) {
                    uiElements.discountCodesModal.classList.remove('hidden');
                } else {
                    alertUserMessage("ليس لديك صلاحية إدارة أكواد الخصم.");
                }
            });
        }

        if (uiElements.closeDiscountCodesModal) {
            uiElements.closeDiscountCodesModal.addEventListener('click', () => {
                uiElements.discountCodesModal.classList.add('hidden');
            });
        }

        if (uiElements.addDiscountCodeForm) {
            uiElements.addDiscountCodeForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!isAdmin) {
                    alertUserMessage("ليس لديك صلاحية إضافة أكواد خصم.");
                    return;
                }

                const code = document.getElementById('discount-code-name').value.trim().toUpperCase();
                const percentage = parseInt(document.getElementById('discount-percentage').value);

                if (!code || !percentage || percentage < 1 || percentage > 100) {
                    alertUserMessage('الرجاء إدخال كود صالح ونسبة خصم بين 1-100.', 'error');
                    return;
                }

                const existingCode = discountCodesData.find(dc => dc.code === code);
                if (existingCode) {
                    alertUserMessage('كود الخصم موجود بالفعل. الرجاء استخدام كود مختلف.', 'error');
                    return;
                }

                try {
                    const discountCodesColRef = collection(db, 'discountCodes');
                    await addDoc(discountCodesColRef, {
                        code: code,
                        percentage: percentage,
                        createdAt: new Date().toISOString()
                    });

                    alertUserMessage('تم إضافة كود الخصم بنجاح!', 'success');
                    uiElements.addDiscountCodeForm.reset();
                } catch (error) {
                    console.error('Error adding discount code:', error);
                    alertUserMessage(`فشل إضافة كود الخصم: ${error.message}`, 'error');
                }
            });
        }

        if (uiElements.applyDiscountBtn) {
            uiElements.applyDiscountBtn.addEventListener('click', async () => {
                const code = uiElements.checkoutDiscountCodeInput.value.trim();

                if (!code) {
                    alertUserMessage('الرجاء إدخال كود الخصم.', 'error');
                    return;
                }

                const validDiscount = await validateDiscountCode(code);

                if (validDiscount) {
                    appliedDiscount = validDiscount;
                    uiElements.discountMessage.textContent = `تم تطبيق خصم ${validDiscount.percentage}% بنجاح!`;
                    uiElements.discountMessage.className = 'text-sm mt-1 text-green-600';
                    updateCheckoutProductsList();
                    alertUserMessage(`تم تطبيق كود الخصم ${validDiscount.code} بخصم ${validDiscount.percentage}%!`, 'success');
                    if (uiElements.removeDiscountBtn) {
                        uiElements.removeDiscountBtn.classList.remove('hidden');
                    }
                } else {
                    uiElements.discountMessage.textContent = 'كود الخصم غير صالح.';
                    uiElements.discountMessage.className = 'text-sm mt-1 text-red-600';
                    appliedDiscount = null;
                    updateCheckoutProductsList();
                    alertUserMessage('كود الخصم غير صالح.', 'error');
                    if (uiElements.removeDiscountBtn) {
                        uiElements.removeDiscountBtn.classList.add('hidden');
                    }
                }
            });
        }

        if (uiElements.removeDiscountBtn) {
            uiElements.removeDiscountBtn.addEventListener('click', () => {
                appliedDiscount = null;
                uiElements.checkoutDiscountCodeInput.value = '';
                uiElements.discountMessage.textContent = '';
                uiElements.discountMessage.className = 'text-sm mt-1 hidden';
                updateCheckoutProductsList();
                uiElements.removeDiscountBtn.classList.add('hidden');
                alertUserMessage('تم حذف كود الخصم.', 'info');
            });
        }

        if (uiElements.offersContainer) {
            let touchStartX = 0;
            let touchEndX = 0;
            let isOfferSwiping = false;

            uiElements.offersContainer.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            });

            uiElements.offersContainer.addEventListener('touchend', (e) => {
                if (!isOfferSwiping && offersData.length > 1) {
                    touchEndX = e.changedTouches[0].screenX;
                    const swipeThreshold = 50;

                    if (touchStartX - touchEndX > swipeThreshold) {
                        isOfferSwiping = true;
                        showNextOffer();
                        setTimeout(() => {
                            isOfferSwiping = false;
                        }, 1000);
                    } else if (touchEndX - touchStartX > swipeThreshold) {
                        isOfferSwiping = true;
                        showPrevOffer();
                        setTimeout(() => {
                            isOfferSwiping = false;
                        }, 1000);
                    }
                }
            });
        }

        if (uiElements.reviewsContainer) {
            let isScrolling = false;
            let touchStartX = 0;
            let touchEndX = 0;

            uiElements.reviewsContainer.addEventListener('wheel', (e) => {
                if (!isScrolling && reviewsData.length > 1) {
                    isScrolling = true;
                    if (e.deltaY > 0) {
                        showNextReview();
                    } else {
                        showPrevReview();
                    }
                    setTimeout(() => {
                        isScrolling = false;
                    }, 1000);
                }
            });

            uiElements.reviewsContainer.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            });

            uiElements.reviewsContainer.addEventListener('touchend', (e) => {
                if (!isScrolling && reviewsData.length > 1) {
                    touchEndX = e.changedTouches[0].screenX;
                    const swipeThreshold = 50;

                    if (touchStartX - touchEndX > swipeThreshold) {
                        isScrolling = true;
                        showNextReview();
                        setTimeout(() => {
                            isScrolling = false;
                        }, 1000);
                    } else if (touchEndX - touchStartX > swipeThreshold) {
                        isScrolling = true;
                        showPrevReview();
                        setTimeout(() => {
                            isScrolling = false;
                        }, 1000);
                    }
                }
            });
        }

        if (uiElements.closeEditProductModal) {
            uiElements.closeEditProductModal.addEventListener('click', () => {
                uiElements.editProductModal.classList.add('hidden');
            });
        }

        if (uiElements.editProductForm) {
            uiElements.editProductForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!isAdmin) {
                    alertUserMessage("ليس لديك صلاحية تعديل المنتجات.");
                    return;
                }
                const productId = uiElements.editProductIdInput.value;
                const brand = document.getElementById('edit-product-brand').value.trim();
                const name = uiElements.editProductNameInput.value.trim();
                const description = uiElements.editProductDescriptionInput.value.trim();
                const price = parseFloat(uiElements.editProductPriceInput.value);
                const availability = document.getElementById('edit-product-availability').value;
                const freeDelivery = document.getElementById('edit-product-free-delivery').checked;
                const imageUrl = uiElements.editProductImageUrlInput.value.trim();
                const categoryId = document.getElementById('edit-product-category').value;
                const hasDiscount = document.getElementById('edit-product-has-discount').checked;
                const originalPrice = hasDiscount ? parseFloat(document.getElementById('edit-product-original-price').value) : null;

                const imageUrls = [];
                for (let i = 2; i <= 5; i++) {
                    const additionalImageUrl = document.getElementById(`edit-product-image-url-${i}`).value.trim();
                    if (additionalImageUrl) {
                        imageUrls.push(additionalImageUrl);
                    }
                }

                if (!productId || !brand || !name || !description || isNaN(price) || price <= 0 || !imageUrl) {
                    alertUserMessage('الرجاء تعبئة جميع الحقول المطلوبة بشكل صحيح.', 'error');
                    return;
                }

                try {
                    const productDocRef = doc(db, `products`, productId);
                    const updateData = {
                        brand,
                        name,
                        description,
                        price,
                        availability,
                        freeDelivery,
                        imageUrl,
                        categoryId: categoryId || null,
                        hasDiscount,
                        originalPrice
                    };

                    if (imageUrls.length > 0) {
                        updateData.imageUrls = imageUrls;
                    }

                    await updateDoc(productDocRef, updateData);
                    alertUserMessage('تم تعديل المنتج بنجاح!', 'success');
                    setTimeout(() => {
                        uiElements.editProductModal.classList.add('hidden');
                        uiElements.editProductMessage.textContent = '';
                    }, 1500);
                } catch (error) {
                    console.error("Error updating product:", error);
                    alertUserMessage(`فشل تعديل المنتج: ${error.message}`, 'error');
                }
            });
        }

        if (uiElements.messageBoxConfirmBtn) {
            uiElements.messageBoxConfirmBtn.addEventListener('click', () => {
                uiElements.messageBox.classList.add('hidden');
                if (resolveMessageBoxPromise) {
                    resolveMessageBoxPromise(true);
                }
            });
        }

        if (uiElements.messageBoxCancelBtn) {
            uiElements.messageBoxCancelBtn.addEventListener('click', () => {
                uiElements.messageBox.classList.add('hidden');
                if (resolveMessageBoxPromise) {
                    resolveMessageBoxPromise(false);
                }
            });
        }

        // تعديل الاسم
        document.addEventListener('click', (e) => {
            if (e.target.closest('#edit-name-btn')) {
                editUserName();
            }
        });

        // تعديل رقم الهاتف
        document.addEventListener('click', (e) => {
            if (e.target.closest('#edit-phone-btn')) {
                editUserPhone();
            }
        });

        // أحداث نافذة الترحيب
        if (uiElements.closeWelcomeModal) {
            uiElements.closeWelcomeModal.addEventListener('click', hideWelcomeModal);
        }

        if (uiElements.welcomeLoginBtn) {
            uiElements.welcomeLoginBtn.addEventListener('click', () => {
                hideWelcomeModal();
                uiElements.loginModal.classList.remove('hidden');
            });
        }

        if (uiElements.welcomeBrowseBtn) {
            uiElements.welcomeBrowseBtn.addEventListener('click', hideWelcomeModal);
        }

        if (uiElements.welcomeModal) {
            uiElements.welcomeModal.addEventListener('click', (e) => {
                if (e.target === uiElements.welcomeModal) {
                    hideWelcomeModal();
                }
            });
        }

        // أحداث تقييم المنتجات
        document.addEventListener('click', (e) => {
            if (e.target.closest('#product-details-rate-btn')) {
                const productId = e.target.closest('#product-details-rate-btn').dataset.productId;
                openProductRatingModal(productId);
            }
        });

        const productRatingModal = document.getElementById('product-rating-modal');
        if (productRatingModal) {
            const closeBtn = document.getElementById('close-product-rating-modal');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    productRatingModal.classList.add('hidden');
                });
            }

            productRatingModal.addEventListener('click', (e) => {
                if (e.target === productRatingModal) {
                    productRatingModal.classList.add('hidden');
                }
            });

            const ratingForm = document.getElementById('product-rating-form');
            if (ratingForm) {
                ratingForm.addEventListener('submit', async (e) => {
                    e.preventDefault();

                    const productId = document.getElementById('rating-product-id').value;
                    const rating = parseInt(document.getElementById('product-rating-value').value);

                    if (!rating || rating < 1 || rating > 5) {
                        alertUserMessage('الرجاء اختيار تقييم من 1 إلى 5 نجوم.', 'error');
                        return;
                    }

                    try {
                        const ratingsColRef = collection(db, 'productRatings');
                        await addDoc(ratingsColRef, {
                            productId: productId,
                            userId: userId,
                            rating: rating,
                            createdAt: new Date().toISOString()
                        });

                        alertUserMessage('تم إرسال التقييم بنجاح!', 'success');
                        productRatingModal.classList.add('hidden');
                    } catch (error) {
                        console.error('Error adding product rating:', error);
                        alertUserMessage(`فشل إرسال التقييم: ${error.message}`, 'error');
                    }
                });
            }
        }
    };

    const waitForFirebase = () => {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100;

            const checkFirebase = () => {
                attempts++;
                if (typeof window.firebase !== 'undefined' &&
                    window.firebase.initializeApp &&
                    window.firebase.auth &&
                    window.firebase.firestore &&
                    window.firebase.analytics) {
                    console.log("Firebase SDK loaded successfully");
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.error("Firebase SDK failed to load after maximum attempts");
                    reject(new Error("Firebase SDK loading timeout"));
                } else {
                    setTimeout(checkFirebase, 100);
                }
            };

            if (typeof window.firebase !== 'undefined' &&
                window.firebase.initializeApp &&
                window.firebase.auth &&
                window.firebase.firestore &&
                window.firebase.analytics) {
                console.log("Firebase SDK already loaded");
                resolve();
            } else {
                console.log("Waiting for Firebase SDK to load...");
                setTimeout(checkFirebase, 100);
            }
        });
    };

    const editUserName = async () => {
        if (!userId || !currentUserProfile) {
            alertUserMessage('يجب تسجيل الدخول أولاً.', 'error');
            return;
        }

        // التحقق من التعديل السابق
        if (currentUserProfile.nameChanged) {
            alertUserMessage('لقد قمت بتعديل الاسم مسبقاً. لا يمكن تعديله مرة أخرى.', 'warning');
            return;
        }

        // إظهار رسالة تحذير
        const confirmEdit = await showConfirmationMessage('تنبيه: يمكنك تعديل الاسم مرة واحدة فقط. هل أنت متأكد من المتابعة؟');
        if (!confirmEdit) {
            return;
        }

        // إنشاء نافذة تعديل الاسم
        const editNameModal = document.createElement('div');
        editNameModal.className = 'modal-overlay';
        editNameModal.innerHTML = `
            <div class="modal-content bg-gray-800 max-w-md">
                <span class="modal-close-btn cursor-pointer text-2xl">&times;</span>
                <h3 class="text-2xl font-bold text-center text-gray-900 mb-6">تعديل الاسم</h3>
                <div class="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4">
                    <p class="text-sm font-medium">⚠️ تذكير: هذا التعديل لمرة واحدة فقط</p>
                </div>
                <form id="edit-name-form" class="space-y-4">
                    <div>
                        <label for="new-name" class="block text-sm font-medium text-gray-700 mb-2">الاسم الكامل الجديد</label>
                        <input type="text" id="new-name" value="${currentUserProfile.fullName}" 
                               class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 text-lg" 
                               required minlength="3" maxlength="50">
                        <p class="text-xs text-gray-500 mt-1">يجب أن يكون الاسم من 3 إلى 50 حرف</p>
                    </div>
                    <div class="flex gap-3">
                        <button type="submit" class="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-300">
                            حفظ التغييرات
                        </button>
                        <button type="button" class="flex-1 bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition duration-300" onclick="this.closest('.modal-overlay').remove()">
                            إلغاء
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(editNameModal);

        // إضافة الأحداث
        editNameModal.querySelector('.modal-close-btn').addEventListener('click', () => {
            editNameModal.remove();
        });

        editNameModal.addEventListener('click', (e) => {
            if (e.target === editNameModal) {
                editNameModal.remove();
            }
        });

        editNameModal.querySelector('#edit-name-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = document.getElementById('new-name').value.trim();

            if (newName.length < 3) {
                alertUserMessage('يجب أن يكون الاسم 3 أحرف على الأقل.', 'error');
                return;
            }

            if (newName !== currentUserProfile.fullName) {
                try {
                    const userDocRef = doc(db, `users/${userId}/userProfile`, userId);
                    await updateDoc(userDocRef, { 
                        fullName: newName,
                        nameChanged: true
                    });
                    alertUserMessage('تم تحديث الاسم بنجاح! لا يمكن تعديله مرة أخرى.', 'success');
                    await fetchUserProfile(userId);
                    editNameModal.remove();
                } catch (error) {
                    console.error('Error updating name:', error);
                    alertUserMessage(`فشل تحديث الاسم: ${error.message}`, 'error');
                }
            } else {
                editNameModal.remove();
            }
        });
    };

    const editUserPhone = async () => {
        if (!userId || !currentUserProfile) {
            alertUserMessage('يجب تسجيل الدخول أولاً.', 'error');
            return;
        }

        // التحقق من التعديل السابق
        if (currentUserProfile.phoneChanged) {
            alertUserMessage('لقد قمت بتعديل رقم الهاتف مسبقاً. لا يمكن تعديله مرة أخرى.', 'warning');
            return;
        }

        // إظهار رسالة تحذير
        const confirmEdit = await showConfirmationMessage('تنبيه: يمكنك تعديل رقم الهاتف مرة واحدة فقط. هل أنت متأكد من المتابعة؟');
        if (!confirmEdit) {
            return;
        }

        const currentPhone = currentUserProfile.phoneNumber.replace('+964', '');

        // إنشاء نافذة تعديل رقم الهاتف
        const editPhoneModal = document.createElement('div');
        editPhoneModal.className = 'modal-overlay';
        editPhoneModal.innerHTML = `
            <div class="modal-content bg-gray-800 max-w-md">
                <span class="modal-close-btn cursor-pointer text-2xl">&times;</span>
                <h3 class="text-2xl font-bold text-center text-gray-900 mb-6">تعديل رقم الهاتف</h3>
                <div class="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4">
                    <p class="text-sm font-medium">⚠️ تذكير: هذا التعديل لمرة واحدة فقط</p>
                </div>
                <form id="edit-phone-form" class="space-y-4">
                    <div>
                        <label for="new-phone" class="block text-sm font-medium text-gray-700 mb-2">رقم الهاتف الجديد</label>
                        <div class="flex items-center">
                            <span class="bg-gray-200 text-gray-700 py-3 px-4 rounded-l-lg border border-r-0 border-gray-300 font-medium text-lg">+964</span>
                            <input type="tel" id="new-phone" value="${currentPhone}" 
                                   class="flex-1 px-4 py-3 border-2 border-gray-300 rounded-r-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 text-lg" 
                                   required pattern="[0-9]{11}" maxlength="11" placeholder="07701234567">
                        </div>
                        <p class="text-xs text-gray-500 mt-1">يجب إدخال 11 رقماً بدقة (مثال: 07701234567)</p>
                    </div>
                    <div class="flex gap-3">
                        <button type="submit" class="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-300">
                            حفظ التغييرات
                        </button>
                        <button type="button" class="flex-1 bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition duration-300" onclick="this.closest('.modal-overlay').remove()">
                            إلغاء
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(editPhoneModal);

        // إضافة الأحداث
        editPhoneModal.querySelector('.modal-close-btn').addEventListener('click', () => {
            editPhoneModal.remove();
        });

        editPhoneModal.addEventListener('click', (e) => {
            if (e.target === editPhoneModal) {
                editPhoneModal.remove();
            }
        });

        // التحقق من صحة الإدخال أثناء الكتابة
        const phoneInput = editPhoneModal.querySelector('#new-phone');
        phoneInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });

        editPhoneModal.querySelector('#edit-phone-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPhone = document.getElementById('new-phone').value.trim();

            const phoneRegex = /^[0-9]{11}$/;
            if (!phoneRegex.test(newPhone)) {
                alertUserMessage('الرجاء إدخال 11 رقماً صحيحاً بدون رمز الدولة (+964)', 'error');
                return;
            }

            if (newPhone !== currentPhone) {
                try {
                    const userDocRef = doc(db, `users/${userId}/userProfile`, userId);
                    await updateDoc(userDocRef, { 
                        phoneNumber: '+964' + newPhone,
                        phoneChanged: true
                    });
                    alertUserMessage('تم تحديث رقم الهاتف بنجاح! لا يمكن تعديله مرة أخرى.', 'success');
                    await fetchUserProfile(userId);
                    editPhoneModal.remove();
                } catch (error) {
                    console.error('Error updating phone:', error);
                    alertUserMessage(`فشل تحديث رقم الهاتف: ${error.message}`, 'error');
                }
            } else {
                editPhoneModal.remove();
            }
        });
    };

    window.onload = async () => {
        try {
            await waitForFirebase();
        } catch (error) {
            console.error("Firebase loading failed:", error);
            alertUserMessage("فشل تحميل Firebase. الرجاء إعادة تحميل الصفحة.", 'error');
            return;
        }
        uiElements = {
            loginModal: document.getElementById('login-modal'),
            closeLoginModal: document.getElementById('close-login-modal'),
            loginForm: document.getElementById('login-form'),
            fullNameInput: document.getElementById('full-name'),
            phoneNumberInput: document.getElementById('phone-number'),
            loginMessage: document.getElementById('login-message'),

            adminControlsSection: document.getElementById('admin-controls'),
            addProductBtn: document.getElementById('add-product-btn'),
            deleteProductsBtn: document.getElementById('delete-products-btn'),
            editProductBtn: document.getElementById('edit-product-btn'),
            addCategoryBtn: document.getElementById('add-category-btn'),

            addProductModal: document.getElementById('add-product-modal'),
            closeAddProductModal: document.getElementById('close-add-product-modal'),
            addProductForm: document.getElementById('add-product-form'),
            productNameInput: document.getElementById('product-name'),
            productDescriptionInput: document.getElementById('product-description'),
            productPriceInput: document.getElementById('product-price'),
            productImageUrlInput: document.getElementById('product-image-url'),
            productCategorySelect: document.getElementById('product-category'),
            addProductMessage: document.getElementById('add-product-message'),

            editProductModal: document.getElementById('edit-product-modal'),
            closeEditProductModal: document.getElementById('close-edit-product-modal'),
            editProductForm: document.getElementById('edit-product-form'),
            editProductIdInput: document.getElementById('edit-product-id'),
            editProductNameInput: document.getElementById('edit-product-name'),
            editProductDescriptionInput: document.getElementById('edit-product-description'),
            editProductPriceInput: document.getElementById('edit-product-price'),
            editProductImageUrlInput: document.getElementById('edit-product-image-url'),
            editProductCategorySelect: document.getElementById('edit-product-category'),
            editProductMessage: document.getElementById('edit-product-message'),

            addCategoryModal: document.getElementById('add-category-modal'),
            closeAddCategoryModal: document.getElementById('close-add-category-modal'),
            addCategoryForm: document.getElementById('add-category-form'),
            categoryNameInput: document.getElementById('category-name'),

            productsContainer: document.getElementById('products-container'),
            cartItemsContainer: document.getElementById('cart-items'),
            cartTotalElement: document.getElementById('cart-total'),
            cartSummaryDiv: document.getElementById('cart-summary'),
            checkoutButton: document.getElementById('checkout-btn'),

            bottomHomeBtn: document.getElementById('bottom-home-btn'),
            bottomSearchBtn: document.getElementById('bottom-search-btn'),
            bottomCartBtn: document.getElementById('bottom-cart-btn'),
            bottomFavoritesBtn: document.getElementById('bottom-favorites-btn'),
            bottomProfileBtn: document.getElementById('bottom-profile-btn'),
            cartCountBottom: document.getElementById('cart-count-bottom'),

            shoppingCartModal: document.getElementById('shopping-cart-modal'),
            closeShoppingCartModal: document.getElementById('close-shopping-cart-modal'),

            profileDetailsModal: document.getElementById('profile-details-modal'),
            closeProfileDetailsModal: document.getElementById('close-profile-details-modal'),
            profileDetailsImage: document.getElementById('profile-details-image'),
            profileDetailsName: document.getElementById('profile-details-name'),
            profileDetailsPhone: document.getElementById('profile-details-phone'),
            profileDetailsRegisteredDate: document.getElementById('profile-details-registered-date'),
            profileDetailsCompletedOrders: document.getElementById('profile-details-completed-orders'),
            profileDetailsLogoutBtn: document.getElementById('profile-details-logout-btn'),
            profileDetailsLoginBtn: document.getElementById('profile-details-login-btn'),

            messageBox: document.getElementById('message-box'),
            messageBoxText: document.getElementById('message-box-text'),
            messageBoxConfirmBtn: document.getElementById('message-box-confirm'),
            messageBoxCancelBtn: document.getElementById('message-box-cancel'),

            searchModal: document.getElementById('search-modal'),
            closeSearchModal: document.getElementById('close-search-modal'),
            searchInput: document.getElementById('search-input'),

            searchResultsContainer: document.getElementById('search-results-container'),

            categoriesModal: document.getElementById('categories-modal'),
            closeCategoriesModal: document.getElementById('close-categories-modal'),
            bottomCategoriesBtn: document.getElementById('bottom-categories-btn'),
            categoriesList: document.getElementById('categories-list'),
            categoriesListModal: document.getElementById('categories-list-modal'),

            checkoutModal: document.getElementById('checkout-modal'),
            closeCheckoutModal: document.getElementById('close-checkout-modal'),
            checkoutForm: document.getElementById('checkout-form'),
            checkoutNameInput: document.getElementById('checkout-name'),
            checkoutGovernorateSelect: document.getElementById('checkout-governorate'),
            checkoutDistrictInput: document.getElementById('checkout-district'),
            checkoutPhoneInput: document.getElementById('checkout-phone'),
            checkoutNotesTextarea: document.getElementById('checkout-notes'),
            checkoutProductsList: document.getElementById('checkout-products-list'),
            confirmOrderBtn: document.getElementById('confirm-order-btn'),
            checkoutMessage: document.getElementById('checkout-message'),

            reviewsSection: document.getElementById('reviews-section'),
            reviewsContainer: document.getElementById('reviews-container'),
            prevReviewBtn: document.getElementById('prev-review-btn'),
            nextReviewBtn: document.getElementById('next-review-btn'),

            productDetailsModal: document.getElementById('product-details-modal'),
            closeProductDetailsModal: document.getElementById('close-product-details-modal'),
            productDetailsMainImage: document.getElementById('product-details-main-image'),
            productDetailsThumbnailContainer: document.getElementById('product-details-thumbnail-container'),
            productDetailsBrand: document.getElementById('product-details-brand'),
            productDetailsName: document.getElementById('product-details-name'),
            productDetailsPrice: document.getElementById('product-details-price'),
            productDetailsAvailability: document.getElementById('product-details-availability'),
            productDetailsFreeDelivery: document.getElementById('product-details-free-delivery'),
            productDetailsDescription: document.getElementById('product-details-description'),
            productDetailsActions: document.getElementById('product-details-actions'),
            productDetailsAddToCart: document.getElementById('product-details-add-to-cart'),
            productDetailsBuyNow: document.getElementById('product-details-buy-now'),
            productDetailsFavoriteBtn: document.getElementById('product-details-favorite-btn'),

            addReviewBtn: document.getElementById('add-review-btn'),
            addReviewModal: document.getElementById('add-review-modal'),
            closeAddReviewModal: document.getElementById('close-add-review-modal'),
            addReviewForm: document.getElementById('add-review-form'),

            offersContainer: document.getElementById('offers-container'),
            offersSlider: document.getElementById('offers-slider'),
            addOfferBtn: document.getElementById('add-offer-btn'),
            addOfferModal: document.getElementById('add-offer-modal'),
            closeAddOfferModal: document.getElementById('close-add-offer-modal'),
            addOfferForm: document.getElementById('add-offer-form'),

            manageDiscountCodesBtn: document.getElementById('manage-discount-codes-btn'),
            discountCodesModal: document.getElementById('discount-codes-modal'),
            closeDiscountCodesModal: document.getElementById('close-discount-codes-modal'),
            addDiscountCodeForm: document.getElementById('add-discount-code-form'),
            discountCodesList: document.getElementById('discount-codes-list'),

            checkoutDiscountCodeInput: document.getElementById('checkout-discount-code'),
            applyDiscountBtn: document.getElementById('apply-discount-btn'),
            removeDiscountBtn: document.getElementById('remove-discount-btn'),
            discountMessage: document.getElementById('discount-message'),

            notificationText: document.querySelector('#notification-section p'),
            notificationIconContainer: document.querySelector('#notification-icon-container'),

            editNameBtn: document.getElementById('edit-name-btn'),
            editPhoneBtn: document.getElementById('edit-phone-btn'),

            welcomeModal: document.getElementById('welcome-modal'),
            closeWelcomeModal: document.getElementById('close-welcome-modal'),
            welcomeLoginBtn: document.getElementById('welcome-login-btn'),
            welcomeBrowseBtn: document.getElementById('welcome-browse-btn'),

            productRatingModal: document.getElementById('product-rating-modal'),
            closeProductRatingModal: document.getElementById('close-product-rating-modal'),
            productRatingForm: document.getElementById('product-rating-form'),
            productDetailsRateBtn: document.getElementById('product-details-rate-btn')
        };

        updateNotification();
        notificationInterval = setInterval(updateNotification, 5000);

        setupEventListeners();
        setupDiscountPriceHandlers();

        await initializeFirebase();
        const isReady = await firebaseReadyPromise;
        if (isReady) {
            console.log("Firebase is fully ready. User can now interact with login/profile via bottom bar.");
            fetchReviews();
            fetchCategories();
            fetchOffers();
            fetchDiscountCodes();
            populateCategoryOptions();
            updateAddReviewButtonVisibility();

            // عرض رسالة الترحيب للمستخدمين غير المسجلين بعد 3 ثوان لضمان تحميل جميع العناصر
            setTimeout(() => {
                if (uiElements.welcomeModal) {
                    showWelcomeModal();
                }
            }, 3000);

            if (window.TelegramHandler && isAdmin) {
                telegramHandler = new window.TelegramHandler();
                telegramHandler.startPolling();
                console.log('تم تشغيل معالج أزرار التليجرام للمشرف');
            }
        } else {
            console.error("Firebase did not become ready.");
            alertUserMessage("تعذر تهيئة نظام تسجيل الدخول. الرجاء المحاولة لاحقاً.", 'error');
        }
    };

    const updateAddReviewButtonVisibility = () => {
        if (uiElements.addReviewBtn) {
            if (userId && currentUserProfile) {
                uiElements.addReviewBtn.classList.remove('hidden');
                const reviewUserNameInput = document.getElementById('review-user-name');
                if (reviewUserNameInput && currentUserProfile) {
                    reviewUserNameInput.value = currentUserProfile.fullName || '';
                }
            } else {
                uiElements.addReviewBtn.classList.add('hidden');
            }
        }
    };

    const showWelcomeModal = () => {
        if (!welcomeModalShown && (!userId || !currentUserProfile) && uiElements.welcomeModal) {
            welcomeModalShown = true;
            uiElements.welcomeModal.classList.remove('hidden');
        }
    };

    const hideWelcomeModal = () => {
        uiElements.welcomeModal.classList.add('hidden');
    };

    const openProductRatingModal = (productId) => {
        if (!userId || !currentUserProfile) {
            alertUserMessage('يجب تسجيل الدخول أولاً لتقييم المنتج.', 'warning');
            return;
        }

        // التحقق من وجود تقييم سابق من نفس المستخدم
        const existingRating = productRatingsData.find(rating => 
            rating.productId === productId && rating.userId === userId
        );

        if (existingRating) {
            alertUserMessage('لقد قمت بتقييم هذا المنتج مسبقاً.', 'warning');
            return;
        }

        const productRatingModal = document.getElementById('product-rating-modal');
        if (!productRatingModal) return;

        document.getElementById('rating-product-id').value = productId;
        document.getElementById('product-rating-value').value = '0';
        document.getElementById('current-product-rating-text').textContent = 'لم يتم الاختيار';

        // إعادة تعيين النجوم
        const stars = productRatingModal.querySelectorAll('.product-rating-star');
        stars.forEach(star => {
            star.classList.remove('text-yellow-400');
            star.classList.add('text-gray-300');
        });

        // إضافة أحداث النجوم
        stars.forEach((star, index) => {
            star.addEventListener('click', () => {
                const rating = index + 1;
                document.getElementById('product-rating-value').value = rating;
                document.getElementById('current-product-rating-text').textContent = `${rating} من 5 نجوم`;

                // تحديث ألوان النجوم
                stars.forEach((s, i) => {
                    if (i < rating) {
                        s.classList.remove('text-gray-300');
                        s.classList.add('text-yellow-400');
                    } else {
                        s.classList.remove('text-yellow-400');
                        s.classList.add('text-gray-300');
                    }
                });
            });
        });

        productRatingModal.classList.remove('hidden');
    };

    const populateCategoryOptions = () => {
        const addProductCategorySelect = document.getElementById('product-category');
        const editProductCategorySelect = document.getElementById('edit-product-category');

        if (!addProductCategorySelect || !editProductCategorySelect) {
            console.log("Category select elements not found yet");
            return;
        }

        addProductCategorySelect.innerHTML = '<option value="">اختر تصنيف</option>';
        editProductCategorySelect.innerHTML = '<option value="">اختر تصنيف</option>';

        categoriesData.forEach(category => {
            const addOption = document.createElement('option');
            addOption.value = category.id;
            addOption.textContent = category.name;
            addProductCategorySelect.appendChild(addOption);

            const editOption = document.createElement('option');
            editOption.value = category.id;
            editOption.textContent = category.name;
            editProductCategorySelect.appendChild(editOption);
        });
    };

    const setupDiscountPriceHandlers = () => {

        const addDiscountCheckbox = document.getElementById('product-has-discount');
        const addOriginalPriceContainer = document.getElementById('original-price-container');

        if (addDiscountCheckbox && addOriginalPriceContainer) {
            addDiscountCheckbox.addEventListener('change', function() {
                if (this.checked) {
                    addOriginalPriceContainer.classList.remove('hidden');
                } else {
                    addOriginalPriceContainer.classList.add('hidden');
                    document.getElementById('product-original-price').value = '';
                }
            });
        }

        const editDiscountCheckbox = document.getElementById('edit-product-has-discount');
        const editOriginalPriceContainer = document.getElementById('edit-original-price-container');

        if (editDiscountCheckbox && editOriginalPriceContainer) {
            editDiscountCheckbox.addEventListener('change', function() {
                if (this.checked) {
                    editOriginalPriceContainer.classList.remove('hidden');
                } else {
                    editOriginalPriceContainer.classList.add('hidden');
                    document.getElementById('edit-product-original-price').value = '';
                }
            });
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        const homeBtn = document.getElementById('home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', showHomePageView);
        }

        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');

        if (mobileMenuButton && mobileMenu) {
            mobileMenuButton.addEventListener('click', () => {
                if (mobileMenu.style.maxHeight === '0px' || mobileMenu.style.maxHeight === '') {
                    mobileMenu.style.maxHeight = mobileMenu.scrollHeight + 'px';
                    mobileMenu.style.paddingTop = '1rem';
                    mobileMenu.style.paddingBottom = '1rem';
                } else {
                    mobileMenu.style.maxHeight = '0px';
                    mobileMenu.style.paddingTop = '0';
                    mobileMenu.style.paddingBottom = '0';
                }
            });

            mobileMenu.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    mobileMenu.style.maxHeight = '0px';
                    mobileMenu.style.paddingTop = '0';
                    mobileMenu.style.paddingBottom = '0';
                });
            });
        }

        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                if (targetId === '#top') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    const targetElement = document.querySelector(targetId);
                    if (targetElement) {
                        targetElement.scrollIntoView({
                            behavior: 'smooth'
                        });
                    }
                }
            });
        });
    });

    // دالة للعودة إلى الصفحة الرئيسية
    window.goToHome = () => {
        // استعادة عنوان "أحدث المنتجات"
        const productsTitle = document.querySelector('#products h2');
        if (productsTitle) {
            productsTitle.textContent = 'أحدث المنتجات';
        }

        // إظهار زر عرض جميع المنتجات مرة أخرى
        const showAllContainer = document.getElementById('show-all-products-container');
        if (showAllContainer) {
            showAllContainer.style.display = 'block';
        }

        // عرض أحدث 10 منتجات مع زر عرض جميع المنتجات
        if (productsData && productsData.length > 0) {
            // عرض أحدث 10 منتجات فقط
            displayProducts(getLatestProducts(productsData));

            // إضافة زر "عرض جميع المنتجات" إذا كان هناك أكثر من 10 منتجات
            if (showAllContainer) {
                if (productsData.length > 10) {
                    showAllContainer.innerHTML = `
                        <button id="show-all-products-btn" class="bg-indigo-600 text-white py-3 px-8 rounded-lg font-semibold hover:bg-indigo-700 transition duration-300 shadow-md transform hover:scale-105">
                            عرض جميع المنتجات (${productsData.length})
                        </button>
                    `;
                    document.getElementById('show-all-products-btn').addEventListener('click', () => {
                        displayProducts(productsData, true);
                        showAllContainer.innerHTML = '';
                    });
                } else {
                    showAllContainer.innerHTML = '';
                }
            }
        }

        // إخفاء أي نوافذ منبثقة قد تكون مفتوحة
        document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => {
            modal.classList.add('hidden');
        });

        // التمرير إلى أعلى الصفحة
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // إعادة تعيين أي عناصر تحكم أخرى في واجهة المستخدم قد تكون نشطة
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = '';
        }
    };
    // End of goToHome function





    window.showFavoriteProducts = () => {
        if (!userId) {
            alertUserMessage("يرجى تسجيل الدخول لعرض المفضلات", "warning");
            return;
        }

        // إخفاء زر عرض جميع المنتجات في صفحة المفضلات
        const showAllContainer = document.getElementById('show-all-products-container');
        if (showAllContainer) {
            showAllContainer.innerHTML = '';
        }

        const favoriteProducts = productsData.filter(product =>
            userFavorites.includes(product.id)
        );

        if (favoriteProducts.length === 0) {
            uiElements.productsContainer.innerHTML = '<p class="col-span-full text-center text-gray-500">لا توجد منتجات في المفضلات.</p>';
            return;
        }

        displayProducts(favoriteProducts);
    };
})();
