const API_BASE = "http://localhost:3000";

const ownerRole = localStorage.getItem("userRole");
const ownerToken = localStorage.getItem("authToken");

if (ownerRole !== "owner" || !ownerToken) {
    alert("Please login as a store owner");
    window.location.href = "login.html";
}

const feedbackEl = document.getElementById("ownerOrdersFeedback");
const summaryEl = document.getElementById("ownerOrdersSummary");
const listEl = document.getElementById("ownerOrdersList");
const logoutBtn = document.getElementById("ownerLogoutBtn");

let currentStore = null;

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatMoney(value) {
    const amount = Number(value) || 0;
    return `Rs. ${amount.toFixed(2)}`;
}

function statusClass(status) {
    const normalized = String(status || "placed").toLowerCase();
    if (normalized === "accepted") return "status-pill status-pill--accepted";
    if (normalized === "rejected") return "status-pill status-pill--rejected";
    return "status-pill status-pill--placed";
}

function showFeedback(message, type) {
    if (!feedbackEl) return;
    if (!message) {
        feedbackEl.innerHTML = "";
        return;
    }
    feedbackEl.innerHTML = `<div class="orders-feedback orders-feedback--${type === "error" ? "error" : "success"}">${escapeHtml(message)}</div>`;
}

async function fetchJson(url, options) {
    const res = await fetch(url, options);
    if (res.status === 401) {
        localStorage.clear();
        window.location.href = "login.html";
        return null;
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || `Request failed (HTTP ${res.status})`);
    }
    return data;
}

function renderSummary(orders) {
    if (!summaryEl) return;
    const counts = {
        total: orders.length,
        placed: 0,
        accepted: 0,
        rejected: 0
    };

    orders.forEach(order => {
        const status = String(order.status || "placed").toLowerCase();
        if (counts[status] !== undefined) counts[status] += 1;
    });

    summaryEl.innerHTML = `
        <div class="orders-stat"><span class="orders-stat__label">Total Orders</span><strong>${counts.total}</strong></div>
        <div class="orders-stat"><span class="orders-stat__label">Placed</span><strong>${counts.placed}</strong></div>
        <div class="orders-stat"><span class="orders-stat__label">Accepted</span><strong>${counts.accepted}</strong></div>
        <div class="orders-stat"><span class="orders-stat__label">Rejected</span><strong>${counts.rejected}</strong></div>
    `;
}

function renderOrders(orders) {
    if (!listEl) return;
    if (!orders.length) {
        listEl.innerHTML = `<div class="orders-empty">No orders yet. New customer orders will appear here.</div>`;
        return;
    }

    listEl.innerHTML = orders.map(order => {
        const itemsHtml = (order.items || []).length
            ? order.items.map(item => `
                <div class="order-item">
                    <div>
                        <div class="order-item__name">${escapeHtml(item.product_name)}</div>
                        <div class="order-item__meta">Qty: ${Number(item.qty) || 0} • Unit Price: ${formatMoney(item.unit_price)}</div>
                    </div>
                    <div class="order-item__meta">${formatMoney(item.line_total || ((Number(item.qty) || 0) * (Number(item.unit_price) || 0)))}</div>
                </div>
            `).join("")
            : `<div class="orders-empty">Item details are not available for this older order.</div>`;

        return `
            <article class="order-card">
                <div class="order-card__top">
                    <div>
                        <h3>Order #${order.id}</h3>
                        <p class="${statusClass(order.status)}">${escapeHtml(order.status || "placed")}</p>
                    </div>
                    <a class="orders-btn orders-btn--ghost" href="owner-dashboard.html">Dashboard</a>
                </div>

                <div class="order-card__meta">
                    <div><span>Customer</span><strong>${escapeHtml(order.customer_name || "Customer")}</strong></div>
                    <div><span>Store</span><strong>${escapeHtml(currentStore?.store_name || localStorage.getItem("storeName") || "Store")}</strong></div>
                    <div><span>Type</span><strong>${escapeHtml(order.delivery_type || "delivery")}</strong></div>
                    <div><span>Total</span><strong>${formatMoney(order.total_amount)}</strong></div>
                </div>

                <div class="order-card__section">
                    <span>Items</span>
                    <div class="order-items">${itemsHtml}</div>
                </div>

                <div class="order-card__actions">
                    <button type="button" class="orders-btn orders-btn--primary" onclick="updateOrderStatus(${order.id}, 'accepted')">Accept</button>
                    <button type="button" class="orders-btn orders-btn--ghost" onclick="updateOrderStatus(${order.id}, 'rejected')">Reject</button>
                    <button type="button" class="orders-btn orders-btn--danger" onclick="deleteOrder(${order.id})">Delete</button>
                </div>
            </article>
        `;
    }).join("");
}

async function loadOrders() {
    try {
        showFeedback("", "success");
        currentStore = await fetchJson(`${API_BASE}/owner/store`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${ownerToken}` }
        });

        const orders = await fetchJson(`${API_BASE}/owner/orders/${currentStore.id}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${ownerToken}` }
        });

        renderSummary(Array.isArray(orders) ? orders : []);
        renderOrders(Array.isArray(orders) ? orders : []);
    } catch (e) {
        if (summaryEl) summaryEl.innerHTML = "";
        if (listEl) listEl.innerHTML = `<div class="orders-empty">${escapeHtml(e.message)}</div>`;
        showFeedback(e.message, "error");
    }
}

async function updateOrderStatus(orderId, status) {
    try {
        await fetchJson(`${API_BASE}/update-order-status`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${ownerToken}`
            },
            body: JSON.stringify({ order_id: orderId, status })
        });
        showFeedback(`Order #${orderId} marked as ${status}.`, "success");
        await loadOrders();
    } catch (e) {
        showFeedback(e.message, "error");
    }
}

async function deleteOrder(orderId) {
    const confirmed = window.confirm(`Delete order #${orderId} from the owner panel?`);
    if (!confirmed) return;

    try {
        await fetchJson(`${API_BASE}/owner/orders/${orderId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${ownerToken}` }
        });
        showFeedback(`Order #${orderId} deleted.`, "success");
        await loadOrders();
    } catch (e) {
        showFeedback(e.message, "error");
    }
}

async function logoutOwner() {
    try {
        await fetch(`${API_BASE}/auth/logout`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${ownerToken}` }
        });
    } catch {
        // ignore
    }
    localStorage.clear();
    window.location.href = "login.html";
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        logoutOwner();
    });
}

window.updateOrderStatus = updateOrderStatus;
window.deleteOrder = deleteOrder;

loadOrders();
setInterval(loadOrders, 10000);
