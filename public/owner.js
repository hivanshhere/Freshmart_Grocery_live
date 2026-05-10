const API_BASE = window.AppAuth?.API_BASE || (window.location.origin && /^https?:/i.test(window.location.origin)
    ? window.location.origin
    : "http://localhost:3000");

const msgEl = document.getElementById("msg");
const ownerAccountNoticeEl = document.getElementById("ownerAccountNotice");
const ownerReviewNoticeEl = document.getElementById("ownerReviewNotice");
const storeDisplayNameEl = document.getElementById("storeDisplayName");
const storeDisplayIdEl = document.getElementById("storeDisplayId");
const createStoreSectionEl = document.getElementById("createStoreSection");
const editStoreSectionEl = document.getElementById("editStoreSection");
const editStoreNameInput = document.getElementById("editStoreName");
const storeLatitudeEl = document.getElementById("storeLatitude");
const storeLongitudeEl = document.getElementById("storeLongitude");
const addProductBtn = document.getElementById("addProductBtn");
const ownerProductListEl = document.getElementById("ownerProductList");
const deliveryAvailableEl = document.getElementById("deliveryAvailable");
const deliveryChargeEl = document.getElementById("deliveryCharge");
const minOrderEl = document.getElementById("minOrder");
const pickupAvailableEl = document.getElementById("pickupAvailable");
const slotTimeInputEl = document.getElementById("slotTimeInput");
const slotListEl = document.getElementById("slotList");
const productFormEl = document.getElementById("productForm");
const addProductFieldErrors = {
    name: document.getElementById("pnameError"),
    description: document.getElementById("pdescriptionError"),
    price: document.getElementById("ppriceError"),
    quantity: document.getElementById("pquantityError"),
    unit: document.getElementById("punitError")
};

let currentStore = null;

function clearAddProductErrors() {
    Object.values(addProductFieldErrors).forEach((el) => {
        if (el) el.innerText = "";
    });
}

function setAddProductError(field, message) {
    clearAddProductErrors();
    const el = addProductFieldErrors[field];
    if (el) el.innerText = message || "";
}

function bindUppercaseInput(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener("input", () => {
        const start = inputEl.selectionStart;
        const end = inputEl.selectionEnd;
        const next = String(inputEl.value || "").toUpperCase();
        if (inputEl.value !== next) inputEl.value = next;
        if (typeof start === "number" && typeof end === "number") {
            inputEl.setSelectionRange(start, end);
        }
    });
}

bindUppercaseInput(document.getElementById("storeName"));
bindUppercaseInput(editStoreNameInput);

function ownerToken() {
    return window.AppAuth?.getToken ? window.AppAuth.getToken() : (localStorage.getItem("authToken") || "");
}

function formatAdminAction(action) {
    const normalized = String(action || "").toLowerCase();
    if (normalized === "warning") return "Warning Issued";
    if (normalized === "ban") return "Banned";
    if (normalized === "remove") return "Removed";
    if (normalized === "dismissed") return "Dismissed";
    if (normalized === "activate") return "Reactivated";
    if (normalized === "message") return "Admin Message";
    return "Under Review";
}

function formatWarningMessage(warning) {
    return String(warning?.notes || warning?.admin_notes || warning?.message || "").trim();
}

function ownerReadStorageKey(userId, bucket) {
    return `freshMartRead:${bucket}:${userId || "unknown"}`;
}

function getOwnerReadIds(userId, bucket) {
    try {
        const raw = localStorage.getItem(ownerReadStorageKey(userId, bucket));
        const ids = JSON.parse(raw || "[]");
        return new Set(Array.isArray(ids) ? ids.map(String) : []);
    } catch {
        return new Set();
    }
}

function saveOwnerReadIds(userId, bucket, ids) {
    try {
        localStorage.setItem(ownerReadStorageKey(userId, bucket), JSON.stringify([...ids]));
    } catch {
    }
}

function markOwnerReadOnOpen(container, userId, bucket, ids) {
    const uniqueIds = [...new Set(ids.filter(Boolean).map(String))];
    if (!container || !uniqueIds.length) return;
    const details = container.querySelector("details");
    if (!details) return;
    details.addEventListener("toggle", () => {
        if (!details.open) return;
        const readIds = getOwnerReadIds(userId, bucket);
        uniqueIds.forEach((id) => readIds.add(id));
        saveOwnerReadIds(userId, bucket, readIds);
        markOwnerReadOnServer(uniqueIds);
    }, { once: true });
}

function markOwnerReadOnServer(ids) {
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

    fetch(`${API_BASE}/notices/read`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${ownerToken()}`
        },
        body: JSON.stringify({ action_ids, report_ids })
    }).catch(() => {});
}

function ownerActionReadId(action, type) {
    return `${type}-action:${String(action?.id || action?._id || action?.created_at || formatWarningMessage(action))}`;
}

function ownerReportReadId(report, type) {
    return `${type}-report:${String(report?.id || report?._id || report?.updated_at || report?.created_at || formatWarningMessage(report))}`;
}

function showOwnerNotice(profile, moderationReports = [], adminActions = []) {
    const status = String(profile?.account_status || localStorage.getItem("accountStatus") || "active").toLowerCase();
    const warningCount = Number(profile?.warning_count ?? localStorage.getItem("warningCount") ?? 0);
    const banReason = String(profile?.ban_reason || localStorage.getItem("banReason") || "").trim();
    const userId = String(profile?.id || localStorage.getItem("userId") || "");
    const readWarningIds = getOwnerReadIds(userId, "owner-warnings");
    const readReviewIds = getOwnerReadIds(userId, "owner-reviews");
    const visibleWarningReports = Array.isArray(moderationReports)
        ? moderationReports.filter((report) => {
            const isForMe = String(report.target_user_id || "") === userId;
            const action = String(report.resolution_action || "").toLowerCase();
            const statusValue = String(report.status || "").toLowerCase();
            return isForMe && action === "warning" && statusValue === "resolved";
        })
        : [];
    const visibleWarnings = Array.isArray(adminActions)
        ? adminActions.filter((action) => String(action.action_type || "").toLowerCase() === "warning" && formatWarningMessage(action))
        : [];
    const warningItems = visibleWarnings
        .slice()
        .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    const unreadWarningItems = warningItems.filter((warning) => !warning.read_by_current_user && !readWarningIds.has(ownerActionReadId(warning, "warning")));
    const unreadWarningReports = visibleWarningReports.filter((report) => !report.read_by_current_user && !readWarningIds.has(ownerReportReadId(report, "warning")));
    const fallbackWarningId = `warning-fallback:${warningCount}:${banReason || status}`;
    const hasFallbackWarning = warningItems.length === 0 && visibleWarningReports.length === 0 && (status === "warned" || warningCount > 0 || Boolean(banReason)) && !readWarningIds.has(fallbackWarningId);
    const totalWarningItems = unreadWarningItems.length + unreadWarningReports.length + (hasFallbackWarning ? 1 : 0);
    const visibleMessages = Array.isArray(adminActions)
        ? adminActions.filter((action) => String(action.action_type || "").toLowerCase() === "message" && formatWarningMessage(action))
        : [];
    const positiveReviews = Array.isArray(moderationReports)
        ? moderationReports.filter((report) => {
            const isForMe = String(report.target_user_id || "") === userId;
            const isReview = String(report.report_type || "").toLowerCase() === "review";
            const rating = Number(report.rating) || 0;
            return isForMe && isReview && rating >= 4 && String(report.message || "").trim();
        })
        : [];
    const adminReviewMessages = Array.isArray(moderationReports)
        ? moderationReports.filter((report) => {
            const isForMe = String(report.target_user_id || "") === userId;
            return isForMe && String(report.resolution_action || "").toLowerCase() === "message" && String(report.admin_notes || "").trim();
        })
        : [];
    const unreadMessages = visibleMessages.filter((message) => !message.read_by_current_user && !readReviewIds.has(ownerActionReadId(message, "message")));
    const unreadPositiveReviews = positiveReviews.filter((report) => !report.read_by_current_user && !readReviewIds.has(ownerReportReadId(report, "review")));
    const unreadAdminReviewMessages = adminReviewMessages.filter((report) => !report.read_by_current_user && !readReviewIds.has(ownerReportReadId(report, "review-message")));
    const hasWarningUpdates = warningItems.length > 0 || visibleWarningReports.length > 0 || hasFallbackWarning;
    const hasReviewUpdates = visibleMessages.length > 0 || positiveReviews.length > 0 || adminReviewMessages.length > 0;
    const unreadWarningTotal = totalWarningItems;
    const unreadReviewTotal = unreadMessages.length + unreadPositiveReviews.length + unreadAdminReviewMessages.length;

    if (ownerAccountNoticeEl && !hasWarningUpdates) {
        ownerAccountNoticeEl.style.display = "none";
        ownerAccountNoticeEl.innerHTML = "";
        ownerAccountNoticeEl.className = "owner-notice";
    }

    const totalWarningDisplayItems = warningItems.length + visibleWarningReports.length + (hasFallbackWarning ? 1 : 0);
    const warningsHtml = warningItems.length
        ? `
            <div class="owner-notice__list">
                ${warningItems.map((warning, index) => `
                    <div class="owner-notice__item">
                        <h4>Warning ${index + 1}${totalWarningDisplayItems > 1 ? ` of ${totalWarningDisplayItems}` : ""} From Admin</h4>
                        <div class="owner-notice__meta">Sent by ${escapeHtml(warning.admin_name || "Admin")}</div>
                        <span class="owner-notice__label">Warning Message</span>
                        <p>${escapeHtml(formatWarningMessage(warning))}</p>
                    </div>
                `).join("")}
            </div>
        `
        : "";

    const reportsHtml = visibleWarningReports.length
        ? `
            <div class="owner-notice__list">
                ${visibleWarningReports.map((report) => `
                    <div class="owner-notice__item">
                        <h4>${escapeHtml(report.report_type || "Complaint")} on Order #${Number(report.order_id) || 0} - ${escapeHtml(formatAdminAction(report.resolution_action || report.status))}</h4>
                        <div class="owner-notice__meta">Reported by ${escapeHtml(report.reporter_name || "Customer")} (${escapeHtml(report.reporter_role || "customer")})${report.store_name ? ` for ${escapeHtml(report.store_name)}` : ""}</div>
                        <span class="owner-notice__label">Customer Issue</span>
                        <p>${escapeHtml(report.message || "No details provided.")}</p>
                        <span class="owner-notice__label">${String(report.resolution_action || "").toLowerCase() === "message" ? "Admin Message" : "Admin Note"}</span>
                        <p>${escapeHtml(report.admin_notes || "No admin note added.")}</p>
                    </div>
                `).join("")}
            </div>
        `
        : "";

    if (ownerAccountNoticeEl && hasWarningUpdates) {
        ownerAccountNoticeEl.style.display = "block";
        ownerAccountNoticeEl.className = "owner-notice owner-notice--error";
        ownerAccountNoticeEl.innerHTML = `
            <details class="owner-notice__details">
                <summary>Warnings${unreadWarningTotal > 0 ? ` (${unreadWarningTotal})` : ""}</summary>
                ${unreadWarningTotal > 0 ? `<p>You have ${unreadWarningTotal} unread warning${unreadWarningTotal === 1 ? "" : "s"} from the admin.</p>` : ""}
                ${hasFallbackWarning ? `<p><strong>Warning:</strong> ${escapeHtml(banReason || "Please review your recent activity and follow the platform rules to avoid stronger action.")}</p>` : ""}
                ${warningsHtml}
                ${reportsHtml}
            </details>
        `;
        markOwnerReadOnOpen(ownerAccountNoticeEl, userId, "owner-warnings", [
            ...unreadWarningItems.map((warning) => ownerActionReadId(warning, "warning")),
            ...unreadWarningReports.map((report) => ownerReportReadId(report, "warning")),
            ...(hasFallbackWarning ? [fallbackWarningId] : [])
        ]);
    }

    if (ownerReviewNoticeEl && !hasReviewUpdates) {
        ownerReviewNoticeEl.style.display = "none";
        ownerReviewNoticeEl.innerHTML = "";
        return;
    }

    const messagesHtml = visibleMessages.length
        ? visibleMessages.map((message) => `
            <div class="owner-review-notice__item">
                <h4>Message From Admin</h4>
                <div class="owner-review-notice__meta">Sent by ${escapeHtml(message.admin_name || "Admin")}</div>
                <span class="owner-review-notice__label">Message Statement</span>
                <p>${escapeHtml(formatWarningMessage(message))}</p>
            </div>
        `).join("")
        : "";
    const reviewsHtml = positiveReviews.length || adminReviewMessages.length
        ? `
                ${positiveReviews.map((report) => `
                    <div class="owner-review-notice__item">
                        <h4>Positive Review ${report.rating ? `(${Number(report.rating)}/5)` : ""}</h4>
                        <div class="owner-review-notice__meta">From ${escapeHtml(report.reporter_name || "Customer")}${report.store_name ? ` for ${escapeHtml(report.store_name)}` : ""}</div>
                        <span class="owner-review-notice__label">Feedback</span>
                        <p>${escapeHtml(report.message)}</p>
                    </div>
                `).join("")}
                ${adminReviewMessages.map((report) => `
                    <div class="owner-review-notice__item">
                        <h4>Admin Message About Review</h4>
                        <span class="owner-review-notice__label">Message Statement</span>
                        <p>${escapeHtml(report.admin_notes)}</p>
                    </div>
                `).join("")}
        `
        : "";

    if (ownerReviewNoticeEl && hasReviewUpdates) {
        ownerReviewNoticeEl.style.display = "block";
        ownerReviewNoticeEl.innerHTML = `
            <details class="owner-review-notice__details">
                <summary>${positiveReviews.length ? "Reviews" : "Messages"}${unreadReviewTotal > 0 ? ` (${unreadReviewTotal})` : ""}</summary>
                ${unreadReviewTotal > 0 ? `<p>You have ${unreadReviewTotal} unread review/message update${unreadReviewTotal === 1 ? "" : "s"} for your store owner account.</p>` : ""}
                <div class="owner-review-notice__list">
                    ${messagesHtml}
                    ${reviewsHtml}
                </div>
            </details>
        `;
        markOwnerReadOnOpen(ownerReviewNoticeEl, userId, "owner-reviews", [
            ...unreadMessages.map((message) => ownerActionReadId(message, "message")),
            ...unreadPositiveReviews.map((report) => ownerReportReadId(report, "review")),
            ...unreadAdminReviewMessages.map((report) => ownerReportReadId(report, "review-message"))
        ]);
    }
}

function setMsg(text, type) {
    if (!msgEl) return;
    msgEl.innerText = text || "";
    msgEl.className = "";
    if (type === "success") msgEl.classList.add("msg--success");
    if (type === "error") msgEl.classList.add("msg--error");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function authHeaders(extra = {}) {
    return {
        "Authorization": `Bearer ${ownerToken()}`,
        ...extra
    };
}

async function fetchJson(url, options = {}) {
    const res = await fetch(url, options);
    if (res.status === 401 || res.status === 403) {
        window.AppAuth?.clearStoredSession?.();
        window.location.href = "login.html";
        return null;
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || "Server error");
    }
    return data;
}

function setStoreUi(store) {
    if (!store) {
        storeDisplayNameEl.innerText = "Not created";
        storeDisplayIdEl.innerText = "-";
        createStoreSectionEl.style.display = "block";
        editStoreSectionEl.style.display = "none";
        storeLatitudeEl.value = "";
        storeLongitudeEl.value = "";
        addProductBtn.disabled = true;
        ownerProductListEl.innerHTML = "";
        slotListEl.innerHTML = "";
        return;
    }

    storeDisplayNameEl.innerText = String(store.store_name || "").toUpperCase();
    storeDisplayIdEl.innerText = String(store.display_id || store.id);
    createStoreSectionEl.style.display = "none";
    editStoreSectionEl.style.display = "block";
    editStoreNameInput.value = String(store.store_name || "").toUpperCase();
    storeLatitudeEl.value = store.latitude ?? "";
    storeLongitudeEl.value = store.longitude ?? "";
    addProductBtn.disabled = false;

    localStorage.setItem("storeId", String(store.id));
    localStorage.setItem("storeName", String(store.store_name || "").toUpperCase());

    deliveryAvailableEl.checked = !!store.delivery_available;
    deliveryChargeEl.value = Number(store.delivery_charge || 0);
    minOrderEl.value = Number(store.min_order_free_delivery || 0);
    pickupAvailableEl.checked = !!store.pickup_available;
}

function renderProducts(products) {
    if (!ownerProductListEl) return;

    if (!products || products.length === 0) {
        ownerProductListEl.innerHTML = "<div class='store-card'><h3>No products yet</h3><p>Add your first product above.</p></div>";
        return;
    }

    ownerProductListEl.innerHTML = products.map((product) => {
        const quantity = Number(product.quantity || 0);
        const price = Number(product.price || 0);
        const description = String(product.description || "").trim();
        const image = product.image ? `<img src="${API_BASE}/uploads/${encodeURIComponent(product.image)}" class="product-img" alt="${escapeHtml(product.name)}">` : "";
        return `
            <div class="store-card">
                ${image}
                <h3>${escapeHtml(product.name)}</h3>
                ${description ? `<p class="product-description">${escapeHtml(description)}</p>` : ""}
                <p>Price: Rs. ${price.toFixed(2)} / ${quantity} ${escapeHtml(product.unit || "")}</p>
                <button type="button" class="store-card__remove-btn" onclick="removeProduct('${escapeHtml(product.id)}')">Remove Product</button>
            </div>
        `;
    }).join("");
}

function renderSlots(slots) {
    if (!slotListEl) return;
    if (!slots || slots.length === 0) {
        slotListEl.innerHTML = "<p class='help-text'>No pickup slots added yet.</p>";
        return;
    }

    slotListEl.innerHTML = `
        <div class="slot-list">
            ${slots.map((slot) => `
                <div class="slot-row">
                    <span class="slot-row__time">${escapeHtml(slot.slot_time)}</span>
                    <button type="button" class="slot-row__btn" onclick="removeTimeSlot('${escapeHtml(slot.id)}')">Remove</button>
                </div>
            `).join("")}
        </div>
    `;
}

async function loadStoreAndProducts() {
    try {
        setMsg("");
        const [profileData, storeData] = await Promise.all([
            fetchJson(`${API_BASE}/auth/me?includeReports=1`, { headers: authHeaders() }),
            fetchJson(`${API_BASE}/owner/store`, { headers: authHeaders() })
        ]);

        const ownerProfile = profileData?.user || null;
        const moderationReports = profileData?.moderation_reports || [];
        const adminActions = profileData?.admin_actions || profileData?.warning_actions || [];
        if (ownerProfile) {
            localStorage.setItem("accountStatus", ownerProfile.account_status || "active");
            localStorage.setItem("warningCount", String(ownerProfile.warning_count || 0));
            localStorage.setItem("banReason", ownerProfile.ban_reason || "");
        }
        showOwnerNotice(ownerProfile, moderationReports, adminActions);

        currentStore = storeData;
        setStoreUi(currentStore);

        if (!currentStore) return;

        const [productsData, slotsData] = await Promise.all([
            fetchJson(`${API_BASE}/owner/products`, { headers: authHeaders() }),
            fetchJson(`${API_BASE}/owner/slots`, { headers: authHeaders() })
        ]);

        renderProducts(productsData?.products || []);
        renderSlots(slotsData?.slots || []);
    } catch (e) {
        setMsg(e.message, "error");
    }
}

async function createStore() {
    const storeName = document.getElementById("storeName").value.trim().toUpperCase();
    if (!storeName) {
        setMsg("Enter store name", "error");
        return;
    }

    try {
        const data = await fetchJson(`${API_BASE}/owner/store`, {
            method: "POST",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ store_name: storeName })
        });
        currentStore = data.store;
        setStoreUi(currentStore);
        setMsg(data.message || "Store created", "success");
        await loadStoreAndProducts();
    } catch (e) {
        setMsg(e.message, "error");
    }
}

async function updateStoreName() {
    if (!currentStore) {
        setMsg("Create your store first", "error");
        return;
    }

    const storeName = editStoreNameInput.value.trim().toUpperCase();
    if (!storeName) {
        setMsg("Enter store name", "error");
        return;
    }

    try {
        const data = await fetchJson(`${API_BASE}/owner/store`, {
            method: "PATCH",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ store_name: storeName })
        });
        currentStore = data.store;
        setStoreUi(currentStore);
        setMsg(data.message || "Store updated", "success");
    } catch (e) {
        setMsg(e.message, "error");
    }
}

async function saveDeliverySettings() {
    if (!currentStore) {
        setMsg("Create your store first", "error");
        return;
    }

    try {
        const res = await fetchJson(`${API_BASE}/owner/store/delivery-settings`, {
            method: "PATCH",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({
                delivery_available: deliveryAvailableEl.checked,
                delivery_charge: Number(deliveryChargeEl.value) || 0,
                min_order: Number(minOrderEl.value) || 0,
                pickup_available: pickupAvailableEl.checked
            })
        });
        setMsg(res.message || "Delivery settings updated", "success");
        await loadStoreAndProducts();
    } catch (e) {
        setMsg(e.message, "error");
    }
}

function useCurrentLocation() {
    if (!currentStore) {
        setMsg("Create your store first", "error");
        return;
    }

    if (!navigator.geolocation) {
        setMsg("Location is not supported in this browser", "error");
        return;
    }

    setMsg("Getting your current location...");

    navigator.geolocation.getCurrentPosition(
        (position) => {
            storeLatitudeEl.value = position.coords.latitude.toFixed(7);
            storeLongitudeEl.value = position.coords.longitude.toFixed(7);
            setMsg("Current location added. Click Save Store Location to store it.", "success");
        },
        () => {
            setMsg("Could not get your location. Please allow location access and try again.", "error");
        },
        {
            enableHighAccuracy: true,
            timeout: 10000
        }
    );
}

async function saveStoreLocation() {
    if (!currentStore) {
        setMsg("Create your store first", "error");
        return;
    }

    const rawLatitude = String(storeLatitudeEl.value ?? "").trim();
    const rawLongitude = String(storeLongitudeEl.value ?? "").trim();

    if (!rawLatitude || !rawLongitude) {
        setMsg("Please enter store latitude and longitude before saving.", "error");
        alert("Error: Please enter your store latitude and longitude before saving.");
        return;
    }

    const latitude = Number(rawLatitude);
    const longitude = Number(rawLongitude);

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        setMsg("Enter a valid latitude", "error");
        alert("Error: Enter a valid latitude.");
        return;
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        setMsg("Enter a valid longitude", "error");
        alert("Error: Enter a valid longitude.");
        return;
    }

    try {
        const data = await fetchJson(`${API_BASE}/owner/store/location`, {
            method: "PATCH",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ latitude, longitude })
        });
        currentStore = data.store;
        setStoreUi(currentStore);
        setMsg(data.message || "Store location updated", "success");
        alert("Yes, your location has been saved successfully.");
    } catch (e) {
        setMsg(e.message, "error");
    }
}

async function addProduct(event) {
    event?.preventDefault();

    if (!currentStore) {
        setMsg("Create your store first", "error");
        return;
    }

    const name = document.getElementById("pname").value.trim();
    const description = document.getElementById("pdescription").value.trim();
    const price = Number(document.getElementById("pprice").value);
    const quantity = Number(document.getElementById("pquantity").value);
    const unit = document.getElementById("punit").value;
    const imageFile = document.getElementById("pimage").files[0];
    const allowedUnits = ["kg", "g", "litre", "ml", "piece", "pack"];

    if (!name) return setAddProductError("name", "Enter product name");
    if (name.length < 2) return setAddProductError("name", "Min 2 letters");
    if (!description) return setAddProductError("description", "Enter description");
    if (description.length < 5) return setAddProductError("description", "Min 5 chars");
    if (!Number.isFinite(price) || price <= 0) return setAddProductError("price", "Invalid price");
    if (!Number.isFinite(quantity) || quantity <= 0) return setAddProductError("quantity", "Invalid quantity");
    if (!allowedUnits.includes(unit)) return setAddProductError("unit", "Invalid unit");
    clearAddProductErrors();

    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("price", String(price));
    formData.append("quantity", String(quantity));
    formData.append("unit", unit);
    if (imageFile) formData.append("image", imageFile);

    try {
        const res = await fetch(`${API_BASE}/owner/products`, {
            method: "POST",
            headers: authHeaders(),
            body: formData
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message || "Could not add product");

        productFormEl.reset();
        document.getElementById("punit").value = "kg";
        setMsg(data?.message || "Product added", "success");
        await loadStoreAndProducts();
    } catch (e) {
        setMsg(e.message, "error");
    }
}

async function removeProduct(productId) {
    try {
        const data = await fetchJson(`${API_BASE}/owner/products/${productId}`, {
            method: "DELETE",
            headers: authHeaders()
        });
        setMsg(data.message || "Product removed", "success");
        await loadStoreAndProducts();
    } catch (e) {
        setMsg(e.message, "error");
    }
}

async function addTimeSlot() {
    if (!currentStore) {
        setMsg("Create your store first", "error");
        return;
    }

    const slotTime = slotTimeInputEl.value.trim();
    if (!slotTime) {
        setMsg("Enter a pickup slot", "error");
        return;
    }

    try {
        const data = await fetchJson(`${API_BASE}/owner/slots`, {
            method: "POST",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ slot_time: slotTime })
        });
        slotTimeInputEl.value = "";
        setMsg(data.message || "Slot added", "success");
        await loadStoreAndProducts();
    } catch (e) {
        setMsg(e.message, "error");
    }
}

async function removeTimeSlot(slotId) {
    try {
        const data = await fetchJson(`${API_BASE}/owner/slots/${slotId}`, {
            method: "DELETE",
            headers: authHeaders()
        });
        setMsg(data.message || "Slot removed", "success");
        await loadStoreAndProducts();
    } catch (e) {
        setMsg(e.message, "error");
    }
}

async function logout() {
    await window.AppAuth?.logoutUser?.();
}

if (productFormEl) {
    productFormEl.addEventListener("submit", addProduct);
}

window.createStore = createStore;
window.updateStoreName = updateStoreName;
window.useCurrentLocation = useCurrentLocation;
window.saveStoreLocation = saveStoreLocation;
window.saveDeliverySettings = saveDeliverySettings;
window.removeProduct = removeProduct;
window.addTimeSlot = addTimeSlot;
window.removeTimeSlot = removeTimeSlot;
window.logout = logout;

async function initOwnerDashboard() {
    const session = await window.AppAuth?.validateCurrentSession?.({
        expectedRole: "owner",
        afterLogin: "owner-dashboard.html"
    });
    if (!session?.user) return;
    loadStoreAndProducts();
}

initOwnerDashboard();
