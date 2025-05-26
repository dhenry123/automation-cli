/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 11/08/24
 */

import { chownSync, existsSync, mkdirSync } from "node:fs";
import {
	exitNodeJs,
	getProcessEnvValue,
	terminateAllProcesses,
} from "./system";
import type { HostsType } from "./types";
import { legacyDirStorage, markProtectedServer } from "./constants";
import { getOperationsPath, getOperationBooksPath } from "./filePathResolver";

/**
 * prerequisites environment variables
 */
export const checkUserShellEnvironment = () => {
	// add mandatory environment variables here
	//     HOME: used to resolve ~/ (homedirectory required for logs)
	const envVars: string[] = ["HOME"];

	for (const envVar of envVars) {
		const message = `Impossible to continue, your shell environment doesn't include the mandatory variable: ${envVar}`;
		if (!getProcessEnvValue(envVar)) throw new Error(message);
	}
};

export const checkHosts = (hosts: HostsType[]) => {
	if (hosts.length === 0) {
		const message =
			'You need to provide a list of hosts (-h), separated by spaces: "ipaddress|hostname:[port] ..." (port is optional, default will be 22)';
		terminateAllProcesses(1, message);
	}
};

/**
 * check is log base directory exists, create if not exists
 */
export const checkDirectoryExists = (path: string) => {
	if (!existsSync(path)) {
		mkdirSync(path, { recursive: true });
		if (process.env.SUDO_UID && process.env.SUDO_GID) {
			// chown sudo_user
			chownSync(
				path,
				Number.parseInt(process.env.SUDO_UID),
				Number.parseInt(process.env.SUDO_GID)
			);
		}
	}
};

export const isInteger = (value: string | number | boolean) => {
	if (typeof value === "number") return Number.isInteger(value);
	if (typeof value === "string") {
		return /^\d+$/.test(value);
	}
	return false;
};

export const checkIsOPSDirectory = () => {
	if (
		!existsSync(getOperationsPath(getProcessEnvValue("OPS"))) ||
		!existsSync(getOperationBooksPath(getProcessEnvValue("OPS")))
	) {
		let opsDirectoryPath = `'${process.env.OPS}'`;
		if (process.env.OPS === legacyDirStorage)
			opsDirectoryPath += " (default value when OPS is not set)";
		throw new Error(`This path: ${opsDirectoryPath} is not an OPSDirectory`);
	}
};

export const checkIsLocalServerProtected = () => {
	if (existsSync(markProtectedServer)) {
		exitNodeJs(
			1,
			`This server is protected against 'automation-cli' operations.\nTo perform an 'operation' on this server, delete the file ${markProtectedServer}`
		);
	}
};
