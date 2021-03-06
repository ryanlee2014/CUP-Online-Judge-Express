import AwaitLock from "await-lock";
import Cacheable from "../../decorator/Cacheable";
import {Request} from "express";
import "express-session";
import Timer from "../../decorator/Timer";
import {ErrorHandlerFactory} from "../../decorator/ErrorHandler";
import {ok} from "../../module/constants/state";
import isNumber from "../../module/util/isNumber";
import ResponseLogger from "../../decorator/ResponseLogger";
import CachePool from "../../module/common/CachePool";
import {MySQLManager} from "../mysql/MySQLManager";
const cache_query = require("../../module/mysql_cache");
const ContestCachePool = require("../../module/contest/ContestCachePool");
const PAGE_SIZE = 50;
function safeArrayParse(array: any[] | any) {
    if (typeof array !== "object" && !array.length) {
        return [];
    }
    return array.length ? array : Object.keys(array);
}

class ContestManager {
    @Timer
    @Cacheable(ContestCachePool, 1, "second")
    getContestListByConditional(admin_str: string, myContest: string, limit: number) {
        const sql = this.buildSqlStructure(admin_str, myContest);
        return cache_query(`${sql} order by (IF(start_time < NOW() and end_time > NOW(), 1, 0))desc,
         (IF(start_time < NOW() and end_time > NOW(), end_time, 0)),
         (IF(start_time >= NOW() and end_time <= NOW(), contest_id, contest_id)) desc limit ?, ?`, [limit, PAGE_SIZE]);
    }

    @Timer
    @Cacheable(new CachePool(), 1, "second")
    getAllContest() {
        return cache_query(`select maker as user_id,defunct,contest_id,cmod_visible,title,start_time,end_time,private from contest order by contest_id desc`);
    }

    @ResponseLogger
    buildSqlStructure (...args: string[]) {
        return `select maker as user_id,defunct,contest_id,cmod_visible,title,start_time,end_time,private from contest where ${args.join(" and ")}`;
    }

    @Timer
    @Cacheable(ContestCachePool, 10, "minute")
    async countTotalNumber(sql: string) {
        const response = await cache_query(`select count(1) as cnt from (${sql})t3`);
        if (response && response.length && response.length > 0) {
            return response[0].cnt;
        }
        else {
            return 0;
        }
    }

    @ErrorHandlerFactory(ok.okMaker)
    async getTotalNumber(req: Request) {
        const sql = this.buildSqlStructure(this.buildPrivilegeStr(req), this.getMyContestList(req));
        return await this.countTotalNumber(sql);
    }

    @Timer
    getMyContestList(req: Request) {
        let myContest = " 1 = 1 ";
        if (req.query.myContest) {
            myContest = `(${safeArrayParse(req.session!.contest_maker).concat(safeArrayParse(req.session!.contest)).map((el: any) => el.substring(1)).join(",")})`;
            if (myContest === "()") {
                myContest = " 1 = 1 ";
            } else {
                myContest = `contest_id in ${myContest}`;
            }
        }
        return myContest;
    }

    buildLimit(req: Request) {
        const page: any = req.query.page;
        const limit = (isNumber(page) ? parseInt(page) : 0) * PAGE_SIZE;
        return limit < 0 ? 0 : limit;
    }

    @ErrorHandlerFactory(ok.okMaker)
    @Timer
    async getContestList(req: Request) {
        return await this.getContestListByConditional(this.buildPrivilegeStr(req), this.getMyContestList(req), this.buildLimit(req));
    }

    @ErrorHandlerFactory(ok.okMaker)
    @Timer
    async getAllContestList() {
        return await this.getAllContest();
    }

    @Timer
    async removeAllCompetitorFromPrivilege(contestId: string | number) {
        return await MySQLManager.execQuery(`delete from privilege where rightstr = ?`, [`c${contestId}`]);
    }

    @Timer
    async addContestCompetitor(contestId: string | number, userList: string[]) {
        if (userList.length === 0) {
            return;
        }
        let baseSql = "insert into privilege (user_id, rightstr) values";
        let sqlArray: string[] = [], valueArray: string[] = [];
        userList.forEach(el => {
            sqlArray.push("(?,?)");
            valueArray.push(el, `c${contestId}`);
        });
        return await MySQLManager.execQuery(`${baseSql} ${sqlArray.join(",")}`, valueArray);
    }

    async updateContestCompetitor(contestIdList: (string | number)[], userList: string[], newContestIdList: (string | number)[]) {
        await Promise.all(contestIdList.map(e => this.removeAllCompetitorFromPrivilege(e)));
        await Promise.all(newContestIdList.map(e => this.addContestCompetitor(e, userList)));
    }

    async getContestCompetitorByContestId(contestId: string | number) {
        return await MySQLManager.execQuery("select user_id from privilege where rightstr = ?", [`c${contestId}`]);
    }

    @Timer
    private buildPrivilegeStr(req: Request) {
        let admin_str = " 1 = 1 ";
        if (!req.session!.isadmin && !req.session!.contest_manager) {
            admin_str += " and defunct = 'N' ";
        }
        // @ts-ignore
        if (global.contest_mode) {
            admin_str = `${admin_str} and cmod_visible = '${!req.session!.isadmin ? 1 : 0}'`;
        }
        return admin_str;
    }
}

export default new ContestManager();
