/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 11/07/24
 */

import colors from "colors/safe";
import { logGetDebugFullPath, logGetHostLogFullPath } from "../lib/log";
import { getProcessEnvValue } from "../lib/system";
import {
	ExecOperationPromiseType,
	HostsType,
	ShellDescription,
} from "../lib/types";

export const truncateLabel = (label: string, maxChars: number = 70) => {
	if (label.length > maxChars) {
		return `${label.substring(0, maxChars - 3)}...`;
	}
	return label;
};

export const stdOutClearLine = () => {
	if (process.stdout.clearLine) process.stdout.clearLine(0);
};

/**
 * Method to detect if screen is present
 */
export const isScreen = () => {
	if (process.stdout.clearLine) {
		process.stdout.clearLine(0);
		return true;
	}
	return false;
};

export const consoleLog = (
	message: string,
	color?: "green" | "red" | "yellow" | "cyan" | "bgGreen" | "bgRed"
) => {
	if (message) {
		stdOutClearLine();
		switch (color) {
			case "green":
				process.stdout.write(colors.green(message));
				break;
			case "red":
				process.stdout.write(colors.red(message));
				break;
			case "yellow":
				process.stdout.write(colors.yellow(message));
				break;
			case "cyan":
				process.stdout.write(colors.cyan(message));
				break;
			case "bgGreen":
				process.stdout.write(colors.bgGreen(message));
				break;
			case "bgRed":
				process.stdout.write(colors.bgRed(message));
				break;
			default:
				process.stdout.write(message);
		}
		// important otherwise no display
		process.stdout.write("\n");
	}
};

export const consoleLogStartingOperation = (
	operationName: string,
	userInput: string,
	operationNumber: number,
	numberOfOperation: number
) => {
	consoleLog(
		`--> Starting Operations: "${truncateLabel(
			operationName
		)}" on: ${userInput} ${progressOfOperations(
			operationNumber,
			numberOfOperation
		)}\n`,
		"yellow"
	);
};

export const consoleLogEndingOperation = (
	promiseExecOperation: ExecOperationPromiseType,
	elapsedTime: number,
	shellDescription: ShellDescription,
	operationNumber: number,
	numberOfOperation: number
) => {
	consoleLog(
		`\n<-- Operation succeeded [${
			promiseExecOperation.host.userInput
		}: ${elapsedTime} ms/ ${
			shellDescription.timeToBuild
		} ms] ${progressOfOperations(operationNumber, numberOfOperation)}\n`,
		"green"
	);
};

export const consoleLogOperationCanceledByCondition = (
	userInput: string,
	operationNumber: number,
	numberOfOperation: number
) => {
	consoleLog(
		`\n<-- Operation canceled by condition [${userInput}: 0 ms] ${progressOfOperations(
			operationNumber,
			numberOfOperation
		)}\n`,
		"red"
	);
};

export const progressOfOperations = (
	operationNumber: number,
	numberOfOperation: number
) => {
	return `(${operationNumber.toString()}/${numberOfOperation.toString()})`;
};

export const consoleWarnDebugActivated = () => {
	if (!getProcessEnvValue("MYTINYDCDEBUG")) return;
	if (getProcessEnvValue("NOLOG")) return;
	consoleWarn(
		`Debug log enabled (MYTINYDCDEBUG=1): file://${logGetDebugFullPath()}`
	);
};

export const consoleErr = (message: string) => {
	if (message) {
		stdOutClearLine();
		process.stderr.write(colors.red(message));
		// important otherwise no display
		process.stderr.write("\n");
	}
};

/**
 * use stdErr output
 */
export const consoleWarn = (message: string) => {
	if (message) {
		process.stderr.write(colors.yellow(message));
		// important otherwise no display
		process.stderr.write("\n");
	}
};

export const displayHostLogFile = (
	hostsListToProceed: HostsType[],
	noconfirm?: string
) => {
	if (
		noconfirm &&
		isScreen() &&
		!getProcessEnvValue("SILENTMODE") &&
		!getProcessEnvValue("QUIETMODE")
	) {
		for (const host of hostsListToProceed) {
			consoleLog(
				`log file for '${host.userInput}': file://${logGetHostLogFullPath(
					host.userInput
				)}`
			);
		}
	}
};
