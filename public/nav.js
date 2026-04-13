(function () {
    try {
        const API_BASE = "http://localhost:3000";
        const role = localStorage.getItem("userRole");
        const token = localStorage.getItem("authToken");
        const showAddresses = role === "customer" && !!token;
        const showCustomerOrders = role === "customer" && !!token;

        const isLoggedIn = !!token;

        document.querySelectorAll('[data-nav="addresses"]').forEach((el) => {
            // Use CSS-defined display (inline-flex) for consistent pill styling
            el.style.display = showAddresses ? "" : "none";
        });

        document.querySelectorAll('[data-nav="customer-orders"]').forEach((el) => {
            el.style.display = showCustomerOrders ? "" : "none";
        });

        document.querySelectorAll('[data-nav="logout"]').forEach((el) => {
            el.style.display = isLoggedIn ? "" : "none";
            el.addEventListener("click", async (e) => {
                e.preventDefault();
                try {
                    await fetch(`${API_BASE}/auth/logout`, {
                        method: "POST",
                        headers: token ? { "Authorization": `Bearer ${token}` } : {}
                    });
                } catch {
                    // ignore
                }
                localStorage.clear();
                window.location.href = "login.html";
            });
        });

        // Hide Login link once authenticated
        document.querySelectorAll('a[href="login.html"]').forEach((el) => {
            // Use CSS-defined display for consistent styling
            el.style.display = isLoggedIn ? "none" : "";
        });
    } catch {
        // ignore
    }
})();
