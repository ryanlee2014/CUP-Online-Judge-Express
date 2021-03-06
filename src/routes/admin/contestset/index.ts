import express from "express";
import ContestSetManager from "../../../manager/contestset/ContestSetManager";
const router = express.Router();

router.get("/:contestSetId", async (req, res) => {
    res.json(await ContestSetManager.getContestSetForAdministratorByContestSetIdByRequest(req));
})

export =["/", router];
