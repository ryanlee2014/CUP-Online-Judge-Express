import express from "express";
import path from "path";
const router = express.Router();
const admin = require("../../middleware/admin");

require("../../module/router_loader")(router, path.resolve(__dirname, "./award"));
export = ["/award", admin, router];
