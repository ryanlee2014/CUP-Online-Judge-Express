const express = require("express");
const router = express.Router();
const path = require("path");
const admin = require("../../middleware/admin");

require("../../module/router_loader")(router, path.resolve(__dirname, "./problem"));
module.exports = ["/problem", admin, router];
