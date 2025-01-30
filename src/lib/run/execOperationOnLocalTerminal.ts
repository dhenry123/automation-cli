/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { ShellDescription, HostsType, Operation } from "../types";
import { buildShellCommand } from "./execOperation";
import {
	logDebugEvent,
	logHostEvent,
	logInstructionToExecute,
	logUserInfo,
} from "../log";

import { consoleErr } from "../../helpers/helperUI";
import {
	buildEnvironmentForSpawn,
	copyFileOnLocalhost,
	getLogErrorCopyTo,
} from "../../helpers/helperOperations";
import { runLocalSpawn } from "./localSpawn";
import { linuxLoggerCommand } from "../security";

/**
 * it seems output process for Spwan if fired once for stdout & stderr and start with stdou
 * if there are lines alternating stdout & stderr, you will get all stdout first, then stderr
 * see with debug mode: set environment variable MYTINYDCDEBUG=1
 */
export const execOperationOnLocalTerminal = (
	shellDescription: ShellDescription,
	host: HostsType,
	operation: Operation,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	commanderOptions: any
) => {
	logUserInfo(host.userInput);
	const logMessage = "[INFO] Using local terminal";
	logHostEvent(host.userInput, logMessage);
	logInstructionToExecute(host.userInput, shellDescription);

	const productionEnv = buildEnvironmentForSpawn(operation.environment || {});

	// Prepare spawn arguments, case:
	const spwanArgs = [];
	// For command spawargs must be :
	// "spawnargs": [
	//   "bash",
	//   "-c",
	//   "[command]"
	// ],
	// AND sudo is a full command
	if (!shellDescription.tmpFile || commanderOptions.sudo) {
		spwanArgs.push("-c");
	}

	// Get command to log action on remote system
	const cmdLogger = linuxLoggerCommand(shellDescription.shellInstructions);
	const spawnCommand = buildShellCommand(
		"",
		commanderOptions,
		shellDescription.tmpFile
			? shellDescription.tmpFile
			: `${cmdLogger} && ${shellDescription.shellInstructions}`,
		shellDescription.tmpFile
			? `bash "${shellDescription.tmpFile}"`
			: `bash -c "${cmdLogger} && ${shellDescription.shellInstructions}"`
	);
	spwanArgs.push(`${spawnCommand}`);

	if (operation.copyTo) {
		logDebugEvent(
			`execOperationOnLocalTerminal: 'copyTo' attribut detected -> trying to copy files list: ${JSON.stringify(
				operation.copyTo,
				null,
				4
			)}`
		);

		for (const data of operation.copyTo) {
			if (data.src) {
				try {
					copyFileOnLocalhost(operation, data);
				} catch (error) {
					consoleErr(getLogErrorCopyTo(error as Error, data));
					return null;
				}
			}
		}
	}
	logDebugEvent(
		`spawn command: ${JSON.stringify(
			spwanArgs,
			null,
			2
		)} - spawn env: ${JSON.stringify(productionEnv, null, 2)}`
	);

	return runLocalSpawn(spwanArgs, productionEnv, shellDescription);
};
