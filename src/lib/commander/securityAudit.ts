/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { Command } from "commander";
import { exitNodeJs } from "../system";
import { securityAudit } from "../securityAudit/securityAudit";

/**
 * To create an operationBook
 */
export const commandSecurityAudit = (program: Command) => {
	program
		.command("audit")
		.option("-failed, --failed", "Display only failed")
		.option("-json", "Display as JSON format")
		.description("OPSDirectory audit")
		.action(async (_str, options) => {
			try {
				await securityAudit(options._optionValues);
				if (options._optionValues.Json) process.env.SILENTMODE = "true";
				await exitNodeJs(0);
			} catch (error) {
				await exitNodeJs(1, (error as Error).toString());
			}
			await exitNodeJs();
		});
};
