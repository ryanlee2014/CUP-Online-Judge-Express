import express, {Router} from "express";
import path from "path";
const router: Router = express.Router();
require("../../../module/router_loader")(router, path.resolve(__dirname, "./data"));

export = ["/data", router];
