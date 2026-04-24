const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  customer_id: mongoose.Schema.Types.ObjectId,
  type: String,
  customer_name: String,
  phone: String,
  house: String,
  area: String,
  landmark: String,
  city: String,
  pincode: String
}, {
  timestamps: true
});

module.exports = mongoose.model("Address", addressSchema);
