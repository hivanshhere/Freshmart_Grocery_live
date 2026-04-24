(function () {
    const APP_STORAGE_VERSION = "mongo-v1";
    const APP_STORAGE_VERSION_KEY = "appStorageVersion";
    const APP_KEYS = [
        "authToken",
        "userId",
        "userName",
        "userRole",
        "storeId",
        "storeName",
        "storeCarts",
        "selectedAddressId"
    ];

    function clearAppState(options) {
        const preserveAfterLogin = !!options?.preserveAfterLogin;
        const afterLogin = preserveAfterLogin ? localStorage.getItem("afterLogin") : null;

        APP_KEYS.forEach((key) => localStorage.removeItem(key));
        localStorage.removeItem(APP_STORAGE_VERSION_KEY);

        if (preserveAfterLogin && afterLogin) {
            localStorage.setItem("afterLogin", afterLogin);
        } else {
            localStorage.removeItem("afterLogin");
        }
    }

    function markAppStorageVersion() {
        localStorage.setItem(APP_STORAGE_VERSION_KEY, APP_STORAGE_VERSION);
    }

    const currentVersion = localStorage.getItem(APP_STORAGE_VERSION_KEY);
    if (currentVersion !== APP_STORAGE_VERSION) {
        clearAppState({ preserveAfterLogin: true });
        markAppStorageVersion();
    }

    window.clearAppState = clearAppState;
    window.markAppStorageVersion = markAppStorageVersion;
})();
