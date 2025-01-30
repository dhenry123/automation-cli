/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 18/01/25
 */

import { Command } from "commander";
import { exitNodeJs } from "../system";
import { writeFileSync } from "fs";
import { consoleLog } from "../../helpers/helperUI";
import { genBashAutocompletionTemplate } from "../getTemplates";

/**
 * To create an operationBook
 */
export const commandBashAutoComplete = (program: Command) => {
	program
		.command("bashauto")
		.description(
			"To install the automation-cli bash auto-completion (sudo could be required)"
		)
		.action(async () => {
			try {
				const bashAutoComplete = genBashAutocompletionTemplate();
				const bashAutoCompleteFile = "/etc/bash_completion.d/automation_cli";
				writeFileSync(bashAutoCompleteFile, bashAutoComplete, "utf-8");
				consoleLog(
					`File has been installed in: ${bashAutoCompleteFile}`,
					"green"
				);
				const commandBashRc =
					'\nif [ -f "/etc/bash_completion.d/automation_cli" ];then . "/etc/bash_completion.d/automation_cli";fi';
				consoleLog(
					"\nTo complete the process, at the end of the file: ~/.bashrc add :"
				);
				consoleLog(commandBashRc);
				consoleLog(
					"\nThen open new console or run '. /etc/bash_completion.d/automation_cli' and try the bash autocompletion for automation-cli using TAB\n"
				);
			} catch (error) {
				await exitNodeJs(1, (error as Error).toString());
			}
			await exitNodeJs();
		});
};
