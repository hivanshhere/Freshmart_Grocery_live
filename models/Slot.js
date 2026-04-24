const mongoose = require("mongoose");

const slotSchema = new mongoose.Schema({
  store_id: mongoose.Schema.Types.ObjectId,
  slot_time: String
}, {
  timestamps: true
});

module.exports = mongoose.model("Slot", slotSchema);
