const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  token: String,
  user_id: mongoose.Schema.Types.ObjectId
});

module.exports = mongoose.model("Session", sessionSchema);