const { Schema, model } = require("mongoose");

const tokenSchema = new Schema({
  code: { type: Number, required: true },
  expire_at: { type: Date, required: true },
});

const tokenModel = model("2FaToken", tokenSchema);

module.exports = tokenModel;
