const mongoose = require("mongoose");

const moderationActionSchema = new mongoose.Schema({
  admin_id: mongoose.Schema.Types.ObjectId,
  target_user_id: mongoose.Schema.Types.ObjectId,
  report_id: mongoose.Schema.Types.ObjectId,
  action_type: String,
  notes: { type: String, default: "" },
  read_by: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
}, {
  timestamps: true
});

module.exports = mongoose.model("ModerationAction", moderationActionSchema);
