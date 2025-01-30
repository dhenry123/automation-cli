/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { Command } from "commander";
import { exportOperation } from "../exportOperation";
import { exitNodeJs } from "../system";

/**
 * To create an operationBook
 */
export const commandExportOperation = (program: Command) => {
	program
		.command("exportop")
		.description(
			"Export an operation, warning: the operation may contain secrets"
		)
		.requiredOption(
			"-op, --operation <string>",
			"Operation name to be exported"
		)
		.action(async (_str, options) => {
			try {
				exportOperation(options._optionValues);
			} catch (error) {
				await exitNodeJs(1, (error as Error).toString());
			}
			await exitNodeJs();
		});
};
