/* eslint-disable no-unused-vars,no-console */
/**
 * Class LocalJudger
 */
//const query = require("../module/mysql_query");
const log4js = require("../module/logger");
//const logger = log4js.logger("normal", "info");
const path = require("path");
const Promise = require("bluebird");
const query = require("./mysql_query");
const fs = Promise.promisifyAll(require("fs"));
const eventEmitter = require("events").EventEmitter;
const OUTPUT_LIMIT_EXCEEDED = -1;
const WRONG_ANSWER = 0;
const PRESENTATION_ERROR = 1;
const ACCEPTED = 2;
const COMPILE_ERROR = 3;
const RUNTIME_ERROR = 4;
const TIME_LIMIT_EXCEEDED = 5;
const MEMORY_LIMIT_EXCEEDED = 6;
const CLOCK_LIMIT_EXCEEDED = 7;

let cache = [];


async function cache_query(sql, sqlArr) {
	if (cache[sql + sqlArr.toString()]) {
		return cache[sql + sqlArr.toString()];
	}
	else {
		return (cache[sql + sqlArr.toString()] = await query(sql, sqlArr));
	}
}

function parseResult(code, time, memory, pass_point, compile_msg, compile_error_msg) {
	return {
		status: code,
		time: time,
		memory: memory,
		pass_point: pass_point,
		compile_message: compile_msg,
		compile_error_message: compile_error_msg
	};
}

class dockerJudger extends eventEmitter {

	constructor(oj_home) {
		super();
		this.oj_home = oj_home;
		this.inputFile = [];
		this.outputFile = [];
		if(fs.existsSync("./module/docker/index.js")) {
			this.Sandbox = require("./docker/index");
			this.submit = this.Sandbox.createSubmit();
		}
		else {
			console.error("You don't have CUP Online Judge docker judger in ./docker directory\nPlease clone it in this directory");
		}
		this.language = NaN;
		this.submit_id = NaN;
		this.mode = 0;
	}

	static parseJudgerCodeToWeb(code) {
		const status = {
			"2": 4,
			"1": 5,
			"0": 6,
			"5": 7,
			"6": 8,
			"-1": 9,
			"4": 10,
			"3": 11,
		};
		return status[code.toString()];
	}

	static parseLanguage(language) {
		language = parseInt(language);
		const languageToName =
			["c11", "c++17", "pascal", "java", "ruby", "bash", "python2", "php", "perl", "csharp", "objc", "freebasic", "schema", "clang", "clang++", "lua", "nodejs", "go", "python3", "c++11", "c++98", "c99","kotlin"];
		if (language > -1 && language < languageToName.length) {
			return languageToName[language];
		}
	}

	static LanguageBonus(language){
		if(language<3||language === 13||language===14||language>18){
			return 1;
		}
		else{
			return 2;
		}
	}

	static parseLanguageSuffix(language) {
		let languageSuffix = {
			"c": ".c",
			"c11": ".c",
			"c99": ".c",
			"c89": ".c",
			"c++": ".cpp",
			"c++11": ".cpp",
			"c++14": ".cpp",
			"c++98": ".cpp",
			"c++17": ".cpp",
			"csharp": ".cs",
			"nodejs": ".js",
			"python2": ".py",
			"python3": ".py",
			"clang": ".c",
			"clang++": ".cpp",
			"php": ".php",
			"lua": ".lua",
			"kotlin": ".kt",
			"bash": ".sh",
			"pascal": ".pas",
			"go": ".go",
			"java":".java"
		};
		return languageSuffix[language];
	}

	static sandboxCodeToJudger(code) {
		const status = [ACCEPTED, TIME_LIMIT_EXCEEDED, MEMORY_LIMIT_EXCEEDED,
			OUTPUT_LIMIT_EXCEEDED, RUNTIME_ERROR];
		return status[code];
	}

	async setProblemID(problem_id) {
		this.problem_id = parseInt(problem_id);
		if (isNaN(this.problem_id) || this.problem_id < 1000) {
			this.problem_id = undefined;
			if (isNaN(this.problem_id)) {
				throw new TypeError("problem_id should be a integer");
			}
			else {
				throw new Error("problem_id should larger than 1000");
			}
		}
		const problem_status = await cache_query("SELECT * FROM problem WHERE problem_id=?", [this.problem_id]);
		let time_limit = parseFloat(problem_status[0].time_limit);
		let memory_limit = parseInt(problem_status[0].memory_limit);
		this.setTimeLimit(time_limit);
		this.setTimeLimitReserve(time_limit / 2);
		this.setMemoryLimit(memory_limit);
		this.setMemoryLimitReserve(memory_limit / 4);
	}

	setTimeLimit(time_limit) {
		this.time_limit = parseFloat(time_limit);
	}

	setSolutionID(solution_id) {
		this.submit_id = solution_id;
	}

	setTimeLimitReserve(time_limit_reserve) {
		this.time_limit_reserve = parseFloat(time_limit_reserve);
	}

	setMemoryLimit(memory_limit) {
		this.memory_limit = parseInt(memory_limit);
	}

	setMemoryLimitReserve(memory_limit_reserve) {
		this.memory_limit_reserve = parseInt(memory_limit_reserve);
	}


	setCompareFn(fn) {
		if (typeof fn === "function") {
			this.compare_fn = fn;
		}
		else {
			return new TypeError("argument must be function");
		}
	}

	on(event, callback) {
		if (typeof event === "string") {
			if (typeof callback === "function") {
				if(this.submit) {
					this.submit.on(event, callback);
				}
			}
			else {
				return new TypeError("callback must be function");
			}
		}
		else {
			return new TypeError("event must be a string");
		}
	}

	setSpecialJudge(file, language) {
		// TODO:complete set special judge module in docker
	}

	setCustomInput(input) {
		this.submit.pushInputRawFiles({
			name: "custominput.in",
			data: input
		});
	}

	setLanguage(language) {
		this.language = language;
	}

	setMode(mode) {
		this.mode = mode;
	}

	setCode(code) {
		this.code = code;
	}

	setUserID(user_id) {
		this.user_id = user_id;
	}

	pushRawFile(file) {
		this.submit.pushInputRawFiles({
			name: file.name,
			data: file.data
		});
	}

	async run() {
		if (this.mode === 0) {
			const dirname = path.join(this.oj_home, "data", this.problem_id.toString());
			const filelist = await fs.readdirAsync(dirname);
			const outfilelist = [];
			for (let i in filelist) {
				//(filelist[i]);
				if (filelist[i].indexOf(".in") > 0) {
					this.submit.pushFileStdin(path.join(dirname, filelist[i]));
				}
				else if (filelist[i].indexOf(".out") > 0) {
					this.submit.pushAnswerFiles(path.join(dirname, filelist[i]));
					outfilelist.push(path.join(dirname, filelist[i]));
				}
			}
		}
		else{
			this.submit.setFileStdin("custominput.in");
		}
		this.submit.setLanguage(dockerJudger.parseLanguage(this.language));
		this.submit.setTimeLimit(this.time_limit*dockerJudger.LanguageBonus(this.language));
		this.submit.setTimeLimitReserve(this.time_limit_reserve);
		this.submit.setMemoryLimit(this.memory_limit*dockerJudger.LanguageBonus(this.language));
		this.submit.setMemoryLimitReverse(this.memory_limit_reserve);
		if (this.mode === 0) {
			if(fs.existsSync("./docker/checker")) {
				this.submit.setCompareFunction(require("./docker/checker").compareDiff);
			}
		}
		await this.submit.pushInputRawFiles({
			name: `Main${dockerJudger.parseLanguageSuffix(dockerJudger.parseLanguage(this.language))}`,
			data: this.code
		});
		if(this.Sandbox) {
			this.result = await this.Sandbox.runner(this.submit);
		}
		this.submit.emit("finish");
	}

}


module.exports = dockerJudger;
