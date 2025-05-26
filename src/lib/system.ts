/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import crypto from "node:crypto";
import {
	type Dirent,
	existsSync,
	readdirSync,
	realpathSync,
	statSync,
} from "node:fs";
import { closeVpnConnection } from "./vpn";
import type { Spinner } from "./spinner";
import type { ReadLine } from "node:readline";
import type { AnyObject, KeyStringValue } from "./types";
import {
	consoleErr,
	consoleLog,
	consoleWarnDebugActivated,
	isScreen,
	stdOutClearLine,
} from "../helpers/helperUI";
import { logDebugEvent } from "./log";
import {
	legacyDirStorage,
	sshDefaultPrivateKeyFiles,
	regExpHomeDirectory,
} from "./constants";
import { join } from "node:path";
import { inventorySetSshOption } from "./inventory";

export const mkTemp = (prefix?: string) => {
	return `/tmp/${prefix ? prefix : ""}${crypto.randomBytes(4).readUInt32LE(0)}`;
};

/**
 * IMPORTANT All error must be output to stderr
 * @param code
 * @param message
 * @returns
 */
export const exitNodeJs = (code?: number, message?: string) => {
	return new Promise(() => {
		if (message) {
			process.stdout.write("\n");
			if (code) {
				consoleErr(`${message.toString()}\n`);
			} else {
				consoleLog(`${message.toString()}\n`, "green");
			}
		}
		// restore cursor
		if (isScreen()) {
			process.stdout.write("\x1B[?25h");
		} else {
			// No screen (cron, product brand display) - except if Silent mode :)
			if (!getProcessEnvValue("SILENTMODE") && !getProcessEnvValue("QUIETMODE"))
				consoleLog("--:-- [Mytinydc - automation-cli] --:--");
		}
		consoleWarnDebugActivated();
		// Used by the test process
		if (getProcessEnvValue("TESTMODE")) return;
		process.exit(code ? code : 0);
	});
};

export const terminateAllProcesses = async (
	exitCode = 0,
	errorMessage?: string,
	rlHandler?: ReadLine,
	spinnerHandler?: Spinner,
	vpnPid?: number
) => {
	if (spinnerHandler) {
		spinnerHandler.setText("");
		spinnerHandler.stop();
	}
	stdOutClearLine();
	if (vpnPid) closeVpnConnection(vpnPid);
	// final
	if (rlHandler) rlHandler.close();
	await exitNodeJs(exitCode, errorMessage);
};

/**
 * populate commander option with found values
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getDefaultSshPrivateKey = (commanderOptions: any) => {
	logDebugEvent(
		"getDefaultSshPrivateKey: Trying with option command line -sshpk"
	);
	// Could be provided by user in command line Options : commanderOptions.sshPrivateKey
	// try with inventory
	if (commanderOptions.inventoryFile) {
		logDebugEvent("getDefaultSshPrivateKey: Trying with provided inventory");
		inventorySetSshOption(commanderOptions);
	} else {
		logDebugEvent("getDefaultSshPrivateKey: inventory file not provided");
	}
	// Finish with default user ssh pk
	if (!commanderOptions.sshPrivateKey) {
		const homeDirectory = `${getUserHomeDirectory()}/.ssh`;
		logDebugEvent(
			"getDefaultSshPrivateKey: Trying with get user default ssh private key from home directory"
		);
		if (homeDirectory && existsSync(homeDirectory)) {
			for (const file of sshDefaultPrivateKeyFiles) {
				if (existsSync(`${homeDirectory}/${file}`)) {
					commanderOptions.sshPrivateKey = `${homeDirectory}/${file}`;
					break;
				}
			}
		}
	}
	// check Key file exists
	if (!existsSync(commanderOptions.sshPrivateKey))
		throw new Error(
			`Impossible to find the private ssh key: ${commanderOptions.sshPrivateKey}`
		);
};

/**
 * check at the top of process, so must always return something here
 * @returns
 */
export const getUserHomeDirectory = (): string => {
	return getProcessEnvValue("HOME");
};

/**
 * resolve path ~/ ../ ./ * & check path exists (real)
 * @param value
 * @returns
 */
export const realAbsolutePath = (value: string): string => {
	// Relative
	// start with ~/
	if (regExpHomeDirectory.test(value)) {
		const homeDirectory = getUserHomeDirectory();
		if (homeDirectory) {
			value = value.replace(regExpHomeDirectory, homeDirectory);
		} else {
			throw new Error(
				"Path provided starting with home directory shortcut but environment variable HOME is not set, impossible to continue"
			);
		}
	}
	return realpathSync(value, "utf-8");
};

/**
 * Try to resolve shortcut home directory ~ in OPS env var
 * OPS DIRECTORY is converted in absolute path
 * & store to process.env.OPS without the trailing /
 */
export const setOPSBasePath = () => {
	// OPS directory is provided by user
	if (getProcessEnvValue("OPS")) {
		try {
			process.env.OPS = realAbsolutePath(getProcessEnvValue("OPS")).trim();
		} catch (error) {
			const errorTyped = error as NodeJS.ErrnoException;
			if (errorTyped.code === "ENOENT")
				throw new Error(
					`OPS Directory doesn't exist: ${errorTyped.path} - Current OPS value: ${process.env.OPS}`
				);
			throw error;
		}
	} else {
		// If not defined - default : MYTINYDC constraints
		process.env.OPS = legacyDirStorage;
	}
	// remove trailing /
	process.env.OPS = getProcessEnvValue("OPS").replace(/\/*$/, "").trim();
};

/**
 * return Operations Base Path: Default is legacy
 */
export const getOPSBasePath = () => {
	return getProcessEnvValue("OPS") || legacyDirStorage;
};

export const autoCompleteFileExtension = (
	extension: string,
	fileName: string
): string => {
	extension = extension.replace(/^\.*/, "").trim();
	// Autocomplete extension file
	const regExp = new RegExp(`.${extension}$`);
	return regExp.test(fileName) ? fileName : `${fileName}.${extension}`;
};

export const getNestedValue = (
	obj: AnyObject,
	path: string
): string | null | AnyObject => {
	const keys = path.split(/\.|\[|\]\.?/).filter(Boolean);
	return keys.reduce((acc, key) => {
		// Convert numeric keys for array access.
		if (acc && typeof acc === "object" && key in acc) {
			return acc[key];
		}
		if (acc && !Number.isNaN(Number(key))) {
			return acc[Number(key)];
		}
		return ""; // Return undefined if path does not exist.
	}, obj);
};

export const setNestedValue = (
	obj: AnyObject,
	path: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	value: any
): void => {
	const keys = path.split(".");
	let current = obj;

	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];

		if (i === keys.length - 1) {
			current[key] = value;
		} else {
			if (!current[key]) {
				current[key] = {};
			}
			current = current[key];
		}
	}
};

/**
 * Get the value of one variable in process.env
 */
export const getProcessEnvValue = (variableName?: string): string => {
	// resolving value
	if (!variableName) return "";
	return process.env[variableName] || "";
};

/**
 * Get subdirectories of directory (recursive)
 */
export const getSubdirectories = (directory: string): string[] => {
	if (!statSync(directory).isDirectory()) return [];

	const subdirectories: string[] = [];

	const browseDirectory = (currentDirectory: string) => {
		const items: Dirent[] = readdirSync(currentDirectory, {
			withFileTypes: true,
		});

		items.forEach((item) => {
			if (item.isDirectory()) {
				const fullPath = join(currentDirectory, item.name);
				subdirectories.push(fullPath);
				browseDirectory(fullPath);
			}
		});
	};

	browseDirectory(directory);
	return subdirectories;
};

export const envSubst = (
	template: string,
	environment: KeyStringValue,
	trowException?: boolean
) => {
	if (typeof template === "number") return template;
	//form 1 : ${XXXX}
	const form1 = template.replace(/\$\{([A-Za-z0-9_]+)\}/g, (_, key) => {
		if (key in environment) {
			return removeQuotesFrameString(environment[key]);
		}
		if (trowException) {
			throw new Error(`${key} was not found in the provided environment`);
		}
		// eslint-disable-next-line no-useless-escape
		return `$\{${removeQuotesFrameString(key)}\}`;
	});
	// Form 2 : $XXX
	return form1.replace(/\$([A-Za-z0-9_]+)/g, (_, key) => {
		if (key in environment) {
			return removeQuotesFrameString(environment[key]);
		}
		if (trowException) {
			throw new Error(`${key} was not found in the provided environment`);
		}
		return `$${removeQuotesFrameString(key)}`;
	});
};
/**
 * Concat "operation.environment" to process.env
 * For security reasons
 * environnement provided could NOT override current process.env
 */
export const extendProcessEnvWithOperationEnvironment = (
	operationEnvironment: KeyStringValue
) => {
	const newObject = { ...process.env };

	for (const envVar of Object.getOwnPropertyNames(operationEnvironment)) {
		if (!newObject[envVar]) newObject[envVar] = operationEnvironment[envVar];
	}
	return newObject;
};

/**
 *
 * @param timeStart Millisecond new Date().valueOf()
 * @param timeoutSeconds
 */
export const isMaxTimeoutReached = (
	timeStart: number,
	timeoutSeconds: number
) => {
	return timeStart + timeoutSeconds * 1000 <= new Date().valueOf();
};

// usefully in some loop
export const sleep = (ms: number) => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};

export const removeQuotesFrameString = (value: string) => {
	// Remove outer matching quotes only if they are the same
	if (typeof value === "object") return value;
	if (typeof value === "boolean") return value;
	if (
		(value && value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1); // Remove both matching outer quotes
	}

	// Otherwise, return the string as is (no removal if quotes don't match)
	return value;
};
