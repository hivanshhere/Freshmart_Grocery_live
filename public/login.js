function resolveApiBase() {
    const { hostname, port, origin } = window.location;
    const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(hostname);
    const isLiveServer = isLocalHost && port && port !== "3000";
    if (isLiveServer) return "http://localhost:3000";
    return origin && /^https?:/i.test(origin) ? origin : "http://localhost:3000";
}

const API_BASE = resolveApiBase();

function login() {
    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value.trim();
    const msg = document.getElementById("msg");
    const showMessage = (message, type = "") => {
        msg.innerText = message;
        msg.className = type ? `msg--${type}` : "";
    };

    if (email === "" || password === "") {
        showMessage("Enter email and password", "error");
        return;
    }

    showMessage("");

    fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
    })
    .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (res.status >= 500) {
                throw new Error("Server error");
            }
            throw new Error(data.message || "Server error");
        }
        return data;
    })
    .then(data => {
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("userId", String(data.user.id));
        localStorage.setItem("userName", data.user.name || "");
        localStorage.setItem("userRole", data.user.role || "");
        localStorage.setItem("accountStatus", data.user.account_status || "active");
        localStorage.setItem("warningCount", String(data.user.warning_count || 0));
        localStorage.setItem("banReason", data.user.ban_reason || "");

        if (data.store && data.store.id) {
            localStorage.setItem("storeId", String(data.store.id));
            localStorage.setItem("storeName", String(data.store.store_name || ""));
        } else {
            localStorage.removeItem("storeId");
            localStorage.removeItem("storeName");
        }

        const afterLogin = localStorage.getItem("afterLogin");
        if (afterLogin) localStorage.removeItem("afterLogin");

        const isSafeLocalHtml = (value) => {
            if (!value) return false;
            if (value.includes("://")) return false;
            if (value.startsWith("//")) return false;
            return value.endsWith(".html") || value.includes(".html?");
        };

        if (data.user.role === "admin") {
            window.location.href = "admin-dashboard.html";
        } else if (data.user.role === "owner") {
            window.location.href = "owner-dashboard.html";
        } else {
            window.location.href = isSafeLocalHtml(afterLogin) ? afterLogin : "stores.html";
        }
    })
    .catch(err => {
        showMessage(err.message || "Server error", "error");
        console.log(err);
    });
}
