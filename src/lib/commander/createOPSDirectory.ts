/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 10/27/24
 */

import { Command } from "commander";
import readline from "node:readline";
import { createOPSDirectory } from "../createOPSDirectory";
import { terminateAllProcesses } from "../system";

export const commandCreateOPSDirectory = (
	program: Command,
	rl: readline.Interface
) => {
	program
		.command("cops")
		.description(
			`Create a directory structure for operations on this workstation`
		)
		.argument("<path>", `OPSDirectory access path (relative or absolute)`)
		.action(async (pathOfOperations) => {
			try {
				await createOPSDirectory(rl, pathOfOperations).catch((error) => {
					throw error;
				});
			} catch (error) {
				await terminateAllProcesses(1, (error as Error).toString(), rl);
			}
		});
};
