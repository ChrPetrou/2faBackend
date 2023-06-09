// const JoiPhoneNumber = require("joi-phone-number");
// const joiPhoneNumber = Joi.extend(JoiPhoneNumber);

const { Schema, model } = require("mongoose");

const UserSchema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  password: { type: String, required: true },
  isAuthanticated: { type: Boolean, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
    required: true,
  },
});

const userModel = model("users", UserSchema);

module.exports = userModel;
