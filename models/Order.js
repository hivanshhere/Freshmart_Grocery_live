const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  customer_id: mongoose.Schema.Types.ObjectId,
  store_id: mongoose.Schema.Types.ObjectId,

  items: [
    {
      name: String,
      qty: Number,
      unit_price: Number,
      line_total: Number
    }
  ],

  total_amount: Number,
  delivery_type: String,
  address_id: mongoose.Schema.Types.ObjectId,
  slot_id: mongoose.Schema.Types.ObjectId,
  delivery_fee: Number,

  status: { type: String, default: "placed" },

  owner_deleted: { type: Boolean, default: false },
  customer_deleted: { type: Boolean, default: false }
});

module.exports = mongoose.model("Order", orderSchema);