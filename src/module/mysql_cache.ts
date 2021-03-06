import CacheScheduler from "../manager/cache/scheduler/CacheScheduler";

const query = require("./mysql_query");
const dayjs = require("dayjs");
const MySQLCachePool = require("./mysql/cache");

function deepCopy(obj: any) {
	return JSON.parse(JSON.stringify(obj));
}

function modifySql(sql: string) {
	return sql.includes("update") || sql.includes("insert") || sql.includes("delete");
}

CacheScheduler.addCacheContainer({
	cacheContainer: MySQLCachePool,
	timeDelta: 2,
	timeUnit: "second"
});

const cache_query = async function (sql: string, sqlArr: any[] = [], opt: any = {copy: 0}) {
	let identified = sql.toString() + JSON.stringify(sqlArr.toString());
	let now = dayjs();
	let cache = await MySQLCachePool.get(identified);
	if (cache) {
		let data = cache.data;
		if (cache.time.add(2, "second").isBefore(now)) {
			const value = await query(sql, sqlArr);
			MySQLCachePool.set(identified, value);
			data = value;
		}
		if (opt.copy) {
			return deepCopy(data);
		}
		else {
			return data;
		}
	}
	else {
		const lowerCaseSql = sql.toLowerCase();
		if (modifySql(lowerCaseSql)) {
			return await query(sql, sqlArr);
		}
		const resp = await query(sql, sqlArr);
		await MySQLCachePool.set(identified, resp);
		return resp;
	}
};

cache_query.pool = query.pool;

const _end = query.pool.end;
query.pool.end = function() {
	if(!this._closed) {
		_end.apply(this, arguments);
	}
};

export = cache_query;
