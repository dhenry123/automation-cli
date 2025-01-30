/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { Command } from "commander";
import { exitNodeJs, setOPSBasePath } from "../system";
import { searchCommand } from "../searchCommand";

/**
 * To create an operationBook
 */
export const commandSearch = (program: Command) => {
	program
		.command("search")
		.description("Operations search")
		.argument("<words>", "Provide the words")
		.option(
			"--display-score",
			"For debug purpose only, display the miniSearch result"
		)
		.action(async (_str, options) => {
			try {
				setOPSBasePath();
				await searchCommand(_str, options);
			} catch (error) {
				await exitNodeJs(1, (error as Error).toString());
			}
			await exitNodeJs();
		});
};
