/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { Command } from "commander";
import { exitNodeJs } from "../system";
import { httpServer } from "../httpServer";
/**
 * To create an operationBook
 */
export const commandServe = (program: Command) => {
	program
		.command("serve")
		.description("Start a minimalist web server")
		.option("-p, --listening-port <number>", "Web server listening port")
		.option(
			"-d, --public-directory <string>",
			"Directory to serve, default: $OPS/public, can also be a relative or absolute path"
		)
		.action(async (_str, options) => {
			try {
				await httpServer(options._optionValues);
			} catch (error) {
				await exitNodeJs(1, (error as Error).toString());
			}
		});
};
