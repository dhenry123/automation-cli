/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { ClientErrorExtensions } from "ssh2";
import {
	incrementHostActivity,
	interpolateInventoryValues,
	isBuiltInOperation,
	isWhenConditionMatch,
	registerContentToEnvironment,
	updateChangesCounters,
} from "../../helpers/helperOperations";
import {
	consoleLogStartingOperation,
	consoleLog,
	consoleLogOperationCanceledByCondition,
	consoleErr,
	consoleLogEndingOperation,
	consoleWarn,
	progressOfOperations,
} from "../../helpers/helperUI";
import { buildShell } from "../bash";
import {
	messageExitWithOutputOnStdErr,
	regExpChangeAll,
	regExpChangeTotal,
	regSudoPassword,
} from "../constants";
import { inventoryGetVpnConnectionInfos } from "../inventory";
import { logDebugEvent, logGetHostLogFullPath, logHostEvent } from "../log";
import { getProcessEnvValue } from "../system";
import {
	ExecOperationHostErrorType,
	ExecOperationPromiseType,
	HostsType,
	KeyNumberValue,
	KeyStringValue,
	Operation,
	ShellDescription,
	ShellOutput,
	VpnConnectionInfos,
} from "../types";
import { emitDataOnStream, logShellExecutionCompleted } from "./execOperation";
import { Spinner } from "../spinner";

export const stepCollectVpnInfosFromInventory = (
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	optionsCommandLine: any
): VpnConnectionInfos | null => {
	if (optionsCommandLine.inventoryFile) {
		// VPN infos connections: attribute: datacenterDescription.internalvpn
		const inventoryVPNInfos = inventoryGetVpnConnectionInfos(
			optionsCommandLine.inventoryFile
		);
		if (inventoryVPNInfos && typeof inventoryVPNInfos === "object")
			Object.getOwnPropertyNames(inventoryVPNInfos).forEach((key) => {
				if (!optionsCommandLine[key] && inventoryVPNInfos)
					optionsCommandLine[key] =
						inventoryVPNInfos[key as keyof typeof inventoryVPNInfos];
			});
		return inventoryVPNInfos;
	}
	return null;
};

/**
 * add host to completed list
 */
export const stepAddHostToHostsListCompleted = (
	host: HostsType,
	hostsListCompleted: string[]
) => {
	incrementHostActivity();
	hostsListCompleted.push(host.userInput);
};

export const stepRemoveHostFromListToProceed = (
	host: HostsType,
	hostsListToProceed: HostsType[]
): HostsType[] => {
	return [...hostsListToProceed].filter(
		(item) => item.userInput !== host.userInput
	);
};

export const stepWhenCondition = (
	host: HostsType,
	hostsListCompleted: string[],
	operation: Operation,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	optionsCommandLine: any,
	currentOperationNumber: number,
	operationsCount: number
): boolean => {
	if (operation.when) {
		logDebugEvent(
			`parameters when detected on operation, executing simple test: ${
				operation.when
			}, environment: ${JSON.stringify(operation.environment, null, 4)} ${
				optionsCommandLine.inventoryFile
					? `Inventory file is provided: ${optionsCommandLine.inventoryFile}`
					: ""
			}`
		);
		const condition = isWhenConditionMatch(
			operation.when,
			operation.environment as KeyStringValue,
			optionsCommandLine.inventoryFile
		);
		logDebugEvent(`condition resolved: ${condition}`);
		if (!condition) {
			const message = `[WARN] This operation is subject to the following conditions: ${operation.when}. As the condition is not met, so this operation is not executed.`;
			stepAddHostToHostsListCompleted(host, hostsListCompleted);
			logDebugEvent(`runOperationsOnHosts: ${message}`);
			consoleLogStartingOperation(
				operation.name,
				host.userInput,
				currentOperationNumber,
				operationsCount
			);
			consoleLog(message, "bgRed");
			consoleLogOperationCanceledByCondition(
				host.userInput,
				currentOperationNumber,
				operationsCount
			);
			return false;
		}
	}
	return true;
};

/**
 * Try to substitute operations parameters value from inventory, value contains ^#inv.
 * exit on the first error
 * Checkin operations parameters values if inventory provided
 * could not be check before starting the run,
 * because some operation could modify inventory during the execution of some operationBook : needed in specific case for Mytinydc datacenter
 */
export const stepInterpolateEnvironmnentWithInventoryValues = (
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	optionsCommandLine: any,
	operation: Operation,
	host: HostsType,
	hostsListToProceed: HostsType[],
	hostsListCompleted: string[],
	hostsResume: ExecOperationHostErrorType[]
): boolean => {
	if (optionsCommandLine.inventoryFile) {
		logDebugEvent(
			`runOperationsOnHosts: inventory provided: ${optionsCommandLine.inventoryFile}`
		);

		/**
		 * !!! This part can modify the content of the environment
		 * if error do not block others
		 */
		if (
			!interpolateInventoryValues(
				operation,
				optionsCommandLine.inventoryFile,
				host.userInput
			)
		) {
			// Remove host from process, it's over for it
			hostsListToProceed = hostsListToProceed.filter(
				(item) => item.userInput !== host.userInput
			);
			stepAddHostToHostsListCompleted(host, hostsListCompleted);
			hostsResume.push({
				host: host.userInput,
				operationError: operation.name,
			});
			return false;
		}
	}
	return true;
};

export const stepBuildShell = (
	operation: Operation,
	host: HostsType
): ShellDescription | null => {
	// Build shell to process
	let shellDescription: ShellDescription | null = null;
	logDebugEvent(
		`runOperationsOnHosts: Trying to buildShell with operation : ${JSON.stringify(
			operation,
			null,
			4
		)}`
	);
	if (
		(operation.scripts && operation.scripts?.length > 0) ||
		operation.command
	) {
		logDebugEvent(
			`runOperationsOnHosts: Calling buildShell with operation : ${JSON.stringify(
				operation,
				null,
				4
			)}`
		);
		shellDescription = buildShell(operation, host.userInput);
	} else if (operation.operation && isBuiltInOperation(operation.operation)) {
		shellDescription = {
			shellInstructions: "builtin",
			timeToBuild: 0,
			tmpFile: "",
		};
	}
	return shellDescription;
};

export const stepRunEventError = (
	promiseExecOperation: ExecOperationPromiseType,
	host: HostsType,
	error: Error & ClientErrorExtensions
) => {
	incrementHostActivity();
	logDebugEvent(
		`runOperationsOnHosts::promiseExecOperation received error: ${(
			error as Error
		).toString()}`
	);
	let errorMessage = error.toString();
	if (error.level === "client-authentication") {
		errorMessage +=
			"\n\nYou can specify the use of a custom ssh key, by passing the parameter: -sshpk [absolute or relative path of an ssh private key file]";
		if (promiseExecOperation.connexion)
			emitDataOnStream(errorMessage, promiseExecOperation.connexion, true);
	}

	logHostEvent(
		host.userInput,
		`[ERROR] End of process execution: ${errorMessage}\n`
	);
	if (promiseExecOperation?.connexion)
		promiseExecOperation.connexion.emit("endConn", new Error(errorMessage));
};

export const stepRunEventDataFromBash = (
	operation: Operation,
	host: HostsType,
	line: ShellOutput,
	outputLines: ShellOutput[],
	alreadyDisplayed: boolean,
	spinner: Spinner
) => {
	incrementHostActivity();
	outputLines.push(line);
	logDebugEvent(
		`runOperationsOnHosts: promiseExecOperation: signal 'dataFromBash': ${JSON.stringify(
			line,
			null,
			4
		)}`
	);
	// nolog specified on operation, output is not included in logfile
	if (!operation.nolog || getProcessEnvValue("NOLOG")) {
		// trim is not applied in log
		logHostEvent(
			host.userInput,
			`${line.output === "stderr" ? "**shellStdErr**" : "shellStdOut"}: ${
				line.message
			}`
		);
	} else {
		if (!alreadyDisplayed) {
			consoleLog(
				'[Security] Events received for this operation (stdout & stderr) will NOT be logged (attribute "nolog" detected for this operation).',
				"yellow"
			);
			alreadyDisplayed = true;
		}
	}

	// trim is applied in spinner
	spinner.setText(
		`${host.userInput}: ${
			line.message ? line.message.trim() : "Waiting for message..."
		}`
	);
};

export const stepRunEventEndConn = (
	promiseExecOperation: ExecOperationPromiseType,
	operation: Operation,
	host: HostsType,
	hostsListCompleted: string[],
	startingTimeProcess: number,
	error: Error,
	currentOperationNumber: number,
	operationsCount: number,
	outputLines: ShellOutput[],
	RegisteredVariables: KeyStringValue,
	hostCounterChanges: KeyNumberValue,
	shellDescription: ShellDescription,
	hostsResume: ExecOperationHostErrorType[],
	hostsListToProceed: HostsType[]
) => {
	incrementHostActivity();
	if (error) {
		logDebugEvent(
			`runOperationsOnHosts: promiseExecOperation endConn signal received with error: ${JSON.stringify(
				error
			)} - host: ${JSON.stringify(host, null, 4)}`
		);
	} else {
		logDebugEvent(
			`runOperationsOnHosts: promiseExecOperation endConn signal received NO error - host: ${JSON.stringify(
				host,
				null,
				4
			)} - hostsListCompleted: ${JSON.stringify(hostsListCompleted, null, 4)}`
		);
	}
	const endingTimeProcess = new Date();
	const elapsedTime =
		endingTimeProcess.valueOf() - startingTimeProcess.valueOf();
	logShellExecutionCompleted(host, endingTimeProcess, elapsedTime);

	if (!getProcessEnvValue("SILENTMODE") && !getProcessEnvValue("QUIETMODE"))
		consoleLogStartingOperation(
			promiseExecOperation.operation.name,
			promiseExecOperation.host.userInput,
			currentOperationNumber,
			operationsCount
		);

	logDebugEvent(`runOperationsOnHosts: outputLines size ${outputLines.length}`);

	if (outputLines && outputLines.length > 0) {
		// register on operation ? only if no error
		if (!error)
			registerContentToEnvironment(
				operation.register,
				outputLines,
				RegisteredVariables
			);
		for (const line of outputLines) {
			// stdout is not displayed if silent mode || (register && ! quietmode)
			if (line.output === "stdout") {
				if (
					!getProcessEnvValue("SILENTMODE") &&
					!(operation.register && getProcessEnvValue("QUIETMODE"))
				) {
					// do not display changes details
					if (
						!regExpChangeAll.test(line.message) &&
						!regSudoPassword.test(line.message)
					)
						consoleLog(line.message);
					if (regExpChangeTotal.test(line.message))
						consoleLog(`\n${line.message}`);
				}

				// try to catch total number of changes for this operation/host
				updateChangesCounters(line, host, hostCounterChanges);
			} else if (line.output === "stderr") {
				consoleErr(line.message);
			}
		}
	}

	// stdErr
	const outputLinesFilterOnStderr = outputLines.filter(
		(item) => item.output === "stderr"
	);
	if (
		outputLinesFilterOnStderr &&
		outputLinesFilterOnStderr.length > 0 &&
		!error
	) {
		consoleWarn(messageExitWithOutputOnStdErr);
	}

	// process completed - screen and log

	if (error) {
		// Output even silentmode
		consoleErr(error.message || `exitCode:${error}`);
		consoleErr(
			`\n<-- Operation failed [${
				promiseExecOperation.host.userInput
			}: ${elapsedTime} ms/${
				shellDescription.timeToBuild
			}ms - ${logGetHostLogFullPath(host.userInput)} ${progressOfOperations(
				currentOperationNumber,
				operationsCount
			)}\n`
		);
		hostsResume.push({
			host: promiseExecOperation.host.userInput,
			operationError: promiseExecOperation.operation.name,
		});
		hostsListToProceed = stepRemoveHostFromListToProceed(
			host,
			hostsListToProceed
		);
	} else {
		if (!getProcessEnvValue("SILENTMODE") && !getProcessEnvValue("QUIETMODE"))
			consoleLogEndingOperation(
				promiseExecOperation,
				elapsedTime,
				shellDescription,
				currentOperationNumber,
				operationsCount
			);
	}
	// list which be scan by controller, when all hosts are OK or KO
	// next operation is started
	stepAddHostToHostsListCompleted(host, hostsListCompleted);
	return hostsListToProceed;
};
