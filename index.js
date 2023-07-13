const express = require("express");
require("dotenv").config(); //manages environment variables.

var cors = require("cors");
const mongoose = require("mongoose");
const users = require("./routes/users.js");
const PORT = 4000;
let whiteListIp = ["69.6.31.74"];

const main = async () => {
  const app = express();
  app.use(express.json());

  app.use(cors());

  app.use((req, res, next) => {
    const ipAddress = req.header("x-forwarded-for") || req.socket.remoteAddress;

    // const forwardedFor = req.headers["x-forwarded-for"];
    // const clientIp = req.ip;
    console.log("ip", ipAddress);

    let isWhiteListed = whiteListIp.includes(ipAddress);

    if (isWhiteListed) {
      next();
    } else {
      res.status(403).send("Forbidden");
    }
  });

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected!");

  app.use("/users", users);

  app.listen(PORT, () => {
    console.log(`Server started on port http://localhost:${PORT}`);
  });

  //   app.get("/", (req, res) => {
  //     res.send("Hello, Express!");
  //   });
};

main();
