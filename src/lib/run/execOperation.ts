/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { Client } from "ssh2";
import {
	ExecOperationPromiseType,
	HostsType,
	Operation,
	ShellDescription,
	ShellOutput,
} from "../types";
import { execOperationOverSsh } from "./execOperationOverSSH";
import { ChildProcessWithoutNullStreams } from "child_process";
import { execOperationOnLocalTerminal } from "./execOperationOnLocalTerminal";
import { logDebugEvent, logHostEvent } from "../log";
import { execOperationBuiltin } from "./execOperationBuiltin";
import { DuplexStream } from "../DuplexStream";
import {
	isBuiltInOperation,
	isLocalhost,
} from "../../helpers/helperOperations";
import { Spinner } from "../spinner";
import { ReadLine } from "readline";

/**
 * Execute operation on remote via ssh or local (127.0.0.1) on local Terminal
 */
export const execOperationOneHost = async (
	shellDescription: ShellDescription,
	host: HostsType,
	operation: Operation,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	commanderOptions: any,
	spinner: Spinner,
	rlHandler: ReadLine
): Promise<ExecOperationPromiseType | null> => {
	// eslint-disable-next-line no-useless-catch
	try {
		let connInfos:
			| Client
			| ChildProcessWithoutNullStreams
			| DuplexStream
			| null = null;

		const isBuiltinOp = operation.operation
			? isBuiltInOperation(operation.operation)
			: false;
		if (!isBuiltinOp && !isLocalhost(host.toPerform) && shellDescription) {
			// Execution will be done over ssh
			connInfos = execOperationOverSsh(
				shellDescription,
				host,
				operation,
				commanderOptions
			);
		} else if (isBuiltinOp) {
			// Built-in operation
			connInfos = execOperationBuiltin(
				host,
				operation,
				commanderOptions,
				spinner,
				rlHandler
			);
		} else if (isLocalhost(host.toPerform) && shellDescription) {
			// Execution will be done over local terminal
			connInfos = execOperationOnLocalTerminal(
				shellDescription,
				host,
				operation,
				commanderOptions
			);
		}
		return {
			connexion: connInfos,
			operation: operation,
			host: host,
		};
	} catch (error) {
		// Warning error must not exist from main, because occurred on one host
		throw error;
	}
};

export const buildShellCommand = (
	bashParameters: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	commanderOptions: any,
	shell: string,
	sudoShell?: string
) => {
	let cmdShell = `${bashParameters ? `${bashParameters} ` : ""}`;
	if (commanderOptions.sudo) {
		if (commanderOptions.sudopass) {
			cmdShell += `sudo -k -p "" -S -E ${sudoShell || shell} <<< '${
				commanderOptions.sudopass
			}'`;
		} else {
			cmdShell += `sudo -E ${sudoShell || shell}`;
		}
	} else {
		cmdShell += shell;
	}
	return cmdShell;
};

/**
 * used by stdout & stderr, pass stdoutLines | stderrLines to lines parameters
 */
export const emitDataOnStream = (
	data: string,
	conn: Client | ChildProcessWithoutNullStreams | DuplexStream,
	isStdErr: boolean
) => {
	if (typeof data === "object") {
		data = (data as string).toString().trim();
	}
	// don't save breaking lines
	if (!data || data === "\n") {
		return;
	}
	for (const line of data.toString().split("\n")) {
		logDebugEvent(`Calling conn.emit with ('dataFromBash', '${line}')`);
		const outputType = isStdErr ? "stderr" : "stdout";
		conn.emit("dataFromBash", {
			output: outputType,
			message: line,
		} as ShellOutput);
	}
};

/**
 * Wrapper to log shell execution completed
 */
export const logShellExecutionCompleted = (
	host: HostsType,
	endingTimeProcess: Date,
	elapsedTime: number
) => {
	logHostEvent(
		host.userInput,
		`[INFO] Shell execution completed - ${endingTimeProcess.toLocaleString()} (${endingTimeProcess.valueOf()} in milliseconds) - Elapsed Time: ${elapsedTime} ms\n`
	);
};

/**
 * Wrapper to log shell execution completed
 */
export const logShellExecutionStarting = (
	host: HostsType,
	operationName: string,
	startingTimeProcess: Date,
	isOverVpn: boolean = false
) => {
	logHostEvent(
		host.userInput,
		`[INFO] Operations '${operationName}' start on host: ${
			isOverVpn
				? `${host.userInput} over VPN ${host.toPerform}`
				: `${host.userInput}`
		} : ${startingTimeProcess.toLocaleString()} (${startingTimeProcess.valueOf()} in milliseconds)`
	);
};
