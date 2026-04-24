const API_BASE = "http://localhost:3000";

const adminRole = localStorage.getItem("userRole");
const adminToken = localStorage.getItem("authToken");

if (adminRole !== "admin" || !adminToken) {
    alert("Please login as admin");
    window.location.href = "login.html";
}

const feedbackEl = document.getElementById("adminFeedback");
const summaryEl = document.getElementById("adminSummary");
const ownersEl = document.getElementById("adminOwnersList");
const customersEl = document.getElementById("adminCustomersList");
const logoutBtn = document.getElementById("adminLogoutBtn");

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function showFeedback(message, type) {
    if (!feedbackEl) return;
    if (!message) {
        feedbackEl.innerHTML = "";
        return;
    }
    feedbackEl.innerHTML = `<div class="orders-feedback orders-feedback--${type === "error" ? "error" : "success"}">${escapeHtml(message)}</div>`;
}

function statusClass(status) {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "warned") return "status-pill status-pill--warned";
    if (normalized === "banned") return "status-pill status-pill--banned";
    if (normalized === "removed") return "status-pill status-pill--removed";
    return "status-pill status-pill--placed";
}

async function fetchJson(url, options = {}) {
    const res = await fetch(url, options);
    if (res.status === 401 || res.status === 403) {
        localStorage.clear();
        window.location.href = "login.html";
        return null;
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || "Request failed");
    }
    return data;
}

function renderSummary(summary) {
    summaryEl.innerHTML = `
        <div class="orders-stat"><span class="orders-stat__label">Customers</span><strong>${Number(summary.customers) || 0}</strong></div>
        <div class="orders-stat"><span class="orders-stat__label">Store Owners</span><strong>${Number(summary.owners) || 0}</strong></div>
        <div class="orders-stat"><span class="orders-stat__label">Pending Reports</span><strong>${Number(summary.pending_reports) || 0}</strong></div>
        <div class="orders-stat"><span class="orders-stat__label">Banned Users</span><strong>${Number(summary.banned_users) || 0}</strong></div>
        <div class="orders-stat"><span class="orders-stat__label">Removed Users</span><strong>${Number(summary.removed_users) || 0}</strong></div>
    `;
}

function userCard(user, options = {}) {
    const isOwner = options.roleLabel === "Store Owner";
    return `
        <article class="admin-card">
            <div class="admin-card__top">
                <div>
                    <h4>${escapeHtml(user.name)}</h4>
                    <p class="${statusClass(user.account_status)}">${escapeHtml(user.account_status || "active")}</p>
                </div>
                <div><strong>${escapeHtml(options.roleLabel || user.role)}</strong></div>
            </div>

            <div class="admin-card__meta">
                <div><span>Email</span><strong>${escapeHtml(user.email)}</strong></div>
                <div><span>Warnings</span><strong>${Number(user.warning_count) || 0}</strong></div>
                ${isOwner ? `<div><span>Store</span><strong>${escapeHtml(user.store_name || "Store not created")}</strong></div>` : ""}
                ${isOwner ? `<div><span>Store ID</span><strong>${escapeHtml(user.store_id || "N/A")}</strong></div>` : ""}
                <div><span>Restriction Note</span><strong>${escapeHtml(user.ban_reason || "None")}</strong></div>
            </div>

            <input class="admin-card__note" id="userNote-${escapeHtml(user.id)}" placeholder="Optional admin note">

            <div class="admin-card__actions">
                <button type="button" class="orders-btn orders-btn--primary" onclick="takeUserAction('${escapeHtml(user.id)}', 'warning')">Warn</button>
                <button type="button" class="orders-btn orders-btn--danger" onclick="takeUserAction('${escapeHtml(user.id)}', 'ban')">Ban</button>
                <button type="button" class="orders-btn orders-btn--danger" onclick="takeUserAction('${escapeHtml(user.id)}', 'remove')">Remove</button>
                <button type="button" class="orders-btn orders-btn--ghost" onclick="takeUserAction('${escapeHtml(user.id)}', 'activate')">Activate</button>
            </div>
        </article>
    `;
}

function renderOwners(users) {
    const owners = users.filter((user) => user.role === "owner");
    if (!owners.length) {
        ownersEl.innerHTML = `<div class="orders-empty">No store owners available.</div>`;
        return;
    }
    ownersEl.innerHTML = owners.map((user) => userCard(user, { roleLabel: "Store Owner" })).join("");
}

function renderCustomers(users) {
    const customers = users.filter((user) => user.role === "customer");
    if (!customers.length) {
        customersEl.innerHTML = `<div class="orders-empty">No customers available.</div>`;
        return;
    }
    customersEl.innerHTML = customers.map((user) => userCard(user, { roleLabel: "Customer" })).join("");
}

async function loadDashboard() {
    try {
        showFeedback("", "success");
        const data = await fetchJson(`${API_BASE}/admin/dashboard`, {
            headers: { "Authorization": `Bearer ${adminToken}` }
        });
        if (!data) return;
        renderSummary(data.summary || {});
        const users = Array.isArray(data.users) ? data.users : [];
        renderOwners(users);
        renderCustomers(users);
    } catch (e) {
        showFeedback(e.message, "error");
    }
}

async function takeUserAction(userId, action) {
    const note = String(document.getElementById(`userNote-${userId}`)?.value || "").trim();

    try {
        const data = await fetchJson(`${API_BASE}/admin/users/${userId}/action`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${adminToken}`
            },
            body: JSON.stringify({ action, notes: note })
        });
        showFeedback(data?.message || "Admin action saved", "success");
        await loadDashboard();
    } catch (e) {
        showFeedback(e.message, "error");
    }
}

async function logoutAdmin() {
    try {
        await fetch(`${API_BASE}/auth/logout`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${adminToken}` }
        });
    } catch {}

    localStorage.clear();
    window.location.href = "login.html";
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", (event) => {
        event.preventDefault();
        logoutAdmin();
    });
}

window.takeUserAction = takeUserAction;

loadDashboard();
