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
  delivery_address_snapshot: {
    type: {
      type: String,
      default: ""
    },
    customer_name: {
      type: String,
      default: ""
    },
    phone: {
      type: String,
      default: ""
    },
    house: {
      type: String,
      default: ""
    },
    area: {
      type: String,
      default: ""
    },
    landmark: {
      type: String,
      default: ""
    },
    city: {
      type: String,
      default: ""
    },
    pincode: {
      type: String,
      default: ""
    }
  },
  slot_id: mongoose.Schema.Types.ObjectId,
  slot_time_snapshot: String,
  delivery_fee: Number,

  status: { type: String, default: "placed" },

  owner_deleted: { type: Boolean, default: false },
  customer_deleted: { type: Boolean, default: false },
  owner_order_number: { type: Number, default: null },
  customer_order_number: { type: Number, default: null },
  owner_notification_pending: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.model("Order", orderSchema);
