const API_BASE = "http://localhost:3000";

const adminRole = localStorage.getItem("userRole");
const adminToken = localStorage.getItem("authToken");

if (adminRole !== "admin" || !adminToken) {
    alert("Please login as admin");
    window.location.href = "login.html";
}

const feedbackEl = document.getElementById("adminFeedback");
const reportsEl = document.getElementById("adminReportsList");
const actionsEl = document.getElementById("adminActionsList");
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
    if (normalized === "resolved") return "status-pill status-pill--resolved";
    if (normalized === "dismissed") return "status-pill status-pill--dismissed";
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

function renderReports(reports) {
    if (!reports.length) {
        reportsEl.innerHTML = `<div class="orders-empty">No complaints or reviews submitted yet.</div>`;
        return;
    }

    reportsEl.innerHTML = reports.map((report) => `
        <article class="admin-card">
            <div class="admin-card__top">
                <div>
                    <h4>${escapeHtml(report.report_type)} for ${escapeHtml(report.target_name)}</h4>
                    <p class="${statusClass(report.status)}">${escapeHtml(report.status)}</p>
                </div>
                <div>
                    <strong>Order #${escapeHtml(report.order_display_number || report.order_id || "")}</strong>
                </div>
            </div>

            <div class="admin-card__meta">
                <div><span>Reporter</span><strong>${escapeHtml(report.reporter_name)} (${escapeHtml(report.reporter_role)})</strong></div>
                <div><span>Target</span><strong>${escapeHtml(report.target_name)} (${escapeHtml(report.target_role)})</strong></div>
                <div><span>Store</span><strong>${escapeHtml(report.store_name || "N/A")}</strong></div>
                <div><span>Rating</span><strong>${report.rating ? `${Number(report.rating)}/5` : "Not provided"}</strong></div>
            </div>

            <div class="admin-card__message">
                <span>Message</span>
                <p>${escapeHtml(report.message)}</p>
            </div>

            <input class="admin-card__note" id="reportNote-${escapeHtml(report.id)}" placeholder="Admin note for this action">

            <div class="admin-card__actions">
                <button type="button" class="orders-btn orders-btn--primary" onclick="takeReportAction('${escapeHtml(report.id)}', '${escapeHtml(report.target_user_id)}', 'warning')">Issue Warning</button>
                <button type="button" class="orders-btn orders-btn--danger" onclick="takeReportAction('${escapeHtml(report.id)}', '${escapeHtml(report.target_user_id)}', 'ban')">Ban User</button>
                <button type="button" class="orders-btn orders-btn--danger" onclick="takeReportAction('${escapeHtml(report.id)}', '${escapeHtml(report.target_user_id)}', 'remove')">Remove User</button>
                <button type="button" class="orders-btn orders-btn--ghost" onclick="dismissReport('${escapeHtml(report.id)}')">Dismiss Report</button>
            </div>
        </article>
    `).join("");
}

function renderActions(actions) {
    if (!actions.length) {
        actionsEl.innerHTML = `<div class="orders-empty">No admin actions have been recorded yet.</div>`;
        return;
    }

    actionsEl.innerHTML = actions.map((action) => `
        <article class="admin-card">
            <div class="admin-card__top">
                <div>
                    <h4>${escapeHtml(action.action_type)}</h4>
                    <p>${escapeHtml(action.admin_name)} acted on ${escapeHtml(action.target_name)} (${escapeHtml(action.target_role)})</p>
                </div>
            </div>
            <div class="admin-card__message">
                <span>Notes</span>
                <p>${escapeHtml(action.notes || "No notes added")}</p>
            </div>
        </article>
    `).join("");
}

async function loadComplaints() {
    try {
        showFeedback("", "success");
        const data = await fetchJson(`${API_BASE}/admin/dashboard`, {
            headers: { "Authorization": `Bearer ${adminToken}` }
        });
        if (!data) return;
        renderReports(Array.isArray(data.reports) ? data.reports : []);
        renderActions(Array.isArray(data.actions) ? data.actions : []);
    } catch (e) {
        showFeedback(e.message, "error");
    }
}

async function takeReportAction(reportId, targetUserId, action) {
    const note = String(document.getElementById(`reportNote-${reportId}`)?.value || "").trim();

    try {
        const data = await fetchJson(`${API_BASE}/admin/users/${targetUserId}/action`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${adminToken}`
            },
            body: JSON.stringify({ action, notes: note, report_id: reportId })
        });
        showFeedback(data?.message || "Admin action saved", "success");
        window.alert(data?.message || "Admin action saved");
        await loadComplaints();
    } catch (e) {
        showFeedback(e.message, "error");
    }
}

async function dismissReport(reportId) {
    const note = String(document.getElementById(`reportNote-${reportId}`)?.value || "").trim();

    try {
        const data = await fetchJson(`${API_BASE}/admin/reports/${reportId}/dismiss`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${adminToken}`
            },
            body: JSON.stringify({ notes: note })
        });
        showFeedback(data?.message || "Report dismissed", "success");
        window.alert(data?.message || "Report dismissed");
        await loadComplaints();
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

window.takeReportAction = takeReportAction;
window.dismissReport = dismissReport;

loadComplaints();
