// const JoiPhoneNumber = require("joi-phone-number");
// const joiPhoneNumber = Joi.extend(JoiPhoneNumber);

const { Schema, model } = require("mongoose");

const UserSchema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, expires: "60m", default: Date.now },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
});

const userModel = model("nonAuthUser", UserSchema);

module.exports = userModel;
