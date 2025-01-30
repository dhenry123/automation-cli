/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { Command } from "commander";
import { createOperationBook } from "../createOperationBook";
import { exitNodeJs } from "../system";
import { legacyDirStorage } from "../constants";
import { getOperationsPath } from "../filePathResolver";

/**
 * To create an operationBook
 */
export const commandCreateOperationBook = (program: Command) => {
	program
		.command("cob")
		.description("Create an operationBook from template")
		.argument(
			"<operationBook path>",
			`absolute: /, relative: ./ or legacy: no prefix will be stored in ${getOperationsPath(
				legacyDirStorage
			)}`
		)
		.action(async (operationBookPath) => {
			try {
				createOperationBook(operationBookPath);
			} catch (error) {
				await exitNodeJs(1, (error as Error).toString());
			}
			await exitNodeJs();
		});
};
