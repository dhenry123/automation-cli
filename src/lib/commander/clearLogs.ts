/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 10/27/24
 */

import { Command } from "commander";
import readline from "node:readline";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import colors from "colors/safe";
import { consoleLog } from "../../helpers/helperUI";
import { isInteger } from "../checks";
import { messageProcessCanceledByUser } from "../constants";
import { logGetBaseDirectory } from "../log";
import { exitNodeJs } from "../system";

export const commandClearLogs = (program: Command, rl: readline.Interface) => {
	program
		.command("clearlogs <number>")
		.description(
			`Delete all files older than <number> days from the log directory: ${logGetBaseDirectory()}`
		)
		.action(async (_str) => {
			try {
				let exitMessage = messageProcessCanceledByUser;
				if (!isInteger(_str))
					throw new Error(`The value of the day(s) must be a whole number`);
				const messageOlder = parseInt(_str) ? ` older than ${_str} day(s)` : "";
				rl.question(
					colors.red(
						`\nAre you sure to delete all files${messageOlder} in the directory: ${logGetBaseDirectory()} ? (Y/[N])`
					),
					(userResponse) => {
						if (userResponse === "Y") {
							exitMessage = "";
							const currentTime = Math.floor(new Date().getTime() / 1000);
							readdirSync(logGetBaseDirectory()).forEach((f) => {
								const node = `${logGetBaseDirectory()}/${f}`;
								const stats = statSync(node);
								const birthTime = Math.floor(stats.birthtimeMs / 1000);
								const limit = parseInt(_str) * 86400;
								if (currentTime - birthTime > limit) {
									if (existsSync(node)) {
										rmSync(node, { recursive: true });
										consoleLog(`${node} has been deleted`);
									}
								}
							});
						}
						exitNodeJs(0, exitMessage);
					}
				);
			} catch (error) {
				await exitNodeJs(1, (error as Error).toString());
			}
		});
};
