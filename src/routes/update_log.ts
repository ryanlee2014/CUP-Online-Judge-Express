import express, {Router} from "express";
import UpdateLogManager from "../manager/SystemInfo/UpdateLogManager";
const router: Router = express.Router();
const auth = require("../middleware/auth");

router.get("/", auth, async (req, res) => {
	res.json(await UpdateLogManager.getAllMaintainInfoByRequest(req));
});


router.get("/latest", async (req, res) => {
	res.json(await UpdateLogManager.getLatestMaintainInfoByRequest(req));
});

export = ["/update_log", router];
