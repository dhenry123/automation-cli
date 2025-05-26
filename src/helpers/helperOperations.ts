/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 18/01/24
 */

import {
	copyFileSync,
	chmodSync,
	existsSync,
	readdirSync,
	statSync,
} from "node:fs";
import { checkHosts, isInteger } from "../lib/checks";
import {
	regExpChangeAll,
	regExpInventoryKey,
	regExpChangeTotal,
	regExpAbsolute,
	regExpHomeDirectory,
	regExpRelative,
	MINUTESNOACTIVITYBEFORESHUTDOWN,
} from "../lib/constants";
import { logDebugEvent, logHostEvent } from "../lib/log";
import {
	checkOperationsListSize,
	checkLimitHostsIncludesCommanderOptionsHostsList,
} from "../lib/run/checkOperations";
import {
	getNestedValue,
	envSubst,
	getUserHomeDirectory,
	getOPSBasePath,
	extendProcessEnvWithOperationEnvironment,
	getProcessEnvValue,
	removeQuotesFrameString,
	getSubdirectories,
	terminateAllProcesses,
} from "../lib/system";
import type {
	Operation,
	HostsType,
	KeyStringValue,
	ShellOutput,
	KeyStringNumberValue,
	BuiltinValuesToObject,
	KeyNumberValue,
	CopyTo,
	ManifestOptionalParameters,
	ManifestParameterType,
	KeyStringNumberBooleanValue,
	AnyObject,
} from "../lib/types";
import { consoleErr, truncateLabel, consoleLog } from "./helperUI";
import { getOperationManifestFileContent } from "../lib/manifests";
import {
	inventoryGetContent,
	inventoryGetHostListFromCommanderOptionHosts,
	resolveInventoryAttributeValue,
} from "../lib/inventory";
import { getOperationsPath } from "../lib/filePathResolver";
import type { Interface } from "node:readline";
import type { Spinner } from "../lib/spinner";

/**
 * test if host is localhost - no need to start ssh connection
 */
export const isLocalhost = (value: string): boolean => {
	const description = value.split(":");
	const matchs = [/^localhost$/, /^127\.0\.0\.1$/];
	for (const match of matchs) {
		if (match.test(description[0].trim())) {
			if (
				!description[1] ||
				(description[1].trim() !== "" && description[1].trim() === "22")
			) {
				return true;
			}
		}
	}
	return false;
};

/**
 * Host must be a hostname||ip address:port
 * result is host passed by user and finally toPerform (ip address|resolvable hostname)
 */
export const buildHostList = (
	commanderOptionHost: string[],
	operations: Operation[],
	inventoryFile?: string
): HostsType[] => {
	const finalHosts: HostsType[] = [];

	checkOperationsListSize(operations);

	// Try to use inventory to detect hosts from inventory
	const hostsList: HostsType[] = inventoryGetHostListFromCommanderOptionHosts(
		commanderOptionHost,
		inventoryFile
	);

	for (const host of hostsList) {
		// Extract user input
		const expl = host.toPerform.split(":");
		// default port for ssh
		if (expl.length === 1) expl.push("22");

		// Finally build host: form host:port - localhost doesn't need port
		const finalHost = expl.join(":");
		// Init host could be modified by startVpn process - do not accept duplicate items
		if (!finalHosts.filter((item) => item.toPerform === finalHost).length)
			finalHosts.push({
				toPerform: `${
					isLocalhost(host.toPerform) ? "127.0.0.1" : expl.join(":")
				}`,
				userInput: host.userInput,
			});
	}

	// host list has been given by user - useless to continue if list is empty
	checkHosts(finalHosts);
	// Now checking if operation is limited to specific host(s)
	// If found, host must be provided by user in hosts list "-h"
	logDebugEvent("Checking limitHosts attribute for all operations");
	for (const operation of operations) {
		if (
			operation.limitHosts &&
			Array.isArray(operation.limitHosts) &&
			operation.limitHosts.length > 0
		) {
			logDebugEvent(
				`limitHosts attribute found for operations ${
					operation.name
				}: ${JSON.stringify(operation.limitHosts)}`
			);
			checkLimitHostsIncludesCommanderOptionsHostsList(
				operation,
				finalHosts,
				commanderOptionHost
			);
		}
	}

	return finalHosts;
};

/**
 * Build string of quoted parameters
 */
export const buildBashParametersFromOperationsParameters = (
	parameters: KeyStringNumberBooleanValue
) => {
	const finalParameters = [];
	if (parameters)
		for (const parameter of Object.getOwnPropertyNames(parameters)) {
			if (parameter) {
				// Because data could come from yaml (operationBook) => convert to String
				if (["boolean", "number"].includes(typeof parameters[parameter]))
					parameters[parameter] = parameters[parameter].toString();
				// Protect double quotes use to frame value of bash variable
				finalParameters.push(
					`${parameter}="${(parameters[parameter] as string).replace(
						/"/g,
						'\\"'
					)}"`
				);
			}
		}
	return finalParameters.join(" ").trim();
};

/**
 * if register detected, add value to register variable process & to process.env (could be used by builtin operations)
 */
export const registerContentToEnvironment = (
	envVarName: string | undefined,
	outputLines: ShellOutput[],
	registeredContent: KeyStringValue
) => {
	// Empty
	logDebugEvent(
		"registerContentToEnvironment: Not content to save in registeredVariable"
	);
	if (!envVarName || !envVarName.trim()) return;

	// split on ':' to determine output type
	// raw no : | :raw => only stdout
	// json :json => stdout & stderr {stdout,stderr}
	const envVar = envVarName.split(":");
	logDebugEvent(
		`registerContentToEnvironment: register detected: ${envVarName}, current register content : \n${JSON.stringify(
			registeredContent
		)}\n`
	);

	// build JSON {stdout: [all output lines from stdout],stderr: [all output line from stderr]}
	let stdout = outputLines
		.filter(
			(item) =>
				item.output === "stdout" &&
				item.message.trim() !== "" &&
				!regExpChangeAll.test(item.message) // output operated by change process is not caught in register operation
		)
		.map((item) => item.message.trim())
		.join("\n");

	let stderr = outputLines
		.filter((item) => item.output === "stderr" && item.message.trim() !== "")
		.map((item) => item.message.trim())
		.join("\n");

	let content = stdout;
	if (envVar[1] && envVar[1] === "json") {
		try {
			//try to parse
			stdout = JSON.parse(stdout);
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
		} catch (error) {
			/* empty */
		}
		logDebugEvent(
			`registerContentToEnvironment: final stdout: ${JSON.stringify(
				stdout
			)} typeof: ${typeof stdout}`
		);
		try {
			stderr = JSON.parse(stderr);
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
		} catch (error) {
			/* empty */
		}
		logDebugEvent(
			`registerContentToEnvironment: final stderr: ${JSON.stringify(
				stderr
			)} typeof: ${typeof stderr}`
		);
		content = JSON.stringify({
			stdout: stdout,
			stderr: stderr,
		});
	}

	logDebugEvent(
		`registerContentToEnvironment: to register: '${envVar[0].trim()}'='${content}'`
	);
	registeredContent[envVar[0].trim()] = content;
	// AND to this environment process to be used by builtin
	process.env[envVar[0]] = content;
	logDebugEvent(
		`registerContentToEnvironment: register value added to global registeredContent and process.env => ${JSON.stringify(
			registeredContent,
			null,
			2
		)}`
	);
};

export const buildEnvironmentForSpawn = (
	operationEnvironment: KeyStringNumberValue
): NodeJS.ProcessEnv => {
	const processEnv = process.env;

	for (const envVar of Object.getOwnPropertyNames(operationEnvironment)) {
		if (typeof operationEnvironment[envVar] === "string") {
			processEnv[envVar] = removeQuotesFrameString(
				operationEnvironment[envVar]
			).replace(/\\"/g, '"');
		} else if (typeof operationEnvironment[envVar] === "number") {
			// number
			processEnv[envVar] = operationEnvironment[envVar].toString();
		}
	}
	logDebugEvent(JSON.stringify(processEnv));
	return processEnv;
};

/**
 * Check operation in progress is executed on all hosts
 */
export const waitForOperationCompletedOnAllHosts = (
	hostsListCompleted: string[],
	initHostsToExec: HostsType[]
) => {
	return new Promise((resolve) => {
		const checkInterval = setInterval(() => {
			// > because executed every n periods, complete.current could be overridden by error process
			if (hostsListCompleted.length === initHostsToExec.length) {
				clearInterval(checkInterval);
				resolve(null);
			}
		}, 5);
	});
};

/**
 * Must be called before executing the operation on the host
 * NOT POSSIBLE to operate upstream, as I allow inventory files to be included in operations.
 */
export const interpolateInventoryValues = (
	operation: Operation,
	inventoryFile: string,
	host: string
): boolean => {
	// This process need to read inventory content once
	let inventoryContent: null | AnyObject = null;
	// Reading the contents of the inventory each time this method is called,
	// could not be opened upstream because each operation is isolated
	// and can interact with the inventory in read or write.
	if (inventoryFile) {
		logDebugEvent(
			`interpolateInventoryValues: reading inventory: ${inventoryFile} (Once)`
		);
		inventoryContent =
			inventoryGetContent(inventoryFile).contentDecrypted.toJSON();
		logDebugEvent(
			`interpolateInventoryValues: inventory content:\n${JSON.stringify(
				inventoryFile,
				null,
				4
			)}`
		);
	}

	const extendedEnvironment = extendProcessEnvWithOperationEnvironment(
		operation.environment as KeyStringValue
	);
	// Substitution is done only on environment
	if (operation.environment) {
		logDebugEvent(
			`interpolateInventoryValues: operation.environment provided : ${JSON.stringify(
				operation.environment,
				null,
				4
			)}`
		);
		// For all environment
		for (const key of Object.getOwnPropertyNames(operation.environment)) {
			// value come from anywhere and could be quoted with ' | "
			const keyValue = removeQuotesFrameString(
				operation.environment[key] || ""
			);
			logDebugEvent(
				`interpolateInventoryValues: testing key : ${key} => ${keyValue}`
			);
			// if environment variable is required or not, if not value is not mandatory (tolerance)
			const isEnvVarRequired: boolean = !!getNestedValue(
				operation,
				`parameters.required.${key}`
			);
			logDebugEvent(
				`interpolateInventoryValues: this environment variable is required ? ${isEnvVarRequired}`
			);
			// is value match inventory tag #inv.
			if (regExpInventoryKey.test(keyValue)) {
				logDebugEvent(
					`interpolateInventoryValues: value match #inv.: ${keyValue} `
				);

				// Using extendedEnvironment to interpolate
				const valueFromInventory = resolveInventoryAttributeValue(
					keyValue,
					extendedEnvironment as KeyStringValue,
					inventoryContent || {}
				);
				logDebugEvent(
					`interpolateInventoryValues: value detected in inventory : ${valueFromInventory}`
				);

				const valueFromInventoryInterpolatedWithEnvironment = valueFromInventory
					? envSubst(valueFromInventory, extendedEnvironment as KeyStringValue)
					: valueFromInventory;
				logDebugEvent(
					`interpolateInventoryValues: valueFromInventoryInterpolatedWithEnvironment: ${valueFromInventoryInterpolatedWithEnvironment}, ${JSON.stringify(
						extendedEnvironment,
						null,
						2
					)}`
				);
				// Controlled environment, if inventory value is empty Environment Variable will not be set
				if (valueFromInventoryInterpolatedWithEnvironment) {
					logDebugEvent(
						`interpolateInventoryValues: operation.environment[${key}] will be ${valueFromInventoryInterpolatedWithEnvironment}`
					);
					operation.environment[key] =
						valueFromInventoryInterpolatedWithEnvironment;
				} else {
					logDebugEvent(
						`interpolateInventoryValues: no reference found in inventory for : ${operation.environment[key]}`
					);
					const messages = [
						`in operation: ${operation.name}`,
						`        Unable to substitute: ${operation.environment[key]}`,
						`Key doesn't contain '.', the yaml parser will convert to attribut`,
						`You need to check your inventory file: ${inventoryFile}, this path is not found in the yaml structure OR value is empty`,
					];
					for (const message of messages) {
						if (isEnvVarRequired) {
							consoleErr(`[ERROR] ${message}`);
							logHostEvent(host, message);
						}
					}
					// environment variable is required : exit
					if (isEnvVarRequired) return false;
					// otherwise continue, developer must manage this case in the bash - env var will be set with an empty value
					logDebugEvent(
						`interpolateInventoryValues: environment variable : ${operation.environment[key]} is not required and not found, new value is: ""`
					);
					operation.environment[key] = "";
				}
			}
		}
	}
	// For all copyTo
	if (operation.copyTo) {
		const fileListToCopy: CopyTo[] = [];
		for (const file of operation.copyTo) {
			for (const key of Object.getOwnPropertyNames(file)) {
				// value come from anywhere and could be quoted with ' | "
				const keyValue = removeQuotesFrameString((file as KeyStringValue)[key]);
				logDebugEvent(
					`interpolateInventoryValues: testing copyTo.${key} : ${
						(file as KeyStringValue)[key]
					}`
				);
				// Using extendedEnvironment to interpolate
				const valueFromInventory = resolveInventoryAttributeValue(
					keyValue,
					extendedEnvironment as KeyStringValue,
					inventoryContent || {}
				);
				logDebugEvent(
					`interpolateInventoryValues: substitute: ${keyValue} with ${valueFromInventory}`
				);

				if (valueFromInventory) {
					logDebugEvent(
						`interpolateInventoryValues: substitute: ${keyValue} with ${valueFromInventory}`
					);
					(file as KeyStringValue)[key] = valueFromInventory;
				} else {
					(file as KeyStringValue)[key] = envSubst(
						keyValue,
						extendedEnvironment as KeyStringValue
					);
				}
			}
			logDebugEvent(
				`interpolateInventoryValues: copyTo final file : ${JSON.stringify(
					file,
					null,
					4
				)}`
			);
			fileListToCopy.push(file);
		}
		operation.copyTo = fileListToCopy;
	}
	return true;
};

/**
 * Is This operation is limited to some hosts
 * - yes:
 * 		- if host is not in this list:
 * 			- yes: this operation is executed return true
 * 			- no: this operation is not executed return false
 * - no: return true
 */
export const isOperationCanBePerformedByHost = (
	operation: Operation,
	host: HostsType
): boolean => {
	if (operation.limitHosts && operation.limitHosts.length > 0) {
		// let couldBePerformed = false;
		const limitHostsResolved: string[] = [];
		for (let limitHost of operation.limitHosts) {
			if (operation.environment)
				limitHost = envSubst(limitHost, operation.environment);
			limitHostsResolved.push(limitHost);
		}

		if (
			!limitHostsResolved.includes(host.userInput) &&
			!limitHostsResolved.includes(host.toPerform)
		) {
			const message = `The operation: "${truncateLabel(
				operation.name
			)}" contains 'limitHosts' list: ${JSON.stringify(
				operation.limitHosts
			)}.\nOperation could not be performed on Host ${host.userInput}/${
				host.toPerform
			}\n`;
			logDebugEvent(message);
			consoleLog(message, "red");
			return false;
		}
	}
	return true;
};

/**
 * is builtin operation
 * starts with # which is the comment mark for bash - no conflict with binary name possible
 */
export const isBuiltInOperation = (operationName: string): boolean => {
	return /^#.*/.test(operationName);
};

export const isBuiltInUpdateInventoryOperation = (
	operationName: string
): boolean => {
	return /^#updateInventory/.test(operationName);
};

export const builtinGetParameterValues = (
	host: string,
	operationValues?: (string | KeyStringNumberValue)[]
): BuiltinValuesToObject => {
	if (!host || !host.trim())
		throw new Error("Host (host:sshport) is not provided");
	const explHost = host.split(":");
	const hostHost = explHost[0];
	if (!hostHost || !hostHost.trim())
		throw new Error("Host (address:sshport) address is not provided");
	const hostPort = Number.parseInt(explHost[1]);
	if (Number.isNaN(hostPort) && !isLocalhost(host))
		throw new Error("Host (address:sshport) ssh port is not provided");
	const response: BuiltinValuesToObject = {
		host: hostHost,
		port: hostPort,
		timeoutServerOffline: 5 * 60, // Default is 5 hours
		timeoutServerOnline: 5 * 60, // Default is 5 hours
	};
	logDebugEvent(
		`builtinGetParameterValues: default values are: ${JSON.stringify(
			response,
			null,
			4
		)}`
	);
	if (operationValues) {
		logDebugEvent(
			`builtinGetParameterValues: operation values are provided: ${JSON.stringify(
				operationValues
			)}`
		);
		for (const value of operationValues) {
			if (typeof value === "object") {
				const keys = Object.getOwnPropertyNames(value);
				if (keys.length === 1) {
					if (!isInteger(value[keys[0]]))
						throw new Error(`value: ${value[keys[0]]} is not number`);
					if (keys.includes("timeoutServerOnline")) {
						response.timeoutServerOnline = value[keys[0]] as number;
					}
					if (keys.includes("timeoutServerOffline")) {
						response.timeoutServerOffline = value[keys[0]] as number;
					}
					if (keys.includes("port")) {
						response.port = value[keys[0]] as number;
					}
				}
			}
		}
	}
	logDebugEvent(
		`builtinGetParameterValues: final value: ${JSON.stringify(
			response,
			null,
			4
		)}`
	);
	return response;
};

/**
 * The notion of changes is implemented by the developer at the level of executed shells (_change).
 * Each call sends a specific message to the pipeline.
 * This message is not displayed at the console but stored in the log file.
 * Then, at the end of the shell, this method outputs the total number of changes.
 */
export const updateChangesCounters = (
	line: ShellOutput,
	host: HostsType,
	hostCounterChanges: KeyNumberValue
) => {
	if (regExpChangeTotal.test(line.message)) {
		const totalChanges = line.message.replace(regExpChangeTotal, "$1");
		if (totalChanges && isInteger(totalChanges))
			hostCounterChanges[host.userInput] += Number.parseInt(totalChanges);
	}
};

/**
 * Return the locale file to copy to remote
 */
export const resolveLocalSrcFileToCopy = (
	operationPath: string,
	value: string
): string => {
	// Absolute Path
	if (regExpAbsolute.test(value)) return value;
	// start with ~/
	if (regExpHomeDirectory.test(value)) {
		const homeDirectory = getUserHomeDirectory();
		if (homeDirectory) {
			return value.replace(regExpHomeDirectory, homeDirectory);
		}
		throw new Error(
			"Path provided starting with home directory shortcut but environment variable HOME is not set, impossible to continue"
		);
	}
	// Relative add operation path
	if (regExpRelative.test(value)) value = value.replace(regExpRelative, "");
	return `${getOperationsPath(getOPSBasePath())}/${operationPath}/${value}`;
};

/**
 * log copy file uniform
 * @param src
 * @param dest
 * @param remote
 * @returns
 */
export const getLogCopyTo = (src: string, dest: string, remote: string) => {
	return `[copyTo] ${src} to ${remote}:${dest} => OK`;
};

export const getLogErrorCopyTo = (error: Error, fileMetadata?: CopyTo) => {
	return `${(error as Error).toString()} - MetaData: ${JSON.stringify(
		fileMetadata || ""
	)} - Source is not availabled, destination file is protected, destination directory is missing,...`;
};

/**
 * used when -h == isLocalHost()
 * @param operation
 * @param data
 */
export const copyFileOnLocalhost = (operation: Operation, data: CopyTo) => {
	logDebugEvent(
		`Trying to copy ${resolveLocalSrcFileToCopy(operation.name, data.src)} to ${
			data.dest
		} on localhost`
	);
	copyFileSync(resolveLocalSrcFileToCopy(operation.name, data.src), data.dest);
	logDebugEvent(getLogCopyTo(data.src, data.dest, "localhost"));
	if (data.chmod) {
		logDebugEvent(`Trying to chmod ${data.dest} with ${data.chmod}`);
		chmodSync(data.dest, data.chmod);
	}
};

/**
 * add operation.parameters.optional.default in the running environnement could be
 * overridden: operationBook, running environment
 */
export const getOperationEnvironmentFromParametersOptionalDefault = (
	operationOptionalParameters: ManifestOptionalParameters,
	operationEnvironment: KeyStringValue
): KeyStringValue => {
	if (
		!operationOptionalParameters ||
		!Object.getOwnPropertyNames(operationOptionalParameters).length
	)
		return operationEnvironment;
	const environment: KeyStringValue = { ...operationEnvironment };
	for (const key of Object.getOwnPropertyNames(operationOptionalParameters)) {
		const attr = operationOptionalParameters[key] as ManifestParameterType;
		// Inject optional even empty because it's option but bash use -u so variable must exist
		if (!operationEnvironment[key]) {
			environment[key] = attr.default || "";
		}
	}
	return environment;
};

/**
 * To generate full command to run operation
 */
export const getCommandToRunOperation = (
	operationFullPath: string,
	operationName: string,
	hostList: string,
	inventory?: string
) => {
	// for helper: operationFullPath is concatenation of opsPath and relative operation path
	// so prefix to give in command line is relative to OPS directory
	// [opsPath]/Operation => remove [opsPath]/
	const prefixOperation = `${operationFullPath.replace(
		new RegExp(`${getProcessEnvValue("OPS")}/operations`),
		""
	)}/`.replace(/^\/*/, "");
	// Parameters
	const environment: string[] = [];
	const manifest = getOperationManifestFileContent(
		`${operationFullPath}/${operationName}/manifest.yaml`,
		false
	);
	if (manifest.parameters?.required) {
		for (const envVar of Object.getOwnPropertyNames(
			manifest.parameters.required
		)) {
			if (!inventory) environment.push(`-e ${envVar}="required"`);
		}
	}
	if (manifest.parameters?.optional) {
		for (const envVar of Object.getOwnPropertyNames(
			manifest.parameters.optional
		)) {
			if (!inventory)
				environment.push(
					`-e ${envVar}="${
						(manifest.parameters.optional as ManifestOptionalParameters)[envVar]
							.default
							? `${
									(manifest.parameters.optional as ManifestOptionalParameters)[
										envVar
									].default
							  }`
							: "optional"
					}"`
				);
		}
	}
	return `OPS="${
		process.env.OPS
	}" automation-cli run -op "${prefixOperation}${operationName}" ${environment.join(
		" "
	)}${inventory ? ` -i "${inventory}"` : ""} -h "${
		hostList ? hostList : "retry with -h to include your hosts"
	}"`;
};

export const getMessageNumberOfOperations = (
	opsPath: string,
	value: number
) => {
	return `Number of operations in directory ${opsPath}: ${value}`;
};

/**
 * to resolve string like : {"password":"newpassword","login":"newlogin"}.password
 */
const tryToParseAsJson = (resolved: string): string => {
	if (resolved.match(/^\{/)) {
		//console.log("match string which looks like JSON");
		//trying to split
		const jsonString = resolved.replace(/(^\{.*})(.*)$/, "$1");
		try {
			const json = JSON.parse(jsonString);
			const rest = resolved.replace(/^.*}/, "").trim();
			return getNestedValue(json, rest) as string;
		} catch {
			// Do nothing
		}
	}
	return resolved;
};
/**
 * test environment condition: $MYVAR==2
 * is $MYVAR in environment ?
 * is $MYVAR has the value of condition (2)
 *
 * In this method I use the FULL process.env as environment, because condition could be retrieved from the entire environment
 */
export const isWhenConditionMatch = (
	condition: string,
	environment: KeyStringValue,
	inventoryFile?: string
): boolean => {
	const extendedEnvironment =
		extendProcessEnvWithOperationEnvironment(environment);
	// Environment is empty no need to continue
	if (!Object.getOwnPropertyNames(extendedEnvironment).length && !inventoryFile)
		return false;
	// Conditions environnement variable
	// ==
	if (/^\$.*==/.test(condition)) {
		const split = condition.split("==");
		logDebugEvent(
			`Trying to resolve ${split[0]} in ${JSON.stringify(extendedEnvironment)}`
		);
		let resolved = envSubst(
			split[0],
			extendedEnvironment as KeyStringValue //compatible
		);
		resolved = tryToParseAsJson(resolved);
		logDebugEvent(`Resolved value: ${resolved}`);
		// compare removing "" from value
		if (resolved === removeQuotesFrameString(split[1].trim())) {
			//no check on type, envvar is string | number
			logDebugEvent("Condition matches");
			return true;
		}
		logDebugEvent("Condition doesn't match");
		return false;
	}
	// !=
	if (/^\$.*!=/.test(condition)) {
		const split = condition.split("!=");
		logDebugEvent(
			`Trying to resolve ${split[0]} in ${JSON.stringify(extendedEnvironment)}`
		);
		let resolved = envSubst(
			split[0],
			extendedEnvironment as KeyStringValue //compatible
		);
		resolved = tryToParseAsJson(resolved);
		logDebugEvent(`Resolved value: ${resolved}`);
		// compare removing "" from value
		if (resolved !== removeQuotesFrameString(split[1].trim())) {
			//no check on type, envvar is string | number
			logDebugEvent("Condition matches");
			return true;
		}
		logDebugEvent("Condition doesn't match");
		return false;
	}
	if (inventoryFile) {
		let inventoryContent = null;
		if (existsSync(inventoryFile)) {
			inventoryContent =
				inventoryGetContent(inventoryFile).contentDecrypted.toJSON();
			logDebugEvent(
				`isWhenConditionMatch: inventory content:\n${JSON.stringify(
					inventoryFile,
					null,
					4
				)}`
			);
		} else {
			throw new Error(
				`Inventory file: ${inventoryFile} was not found - used to resolve when condition`
			);
		}
		if (/^#inv\..*==/.test(condition)) {
			const split = condition.split("==");
			const resolved = resolveInventoryAttributeValue(
				split[0].trim(),
				environment,
				inventoryContent
			);
			if (resolved === removeQuotesFrameString(split[1].trim())) {
				//no check on type, envvar is string | number
				logDebugEvent("Condition matches");
				return true;
			}
			logDebugEvent("Condition doesn't match");
			return false;
		}
		if (/^#inv\..*!=/.test(condition)) {
			const split = condition.split("!=");
			const resolved = resolveInventoryAttributeValue(
				split[0].trim(),
				environment,
				inventoryContent
			);
			if (resolved !== removeQuotesFrameString(split[1].trim())) {
				//no check on type, envvar is string | number
				logDebugEvent("Condition matches");
				return true;
			}
			logDebugEvent("Condition doesn't match");
			return false;
		}
	}
	return false;
};

/**
 * Extract operation from Full Operation path : the latest item is directory
 *
 * @param operationPath
 * @returns
 */
export const extractOperationNameFromFullOperationDirectory = (
	operationPath: string
) => {
	return operationPath
		.replace(
			new RegExp(`${getOPSBasePath()}/operations`.replace(/\//g, "\\/")),
			""
		)
		.replace(/^\/*/, "");
};

/**
 * build list of manifests operation
 */
export const getOperationsManifestPathList = (
	operationsPath: string
): string[] => {
	if (operationsPath.trim() !== "") {
		let list: string[] = [];
		if (existsSync(operationsPath) && statSync(operationsPath).isDirectory()) {
			const dirContent = readdirSync(operationsPath);
			for (const item of dirContent) {
				const fullPath = `${operationsPath}/${item}`;
				const manifestPath = `${fullPath}/manifest.yaml`;
				if (existsSync(manifestPath)) {
					list.push(manifestPath);
				} else {
					const browse = getOperationsManifestPathList(fullPath);
					if (browse.length) list = list.concat(browse);
				}
			}
		}
		return list;
	}
	throw new Error(`${getProcessEnvValue("OPS")} is not OPSDirectory`);
};

export const getOPSDirectoryOperationsPath = (): string[] => {
	const operationsPath = `${getProcessEnvValue("OPS")}/operations`;
	const subdirectories = getSubdirectories(operationsPath);
	logDebugEvent(`subdirectories found: ${subdirectories.join(",")}`);
	const operationPaths: string[] = [];
	const regExp = new RegExp(operationsPath);
	for (const subdirectory of subdirectories) {
		if (regExp.test(subdirectory)) operationPaths.push(subdirectory);
	}
	return operationPaths;
};

export const getOPSDirectoryOperationBooksPath = (): string[] => {
	const operationBooksPath = `${getProcessEnvValue("OPS")}/operationBooks`;
	const subdirectories = getSubdirectories(operationBooksPath);
	logDebugEvent(`subdirectories found: ${subdirectories.join(",")}`);

	const operationBookPaths: string[] = [operationBooksPath];
	const regExp = new RegExp(operationBooksPath);
	for (const subdirectory of subdirectories) {
		if (regExp.test(subdirectory)) operationBookPaths.push(subdirectory);
	}
	return operationBookPaths;
};

/**
 * to call when activity from operation is received
 */
export const incrementHostActivity = () => {
	logDebugEvent("incrementing host activity (TIMEOFLASTHOSTACTIVITY)");
	process.env.TIMEOFLASTHOSTACTIVITY = new Date().valueOf().toString();
};

/**
 * Autokiller - automation-cli is killed when process execution time is over the defined max value
 * To test:
 *  with timeout 1 minute: automation-cli run -h localhost -actto 1 -c 'sleep 120'
 */
export const activateAutoKillHostNoActivity = (
	rlHandler: Interface,
	spinner: Spinner,
	vpnPid: number,
	timeoutFromOptionsCommandLine: number
) => {
	const intervalValueSeconds = 5;
	incrementHostActivity();
	let timeout =
		timeoutFromOptionsCommandLine || MINUTESNOACTIVITYBEFORESHUTDOWN;
	if (timeout <= 0) timeout = MINUTESNOACTIVITYBEFORESHUTDOWN;

	const labelMinute = `minute${timeout > 1 ? "s" : ""}`;
	logDebugEvent(
		`Autokilled after a period of inactivity: ${timeout} ${labelMinute} (precision ~${intervalValueSeconds}seconds)`
	);
	setInterval(() => {
		if (
			new Date().valueOf() >
			Number.parseInt(getProcessEnvValue("TIMEOFLASTHOSTACTIVITY")) +
				60 * timeout * 1000
		) {
			terminateAllProcesses(
				2,
				`SIGKILL auto, process is running more than ${timeout} ${labelMinute} without activity`,
				rlHandler,
				spinner,
				vpnPid
			);
		}
	}, intervalValueSeconds * 1000);
};
