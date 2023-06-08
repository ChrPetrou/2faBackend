const express = require("express");
const Joi = require("joi");
const bcrypt = require("bcrypt");
const JoiPhoneNumber = require("joi-phone-number");
const twilio = require("twilio");
require("dotenv").config();

const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
// Extend Joi with the joi-phone-number extension
const JoiExtended = Joi.extend(JoiPhoneNumber);
const router = express.Router();
const userModel = require("../models/userModel");

const registerSchema = Joi.object({
  firstname: Joi.string().required(),
  surname: Joi.string().required(),
  email: Joi.string()
    .email({ tlds: { allow: ["com", "net"] } })
    .required(),
  password: Joi.string().pattern(new RegExp(`^[a-zA-Z0-9]{3,30}`)).required(),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required(),
  phone: JoiExtended.string().phoneNumber().default("US"),
});

router.post("/register", async (req, res) => {
  const saltRounds = 10;
  const { error, value } = registerSchema.validate(req.body);
  if (error) {
    res.status(400).json(error);
  }

  const hash = await bcrypt.hash(value.password, saltRounds);
  console.log(hash);
  const newUser = await userModel
    .create({
      firstname: value.firstname,
      surname: value.surname,
      email: value.email,
      phone: value.phone,
      password: hash,
    })
    .catch((err) => {});
  if (!newUser) {
    res.status(403).json({ message: "Email Already exist" });
    return;
  }
  //   try {
  //     await twilioClient.messages.create({
  //       to: phone,
  //       from: process.env.TWILIO_PHONE,
  //       body: "Your 2FA code is: 123456", // Replace with your actual 2FA code
  //     });
  //   } catch (error) {
  //     console.error("Failed to send SMS:", error);
  //     return res.status(500).json({ error: "Failed to send SMS" });
  //   }
  const user = newUser.toJSON();
  return res.status(200).json({ user });
});

module.exports = router;
