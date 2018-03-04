const express = require("express");
//const query = require("../module/mysql_query");
const cache_query = require("../module/mysql_cache");
const router = express.Router();
const page_cnt = 50;
const get_ranklist = async (req, res, opt = {}) => {
	let page = opt.page * 50;
	let result;
	if (!opt.search && !opt.time_stamp) {
		result = await cache_query(`SELECT user_id,nick,solved,submit,vjudge_solved FROM users ORDER BY solved 
				DESC,submit,reg_time LIMIT ?,?`, [page, page_cnt]);
	}
	else if (!opt.search) {
		let time_start;
		if (opt.time_stamp === "Y") {
			time_start = new Date().getFullYear() + "-01-01";
		}
		else if (opt.time_stamp === "M") {
			time_start = new Date().getFullYear() + "-" + (new Date().getMonth() + 1) + "-01";
		}
		else if (opt.time_stamp === "W") {
			let _temp_date = new Date();
			let week_time = new Date(0).setDate(_temp_date.getDay()+1);
			_temp_date = new Date(_temp_date - week_time);
			time_start = _temp_date.getFullYear() + "-" + (_temp_date.getMonth() + 1) + "-" + (_temp_date.getDate());
		}
		else if (opt.time_stamp === "D") {
			time_start = new Date().getFullYear() + "-" + (new Date().getMonth() + 1) + "-" + new Date().getDate();
		}
		else{
			time_start = "1970-01-01";
		}
		result = await cache_query(`SELECT users.user_id,
		users.nick,s.solved,t.submit,v.solved as vjudge_solved FROM users
		RIGHT JOIN (SELECT count(distinct problem_id) solved,user_id
		FROM solution WHERE in_date >= ? AND result = 4 GROUP BY user_id
		ORDER BY solved DESC LIMIT ?,?) s
		ON users.user_id = s.user_id
		LEFT JOIN
		(SELECT count(problem_id) submit,user_id FROM solution WHERE
		in_date >= ?
		GROUP BY user_id ORDER BY submit DESC
		LIMIT ?,?) t
		ON users.user_id = t.user_id
		LEFT JOIN (SELECT count(distinct CONCAT(oj_name,problem_id)) solved,user_id
		FROM (select oj_name,problem_id,user_id,result FROM vjudge_solution
		WHERE in_date >= ?
		UNION ALL
		SELECT oj_name,problem_id,user_id,4 as result FROM vjudge_record
		WHERE time >= ?)
		vsol WHERE result = 4 GROUP BY user_id ORDER BY solved LIMIT ?,?) v
		ON users.user_id = v.user_id
		ORDER BY s.solved DESC,t.submit,reg_time LIMIT 0,50`,
			[time_start,page,page_cnt,time_start,page,page_cnt,time_start,time_start,page,page_cnt]);
	}
	else if(!opt.time_stamp){
		let search_name = `%${opt.search}%`;
		result = await cache_query(`SELECT user_id,nick,solved,submit FROM users WHERE user_id 
		LIKE ? ORDER BY solved DESC,submit,user_id
		LIMIT ?,?`,
			[search_name,page,page_cnt]);
	}
	else{
		res.json({
			status:"error",
			statement:"invalid parameter"
		});
		return;
	}
	res.json(result);
};

router.get("/", async function (req, res) {
	let page = req.query.page || 0;
	let search = req.query.search || "";
	let time_stamp = req.query.time_stamp;
	await get_ranklist(req, res, {
		page: page,
		search: search,
		time_stamp: time_stamp
	});
});

router.get("/user",async function(req,res){
	let result = await cache_query(`SELECT count(1) as tot_user,acm.acm_users FROM users
									LEFT JOIN (SELECT count(1) as acm_user FROM acm_member)acm on 1=1`)
		.catch(()=>{
			//console.log(errs);
			res.json({
				status:"error",
				statement:"database error"
			});
		});
	res.json(result);
});

module.exports = router;