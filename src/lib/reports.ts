/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import {
	KeyNumberValue,
	KeyStringNumberValue,
	KeyStringValue,
	Operation,
	OperationCatalogItemType,
	ReportOperationDependenciesLine,
	RequiredAndMissingParameters,
} from "./types";
import humanizeDuration from "humanize-duration";
import { consoleErr, consoleLog, isScreen } from "../helpers/helperUI";
import {
	logDebugEvent,
	logGetCommonLogFullPath,
	logGetDebugFullPath,
	logGetHostLogFullPath,
} from "./log";
import { HostsType, ExecOperationHostErrorType } from "./types";
import Table from "cli-table3";
import colors from "colors";
import { exitNodeJs, getProcessEnvValue } from "./system";
import { messageNumberOfOperations } from "./constants";

/**
 * Simple report resuming state of operation for each hosts
 */
export const reportHostsShellExecution = (
	hosts: HostsType[],
	hostsResume: ExecOperationHostErrorType[],
	hostCounterChanges: KeyNumberValue,
	startRunningOperation: number,
	vpnPid: number
) => {
	if (getProcessEnvValue("SILENTMODE") || getProcessEnvValue("QUIETMODE"))
		return;
	logDebugEvent(
		`reportHostsShellExecution:: hostResume value: ${JSON.stringify(
			hostsResume,
			null,
			4
		)}`
	);
	let consoleColWidth = process.stdout.columns;
	if (!isScreen()) consoleColWidth = 140;

	const hostsColSize = 40;
	const changesColSize = 9;
	const colorHeader = "yellow";
	const table = new Table({
		head: [
			colors[colorHeader]("Hosts"),
			colors[colorHeader]("Result"),
			colors[colorHeader]("Changes"),
		],
		colWidths: [
			hostsColSize,
			consoleColWidth - hostsColSize - 6 - changesColSize,
			changesColSize,
		],
		// wrapOnWordBoundary: true,
		wordWrap: true,
	});

	for (const host of hosts) {
		const hostError = getHostError(host.userInput, hostsResume);
		// let hostChanges = getHostChanges(host.userInput, hostsResume);
		table.push([
			`${host.userInput}-${host.toPerform}`,
			`${
				hostError
					? `${colors.red(
							`ERROR in operation: "${hostError}"\n`
					  )} see ${colors.red.underline(
							`file://${logGetHostLogFullPath(host.userInput)}`
					  )}`
					: colors.green(`OK - file://${logGetHostLogFullPath(host.userInput)}`)
			}`,
			hostCounterChanges[host.userInput]
				? hostCounterChanges[host.userInput]
				: "-",
		]);
	}
	const elapsedTime = new Date().valueOf() - startRunningOperation;
	table.push([
		`Executed in`,
		`${humanizeDuration(elapsedTime)} ${elapsedTime} ms`,
	]);
	// commonLog has been Used because vpn pid <> 0
	if (vpnPid)
		table.push([
			`commonlog file`,
			colors.cyan(`file://${logGetCommonLogFullPath()}`),
		]);

	consoleLog(table.toString());
	logDebugEvent(`logsPath value: ${logGetDebugFullPath()}`);
};

const getHostError = (
	host: string,
	hostsResume: ExecOperationHostErrorType[]
) => {
	const error = hostsResume.filter((item) => item.host === host);
	return error && error[0] ? error[0].operationError : null;
};

export const reportDisplayBuiltinOperationValues = (
	operation: Operation
): string => {
	if (operation.operation && operation.values) {
		switch (operation.operation) {
			case "#updateInventory":
				return `\n[*] Values to update:\n${operation.values.join("\n")}`;
			case "#waitForServerRestart":
				// eslint-disable-next-line no-case-declarations
				let message = "[*] Values:";
				for (const valueObject of operation.values as KeyStringNumberValue[]) {
					if (valueObject["port"]) {
						message += `  Port to Watch: ${valueObject["port"]}\n`;
					} else {
						const keyObject = Object.getOwnPropertyNames(valueObject);
						if (keyObject.length === 1)
							message += `  Additional parameter '${keyObject[0]}': ${
								valueObject[keyObject[0]]
							}\n`;
					}
				}
				return `${message}\n`;
			default:
				return `\n[*] Values: ${JSON.stringify(operation.values)}`;
		}
	}
	return "";
};

/**
 * Build a string report to help user to retry operation
 */
export const reportEnvironmentVariablesMissing = (
	requiredAndMissingParameters: RequiredAndMissingParameters[]
): string | null => {
	if (requiredAndMissingParameters.length === 0) return null;
	const message: string[] = [];
	for (const item of requiredAndMissingParameters) {
		message.push(
			`Operation '${item.operationName}' - parameter command line is missing, retry command adding: -e ${item.environmentVariableName}="value" (idx operation in list: ${item.idxOperationInList})`
		);
	}
	return message.join("\n");
};

export const reportOperationsToRun = (
	operations: Operation[],
	hostsListToProceed: HostsType[]
) => {
	const consoleColWidth = process.stdout.columns;
	const firstColSizeDetails = 45;
	const firstColSizeResume = 22;
	const secondColSizeResume = firstColSizeResume;

	let table = new Table({
		head: [colors.green("Operations"), colors.green("Details")],
		colWidths: [firstColSizeDetails, consoleColWidth - firstColSizeDetails - 5],
		// wrapOnWordBoundary: true,
		wordWrap: true,
	});
	const registeredVariables: string[] = [];
	for (const operation of operations) {
		let environment: string = "";
		const envDetails: string[] = [];
		if (operation.environment) {
			const keys = Object.getOwnPropertyNames(operation.environment);
			if (keys.length) {
				for (const key of keys) {
					envDetails.push(`${key}="${operation.environment[key]}"`);
				}
			}
			// Adding registered
			for (const regVar of registeredVariables) {
				envDetails.push(`${regVar}="Defined by previous operation [register]"`);
			}
			environment = envDetails.join("\n");
		}
		if (
			operation.register &&
			!registeredVariables.includes(operation.register.split(":")[0])
		)
			registeredVariables.push(operation.register.split(":")[0]);
		/**
		 * Content varies according to the type of "builtin" operation
		 */

		let copyTo = "";
		const copyToLabel = "[*] copy To: ";
		if (operation.copyTo && operation.copyTo.length) {
			for (const file of operation.copyTo) {
				copyTo += `src: ${file.src}\n${" ".repeat(copyToLabel.length)}dest: ${
					file.dest
				}\n`;
			}
		}
		table.push([
			operation.name,
			`[*] Comment: ${
				operation.comment
					? `${operation.comment}\n`
					: "No comment provided...\n"
			}[*] Environment:\n${environment}${reportDisplayBuiltinOperationValues(
				operation
			)}${
				operation.limitHosts
					? `\n${colors.bgRed("Limited to Host")}: ${colors.bgRed(
							operation.limitHosts.join(" ")
					  )}`
					: ""
			}${copyTo ? `\n${copyToLabel}${copyTo}` : ""}${
				operation.when
					? `\n${colors.red(`\n[*] when: "${operation.when}"`)}`
					: ""
			}\n[*] Register: ${operation.register ? operation.register : ""}\n`,
		]);
	}
	table.push([
		colors.yellow("Number of operations"),
		colors.yellow(operations.length.toString()),
	]);
	consoleLog(table.toString());
	table = new Table({
		head: [
			"Host (user input)",
			"Target host (resolved)",
			colors.green("Log file path"),
		],
		colWidths: [
			firstColSizeResume,
			secondColSizeResume,
			consoleColWidth - firstColSizeResume - secondColSizeResume - 5,
		],
		wordWrap: true,
	});

	for (const host of hostsListToProceed) {
		table.push([
			host.userInput,
			host.toPerform,
			logGetHostLogFullPath(host.userInput),
		]);
	}
	consoleLog(table.toString());
};

export const reportOperationsCatalog = (
	table: Table.Table,
	operationFullPath: string,
	operation: Operation,
	jsonOperationItem: OperationCatalogItemType
) => {
	// Compatibility old manifests : will be removed in the future
	if (operation.parameters)
		operation.environment = operation.parameters as KeyStringValue;
	if (operation.script) operation.scripts = operation.script;
	if (operation.command || operation.scripts) {
		table.push(["type", operation.command ? "command" : "script"]);
		jsonOperationItem.type = operation.command ? "command" : "script";
		table.push([
			"comment",
			operation.comment ? operation.comment : "NO comment provided",
		]);
		jsonOperationItem.comment = operation.comment
			? operation.comment
			: "NO comment provided";

		if (operation.scripts && operation.scripts.length > 0) {
			table.push(["scripts", ""]);
			for (const script of operation.scripts) {
				table.push(["", script]);
				jsonOperationItem.scripts.push(script);
			}
		}
		if (
			operation.environment &&
			operation.environment.required &&
			Object.getOwnPropertyNames(operation.environment.required).length > 0
		) {
			table.push([
				"Required parameters",
				Object.getOwnPropertyNames(operation.environment.required).join(","),
			]);
			jsonOperationItem.environment.required = Object.getOwnPropertyNames(
				operation.environment.required
			);
		} else {
			table.push(["Required parameters", "NO"]);
		}
		if (
			operation.environment &&
			operation.environment.optional &&
			Object.getOwnPropertyNames(operation.environment.optional).length > 0
		) {
			table.push([
				"Optional parameters",
				Object.getOwnPropertyNames(operation.environment.optional).join(","),
			]);
			jsonOperationItem.environment.optional = Object.getOwnPropertyNames(
				operation.environment.optional
			);
		} else {
			table.push(["Optional parameters", "NO"]);
		}
		if (operation.limitHosts) {
			table.push([
				colors.red("Limited to host(s)"),
				colors.red(operation.limitHosts.join(",")),
			]);
			jsonOperationItem.limitHosts = operation.limitHosts;
		}
		if (operation.when) {
			table.push([colors.red("Only when"), colors.red(operation.when)]);
			jsonOperationItem.when = operation.when;
		}
		table.push(["Command to edit", ""]);
		table.push([
			"  manifest",
			`automation-cli edit -edm "${operationFullPath}"`,
		]);
		table.push(["  script", `automation-cli edit -eds "${operationFullPath}"`]);
	} else {
		consoleErr(
			`  This operation doesn't contain one of this attribute: command, operation, operationBook. Always try to create an operation with the "createOp" command...`
		);
		consoleLog(
			` To edit manifest: automation-cli edit -edm "${operationFullPath}"`,
			"yellow"
		);
	}
	return jsonOperationItem;
};

export const reportListHosts = async (
	listHost: HostsType[],
	asJson?: BodyInit
) => {
	const consoleColWidth = process.stdout.columns;
	const firstColSizeUserInput = 45;

	if (asJson) {
		const jsonOutput: KeyStringValue[] = [];
		for (const host of listHost) {
			jsonOutput.push({
				userInput: host.userInput,
				resolvedAs: host.toPerform,
			});
		}
		consoleLog(JSON.stringify(jsonOutput, null, 4));
	} else {
		consoleLog(
			`Operations will be run on host${listHost.length ? "s" : ""}`,
			"green"
		);
		const table = new Table({
			head: ["User input", "Resolved hostname"],
			colWidths: [
				firstColSizeUserInput,
				consoleColWidth - firstColSizeUserInput - 5,
			],
			wordWrap: true,
		});
		for (const host of listHost) {
			table.push([host.userInput, host.toPerform]);
		}
		consoleLog(table.toString());
	}
	await exitNodeJs(0);
};

export const reportDependenciesList = async (
	OPSDirectory: string,
	dependencies: ReportOperationDependenciesLine[],
	filter: string,
	noDepReport: boolean,
	asJson?: boolean
) => {
	const consoleColWidth = process.stdout.columns;
	const firstColSizeUserInput = 80;
	const debPackages: string[] = [];
	if (!noDepReport) {
		for (const line of dependencies) {
			for (const debPackage of line.dependencies) {
				if (!debPackages.includes(debPackage)) debPackages.push(debPackage);
			}
		}
	}

	if (asJson) {
		consoleLog(
			JSON.stringify(
				{ operations: dependencies, debianPackages: debPackages },
				null,
				4
			)
		);
	} else {
		let title = "List of dependencies by operation";
		if (noDepReport) {
			title = "List of operations with no dependencies";
		}
		consoleLog(
			`${title} for OPSDirectory: ${colors.cyan(OPSDirectory)}`,
			"yellow"
		);
		const table = new Table({
			head: [colors.cyan("Operation name"), colors.cyan("Dependencies")],
			colWidths: [
				firstColSizeUserInput,
				consoleColWidth - firstColSizeUserInput - 5,
			],
			wordWrap: true,
		});
		for (const line of dependencies) {
			table.push([
				line.operationName,
				line.dependencies.length ? line.dependencies.join("\n") : "-",
			]);
		}
		table.push([
			colors.green(messageNumberOfOperations),
			colors.green(dependencies.length.toString()),
		]);
		// all packages
		if (!noDepReport) {
			table.push([
				`Summary of Debian packages used`,
				debPackages.sort().join("\n"),
			]);
		}
		consoleLog(table.toString());
		if (filter) consoleLog(`[*] Filter applied: '${filter}'`, "red");
	}
	await exitNodeJs(0);
};

export const reportSecurityAudit = (
	consoleColWidth: number,
	operationType: string,
	filePath: string,
	warnings: string[],
	shortcut?: string
) => {
	// Report
	const firstColSize = 21;
	const table = new Table({
		head: [colors.green("Attributes"), colors.green("Value")],
		colWidths: [firstColSize, consoleColWidth - firstColSize - 5],
		wordWrap: true,
	});
	table.push(["Type", colors.red(operationType)]);
	table.push(["Path", filePath]);
	if (shortcut) table.push(["shortcut", shortcut]);
	if (warnings.length) {
		table.push(["audit result", colors.red(warnings.join("\n"))]);
	} else {
		table.push(["audit result", colors.green("passed")]);
	}
	return table.toString();
};
