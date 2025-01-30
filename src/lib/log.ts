/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { appendFileSync, chownSync, existsSync, rmSync } from "node:fs";
import { LogCommonFileName, LogDebugFileName, logDirectory } from "./constants";
import { getProcessEnvValue, getUserHomeDirectory } from "./system";
import { checkDirectoryExists } from "./checks";
import { consoleLog } from "../helpers/helperUI";
import crypto from "crypto";
import { ShellDescription } from "./types";
import { addLineNumberToShell } from "./bash";
import { execSync } from "node:child_process";
import { logHideInformations } from "./security";

/**
 * used to log debug events
 */
export const logGetDebugFullPath = (): string => {
	return `${logGetBaseDirectory()}/${LogDebugFileName}`;
};

/**
 * used to log common events
 */
export const logGetCommonLogFullPath = (): string => {
	return `${logGetBaseDirectory()}/${LogCommonFileName}`;
};

/**
 * used to log host events
 */
export const logGetHostLogFullPath = (host: string): string => {
	return `${getProcessEnvValue("DIRECTORYLOGOPERATION")}/${host}.log`;
};

/**
 * Delete debug log file if debug mode detected
 * This file is deleted each time you execute automation-cli
 */
export const logDeleteDebugLogFile = () => {
	const debugLogFile = logGetDebugFullPath();
	if (getProcessEnvValue("MYTINYDCDEBUG") && existsSync(debugLogFile))
		rmSync(debugLogFile);
};

/**
 * Prepare base log storage directory
 */
export const logSetBaseDirectory = () => {
	// Define base directory - <> if development environment ?
	if (process.env.AUTOMATIONCLIDEV && process.env.AUTOMATIONCLIDEV === "1") {
		process.env.LOGSPATH = `${process.cwd()}/tests/logs`;
	} else if (process.env.SUDO_USER) {
		// executed with sudo - Log directory will be set in the sudo_user
		const userHomeDirectory = execSync(
			`getent passwd ${process.env.SUDO_USER} | cut -d: -f6`
		)
			.toString()
			.trim();
		if (userHomeDirectory && existsSync(userHomeDirectory)) {
			process.env.LOGSPATH = `${userHomeDirectory}/${logDirectory}`;
		} else {
			throw new Error(
				`You are trying to run automation-cli with a user account without home directory !`
			);
		}
	} else {
		process.env.LOGSPATH = `${getUserHomeDirectory()}/${logDirectory}`;
	}
	checkDirectoryExists(getProcessEnvValue("LOGSPATH"));
	logDeleteDebugLogFile();
};

/**
 * run operation store all host log in the same directory
 * must be set before starting run process on host
 * must be available in the confirmation report
 * the directory creation process is separated because the administrator may not have confirmed the start of the operation.
 * In this case, it is not necessary to create the directory.
 */
export const logSetBaseDirectoryOperation = () => {
	//set Operation starting Date in node environment -could be used by all subprocesses
	process.env.STARTINGOPERATION = `${new Date()
		.toISOString()
		.replace(/[:.]/g, "_")}-${crypto.randomBytes(2).toString("hex")}`;
	process.env.DIRECTORYLOGOPERATION = `${logGetBaseDirectory()}/${
		process.env.STARTINGOPERATION
	}`;
};

/**
 * If file has been created by append, chown must be applied for process executed with sudo
 */
const chownLogFile = (fileExist: boolean, logFileName: string) => {
	if (!fileExist && process.env.SUDO_UID && process.env.SUDO_GID) {
		// chown sudo_user
		chownSync(
			logFileName,
			parseInt(process.env.SUDO_UID),
			parseInt(process.env.SUDO_GID)
		);
	}
};

export const logHostEvent = (
	host: string,
	data: string,
	displayScreen: boolean = false
) => {
	// NOLOG is set ?
	if (getProcessEnvValue("NOLOG")) return;
	const logFileName = `${logGetHostLogFullPath(host)}`;
	// if log file created by process, chown will be necessary if sudo
	const logExists = existsSync(logFileName);
	appendFileSync(logFileName, `${logHideInformations(data)}\n`);
	chownLogFile(logExists, logFileName);

	if (displayScreen) consoleLog(data);
	logDebugEvent(data);
};

export const logCommonEvent = (
	data: string,
	displayScreen: boolean,
	prefixCommonLog?: string
) => {
	// NOLOG is set ?
	if (getProcessEnvValue("NOLOG")) return;
	const logFileName = `${logGetCommonLogFullPath()}`;
	// if log file created by process, chown will be necessary if sudo
	const logExists = existsSync(logFileName);
	appendFileSync(
		logFileName,
		`${prefixCommonLog ? `${prefixCommonLog} ` : ""} ${logHideInformations(
			data
		)}\n`
	);
	chownLogFile(logExists, logFileName);
	if (displayScreen) consoleLog(data);
};

export const logDebugEvent = (data: string, displayScreen: boolean = false) => {
	// MYTINYDCDEBUG is set ?
	if (!getProcessEnvValue("MYTINYDCDEBUG")) return;
	// NOLOG is set ?
	if (getProcessEnvValue("NOLOG")) return;
	const logFileName = logGetDebugFullPath();
	// if log file created by process, chown will be necessary if sudo
	const logExists = existsSync(logFileName);
	appendFileSync(logFileName, `Debug:: ${logHideInformations(data)}\n`);
	chownLogFile(logExists, logFileName);
	if (displayScreen) {
		consoleLog(data);
	}
};

/**
 * return logs directory place - no trailing /
 */
export const logGetBaseDirectory = (): string => {
	if (
		getProcessEnvValue("LOGSPATH") &&
		getProcessEnvValue("LOGSPATH").trim() !== ""
	)
		return getProcessEnvValue("LOGSPATH");
	throw new Error(
		`Unable to continue LOGSPATH environment variable has not been set`
	);
};

export const logUserInfo = (host: string) => {
	logHostEvent(host, `[INFO] Executed by: ${getProcessEnvValue("USER")}`);
	const sudoUser = getProcessEnvValue("SUDO_USER");
	if (sudoUser) {
		logHostEvent(host, `[INFO] sudo user: ${sudoUser}`);
	}
};

export const logInstructionToExecute = (
	host: string,
	shellDescription: ShellDescription
) => {
	if (shellDescription.tmpFile && shellDescription.shellInstructions) {
		logHostEvent(
			host,
			`[INFO] Shell content:\n${addLineNumberToShell(
				shellDescription.shellInstructions.split("\n")
			)}`
		);
	}
	logHostEvent(
		host,
		`[INFO] Instructions to execute on remote: '${
			shellDescription.tmpFile
				? shellDescription.tmpFile
				: shellDescription.shellInstructions
		}'`
	);
};
