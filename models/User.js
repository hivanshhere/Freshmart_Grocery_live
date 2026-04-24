const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: String,
  account_status: { type: String, default: "active" },
  warning_count: { type: Number, default: 0 },
  ban_reason: { type: String, default: "" }
}, {
  timestamps: true
});

module.exports = mongoose.model("User", userSchema);
