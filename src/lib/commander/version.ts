/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { Command } from "commander";
import { exitNodeJs } from "../system";
import { APPLICATION_VERSION } from "../constants";
import { consoleLog } from "../../helpers/helperUI";

/**
 * To create an operation
 */
export const commandVersion = (program: Command) => {
	program
		.command("version")
		.description("Display the automation-cli version")
		.option("-json", "Display as JSON format")
		.action(async (_str, options) => {
			try {
				const digit = APPLICATION_VERSION.split(".");
				if (!options._optionValues.Json) {
					consoleLog(`NodeJs version: ${digit[0]}`);
					consoleLog(`automation-cli version: ${digit[1]}`);
					consoleLog(`automation-cli patch: ${digit[2]}`);
				} else {
					consoleLog(
						JSON.stringify({
							nodejs: digit[0],
							version: digit[1],
							patch: digit[2],
						})
					);
				}
			} catch (error) {
				await exitNodeJs(1, (error as Error).toString());
			}
			await exitNodeJs();
		});
};
