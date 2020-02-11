import {MySQLManager} from "../mysql/MySQLManager";
import {Request} from "express";
import {ErrorHandlerFactory} from "../../decorator/ErrorHandler";
import {ok} from "../../module/constants/state";

export interface IMaintainInfoDAO {
    mtime: string,
    msg: string,
    version: string,
    vj_version: string,
    frontend_version: string
}

class UpdateLogManager {
    async getMaintainInfo(limit: boolean): Promise<IMaintainInfoDAO[]> {
        return MySQLManager.execQuery(`select * from maintain_info order by mtime desc ${limit ? "limit 1" : ""}`) as any;
    }

    @ErrorHandlerFactory(ok.okMaker)
    async getLatestMaintainInfoByRequest(req: Request) {
        return await this.getMaintainInfo(true);
    }

    @ErrorHandlerFactory(ok.okMaker)
    async getAllMaintainInfoByRequest(req: Request) {
        return await this.getMaintainInfo(false);
    }
}

export default new UpdateLogManager();
