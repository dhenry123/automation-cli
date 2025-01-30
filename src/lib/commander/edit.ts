/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { Command } from "commander";
import { isCommanderOptionsIncludeEdit } from "../../helpers/helperOptions";
import { consoleErr } from "../../helpers/helperUI";
import { discoverOperationsFromCommanderOptions } from "../run/discoverOperations";
import { exitNodeJs } from "../system";

export const commandEdit = (program: Command) => {
	program
		.command("edit")
		.description("To edit manifest & script")
		.option(
			"-op, --operation <string>",
			"Operation to be executed(complete sub-directory of the 'operations' directory) eg: built-in/system/apt-update"
		)
		.option(
			"-ob, --operation-book <string>",
			"Full path of the manifest containing the list of operations to be performed"
		)
		.option("-eds", "Try to edit the first script of operation")
		.option(
			"-edm",
			"Try to edit the manifest file of operation or operationBook"
		)
		.action(async (_str, options) => {
			if (
				!options._optionValues.operationBook &&
				!options._optionValues.operation
			) {
				consoleErr(`To edit operation use -op or -ob for operationBook`);
				await exitNodeJs();
			}
			// if OperationBook no need use set -edm because only one file to Edit
			// set Edm = true
			if (options._optionValues.operationBook) {
				options._optionValues.Edm = true;
				// if user set -eds (not available on operationBook)
				options._optionValues.Eds = false;
			}
			// Edit must be set with -edm | -eds
			if (!isCommanderOptionsIncludeEdit(options._optionValues)) {
				consoleErr(`You must specify the type of file you wish to edit, using one of the following options:
-edm To edit the manifest of the operation
-eds To edit the script of the operation
`);
				await exitNodeJs();
			}

			// Edit if possible
			if (
				options._optionValues.operation ||
				options._optionValues.operationBook
			) {
				await discoverOperationsFromCommanderOptions(options._optionValues);
			}
			return;
		});
};
