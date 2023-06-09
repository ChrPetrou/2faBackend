const express = require("express");
const Joi = require("joi");
const bcrypt = require("bcrypt");
const JoiPhoneNumber = require("joi-phone-number");
const { getCodes } = require("iso-3166-1-alpha-2");
const twilio = require("twilio");
const speakeasy = require("speakeasy");

const { v4: uuidv4 } = require("uuid");
require("dotenv").config();
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

const JoiExtended = Joi.extend(JoiPhoneNumber);
const router = express.Router();
const userModel = require("../models/userModel");
const tokenModel = require("../models/tokenModel");

const signInSchema = JoiExtended.object({
  email: Joi.string()
    .email({ tlds: { allow: ["com", "net"] } })
    .required(),
  password: Joi.string().pattern(new RegExp(`^[a-zA-Z0-9]{3,30}`)).required(),
});

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

const authSchema = JoiExtended.object({
  code: Joi.number().required(),
});

router.post("/register", async (req, res) => {
  const saltRounds = 10;
  const { error, value } = registerSchema.validate(req.body);

  if (error) {
    res.status(400).json(error);
    return error;
  }
  let ip = (
    req.headers["cf-connecting-ip"] ||
    req.headers["x-real-ip"] ||
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    ""
  ).split(",");

  const hash = await bcrypt.hash(value.password, saltRounds);

  const newUser = await userModel
    .create({
      firstName: value.firstname,
      lastName: value.surname,
      isAuthanticated: false,
      email: value.email,
      phone: value.phone,
      password: hash,
    })
    .catch((err) => {}); // to catch error

  if (!newUser) {
    res.status(403).json({ message: "Email Already exist" });
    return;
  }

  const secret = speakeasy.generateSecret({ length: 20 });
  const verificationCode = speakeasy.totp({
    secret: secret.base32,
    encoding: "base32",
  });

  const expirationDate = Date.now() + 30 * 60000;

  const newToken = await tokenModel.create({
    user_id: newUser._id,
    token_id: uuidv4(),
    code: verificationCode,
    state: "register",
    expire_at: expirationDate,
  });

  // try {
  //   await twilioClient.messages.create({
  //     to: phone,
  //     from: process.env.TWILIO_PHONE,
  //     body: `Your 2FA code is: ${verificationCode}`, // Replace with your actSual 2FA code
  //   });
  // } catch (error) {
  //   return res.status(500).json({ error: "Failed to send SMS" });
  // }
  const user = newUser.toJSON();

  return res.status(200).json({
    user: user,
    token: newToken,
    token_id: newToken.token,
    expire_at: newToken.expire_at,
    token_code: newToken.code,
  });
});

router.post("/authanticate", async (req, res) => {
  const { error, value } = authSchema.validate(req.body);

  if (error) {
    res.status(400).json(error);
    return error;
  }
  const authanticate = await tokenModel.findOne({ code: req.body.code });

  if (!authanticate) {
    res.status(404).json({ message: "Code is either wrong or doesnt exist" });
    return;
  }
  console.log(authanticate.user_id);
  const user = await userModel.findByIdAndUpdate(
    authanticate.user_id,
    {
      isAuthanticated: false,
    },
    { returnDocument: "after" }
  );
  if (!user) {
    res.status(404).json({ message: "User doesnt exist" });
    return;
  }
  // console.log(user);
  res.status(200).json(user); // send response
});

router.post("/sign-in", async (req, res) => {
  const { error, value } = signInSchema.validate(req.body);

  const existingUser = await userModel
    .findOne({ email: value.email })
    .catch((err) => {});

  if (!existingUser) {
    return res.status(404).json({ message: "User not found" });
  }

  if (existingUser.isAuthanticated === false) {
    const deletedUser = await userModel.findOneAndDelete({
      _id: existingUser._id,
    });
    console.log(deletedUser);
    return res.status(404).json({ message: "User not found" });
  }

  //compare passwords
  const isMatch = await bcrypt.compare(value.password, existingUser.password);
  if (!isMatch) {
    res.status(403).json({ message: "Wrong Password" });
    return;
  }

  // try {
  //   await twilioClient.messages.create({
  //     to: phone,
  //     from: process.env.TWILIO_PHONE,
  //     body: `Your 2FA code is: ${verificationCode}`, // Replace with your actSual 2FA code
  //   });
  // } catch (error) {
  //   return res.status(500).json({ error: "Failed to send SMS" });
  // }

  const user = existingUser.toJSON();
  return res.status(200).json({ message: user });
});

module.exports = router;
