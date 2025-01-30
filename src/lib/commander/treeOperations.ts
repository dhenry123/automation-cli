/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { Command } from "commander";
import { buildTreeOperations } from "../buildTreeOperations";
import { exitNodeJs } from "../system";

/**
 * To create an operationBook
 */
export const commandTreeOperations = (program: Command) => {
	program
		.command("tree")
		.description(
			"To obtain the tree of operations - default path is OPS directory"
		)
		.option(
			"-dir, --operations-path <string>",
			"Absolute or relative path of the operations directory"
		)
		.option(
			"-fp, --displayFullPath",
			"Display full path for editor integration"
		)
		.option(
			"-d, --depth <integer>",
			"Depth of directory scan from operations directory"
		)
		.option("-nc, --nocolors", "Display full path for editor integration")
		.option("-f, --filter <string>", "Filter on operation name (RegExp)")
		.option("-gc, --generate-command", "To display to command to run operation")
		.option("-h, --hostsList <string>", "helper for -gc to include hosts list")
		.option(
			"-i, --inventory <string>",
			"helper for -gc to include inventory file"
		)
		.action(async (_str, options) => {
			try {
				buildTreeOperations(options._optionValues);
			} catch (error) {
				await exitNodeJs(1, (error as Error).toString());
			}
			await exitNodeJs();
		});
};
