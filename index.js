const express = require("express");
require("dotenv").config(); //manages environment variables.

var cors = require("cors");
const mongoose = require("mongoose");
const users = require("./routes/users.js");
const PORT = 4000;

const main = async () => {
  const app = express();
  app.use(express.json());

  app.use(cors());

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
