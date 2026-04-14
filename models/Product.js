const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  store_id: mongoose.Schema.Types.ObjectId,
  name: String,
  price: Number,
  quantity: Number,
  unit: String,
  description: String,
  image: String
});

module.exports = mongoose.model("Product", productSchema);