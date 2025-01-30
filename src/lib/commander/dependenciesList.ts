/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { Command } from "commander";
import { exitNodeJs } from "../system";
import { dependenciesList } from "../dependenciesList";

/**
 * To create an operationBook
 */
export const commandDependenciesList = (program: Command) => {
	program
		.command("deplist")
		.description("Display all integrated dependencies in operations")
		.option(
			"-f, --filter <string>",
			"Filter on operation name or dependency package name (RegExp)"
		)
		.option("-json", "Display as JSON format")
		.option("-nodep", "Display only operations with no dependencies")
		.action(async (_str, options) => {
			try {
				dependenciesList(options._optionValues);
			} catch (error) {
				await exitNodeJs(1, (error as Error).toString());
			}
			await exitNodeJs();
		});
};
