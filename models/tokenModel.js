const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const userModel = require("./userModel");

const tokenSchema = new Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: userModel,
    required: true,
  },
  token_id: { type: String, unique: true, required: true },
  code: { type: Number, required: true },
  expire_at: { type: Date, required: true },
});

const tokenModel = model("token", tokenSchema);

module.exports = tokenModel;
