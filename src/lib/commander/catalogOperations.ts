/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { Command } from "commander";
import { buildCatalogOperations } from "../buildCatalogOperations";
import { exitNodeJs } from "../system";

/**
 * To create an operationBook
 */
export const commandCatalogOperations = (program: Command) => {
	program
		.command("catop")
		.description(
			"To obtain the operations catalog - default path is OPS directory"
		)
		.option("-f, --filter <string>", "Filter on operation name (RegExp)")
		.option("-json", "Display as JSON format")
		.action(async (_str, options) => {
			try {
				buildCatalogOperations(options._optionValues);
			} catch (error) {
				await exitNodeJs(1, (error as Error).toString());
			}
			await exitNodeJs();
		});
};
