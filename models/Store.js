const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema({
  owner_id: mongoose.Schema.Types.ObjectId,
  store_name: String,
  delivery_available: Boolean,
  delivery_charge: Number,
  min_order_free_delivery: Number,
  pickup_available: Boolean,
  latitude: Number,
  longitude: Number
});

module.exports = mongoose.model("Store", storeSchema);
