import Cacheable from "../../decorator/Cacheable";
import CachePool from "../../module/common/CachePool";
import {MySQLManager} from "../mysql/MySQLManager";
import {Request} from "express";
import {ErrorHandlerFactory} from "../../decorator/ErrorHandler";
import {ok} from "../../module/constants/state";

interface AwardDTO {
    userId: string,
    award: string,
    year: number,
    awardId?: number
}

class AwardManager {
    @Cacheable(new CachePool<any>(), 1, "hour")
    async getAllAward() {
        return await MySQLManager.execQuery("select user_id, award, year, award_id as awardId from award");
    }

    @Cacheable(new CachePool<any>(), 1, "hour")
    async getAwardByUserId(userId: string | number) {
        return await MySQLManager.execQuery("select user_id, award, year, award_id as awardId from award where user_id = ?", [userId]);
    }

    @Cacheable(new CachePool<any>(), 1, "hour")
    async getAwardByYear(year: number) {
        return await MySQLManager.execQuery("select user_id, award, year, award_id as awardId from award where year = ?", [year]);
    }

    async getAwardByAwardId(awardId: number) {
        return await MySQLManager.execQuery("select user_id, award, year, award_id as awardId from award where award_id = ?", [awardId]);
    }

    @ErrorHandlerFactory(ok.okMaker)
    async updateAwardByDtoByRequest(req: Request) {
        const dto = req.body;
        await this.updateAwardByDto(dto);
    }

    async updateAwardByDto(awardDto: AwardDTO) {
        const {userId, award, year, awardId} = awardDto;
        await MySQLManager.execQuery("update award set award = ?, year = ?, user_id = ? where award_id = ?", [award, year, userId, awardId]);
    }

    async insertAwardByDto(awardDto: AwardDTO) {
        const {userId, award, year} = awardDto;
        await MySQLManager.execQuery("insert into award(award, year, user_id)values(?, ?, ?)", [award, year, userId]);
    }

    @ErrorHandlerFactory(ok.okMaker)
    async insertAwardByDtoByRequest(req: Request) {
        const dto = req.body;
        await this.insertAwardByDto(dto);
    }
}

export default new AwardManager();
