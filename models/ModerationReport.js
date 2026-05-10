const mongoose = require("mongoose");

const moderationReportSchema = new mongoose.Schema({
  reporter_id: mongoose.Schema.Types.ObjectId,
  reporter_role: String,
  target_user_id: mongoose.Schema.Types.ObjectId,
  target_role: String,
  order_id: mongoose.Schema.Types.ObjectId,
  store_id: mongoose.Schema.Types.ObjectId,
  report_type: String,
  rating: Number,
  message: String,
  status: { type: String, default: "pending" },
  admin_notes: { type: String, default: "" },
  resolved_by: mongoose.Schema.Types.ObjectId,
  resolution_action: { type: String, default: "" },
  read_by: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
}, {
  timestamps: true
});

module.exports = mongoose.model("ModerationReport", moderationReportSchema);
