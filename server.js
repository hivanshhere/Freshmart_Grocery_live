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

function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

function userDto(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role
    };
}

function newToken() {
    return crypto.randomBytes(32).toString("hex");
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

async function getOwnerStore(ownerId) {
  return await Store.findOne({ owner_id: ownerId });
}

// ================= AUTH =================
app.post("/auth/register-customer", async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    const existing = await User.findOne({ email });

    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: "customer"
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
        email,
        role: "customer"
      }
    });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/auth/register-owner", async (req, res) => {
  const { name, email, password, store_name } = req.body || {};

  if (!name || !email || !password || !store_name) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    const existing = await User.findOne({ email });

    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: "owner"
    });

    const store = await Store.create({
      owner_id: user._id,
      store_name,
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
        email,
        role: "owner"
      },
      store
    });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const user = await User.findOne({ email, password });

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = newToken();

  await Session.create({
    token,
    user_id: user._id
  });

  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});


app.post("/auth/logout", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (token) {
    await Session.deleteOne({ token });
  }

  res.json({ message: "Logged out" });
});

// ================= PUBLIC CUSTOMER-FACING APIs =================
app.get("/stores", async (req, res) => {
  const stores = await Store.find().sort({ _id: -1 });
  res.json(stores);
});

app.get("/store/:storeId", async (req, res) => {
  const store = await Store.findById(req.params.storeId);

  if (!store) {
    return res.status(404).json({ message: "Store not found" });
  }

  res.json(store);
});

app.get("/products/:storeId", async (req, res) => {
  const products = await Product.find({ store_id: req.params.storeId })
    .sort({ _id: -1 });

  res.json(products);
});

// ================= OWNER APIs =================
app.get("/owner/store", requireAuth, requireOwner, asyncHandler(async (req, res) => {
    const store = await getOwnerStore(req.auth.user._id);
    res.json(store || null);
}));

app.get("/owner/products", requireAuth, requireOwner, async (req, res) => {
  const store = await getOwnerStore(req.auth.user._id);

  if (!store) return res.json({ products: [] });

  const products = await Product.find({ store_id: store._id })
    .sort({ _id: -1 });

  res.json({ products });
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

// ================= CUSTOMER APIs =================

app.post("/orders", requireAuth, requireCustomer, async (req, res) => {
  const { store_id, delivery_type, address_id, slot_id, delivery_fee, items } = req.body || {};

  if (!store_id || !items || items.length === 0) {
    return res.status(400).json({ message: "Invalid data" });
  }

  let total = Number(delivery_fee) || 0;

  const formattedItems = items.map(it => {
    const qty = Number(it.qty);
    const price = Number(it.unit_price);

    const line_total = qty * price;
    total += line_total;

    return {
      name: it.name,
      qty,
      unit_price: price,
      line_total
    };
  });

  const order = await Order.create({
    customer_id: req.auth.user._id,
    store_id,
    items: formattedItems,
    total_amount: total,
    delivery_type,
    address_id,
    slot_id,
    delivery_fee: Number(delivery_fee) || 0
  });

  res.json({
    message: "Order placed",
    order_id: order._id
  });
});

app.get("/user/orders", requireAuth, requireCustomer, async (req, res) => {
  const orders = await Order.find({
    customer_id: req.auth.user._id,
    customer_deleted: false
  }).sort({ _id: -1 });

  res.json(orders);
});

app.delete("/user/orders/:orderId", requireAuth, requireCustomer, async (req, res) => {
  await Order.findByIdAndUpdate(req.params.orderId, {
    customer_deleted: true
  });

  res.json({ message: "Order removed" });
});

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
  const orders = await Order.find({
    store_id: req.params.store_id,
    owner_deleted: false
  }).sort({ _id: -1 });

  res.json(orders);
});


app.post("/update-order-status", requireAuth, requireOwner, async (req, res) => {
  const { order_id, status } = req.body;

  await Order.findByIdAndUpdate(order_id, { status });

  res.json({ message: "Order status updated" });
});

app.delete("/owner/orders/:orderId", requireAuth, requireOwner, async (req, res) => {
  await Order.findByIdAndUpdate(req.params.orderId, {
    owner_deleted: true
  });

  res.json({ message: "Order removed" });
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

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

startServer();
