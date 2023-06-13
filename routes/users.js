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
const nonAuthUserModel = require("../models/nonAuthUserModel");
const AuthUserModel = require("../models/authUserModel");
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

  const existingUser = await AuthUserModel.findOne({ email: value.email });
  //check if email exist in auth Users
  if (existingUser) {
    res.status(403).json({ message: "Email Already exist" });
    return;
  }
  //create a new register user
  const newUser = await nonAuthUserModel
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
    res.status(403).json({ message: "Something Went Wrong" });
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
    user: newUser,
    token: newToken,
    token_id: newToken.token,
    expire_at: newToken.expire_at,
    token_code: newToken.code,
  });
});

router.post("/authanticate/:id", async (req, res) => {
  const { error, value } = authSchema.validate(req.body);

  const authanticate = await tokenModel.findOne({ user_id: req.params.id });
  //check if token exist
  if (!authanticate) {
    res.status(404).json({ message: "Code is either wrong or doesnt exist" });
    return;
  }

  //check if the code is correct
  if (authanticate.code !== value.code) {
    res.status(404).json({ message: "Wrong Code" });
    return;
  }

  let user = await nonAuthUserModel.findById(req.params.id);
  //check if he is authanticated
  if (!user) {
    user = await AuthUserModel.findById(req.params.id);
    if (!user) {
      res.status(404).json({ message: "Data not found" });
      return;
    }
    res.status(200).json(user);
    return;
  }

  if (error) {
    res.status(400).json(error);
    return error;
  }

  console.log(user);

  const newUser = await AuthUserModel.create({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    password: user.password,
  }).catch((err) => {}); // to catch error

  if (!newUser) {
    res.status(403).json({ message: "Email Already exist" });
    return;
  }
  const expirationDate = Date.now() + 30 * 60000;

  const secret = speakeasy.generateSecret({ length: 20 });
  const verificationCode = speakeasy.totp({
    secret: secret.base32,
    encoding: "base32",
  });

  const newToken = await tokenModel.create({
    user_id: newUser._id,
    token_id: uuidv4(),
    code: verificationCode,
    expire_at: expirationDate,
  });

  const authuser = newUser.toJSON();
  delete authuser.password;
  res.status(200).json({
    user: authuser,
    token: newToken,
    token_id: newToken.token,
    expire_at: newToken.expire_at,
    token_code: newToken.code,
  }); // send response
});

router.post("/sign-in", async (req, res) => {
  const { error, value } = signInSchema.validate(req.body);

  const existingUser = await AuthUserModel.findOne({
    email: value.email,
  }).catch((err) => {});

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
  delete user.password;
  return res.status(200).json(user);
});

module.exports = router;
