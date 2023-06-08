const express = require("express");
const Joi = require("joi");
const bcrypt = require("bcrypt");
const JoiPhoneNumber = require("joi-phone-number");
const { getCodes } = require("iso-3166-1-alpha-2");
const twilio = require("twilio");
require("dotenv").config();

const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

const JoiExtended = Joi.extend(JoiPhoneNumber);
const router = express.Router();
const userModel = require("../models/userModel");

const registerSchema = JoiExtended.object({
  firstname: Joi.string().required(),
  surname: Joi.string().required(),
  email: Joi.string()
    .email({ tlds: { allow: ["com", "net"] } })
    .required(),
  password: Joi.string().pattern(new RegExp(`^[a-zA-Z0-9]{3,30}`)).required(),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required(),
  country: Joi.string()
    .valid(...getCodes())
    .required(),
  phone: JoiExtended.string().phoneNumber({
    defaultCountry: Joi.ref("country", {
      adjust: (value) => value.toUpperCase(),
    }),
    format: "e164",
    strict: true,
  }),
});

router.post("/register", async (req, res) => {
  const saltRounds = 10;
  const { error, value } = registerSchema.validate(req.body);
  if (error) {
    res.status(400).json(error);
    return error;
  }

  const hash = await bcrypt.hash(value.password, saltRounds);

  const newUser = await userModel
    .create({
      firstName: value.firstname,
      lastName: value.surname,
      email: value.email,
      phone: value.phone,
      password: hash,
    })
    .catch((err) => {}); // to catch error

  if (!newUser) {
    res.status(403).json({ message: "Email Already exist" });
    return;
  }
  //   try {
  //     await twilioClient.messages.create({
  //       to: phone,
  //       from: process.env.TWILIO_PHONE,
  //       body: "Your 2FA code is: 123456", // Replace with your actSual 2FA code
  //     });
  //   } catch (error) {
  //     console.error("Failed to send SMS:", error);
  //     return res.status(500).json({ error: "Failed to send SMS" });
  //   }
  const user = newUser.toJSON();
  return res.status(200).json({ message: user });
});

router.post("/sign-in", async (req, res) => {});

module.exports = router;
