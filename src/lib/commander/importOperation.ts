/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { Command } from "commander";
import readline from "node:readline";
import { importOperation } from "../importOperation";
import { exitNodeJs } from "../system";
/**
 * To create an operationBook
 */
export const commandImportOperation = (
	program: Command,
	rl: readline.Interface
) => {
	program
		.command("importop")
		.description("Import operation, warning: content may be compromiseds")
		.requiredOption(
			"-f, --file-to-import <string>",
			"Operation filename to import"
		)
		.option("--force", "Force to overwrite destination")
		.action(async (_str, options) => {
			try {
				importOperation(options._optionValues, rl);
			} catch (error) {
				await exitNodeJs(1, (error as Error).toString());
			}
		});
};
