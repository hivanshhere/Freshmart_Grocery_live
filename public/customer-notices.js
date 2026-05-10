(function () {
    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function statement(item) {
        return String(item?.notes || item?.admin_notes || item?.message || "").trim();
    }

    function readStorageKey(userId, bucket) {
        return `freshMartRead:${bucket}:${userId || "unknown"}`;
    }

    function getReadIds(userId, bucket) {
        try {
            const raw = localStorage.getItem(readStorageKey(userId, bucket));
            const ids = JSON.parse(raw || "[]");
            return new Set(Array.isArray(ids) ? ids.map(String) : []);
        } catch {
            return new Set();
        }
    }

    function saveReadIds(userId, bucket, ids) {
        try {
            localStorage.setItem(readStorageKey(userId, bucket), JSON.stringify([...ids]));
        } catch {
        }
    }

    function markReadOnOpen(container, userId, bucket, ids) {
        const uniqueIds = [...new Set(ids.filter(Boolean).map(String))];
        if (!container || !uniqueIds.length) return;
        const details = container.querySelector("details");
        if (!details) return;
        details.addEventListener("toggle", () => {
            if (!details.open) return;
            const readIds = getReadIds(userId, bucket);
            uniqueIds.forEach((id) => readIds.add(id));
            saveReadIds(userId, bucket, readIds);
            markReadOnServer(uniqueIds);
        }, { once: true });
    }

    function markReadOnServer(ids) {
        const extractId = (value) => String(value || "").split(":").slice(1).join(":");
        const isObjectId = (value) => /^[a-f\d]{24}$/i.test(value);
        const action_ids = ids
            .filter((id) => id.includes("-action:"))
            .map(extractId)
            .filter(isObjectId);
        const report_ids = ids
            .filter((id) => id.includes("-report:"))
            .map(extractId)
            .filter(isObjectId);
        if (!action_ids.length && !report_ids.length) return;
        if (typeof fetch !== "function") return;

        const apiBase = window.AppAuth?.API_BASE || (window.location.origin && /^https?:/i.test(window.location.origin)
            ? window.location.origin
            : "http://localhost:3000");
        const token = window.AppAuth?.getToken ? window.AppAuth.getToken() : (localStorage.getItem("authToken") || "");
        fetch(`${apiBase}/notices/read`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ action_ids, report_ids })
        }).catch(() => {});
    }

    function actionReadId(action, type) {
        return `${type}-action:${String(action?.id || action?._id || action?.created_at || statement(action))}`;
    }

    function reportReadId(report, type) {
        return `${type}-report:${String(report?.id || report?._id || report?.updated_at || report?.created_at || statement(report))}`;
    }

    function actionLabel(action) {
        const normalized = String(action || "").toLowerCase();
        if (normalized === "warning") return "Warning Issued";
        if (normalized === "message") return "Admin Message";
        if (normalized === "ban" || normalized === "banned") return "Banned";
        if (normalized === "remove" || normalized === "removed") return "Removed";
        if (normalized === "dismissed") return "Dismissed";
        if (normalized === "activate") return "Reactivated";
        return "Under Review";
    }

    function prefixFor(container) {
        if (container.classList.contains("owner-review-notice")) return "owner-review-notice";
        if (container.classList.contains("owner-notice")) return "owner-notice";
        if (container.classList.contains("store-account-warning")) return "store-account-warning";
        if (container.classList.contains("admin-message-panel")) return "admin-message-panel";
        return "account-review";
    }

    function itemHtml(prefix, title, meta, label, body) {
        if (prefix === "owner-notice" || prefix === "owner-review-notice") {
            return `
                <div class="${prefix}__item">
                    ${title ? `<h4>${escapeHtml(title)}</h4>` : ""}
                    ${meta ? `<div class="${prefix}__meta">${escapeHtml(meta)}</div>` : ""}
                    <span class="${prefix}__label">${escapeHtml(label)}</span>
                    <p>${escapeHtml(body)}</p>
                </div>
            `;
        }

        return `
            <div class="${prefix}__item">
                ${title ? `<h4>${escapeHtml(title)}</h4>` : ""}
                ${meta ? `<div class="${prefix}__meta">${escapeHtml(meta)}</div>` : ""}
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(body)}</strong>
            </div>
        `;
    }

    function renderCustomerAccountNotice(session, options = {}) {
        const container = typeof options.container === "string"
            ? document.getElementById(options.container)
            : options.container;
        const reviewContainer = typeof options.reviewContainer === "string"
            ? document.getElementById(options.reviewContainer)
            : options.reviewContainer;
        if (!container || session?.user?.role !== "customer") return;

        const profile = session.user || {};
        const userId = String(profile.id || localStorage.getItem("userId") || "");
        const reports = Array.isArray(session.moderation_reports) ? session.moderation_reports : [];
        const actions = Array.isArray(session.admin_actions)
            ? session.admin_actions
            : (Array.isArray(session.warning_actions) ? session.warning_actions : []);
        const warningCount = Number(profile.warning_count ?? localStorage.getItem("warningCount") ?? 0);
        const banReason = String(profile.ban_reason || localStorage.getItem("banReason") || "").trim();
        const status = String(profile.account_status || localStorage.getItem("accountStatus") || "active").toLowerCase();
        const readWarningIds = getReadIds(userId, "customer-warnings");
        const readReviewIds = getReadIds(userId, "customer-reviews");

        const warningActions = actions
            .filter((action) => String(action.action_type || "").toLowerCase() === "warning" && statement(action))
            .slice()
            .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        const messageActions = actions.filter((action) => String(action.action_type || "").toLowerCase() === "message" && statement(action));
        const warningReports = reports.filter((report) => {
            const isForMe = String(report.target_user_id || "") === userId;
            const reportAction = String(report.resolution_action || "").toLowerCase();
            const reportStatus = String(report.status || "").toLowerCase();
            return isForMe && reportAction === "warning" && reportStatus === "resolved";
        });
        const unreadWarningActions = warningActions.filter((action) => !action.read_by_current_user && !readWarningIds.has(actionReadId(action, "warning")));
        const unreadWarningReports = warningReports.filter((report) => !report.read_by_current_user && !readWarningIds.has(reportReadId(report, "warning")));
        const fallbackWarningId = `warning-fallback:${warningCount}:${banReason || status}`;
        const hasFallbackWarning = warningActions.length === 0 && warningReports.length === 0 && (status === "warned" || warningCount > 0 || Boolean(banReason)) && !readWarningIds.has(fallbackWarningId);
        const positiveReviews = reports.filter((report) => {
            const isForMe = String(report.target_user_id || "") === userId;
            const isReview = String(report.report_type || "").toLowerCase() === "review";
            const rating = Number(report.rating) || 0;
            return isForMe && isReview && rating >= 4 && String(report.message || "").trim();
        });
        const adminReviewMessages = reports.filter((report) => {
            const isForMe = String(report.target_user_id || "") === userId;
            return isForMe && String(report.resolution_action || "").toLowerCase() === "message" && String(report.admin_notes || "").trim();
        });
        const unreadMessageActions = messageActions.filter((action) => !action.read_by_current_user && !readReviewIds.has(actionReadId(action, "message")));
        const unreadPositiveReviews = positiveReviews.filter((report) => !report.read_by_current_user && !readReviewIds.has(reportReadId(report, "review")));
        const unreadAdminReviewMessages = adminReviewMessages.filter((report) => !report.read_by_current_user && !readReviewIds.has(reportReadId(report, "review-message")));

        const hasWarning = warningActions.length > 0 || warningReports.length > 0 || hasFallbackWarning;
        const hasReviewUpdates = messageActions.length > 0 || positiveReviews.length > 0 || adminReviewMessages.length > 0;
        const unreadWarningTotal = unreadWarningActions.length + unreadWarningReports.length + (hasFallbackWarning ? 1 : 0);
        const unreadReviewTotal = unreadMessageActions.length + unreadPositiveReviews.length + unreadAdminReviewMessages.length;

        if (!hasWarning) {
            container.style.display = "none";
            container.innerHTML = "";
            if (prefixFor(container) === "owner-notice") {
                container.className = "owner-notice";
            }
        }

        const prefix = prefixFor(container);
        const totalWarningItems = warningActions.length + warningReports.length + (hasFallbackWarning ? 1 : 0);
        const warningHtml = warningActions.map((action, index) => itemHtml(
            prefix,
            `Warning ${index + 1}${totalWarningItems > 1 ? ` of ${totalWarningItems}` : ""} From Admin`,
            `Sent by ${action.admin_name || "Admin"}`,
            "Warning Message",
            statement(action)
        )).join("");
        const fallbackWarningHtml = hasFallbackWarning
            ? itemHtml(prefix, "Warning From Admin", "", "Warning Message", banReason || "Please review your recent activity and follow the platform rules to avoid stronger action.")
            : "";
        const reportHtml = warningReports.map((report) => {
            if (prefix === "owner-notice") {
                return `
                    <div class="owner-notice__item">
                        <h4>${escapeHtml(report.report_type || "Complaint")} - ${escapeHtml(actionLabel(report.resolution_action || report.status))}</h4>
                        <div class="owner-notice__meta">Reported by ${escapeHtml(report.reporter_name || "Store Owner")} (${escapeHtml(report.reporter_role || "owner")})${report.store_name ? ` for ${escapeHtml(report.store_name)}` : ""}</div>
                        <span class="owner-notice__label">Reported Issue</span>
                        <p>${escapeHtml(report.message || "No details provided.")}</p>
                        <span class="owner-notice__label">Admin Note</span>
                        <p>${escapeHtml(report.admin_notes || "No admin note added.")}</p>
                    </div>
                `;
            }
            return `
                <div class="${prefix}__item">
                    <h4>${escapeHtml(report.report_type || "Complaint")} - ${escapeHtml(actionLabel(report.resolution_action || report.status))}</h4>
                    <div class="${prefix}__meta">Reported by ${escapeHtml(report.reporter_name || "Store Owner")} (${escapeHtml(report.reporter_role || "owner")})${report.store_name ? ` for ${escapeHtml(report.store_name)}` : ""}</div>
                    <span>Reported Issue</span>
                    <strong>${escapeHtml(report.message || "No details provided.")}</strong>
                    <span>Admin Note</span>
                    <strong>${escapeHtml(report.admin_notes || "No admin note added.")}</strong>
                </div>
            `;
        }).join("");

        const noticeItemsHtml = `
            ${warningHtml}
            ${fallbackWarningHtml}
            ${reportHtml}
        `;
        const noticeListHtml = prefix === "owner-notice" && noticeItemsHtml.trim()
            ? `<div class="owner-notice__list">${noticeItemsHtml}</div>`
            : noticeItemsHtml;

        if (hasWarning) {
            container.style.display = "block";
            if (prefix === "owner-notice") {
                container.className = "owner-notice owner-notice--error";
            }
            container.innerHTML = `
                <details class="${prefix}__details">
                    <summary>Warnings${unreadWarningTotal > 0 ? ` (${unreadWarningTotal})` : ""}</summary>
                    ${unreadWarningTotal > 0 ? `<p>You have ${unreadWarningTotal} unread warning${unreadWarningTotal === 1 ? "" : "s"} from the admin.</p>` : ""}
                    ${noticeListHtml}
                </details>
            `;
            markReadOnOpen(container, userId, "customer-warnings", [
                ...unreadWarningActions.map((action) => actionReadId(action, "warning")),
                ...unreadWarningReports.map((report) => reportReadId(report, "warning")),
                ...(hasFallbackWarning ? [fallbackWarningId] : [])
            ]);
        }

        if (!reviewContainer) return;

        if (!hasReviewUpdates) {
            reviewContainer.style.display = "none";
            reviewContainer.innerHTML = "";
            return;
        }

        const reviewPrefix = prefixFor(reviewContainer);
        const messageHtml = messageActions.map((action) => itemHtml(
            reviewPrefix,
            "Message From Admin",
            `Sent by ${action.admin_name || "Admin"}`,
            "Message Statement",
            statement(action)
        )).join("");
        const reviewHtml = positiveReviews.map((report) => itemHtml(
            reviewPrefix,
            `Positive Review${report.rating ? ` (${Number(report.rating)}/5)` : ""}`,
            `From ${report.reporter_name || "Store Owner"}${report.store_name ? ` for ${report.store_name}` : ""}`,
            "Feedback",
            report.message
        )).join("");
        const reviewMessageHtml = adminReviewMessages.map((report) => itemHtml(
            reviewPrefix,
            "Admin Message About Review",
            "",
            "Message Statement",
            report.admin_notes
        )).join("");
        const reviewItemsHtml = `${messageHtml}${reviewHtml}${reviewMessageHtml}`;
        const reviewListHtml = reviewPrefix === "owner-review-notice" && reviewItemsHtml.trim()
            ? `<div class="owner-review-notice__list">${reviewItemsHtml}</div>`
            : reviewItemsHtml;

        reviewContainer.style.display = "block";
        reviewContainer.innerHTML = `
            <details class="${reviewPrefix}__details">
                <summary>${positiveReviews.length ? "Reviews" : "Messages"}${unreadReviewTotal > 0 ? ` (${unreadReviewTotal})` : ""}</summary>
                ${unreadReviewTotal > 0 ? `<p>You have ${unreadReviewTotal} unread review/message update${unreadReviewTotal === 1 ? "" : "s"} for your customer account.</p>` : ""}
                ${reviewListHtml}
            </details>
        `;
        markReadOnOpen(reviewContainer, userId, "customer-reviews", [
            ...unreadMessageActions.map((action) => actionReadId(action, "message")),
            ...unreadPositiveReviews.map((report) => reportReadId(report, "review")),
            ...unreadAdminReviewMessages.map((report) => reportReadId(report, "review-message"))
        ]);
    }

    window.CustomerNotices = {
        renderCustomerAccountNotice
    };
})();
