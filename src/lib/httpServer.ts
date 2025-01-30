/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { OptionValues } from "commander";
import express from "express";
import http from "node:http";

import logger from "morgan";
import { execSync } from "node:child_process";
import { resolveHttpServerPublicPath } from "./filePathResolver";
import { consoleLog } from "../helpers/helperUI";
import { existsSync, readdirSync } from "fs";
import { exitNodeJs } from "./system";

export const httpServer = async (commanderOptions: OptionValues) => {
	const appHttp = express();

	// listening port server
	const listeningPort = commanderOptions.listeningPort || 52300;
	// listening IP address server
	const listeningAddress = "0.0.0.0";

	// statics routes
	const publicPath = resolveHttpServerPublicPath(
		commanderOptions.publicDirectory || "public"
	);

	if (!existsSync(publicPath)) {
		await exitNodeJs(1, `Public path not found: ${publicPath}`);
	}
	const morganChain =
		':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';
	// Use Morgan middleware with the configured token
	appHttp.use((req, res, next) => {
		logger(morganChain)(req, res, next);
	});

	// route to send react app
	consoleLog(`public path is : ${publicPath}`);
	appHttp.use(
		"/",
		express.static(publicPath, {
			etag: true,
		})
	);

	// get main ip address
	const ipAddress = execSync(
		"ip route get 1 | head -n 1 | sed -E 's/.*src (.*) uid.*/\\1/'"
	)
		.toString()
		.trim();
	// <--- Http Server
	http.createServer(appHttp).listen(listeningPort, listeningAddress, () => {
		consoleLog(
			`http protocol listening at http://${ipAddress}:${listeningPort}`
		);
	});
	const list = readdirSync(publicPath);
	if (list.length === 0) {
		await exitNodeJs(1, `No file to serve in ${publicPath}`);
	}
	consoleLog("Files available:");
	for (const file of list) {
		consoleLog(
			` --> ${file} : curl http://${ipAddress}:${listeningPort}/${file}`
		);
	}

	// listening process signal
	process.on("SIGTERM", () => {
		consoleLog("Received SIGTERM: cleaning up");
		process.exit(0);
	});

	process.on("SIGINT", () => {
		consoleLog("Received SIGINT: cleaning up");
		process.exit(0);
	});
};
