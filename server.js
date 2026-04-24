require("dotenv").config();

const express = require("express"); 
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

//start 
const mongoose = require("mongoose");
const User = require("./models/User");
const Session = require("./models/Session");

const Store = require("./models/Store");
const Product = require("./models/Product");
const Order = require("./models/Order");
const Address = require("./models/Address");
const Slot = require("./models/Slot");
const ModerationReport = require("./models/ModerationReport");
const ModerationAction = require("./models/ModerationAction");

const app = express();
app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

app.use("/uploads", express.static(uploadsDir));
app.use(express.static("public"));

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
            cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
        }
    }),
    fileFilter: (req, file, cb) => {
        if (!file.mimetype || !file.mimetype.startsWith("image/")) {
            return cb(new Error("Only image files are allowed"));
        }
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 }
});

const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "admin@freshmart.com").trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "admin123").trim();
const ADMIN_NAME = String(process.env.ADMIN_NAME || "Platform Admin").trim();

function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

function userDto(row) {
    if (!row) return null;
    return {
        id: String(row._id || row.id || ""),
        name: row.name,
        email: row.email,
        role: row.role,
        account_status: row.account_status || "active",
        warning_count: Number(row.warning_count) || 0,
        ban_reason: row.ban_reason || ""
    };
}

function storeDto(store, extra = {}) {
    if (!store) return null;
    return {
        id: String(store._id || store.id || ""),
        display_id: Number(extra.display_id) || null,
        store_name: store.store_name,
        delivery_available: !!store.delivery_available,
        delivery_charge: Number(store.delivery_charge) || 0,
        min_order_free_delivery: Number(store.min_order_free_delivery) || 0,
        pickup_available: !!store.pickup_available,
        latitude: store.latitude ?? null,
        longitude: store.longitude ?? null,
        distance_km: extra.distance_km ?? undefined
    };
}

function productDto(product) {
    if (!product) return null;
    return {
        id: String(product._id || product.id || ""),
        store_id: String(product.store_id || ""),
        name: product.name,
        price: Number(product.price) || 0,
        quantity: Number(product.quantity) || 0,
        unit: product.unit,
        description: product.description || "",
        image: product.image || null
    };
}

function addressDto(address) {
    if (!address) return null;
    const addressLine = [
        address.house,
        address.area,
        address.landmark,
        address.city,
        address.pincode
    ].filter(Boolean).join(", ");
    return {
        id: String(address._id || address.id || ""),
        user_id: String(address.customer_id || address.user_id || ""),
        type: address.type || "Home",
        address_line: address.address_line || addressLine,
        customer_name: address.customer_name || "",
        phone: address.phone || "",
        house: address.house || "",
        area: address.area || "",
        landmark: address.landmark || "",
        city: address.city || "",
        pincode: address.pincode || ""
    };
}

function addressSnapshot(address) {
    if (!address) return null;
    return {
        type: address.type || "Home",
        customer_name: address.customer_name || "",
        phone: address.phone || "",
        house: address.house || "",
        area: address.area || "",
        landmark: address.landmark || "",
        city: address.city || "",
        pincode: address.pincode || ""
    };
}

function slotDto(slot) {
    if (!slot) return null;
    return {
        id: String(slot._id || slot.id || ""),
        store_id: String(slot.store_id || ""),
        slot_time: slot.slot_time || ""
    };
}

function orderDto(order, extra = {}) {
    if (!order) return null;
    return {
        id: String(order._id || order.id || ""),
        store_id: String(order.store_id || ""),
        customer_id: String(order.customer_id || ""),
        items: Array.isArray(order.items) ? order.items.map((item) => ({
            name: item?.name || item?.product_name || "",
            product_name: item?.product_name || item?.name || "",
            qty: Number(item?.qty) || 0,
            unit_price: Number(item?.unit_price) || 0,
            line_total: Number(item?.line_total) || 0
        })) : [],
        total_amount: Number(order.total_amount) || 0,
        delivery_type: order.delivery_type || "delivery",
        address_id: order.address_id ? String(order.address_id) : null,
        slot_id: order.slot_id ? String(order.slot_id) : null,
        delivery_fee: Number(order.delivery_fee) || 0,
        status: order.status || "placed",
        display_order_number: extra.display_order_number || order.customer_order_number || order.owner_order_number || null,
        owner_order_number: order.owner_order_number || null,
        customer_order_number: order.customer_order_number || null,
        customer_name: extra.customer_name || "",
        customer_email: extra.customer_email || "",
        customer_user_id: extra.customer_user_id ? String(extra.customer_user_id) : "",
        customer_account_status: extra.customer_account_status || "",
        owner_id: extra.owner_id ? String(extra.owner_id) : "",
        owner_name: extra.owner_name || "",
        owner_account_status: extra.owner_account_status || "",
        store_name: extra.store_name || "",
        delivery_address: extra.delivery_address || order.delivery_address_snapshot || null,
        slot_time: extra.slot_time || order.slot_time_snapshot || "",
        created_at: order.createdAt || null
    };
}

function newToken() {
    return crypto.randomBytes(32).toString("hex");
}

function normalizeAccountStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["active", "warned", "banned", "removed"].includes(normalized)) return normalized;
  return "active";
}

function canUsePlatform(accountStatus) {
  return !["banned", "removed"].includes(normalizeAccountStatus(accountStatus));
}

function isValidLatitude(value) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function calculateDistanceInKm(latitude1, longitude1, latitude2, longitude2) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latDiff = toRadians(latitude2 - latitude1);
  const lonDiff = toRadians(longitude2 - longitude1);
  const startLat = toRadians(latitude1);
  const endLat = toRadians(latitude2);
  const a =
    Math.sin(latDiff / 2) * Math.sin(latDiff / 2) +
    Math.cos(startLat) * Math.cos(endLat) *
    Math.sin(lonDiff / 2) * Math.sin(lonDiff / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}


async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Login required" });
  }

  const session = await Session.findOne({ token });

  if (!session) {
    return res.status(401).json({ message: "Invalid session" });
  }

  const user = await User.findById(session.user_id);

  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }

  if (!canUsePlatform(user.account_status)) {
    await Session.deleteOne({ token });
    return res.status(403).json({ message: "Your account has been restricted by the admin" });
  }

  req.auth = { token, user };

  next();
}

function requireOwner(req, res, next) {
    if (!req.auth?.user) return res.status(401).json({ message: "Login required" });
    if (req.auth.user.role !== "owner") return res.status(403).json({ message: "Owner access required" });
    next();
}

function requireCustomer(req, res, next) {
    if (!req.auth?.user) return res.status(401).json({ message: "Login required" });
    if (req.auth.user.role !== "customer") return res.status(403).json({ message: "Customer access required" });
    next();
}

function requireAdmin(req, res, next) {
    if (!req.auth?.user) return res.status(401).json({ message: "Login required" });
    if (req.auth.user.role !== "admin") return res.status(403).json({ message: "Admin access required" });
    next();
}

async function getOwnerStore(ownerId) {
  return await Store.findOne({ owner_id: ownerId });
}

async function getActiveStoreById(storeId) {
  const store = await Store.findById(storeId);
  if (!store) return null;
  const owner = await User.findById(store.owner_id);
  if (!owner || !canUsePlatform(owner.account_status)) return null;
  return store;
}

function calculateDeliveryFee(store, itemsTotal) {
  if (!store || !store.delivery_available) return 0;
  const minimumForFree = Number(store.min_order_free_delivery) || 0;
  if (itemsTotal >= minimumForFree) return 0;
  return Number(store.delivery_charge) || 0;
}

async function getNextOwnerOrderNumber(storeId) {
  const latest = await Order.findOne({ store_id: storeId }).sort({ owner_order_number: -1, _id: -1 });
  return (Number(latest?.owner_order_number) || 0) + 1;
}

async function getNextCustomerOrderNumber(customerId) {
  const latest = await Order.findOne({ customer_id: customerId }).sort({ customer_order_number: -1, _id: -1 });
  return (Number(latest?.customer_order_number) || 0) + 1;
}

async function purgeOrderIfHiddenEverywhere(orderId) {
  const order = await Order.findById(orderId);
  if (!order) return;
  if (order.owner_deleted && order.customer_deleted) {
    await Order.deleteOne({ _id: orderId });
  }
}

async function createModerationAction(adminId, targetUserId, reportId, actionType, notes) {
  await ModerationAction.create({
    admin_id: adminId,
    target_user_id: targetUserId,
    report_id: reportId || null,
    action_type: actionType,
    notes: notes || ""
  });
}

async function issueWarning(adminId, targetUserId, reportId, notes) {
  const target = await User.findById(targetUserId);
  if (!target || target.role === "admin") return;
  target.warning_count = (Number(target.warning_count) || 0) + 1;
  if (normalizeAccountStatus(target.account_status) === "active") target.account_status = "warned";
  target.ban_reason = notes || "Warning issued by admin";
  await target.save();
  await createModerationAction(adminId, targetUserId, reportId, "warning", notes);
}

async function removeUserAccess(adminId, targetUserId, reportId, notes, status) {
  const target = await User.findById(targetUserId);
  if (!target || target.role === "admin") return;
  target.account_status = status === "removed" ? "removed" : "banned";
  target.ban_reason = notes || "";
  await target.save();
  await Session.deleteMany({ user_id: target._id });
  await createModerationAction(adminId, targetUserId, reportId, target.account_status, notes);
}

async function resolveReport(reportId, adminId, action, adminNotes) {
  await ModerationReport.findByIdAndUpdate(reportId, {
    status: "resolved",
    admin_notes: adminNotes || "",
    resolved_by: adminId,
    resolution_action: action
  });
}

async function rejectReport(reportId, adminId, adminNotes) {
  await ModerationReport.findByIdAndUpdate(reportId, {
    status: "dismissed",
    admin_notes: adminNotes || "",
    resolved_by: adminId,
    resolution_action: "dismissed"
  });
}

async function ensureAdminAccount() {
  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    existing.role = "admin";
    existing.account_status = "active";
    await existing.save();
    return;
  }

  await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: "admin",
    account_status: "active",
    warning_count: 0,
    ban_reason: ""
  });
}

async function getStoreDisplayIdMap() {
  const stores = await Store.find().sort({ _id: 1 }).select("_id");
  return new Map(
    stores.map((store, index) => [String(store._id), 101 + index])
  );
}

async function toDisplayStoreDto(store) {
  if (!store) return null;
  const displayIdMap = await getStoreDisplayIdMap();
  return storeDto(store, {
    display_id: displayIdMap.get(String(store._id)) || null
  });
}

async function toDisplayStoreDtos(stores) {
  const displayIdMap = await getStoreDisplayIdMap();
  return stores.map((store) => storeDto(store, {
    display_id: displayIdMap.get(String(store._id)) || null
  }));
}

// ================= AUTH =================
app.post("/auth/register-customer", async (req, res) => {
  const { name, email, password } = req.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!name || !normalizedEmail || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    const existing = await User.findOne({ email: normalizedEmail });

    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role: "customer",
      account_status: "active",
      warning_count: 0,
      ban_reason: ""
    });

    const token = newToken();

    await Session.create({
      token,
      user_id: user._id
    });

    res.json({
      token,
      user: {
        id: user._id,
        name,
        email: normalizedEmail,
        role: "customer",
        account_status: "active",
        warning_count: 0,
        ban_reason: ""
      }
    });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/auth/register-owner", async (req, res) => {
  const { name, email, password, store_name } = req.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const storeNameCaps = String(store_name || "").trim().toUpperCase();

  if (!name || !normalizedEmail || !password || !storeNameCaps) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    const existing = await User.findOne({ email: normalizedEmail });

    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role: "owner",
      account_status: "active",
      warning_count: 0,
      ban_reason: ""
    });

    const store = await Store.create({
      owner_id: user._id,
      store_name: storeNameCaps,
      delivery_available: false,
      delivery_charge: 0,
      min_order_free_delivery: 0,
      pickup_available: true
    });

    const token = newToken();

    await Session.create({
      token,
      user_id: user._id
    });

    res.json({
      token,
      user: {
        id: user._id,
        name,
        email: normalizedEmail,
        role: "owner",
        account_status: "active",
        warning_count: 0,
        ban_reason: ""
      },
      store: await toDisplayStoreDto(store)
    });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/auth/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "").trim();

  if (!email || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const user = await User.findOne({ email, password });

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (!canUsePlatform(user.account_status)) {
    return res.status(403).json({ message: "Your account has been restricted by the admin" });
  }

  const token = newToken();

  await Session.create({
    token,
    user_id: user._id
  });

  let store = null;
  if (user.role === "owner") {
    store = await getOwnerStore(user._id);
  }

  res.json({
    token,
    user: userDto(user),
    store: await toDisplayStoreDto(store)
  });
});


app.post("/auth/logout", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (token) {
    await Session.deleteOne({ token });
  }

  res.json({ message: "Logged out" });
});

app.get("/auth/me", requireAuth, asyncHandler(async (req, res) => {
  const reports = await ModerationReport.find({ target_user_id: req.auth.user._id })
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(10);
  const reporterIds = [...new Set(reports.map((report) => String(report.reporter_id || "")).filter(Boolean))];
  const storeIds = [...new Set(reports.map((report) => String(report.store_id || "")).filter(Boolean))];
  const adminIds = [...new Set(reports.map((report) => String(report.resolved_by || "")).filter(Boolean))];
  const [reporters, stores, admins] = await Promise.all([
    User.find({ _id: { $in: reporterIds } }),
    Store.find({ _id: { $in: storeIds } }),
    User.find({ _id: { $in: adminIds } })
  ]);
  const reporterMap = new Map(reporters.map((user) => [String(user._id), user]));
  const storeMap = new Map(stores.map((store) => [String(store._id), store]));
  const adminMap = new Map(admins.map((user) => [String(user._id), user]));

  res.json({
    user: userDto(req.auth.user),
    moderation_reports: reports.map((report) => ({
      id: String(report._id),
      order_id: String(report.order_id || ""),
      report_type: report.report_type,
      message: report.message,
      status: report.status,
      admin_notes: report.admin_notes || "",
      created_at: report.createdAt,
      updated_at: report.updatedAt,
      resolution_action: report.resolution_action || "",
      rating: report.rating || null,
      reporter_name: reporterMap.get(String(report.reporter_id || ""))?.name || "",
      reporter_role: reporterMap.get(String(report.reporter_id || ""))?.role || report.reporter_role || "",
      store_name: storeMap.get(String(report.store_id || ""))?.store_name || "",
      resolved_by_name: adminMap.get(String(report.resolved_by || ""))?.name || ""
    }))
  });
}));

// ================= PUBLIC CUSTOMER-FACING APIs =================
app.get("/stores", asyncHandler(async (req, res) => {
  const customerLatitude = Number(req.query.latitude);
  const customerLongitude = Number(req.query.longitude);

  if (!isValidLatitude(customerLatitude) || !isValidLongitude(customerLongitude)) {
    return res.status(400).json({ message: "Valid customer latitude and longitude are required" });
  }

  const owners = await User.find({ account_status: { $nin: ["banned", "removed"] }, role: "owner" }).select("_id");
  const ownerIds = owners.map((owner) => owner._id);
  const stores = await Store.find({
    owner_id: { $in: ownerIds },
    latitude: { $ne: null },
    longitude: { $ne: null }
  }).sort({ _id: -1 });
  const displayIdMap = await getStoreDisplayIdMap();

  const nearbyStores = stores
    .map((store) => {
      const storeLatitude = Number(store.latitude);
      const storeLongitude = Number(store.longitude);
      const distance = calculateDistanceInKm(customerLatitude, customerLongitude, storeLatitude, storeLongitude);
      return storeDto(store, {
        display_id: displayIdMap.get(String(store._id)) || null,
        distance_km: Number(distance.toFixed(2))
      });
    })
    .filter((store) => Number(store.distance_km) <= 5)
    .sort((a, b) => Number(a.distance_km) - Number(b.distance_km));

  res.json(nearbyStores);
}));

app.get("/store/:storeId", asyncHandler(async (req, res) => {
  const store = await getActiveStoreById(req.params.storeId);

  if (!store) {
    return res.status(404).json({ message: "Store not found" });
  }

  res.json(await toDisplayStoreDto(store));
}));

app.get("/products/:storeId", asyncHandler(async (req, res) => {
  const store = await getActiveStoreById(req.params.storeId);
  if (!store) return res.json([]);

  const products = await Product.find({ store_id: req.params.storeId })
    .sort({ _id: -1 });

  res.json(products.map(productDto));
}));

app.get("/store/:storeId/slots", async (req, res) => {
  const slots = await Slot.find({ store_id: req.params.storeId }).sort({ createdAt: 1, _id: 1 });
  res.json(slots.map(slotDto));
});

// ================= OWNER APIs =================
app.get("/owner/store", requireAuth, requireOwner, asyncHandler(async (req, res) => {
    const store = await getOwnerStore(req.auth.user._id);
    res.json(await toDisplayStoreDto(store));
}));

app.post("/owner/store", requireAuth, requireOwner, asyncHandler(async (req, res) => {
    const store_name = String(req.body?.store_name || "").trim().toUpperCase();

    if (!store_name) {
      return res.status(400).json({ message: "Store name is required" });
    }

    const existing = await getOwnerStore(req.auth.user._id);
    if (existing) {
      return res.status(409).json({ message: "Store already exists" });
    }

    const store = await Store.create({
      owner_id: req.auth.user._id,
      store_name,
      delivery_available: false,
      delivery_charge: 0,
      min_order_free_delivery: 0,
      pickup_available: true
    });

    res.json({
      message: "Store created successfully",
      store: await toDisplayStoreDto(store)
    });
}));

app.patch("/owner/store", requireAuth, requireOwner, asyncHandler(async (req, res) => {
    const store_name = String(req.body?.store_name || "").trim().toUpperCase();

    if (!store_name) {
      return res.status(400).json({ message: "Store name is required" });
    }

    const store = await getOwnerStore(req.auth.user._id);
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    store.store_name = store_name;
    await store.save();

    res.json({
      message: "Store name updated",
      store: await toDisplayStoreDto(store)
    });
}));

app.patch("/owner/store/location", requireAuth, requireOwner, asyncHandler(async (req, res) => {
    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);

    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      return res.status(400).json({ message: "Enter a valid latitude and longitude" });
    }

    const store = await getOwnerStore(req.auth.user._id);
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    store.latitude = latitude;
    store.longitude = longitude;
    await store.save();

    res.json({
      message: "Store location updated",
      store: await toDisplayStoreDto(store)
    });
}));

app.get("/owner/products", requireAuth, requireOwner, async (req, res) => {
  const store = await getOwnerStore(req.auth.user._id);

  if (!store) return res.json({ products: [] });

  const products = await Product.find({ store_id: store._id })
    .sort({ _id: -1 });

  res.json({ products: products.map(productDto) });
});

app.post("/owner/products", requireAuth, requireOwner, upload.single("image"), async (req, res) => {
  const { name, price, quantity, unit, description } = req.body || {};

  if (!name || !price || !quantity || !unit) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const store = await getOwnerStore(req.auth.user._id);

  if (!store) {
    return res.status(400).json({ message: "Create a store first" });
  }

  const image = req.file ? req.file.filename : null;

  await Product.create({
    store_id: store._id,
    name,
    price: Number(price),
    quantity: Number(quantity),
    unit,
    description: description || "",
    image
  });

  res.json({ message: "Product added" });
});

app.delete("/owner/products/:productId", requireAuth, requireOwner, async (req, res) => {
  const store = await getOwnerStore(req.auth.user._id);

  if (!store) {
    return res.status(400).json({ message: "Create a store first" });
  }

  const product = await Product.findOneAndDelete({
    _id: req.params.productId,
    store_id: store._id
  });

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  res.json({ message: "Product removed" });
});

async function saveDeliverySettings(req, res) {
  const store = await getOwnerStore(req.auth.user._id);

  if (!store) {
    return res.status(400).json({ message: "Create a store first" });
  }

  const delivery_available = !!req.body?.delivery_available;
  const pickup_available = !!req.body?.pickup_available;
  const delivery_charge = Number(req.body?.delivery_charge) || 0;
  const min_order = Number(req.body?.min_order) || 0;

  if (!delivery_available && !pickup_available) {
    return res.status(400).json({ message: "Select at least one fulfillment option" });
  }

  store.delivery_available = delivery_available;
  store.pickup_available = pickup_available;
  store.delivery_charge = delivery_charge;
  store.min_order_free_delivery = min_order;
  await store.save();

  res.json({
    message: "Delivery settings updated",
    store: await toDisplayStoreDto(store)
  });
}

app.patch("/owner/store/delivery-settings", requireAuth, requireOwner, asyncHandler(saveDeliverySettings));
app.post("/api/store/delivery-settings", requireAuth, requireOwner, asyncHandler(saveDeliverySettings));

app.get("/owner/slots", requireAuth, requireOwner, asyncHandler(async (req, res) => {
  const store = await getOwnerStore(req.auth.user._id);
  if (!store) return res.json({ slots: [] });

  const slots = await Slot.find({ store_id: store._id }).sort({ createdAt: 1, _id: 1 });
  res.json({ slots: slots.map(slotDto) });
}));

app.post("/owner/slots", requireAuth, requireOwner, asyncHandler(async (req, res) => {
  const store = await getOwnerStore(req.auth.user._id);
  if (!store) {
    return res.status(404).json({ message: "Store not found" });
  }

  const slot_time = String(req.body?.slot_time || "").trim();
  if (!slot_time) {
    return res.status(400).json({ message: "Slot time is required" });
  }

  const slot = await Slot.create({
    store_id: store._id,
    slot_time
  });

  res.json({
    message: "Pickup slot added",
    slot: slotDto(slot)
  });
}));

app.delete("/owner/slots/:slotId", requireAuth, requireOwner, asyncHandler(async (req, res) => {
  const store = await getOwnerStore(req.auth.user._id);
  if (!store) {
    return res.status(404).json({ message: "Store not found" });
  }

  const slot = await Slot.findOneAndDelete({
    _id: req.params.slotId,
    store_id: store._id
  });

  if (!slot) {
    return res.status(404).json({ message: "Slot not found" });
  }

  res.json({ message: "Pickup slot removed" });
}));

app.get("/owner/orders/:store_id/notifications", requireAuth, requireOwner, asyncHandler(async (req, res) => {
  const store = await getOwnerStore(req.auth.user._id);
  if (!store || String(store._id) !== String(req.params.store_id)) {
    return res.status(404).json({ message: "Store not found" });
  }

  const count = await Order.countDocuments({
    store_id: store._id,
    owner_deleted: false,
    owner_notification_pending: true
  });

  if (count > 0) {
    await Order.updateMany({
      store_id: store._id,
      owner_deleted: false,
      owner_notification_pending: true
    }, {
      owner_notification_pending: false
    });
  }

  res.json({ count });
}));

// ================= CUSTOMER APIs =================

app.get("/user/addresses", requireAuth, requireCustomer, asyncHandler(async (req, res) => {
  const addresses = await Address.find({ customer_id: req.auth.user._id }).sort({ createdAt: -1, _id: -1 });
  res.json(addresses.map(addressDto));
}));

app.post("/user/addresses", requireAuth, requireCustomer, asyncHandler(async (req, res) => {
  const payload = {
    type: String(req.body?.type || "").trim(),
    customer_name: String(req.body?.customer_name || "").trim().toUpperCase(),
    phone: String(req.body?.phone || "").trim(),
    house: String(req.body?.house || "").trim().toUpperCase(),
    area: String(req.body?.area || "").trim().toUpperCase(),
    landmark: String(req.body?.landmark || "").trim().toUpperCase(),
    city: String(req.body?.city || "").trim().toUpperCase(),
    pincode: String(req.body?.pincode || "").trim()
  };

  if (!payload.type || !payload.customer_name || !payload.phone || !payload.house || !payload.area || !payload.city || !payload.pincode) {
    return res.status(400).json({ message: "Missing address fields" });
  }

  const address = await Address.create({
    customer_id: req.auth.user._id,
    ...payload
  });

  res.json({
    message: "Address saved",
    address: addressDto(address)
  });
}));

app.patch("/user/addresses/:addressId", requireAuth, requireCustomer, asyncHandler(async (req, res) => {
  const payload = {
    type: String(req.body?.type || "").trim(),
    customer_name: String(req.body?.customer_name || "").trim().toUpperCase(),
    phone: String(req.body?.phone || "").trim(),
    house: String(req.body?.house || "").trim().toUpperCase(),
    area: String(req.body?.area || "").trim().toUpperCase(),
    landmark: String(req.body?.landmark || "").trim().toUpperCase(),
    city: String(req.body?.city || "").trim().toUpperCase(),
    pincode: String(req.body?.pincode || "").trim()
  };

  const address = await Address.findOneAndUpdate(
    { _id: req.params.addressId, customer_id: req.auth.user._id },
    payload,
    { new: true }
  );

  if (!address) {
    return res.status(404).json({ message: "Address not found" });
  }

  res.json({
    message: "Address updated",
    address: addressDto(address)
  });
}));

app.delete("/user/addresses/:addressId", requireAuth, requireCustomer, asyncHandler(async (req, res) => {
  const address = await Address.findOneAndDelete({
    _id: req.params.addressId,
    customer_id: req.auth.user._id
  });

  if (!address) {
    return res.status(404).json({ message: "Address not found" });
  }

  res.json({ message: "Address deleted" });
}));

app.post("/orders", requireAuth, requireCustomer, async (req, res) => {
  const { store_id, delivery_type, address_id, slot_id, items } = req.body || {};

  if (!store_id || !items || items.length === 0) {
    return res.status(400).json({ message: "Invalid data" });
  }

  const store = await getActiveStoreById(store_id);
  if (!store) {
    return res.status(404).json({ message: "Store not found" });
  }

  const orderDeliveryType = String(delivery_type || "").toLowerCase();
  if (!["delivery", "pickup"].includes(orderDeliveryType)) {
    return res.status(400).json({ message: "Invalid delivery type" });
  }

  let address = null;
  if (orderDeliveryType === "delivery") {
    if (!store.delivery_available) {
      return res.status(400).json({ message: "This store does not offer delivery" });
    }
    if (!address_id) {
      return res.status(400).json({ message: "Address is required for delivery orders" });
    }

    address = await Address.findOne({
      _id: address_id,
      customer_id: req.auth.user._id
    });

    if (!address) {
      return res.status(404).json({ message: "Selected address not found" });
    }
  }

  let slot = null;
  if (orderDeliveryType === "pickup") {
    if (!store.pickup_available) {
      return res.status(400).json({ message: "This store does not offer pickup" });
    }
    if (!slot_id) {
      return res.status(400).json({ message: "Pickup slot is required" });
    }

    slot = await Slot.findOne({
      _id: slot_id,
      store_id: store._id
    });

    if (!slot) {
      return res.status(404).json({ message: "Selected pickup slot not found" });
    }
  }

  let itemsTotal = 0;

  const formattedItems = items.map(it => {
    const qty = Number(it.qty);
    const price = Number(it.unit_price);
    if (!it.name || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
      return null;
    }

    const line_total = qty * price;
    itemsTotal += line_total;

    return {
      name: String(it.name),
      product_name: String(it.name),
      qty,
      unit_price: price,
      line_total
    };
  });

  if (formattedItems.some((item) => !item)) {
    return res.status(400).json({ message: "Invalid items" });
  }

  const deliveryFee = orderDeliveryType === "delivery" ? calculateDeliveryFee(store, itemsTotal) : 0;
  const total = itemsTotal + deliveryFee;
  const ownerOrderNumber = await getNextOwnerOrderNumber(store._id);
  const customerOrderNumber = await getNextCustomerOrderNumber(req.auth.user._id);

  const order = await Order.create({
    customer_id: req.auth.user._id,
    store_id: store._id,
    items: formattedItems,
    total_amount: total,
    delivery_type: orderDeliveryType,
    address_id: orderDeliveryType === "delivery" ? address_id : null,
    delivery_address_snapshot: addressSnapshot(address),
    slot_id: orderDeliveryType === "pickup" ? slot_id : null,
    slot_time_snapshot: slot?.slot_time || "",
    delivery_fee: deliveryFee,
    owner_order_number: ownerOrderNumber,
    customer_order_number: customerOrderNumber,
    owner_notification_pending: true
  });

  res.json({
    message: "Order placed",
    order_id: order._id,
    customer_order_number: customerOrderNumber,
    owner_order_number: ownerOrderNumber,
    delivery_type: orderDeliveryType,
    delivery_fee: deliveryFee,
    address_id: order.address_id,
    slot_id: order.slot_id,
    total_amount: total
  });
});

app.get("/user/orders", requireAuth, requireCustomer, async (req, res) => {
  const orders = await Order.find({
    customer_id: req.auth.user._id,
    customer_deleted: false
  }).sort({ _id: -1 });

  const storeIds = [...new Set(orders.map((order) => String(order.store_id || "")).filter(Boolean))];
  const stores = await Store.find({ _id: { $in: storeIds } });
  const ownerIds = [...new Set(stores.map((store) => String(store.owner_id || "")).filter(Boolean))];
  const owners = await User.find({ _id: { $in: ownerIds } });
  const storeMap = new Map(stores.map((store) => [String(store._id), store]));
  const ownerMap = new Map(owners.map((owner) => [String(owner._id), owner]));

  res.json(orders.map((order) => orderDto(order, {
    display_order_number: order.customer_order_number,
    store_name: storeMap.get(String(order.store_id || ""))?.store_name || "",
    owner_id: String(storeMap.get(String(order.store_id || ""))?.owner_id || ""),
    owner_name: ownerMap.get(String(storeMap.get(String(order.store_id || ""))?.owner_id || ""))?.name || "",
    owner_account_status: ownerMap.get(String(storeMap.get(String(order.store_id || ""))?.owner_id || ""))?.account_status || ""
  })));
});

app.delete("/user/orders/:orderId", requireAuth, requireCustomer, async (req, res) => {
  const order = await Order.findOneAndUpdate({
    _id: req.params.orderId,
    customer_id: req.auth.user._id,
    customer_deleted: false
  }, {
    customer_deleted: true
  });

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  await purgeOrderIfHiddenEverywhere(req.params.orderId);

  res.json({ message: "Order removed from your order history" });
});

// ================= REPORTING / REVIEW =================
app.post("/reports", requireAuth, asyncHandler(async (req, res) => {
  const user = req.auth.user;
  if (!["customer", "owner"].includes(user.role)) {
    return res.status(403).json({ message: "Only customers and owners can send reports" });
  }

  const orderId = req.body?.order_id;
  const targetUserId = req.body?.target_user_id;
  const reportType = String(req.body?.report_type || "").trim().toLowerCase();
  const message = String(req.body?.message || "").trim();
  const rating = req.body?.rating === null || req.body?.rating === undefined || req.body?.rating === ""
    ? null
    : Number(req.body.rating);

  if (!orderId || !targetUserId) {
    return res.status(400).json({ message: "Invalid order or target user" });
  }
  if (!["review", "complaint"].includes(reportType)) {
    return res.status(400).json({ message: "Report type must be review or complaint" });
  }
  if (!message) {
    return res.status(400).json({ message: "Please enter the review or complaint details" });
  }
  if (reportType === "review" && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
    return res.status(400).json({ message: "Review rating must be between 1 and 5" });
  }

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  const store = await Store.findById(order.store_id);
  if (!store) return res.status(404).json({ message: "Store not found" });

  let expectedTargetUserId = null;
  let targetRole = null;

  if (user.role === "customer") {
    if (String(order.customer_id) !== String(user._id)) {
      return res.status(403).json({ message: "You can only review your own orders" });
    }
    expectedTargetUserId = String(store.owner_id);
    targetRole = "owner";
  } else {
    if (String(store.owner_id) !== String(user._id)) {
      return res.status(403).json({ message: "You can only review customers from your own store orders" });
    }
    expectedTargetUserId = String(order.customer_id);
    targetRole = "customer";
  }

  if (expectedTargetUserId !== String(targetUserId)) {
    return res.status(403).json({ message: "Invalid target user for this order" });
  }

  await ModerationReport.create({
    reporter_id: user._id,
    reporter_role: user.role,
    target_user_id: targetUserId,
    target_role: targetRole,
    order_id: order._id,
    store_id: store._id,
    report_type: reportType,
    rating: reportType === "review" ? rating : null,
    message,
    status: "pending"
  });

  res.json({ message: "Your feedback has been sent to the admin" });
}));

app.get("/my-reports", requireAuth, asyncHandler(async (req, res) => {
  const reports = await ModerationReport.find({ reporter_id: req.auth.user._id }).sort({ createdAt: -1 });
  const orderIds = [...new Set(reports.map((report) => String(report.order_id || "")).filter(Boolean))];
  const targetIds = [...new Set(reports.map((report) => String(report.target_user_id || "")).filter(Boolean))];
  const storeIds = [...new Set(reports.map((report) => String(report.store_id || "")).filter(Boolean))];
  const adminIds = [...new Set(reports.map((report) => String(report.resolved_by || "")).filter(Boolean))];
  const [orders, targets, stores, admins] = await Promise.all([
    Order.find({ _id: { $in: orderIds } }),
    User.find({ _id: { $in: targetIds } }),
    Store.find({ _id: { $in: storeIds } }),
    User.find({ _id: { $in: adminIds } })
  ]);
  const orderMap = new Map(orders.map((order) => [String(order._id), order]));
  const targetMap = new Map(targets.map((target) => [String(target._id), target]));
  const storeMap = new Map(stores.map((store) => [String(store._id), store]));
  const adminMap = new Map(admins.map((admin) => [String(admin._id), admin]));

  res.json(reports.map((report) => {
    const order = orderMap.get(String(report.order_id || ""));
    const target = targetMap.get(String(report.target_user_id || ""));
    return {
      id: String(report._id),
      order_id: String(report.order_id || ""),
      report_type: report.report_type,
      rating: report.rating || null,
      message: report.message,
      status: report.status,
      admin_notes: report.admin_notes || "",
      created_at: report.createdAt,
      updated_at: report.updatedAt,
      resolution_action: report.resolution_action || "",
      order_display_number: order?.customer_order_number || order?.owner_order_number || "",
      total_amount: order?.total_amount || 0,
      delivery_type: order?.delivery_type || "",
      order_status: order?.status || "",
      target_name: target?.name || "",
      target_role: target?.role || report.target_role || "",
      store_name: storeMap.get(String(report.store_id || ""))?.store_name || "",
      resolved_by_name: adminMap.get(String(report.resolved_by || ""))?.name || ""
    };
  }));
}));

// ================= ADMIN APIs =================
app.get("/admin/dashboard", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const [customers, owners, bannedUsers, removedUsers, pendingReports, users, reports, actions] = await Promise.all([
    User.countDocuments({ role: "customer" }),
    User.countDocuments({ role: "owner" }),
    User.countDocuments({ account_status: "banned" }),
    User.countDocuments({ account_status: "removed" }),
    ModerationReport.countDocuments({ status: "pending" }),
    User.find({ role: { $in: ["customer", "owner"] } }).sort({ role: 1, name: 1 }),
    ModerationReport.find().sort({ status: 1, createdAt: -1 }),
    ModerationAction.find().sort({ createdAt: -1 }).limit(20)
  ]);

  const userIds = [
    ...users.map((user) => String(user._id)),
    ...reports.flatMap((report) => [String(report.reporter_id || ""), String(report.target_user_id || ""), String(report.resolved_by || "")]),
    ...actions.flatMap((action) => [String(action.admin_id || ""), String(action.target_user_id || "")])
  ].filter(Boolean);
  const storeIds = reports.map((report) => String(report.store_id || "")).filter(Boolean);
  const orderIds = reports.map((report) => String(report.order_id || "")).filter(Boolean);
  const ownerIdsForUsers = users.filter((user) => user.role === "owner").map((user) => String(user._id));
  const [allUsers, stores, ownerStores, reportOrders] = await Promise.all([
    User.find({ _id: { $in: [...new Set(userIds)] } }),
    Store.find({ _id: { $in: [...new Set(storeIds)] } }),
    Store.find({ owner_id: { $in: ownerIdsForUsers } }),
    Order.find({ _id: { $in: [...new Set(orderIds)] } })
  ]);
  const userMap = new Map(allUsers.map((user) => [String(user._id), user]));
  const storeMap = new Map(stores.map((store) => [String(store._id), store]));
  const ownerStoreMap = new Map(ownerStores.map((store) => [String(store.owner_id), store]));
  const orderMap = new Map(reportOrders.map((order) => [String(order._id), order]));
  const displayIdMap = await getStoreDisplayIdMap();

  res.json({
    summary: {
      customers,
      owners,
      banned_users: bannedUsers,
      removed_users: removedUsers,
      pending_reports: pendingReports
    },
    users: users.map((user) => ({
      ...userDto(user),
      created_at: user.createdAt,
      store_id: displayIdMap.get(String(ownerStoreMap.get(String(user._id))?._id || "")) || "",
      store_name: ownerStoreMap.get(String(user._id))?.store_name || ""
    })),
    reports: reports.map((report) => {
      const reporter = userMap.get(String(report.reporter_id || ""));
      const target = userMap.get(String(report.target_user_id || ""));
      const admin = userMap.get(String(report.resolved_by || ""));
      const order = orderMap.get(String(report.order_id || ""));
      return {
        id: String(report._id),
        report_type: report.report_type,
        rating: report.rating || null,
        message: report.message,
        status: report.status,
        admin_notes: report.admin_notes || "",
        order_id: String(report.order_id || ""),
        order_display_number: order?.customer_order_number || order?.owner_order_number || "",
        store_id: String(report.store_id || ""),
        created_at: report.createdAt,
        resolution_action: report.resolution_action || "",
        reporter_name: reporter?.name || "",
        reporter_email: reporter?.email || "",
        reporter_role: reporter?.role || report.reporter_role || "",
        target_user_id: String(report.target_user_id || ""),
        target_name: target?.name || "",
        target_email: target?.email || "",
        target_role: target?.role || report.target_role || "",
        target_account_status: target?.account_status || "",
        store_name: storeMap.get(String(report.store_id || ""))?.store_name || "",
        resolved_by_name: admin?.name || ""
      };
    }),
    actions: actions.map((action) => ({
      id: String(action._id),
      action_type: action.action_type,
      notes: action.notes || "",
      created_at: action.createdAt,
      admin_name: userMap.get(String(action.admin_id || ""))?.name || "",
      target_name: userMap.get(String(action.target_user_id || ""))?.name || "",
      target_role: userMap.get(String(action.target_user_id || ""))?.role || ""
    }))
  });
}));

app.post("/admin/users/:userId/action", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const targetUserId = req.params.userId;
  const action = String(req.body?.action || "").trim().toLowerCase();
  const notes = String(req.body?.notes || "").trim();
  const reportId = req.body?.report_id || null;

  if (!["warning", "ban", "remove", "activate"].includes(action)) {
    return res.status(400).json({ message: "Invalid admin action" });
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) return res.status(404).json({ message: "User not found" });
  if (targetUser.role === "admin") return res.status(400).json({ message: "Admin accounts cannot be moderated here" });

  if (action === "warning") {
    await issueWarning(req.auth.user._id, targetUserId, reportId, notes || "Warning issued by admin");
  } else if (action === "ban") {
    await removeUserAccess(req.auth.user._id, targetUserId, reportId, notes || "Banned by admin", "banned");
  } else if (action === "remove") {
    await removeUserAccess(req.auth.user._id, targetUserId, reportId, notes || "Removed by admin", "removed");
  } else if (action === "activate") {
    targetUser.account_status = "active";
    targetUser.ban_reason = "";
    await targetUser.save();
    await createModerationAction(req.auth.user._id, targetUserId, reportId, "activate", notes || "Account reactivated");
  }

  if (reportId) {
    await resolveReport(reportId, req.auth.user._id, action, notes);
  }

  res.json({ message: "Admin action saved" });
}));

app.post("/admin/reports/:reportId/dismiss", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const adminNotes = String(req.body?.notes || "").trim();
  await rejectReport(req.params.reportId, req.auth.user._id, adminNotes || "Report dismissed by admin");
  res.json({ message: "Report dismissed" });
}));

// ================= ERROR HANDLER =================
app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    if (err instanceof multer.MulterError || err?.message === "Only image files are allowed") {
        return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Server error" });
});

// ================= START =================


app.get("/owner/orders/:store_id", requireAuth, requireOwner, async (req, res) => {
  const store = await getOwnerStore(req.auth.user._id);
  if (!store || String(store._id) !== String(req.params.store_id)) {
    return res.status(404).json({ message: "Store not found" });
  }

  const orders = await Order.find({
    store_id: store._id,
    owner_deleted: false
  }).sort({ _id: -1 });

  const customerIds = [...new Set(orders.map((order) => String(order.customer_id || "")).filter(Boolean))];
  const addressIds = [...new Set(orders.map((order) => String(order.address_id || "")).filter(Boolean))];
  const slotIds = [...new Set(orders.map((order) => String(order.slot_id || "")).filter(Boolean))];
  const customers = await User.find({ _id: { $in: customerIds } });
  const addresses = await Address.find({ _id: { $in: addressIds } });
  const slots = await Slot.find({ _id: { $in: slotIds } });
  const customerMap = new Map(customers.map((customer) => [String(customer._id), customer.name]));
  const addressMap = new Map(addresses.map((address) => [String(address._id), addressDto(address)]));
  const slotMap = new Map(slots.map((slot) => [String(slot._id), slotDto(slot)]));

  res.json(orders.map((order) => orderDto(order, {
    display_order_number: order.owner_order_number,
    customer_name: customerMap.get(String(order.customer_id || "")) || "",
    customer_user_id: String(order.customer_id || ""),
    customer_account_status: customers.find((customer) => String(customer._id) === String(order.customer_id || ""))?.account_status || "",
    delivery_address: addressMap.get(String(order.address_id || "")) || order.delivery_address_snapshot || null,
    slot_time: slotMap.get(String(order.slot_id || ""))?.slot_time || ""
  })));
});


app.post("/update-order-status", requireAuth, requireOwner, async (req, res) => {
  const { status } = req.body;
  const order_id = req.params.orderId || req.body.order_id;
  const store = await getOwnerStore(req.auth.user._id);
  if (!store) {
    return res.status(404).json({ message: "Store not found" });
  }

  const allowedStatus = ["placed", "accepted", "rejected"];
  if (!allowedStatus.includes(String(status || "").toLowerCase())) {
    return res.status(400).json({ message: "Invalid order status" });
  }

  const order = await Order.findOneAndUpdate(
    { _id: order_id, store_id: store._id },
    { status: String(status).toLowerCase() },
    { new: true }
  );

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  res.json({ message: "Order status updated" });
});

app.patch("/owner/orders/:orderId/status", requireAuth, requireOwner, asyncHandler(async (req, res) => {
  req.body.order_id = req.params.orderId;
  const store = await getOwnerStore(req.auth.user._id);
  if (!store) {
    return res.status(404).json({ message: "Store not found" });
  }

  const status = String(req.body?.status || "").toLowerCase();
  const allowedStatus = ["placed", "accepted", "rejected"];
  if (!allowedStatus.includes(status)) {
    return res.status(400).json({ message: "Invalid order status" });
  }

  const order = await Order.findOneAndUpdate(
    { _id: req.params.orderId, store_id: store._id },
    { status },
    { new: true }
  );

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  res.json({ message: "Order status updated" });
}));

app.delete("/owner/orders/:orderId", requireAuth, requireOwner, async (req, res) => {
  const store = await getOwnerStore(req.auth.user._id);
  if (!store) {
    return res.status(404).json({ message: "Store not found" });
  }

  const order = await Order.findOneAndUpdate({
    _id: req.params.orderId,
    store_id: store._id
  }, {
    owner_deleted: true
  });

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  await purgeOrderIfHiddenEverywhere(req.params.orderId);

  res.json({ message: "Order removed from the store order panel" });
});

app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    if (err instanceof multer.MulterError || err?.message === "Only image files are allowed") {
        return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Server error" });
});

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env");
    }

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000
    });

    console.log("MongoDB Connected");
    await ensureAdminAccount();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

startServer();
