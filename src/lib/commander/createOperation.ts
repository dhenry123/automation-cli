/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { Command } from "commander";
import { createOperation } from "../createOperation";
import { exitNodeJs } from "../system";

/**
 * To create an operation
 */
export const commandCreateOperation = (program: Command) => {
	program
		.command("cop")
		.description("To create an operation from template")
		.argument(
			"<operation path>",
			"absolute: /, relative: ./ or relative to OPS environment"
		)
		.requiredOption("-c, --comment <string>", "Comment for this operation")
		.action(async (_str, options) => {
			try {
				createOperation(_str, options);
			} catch (error) {
				await exitNodeJs(1, (error as Error).toString());
			}
			await exitNodeJs();
		});
};
