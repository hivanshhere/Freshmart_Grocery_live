const API_BASE = "http://localhost:3000";

const customerRole = localStorage.getItem("userRole");
const customerToken = localStorage.getItem("authToken");

if (customerRole !== "customer" || !customerToken) {
    alert("Please login as a customer");
    window.location.href = "login.html";
}

const customerFeedbackEl = document.getElementById("customerOrdersFeedback");
const customerSummaryEl = document.getElementById("customerOrdersSummary");
const customerListEl = document.getElementById("customerOrdersList");

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

function statusMessage(status) {
    const normalized = String(status || "placed").toLowerCase();
    if (normalized === "accepted") return "The store owner has accepted this order.";
    if (normalized === "rejected") return "The store owner has rejected this order.";
    return "The store owner has not reviewed this order yet.";
}

function showFeedback(message, type) {
    if (!customerFeedbackEl) return;
    if (!message) {
        customerFeedbackEl.innerHTML = "";
        return;
    }
    customerFeedbackEl.innerHTML = `<div class="orders-feedback orders-feedback--${type === "error" ? "error" : "success"}">${escapeHtml(message)}</div>`;
}

async function fetchOrders() {
    const res = await fetch(`${API_BASE}/user/orders`, {
        headers: { "Authorization": `Bearer ${customerToken}` }
    });
    if (res.status === 401) {
        localStorage.clear();
        window.location.href = "login.html";
        return null;
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || `Could not load orders (HTTP ${res.status})`);
    }
    return Array.isArray(data) ? data : [];
}

function renderSummary(orders) {
    if (!customerSummaryEl) return;
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

    customerSummaryEl.innerHTML = `
        <div class="orders-stat"><span class="orders-stat__label">Total Orders</span><strong>${counts.total}</strong></div>
        <div class="orders-stat"><span class="orders-stat__label">Pending</span><strong>${counts.placed}</strong></div>
        <div class="orders-stat"><span class="orders-stat__label">Accepted</span><strong>${counts.accepted}</strong></div>
        <div class="orders-stat"><span class="orders-stat__label">Rejected</span><strong>${counts.rejected}</strong></div>
    `;
}

function renderOrders(orders) {
    if (!customerListEl) return;
    if (!orders.length) {
        customerListEl.innerHTML = `<div class="orders-empty">You have not placed any orders yet.</div>`;
        return;
    }

    customerListEl.innerHTML = orders.map(order => {
        const visibleOrderNumber = Number(order.display_order_number) || Number(order.id) || 0;
        const itemsHtml = (order.items || []).length
            ? order.items.map(item => `
                <div class="order-item">
                    <div>
                        <div class="order-item__name">${escapeHtml(item.product_name)}</div>
                        <div class="order-item__meta">Qty: ${Number(item.qty) || 0} &bull; Unit Price: ${formatMoney(item.unit_price)}</div>
                    </div>
                    <div class="order-item__meta">${formatMoney(item.line_total || ((Number(item.qty) || 0) * (Number(item.unit_price) || 0)))}</div>
                </div>
            `).join("")
            : `<div class="orders-empty">Item details are not available for this older order.</div>`;

        return `
            <article class="order-card">
                <div class="order-card__top">
                    <div>
                        <h3>Order #${visibleOrderNumber}</h3>
                        <p class="${statusClass(order.status)}">${escapeHtml(order.status || "placed")}</p>
                    </div>
                    <a class="orders-btn orders-btn--ghost" href="stores.html">Keep Shopping</a>
                </div>

                <div class="order-card__meta">
                    <div><span>Store</span><strong>${escapeHtml(order.store_name || "Store")}</strong></div>
                    <div><span>Type</span><strong>${escapeHtml(order.delivery_type || "delivery")}</strong></div>
                    <div><span>Total</span><strong>${formatMoney(order.total_amount)}</strong></div>
                    <div><span>Status Update</span><strong>${escapeHtml(statusMessage(order.status))}</strong></div>
                </div>

                <div class="order-card__section">
                    <span>Items</span>
                    <div class="order-items">${itemsHtml}</div>
                </div>

                <div class="order-card__actions">
                    <button type="button" class="orders-btn orders-btn--danger" onclick="deleteCustomerOrder(${order.id})">Delete</button>
                </div>
            </article>
        `;
    }).join("");
}

async function deleteCustomerOrder(orderId) {
    const confirmed = window.confirm(`Delete order #${orderId}?`);
    if (!confirmed) return;

    try {
        const res = await fetch(`${API_BASE}/user/orders/${orderId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${customerToken}` }
        });

        if (res.status === 401) {
            localStorage.clear();
            window.location.href = "login.html";
            return;
        }

        const data = await res.json().catch(() => null);
        if (!res.ok) {
            throw new Error(data?.message || `Could not delete order (HTTP ${res.status})`);
        }

        showFeedback(data?.message || "The order was removed from your order history.", "success");
        await loadCustomerOrders();
    } catch (e) {
        showFeedback(e.message, "error");
    }
}

async function loadCustomerOrders() {
    try {
        showFeedback("", "success");
        const orders = await fetchOrders();
        if (!orders) return;
        renderSummary(orders);
        renderOrders(orders);
    } catch (e) {
        if (customerSummaryEl) customerSummaryEl.innerHTML = "";
        if (customerListEl) customerListEl.innerHTML = `<div class="orders-empty">${escapeHtml(e.message)}</div>`;
        showFeedback(e.message, "error");
    }
}

loadCustomerOrders();
setInterval(loadCustomerOrders, 10000);

window.deleteCustomerOrder = deleteCustomerOrder;
