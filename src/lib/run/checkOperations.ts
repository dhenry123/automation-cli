/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import {
	isBuiltInOperation,
	isBuiltInUpdateInventoryOperation,
} from "../../helpers/helperOperations";
import {
	builtinMethods,
	regExpInventoryKey,
	typeEnvironmentVariable,
} from "../constants";
import { convCommanderOptionsEnvVarToKeyValueObject } from "../environment";
import { logDebugEvent } from "../log";
import { reportEnvironmentVariablesMissing } from "../reports";
import { getNestedValue, envSubst, terminateAllProcesses } from "../system";
import {
	AnyObject,
	HostsType,
	ManifestParameterType,
	ManifestRequiredParameters,
	Operation,
	RequiredAndMissingParameters,
} from "../types";

export const checkOperationsBeforeRunning = (
	operations: Operation[],
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	commanderOptions?: any
) => {
	// each operation must be set with "name" attribute
	checkOperationsNamed(operations);
	checkLimitHostsIsArray(operations);
	checkEnvironmentNeededByOperation(operations, commanderOptions.envVar);
	checkBuiltinOperationsName(operations);
	checkBuiltinOperationsSemantic(operations, commanderOptions);
	checkIsInventoryNeededInOperation(commanderOptions, operations);
	checkOperationsWhen(operations);
};

export const checkOperationsNamed = (operations: Operation[]) => {
	let idx = 0;
	for (const operation of operations) {
		if (!operation.name)
			throw new Error(
				`The 'name' attribute is mandatory on an operation (operation index: ${idx})`
			);
		idx++;
	}
};

export const checkLimitHostsIsArray = (operations: Operation[]) => {
	let idx = 0;
	for (const operation of operations) {
		if (operation.limitHosts && !Array.isArray(operation.limitHosts))
			throw new Error(
				`Operation: '${operation.name}' - The 'limitHosts' attribute must be an Array (operation index: ${idx})`
			);
		idx++;
	}
};

export const checkParameterType = (
	parameter: ManifestParameterType,
	idx: number,
	operationName: string
): boolean => {
	// check type is specified not covered now but in the future
	if (!parameter.type) {
		throw new Error(
			`Operation: ${operationName} - idx: ${idx} doesn't specify type. Types supported: ${typeEnvironmentVariable.join(
				","
			)}`
		);
	} else {
		if (!typeEnvironmentVariable.includes(parameter.type)) {
			throw new Error(
				`Operation: ${operationName} - idx: ${idx} use a type not supported. Types supported: ${typeEnvironmentVariable.join(
					","
				)}`
			);
		}
	}
	return true;
};
/**
 * Environment variables are set by user with multiple -e parmeters
 * Parmametes needed to execute operation are described in manifest
 * so we keep only variable needed for each operation and formated for bash language
 * if operation comes with parameters attributes, values are set by defaults and -e parameters override each value
 * -------------
 * Reminder:
 * -------------
 * priority order is:
 * - user environnement
 * - book.operation.parameters
 */
export const checkEnvironmentNeededByOperation = (
	operations: Operation[],
	commanderOptionsEnvVar?: string[]
) => {
	const requiredAndMissingParameters: RequiredAndMissingParameters[] = [];
	// All operations
	const environmentFromCommanderOption =
		convCommanderOptionsEnvVarToKeyValueObject(commanderOptionsEnvVar || []);
	const registeredVariables: string[] = [];
	for (let idx = 0; idx < operations.length; idx++) {
		const operation = operations[idx];
		// if operation requires environment variable ?
		if (operation.parameters && operation.parameters.required) {
			for (const required of Object.getOwnPropertyNames(
				operation.parameters.required
			)) {
				// Check type is provided
				checkParameterType(
					(operation.parameters.required as ManifestRequiredParameters)[
						required
					],
					idx,
					operation.name
				);

				// inject parameters.required.*.default value if exists
				const getDefaultValue = getNestedValue(
					operation.parameters.required as AnyObject,
					`${required}.default`
				);
				if (getDefaultValue) {
					if (operation.environment && !operation.environment[required])
						operation.environment[required] = getDefaultValue as string;
				}

				if (!operation.environment || !operation.environment[required]) {
					// Check in environment if required variable is set and found in registered process
					// By respecting this order, a variable required for the operation can be found in registered, provided by a previous operation.
					if (
						!environmentFromCommanderOption[required] &&
						!registeredVariables.includes(required)
					) {
						requiredAndMissingParameters.push({
							environmentVariableName: required,
							operationName: operation.name,
							idxOperationInList: idx,
						});
					}
				}
			}
		}
		if (operation.register)
			registeredVariables.push(operation.register.split(":")[0]);
	}
	// Make report
	const report = reportEnvironmentVariablesMissing(
		requiredAndMissingParameters
	);
	if (report) throw new Error(report);
};

/**
 * check builtin operation semantic
 */
export const checkBuiltinOperationsSemantic = (
	operations: Operation[],
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	commanderOptions: any
) => {
	let idx = 0;
	const hosts =
		(commanderOptions.hosts && commanderOptions.hosts.split(" ")) || 0;
	const isCommanderOptionInventoryFileProvided = commanderOptions.inventoryFile
		? true
		: false;
	for (const operation of operations) {
		if (
			isBuiltInOperation(operation.name) &&
			operation.name === "#confirm" &&
			hosts.length > 1
		) {
			throw new Error(
				`The builtin operation #confirm can only run with 1 host, ${hosts.length} hosts provided: ${commanderOptions.hosts}`
			);
		}
		if (operation.values && !Array.isArray(operation.values))
			throw new Error(
				`Attribut "values" of operation must be an array (operation index: ${idx})`
			);
		if (operation.limitHosts && !Array.isArray(operation.limitHosts))
			throw new Error(
				`Attribut "limitHosts" of operation must be an array (operation index: ${idx})`
			);
		if (operation.copyTo) {
			if (!Array.isArray(operation.copyTo))
				throw new Error(
					`Attribut "copyTo" of operation must be an array (operation index: ${idx})`
				);
			for (const data of operation.copyTo) {
				if (!data.src)
					throw new Error(
						`item ${JSON.stringify(
							data
						)} of Attribut "copyTo" needs attribute "src" (operation index: ${idx})`
					);
				if (!data.dest)
					throw new Error(
						`item ${JSON.stringify(
							data
						)} of Attribut "copyTo" needs attribute "dest" (operation index: ${idx})`
					);
				if (
					data &&
					data.chmod &&
					(typeof data.chmod !== "string" ||
						(typeof data.chmod === "string" && data.chmod.length !== 3))
				)
					throw new Error(
						`item ${JSON.stringify(
							data
						)} of Attribut "copyTo" has attribute "chmod", must be a 3-digit character string (unix like permissions) eg: '755' (operation index: ${idx})`
					);
				if (
					(regExpInventoryKey.test(data.src) ||
						regExpInventoryKey.test(data.dest)) &&
					!isCommanderOptionInventoryFileProvided
				)
					throw new Error(
						`Operation: ${
							operation.name
						} (idx: ${idx}) contains copyTo with src referring to an inventory: ${JSON.stringify(
							data
						)}, inventory file must be provided`
					);
			}
		}
		idx++;
	}
};

export const checkBuiltinOperationsName = (operations: Operation[]) => {
	let idx = 0;
	for (const operation of operations) {
		if (
			operation.operation &&
			isBuiltInOperation(operation.operation) &&
			!builtinMethods.includes(operation.operation)
		)
			throw new Error(
				`Bultin operation: '${operation.name}' doesn't exist (operation index: ${idx})`
			);
		idx++;
	}
};

/**
 * Latest check before running
 */
export const checkOperationsListSize = (operations: Operation[]) => {
	if (operations.length === 0) {
		const message = "There is no operation to process";
		terminateAllProcesses(1, message);
	}
};

/**
 * some value included in operation could be a reference to the inventory
 * => #inv
 * so inventory file must provided
 */
export const checkIsInventoryNeededInOperation = (
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	commanderOptions: any,
	operations: Operation[]
) => {
	let idx = 0;
	const isCommanderOptionInventoryFileProvided =
		!!commanderOptions.inventoryFile;
	// #inv. present in operation (environnement)
	for (const operation of operations) {
		try {
			if (operation.environment) {
				for (const key of Object.getOwnPropertyNames(operation.environment)) {
					if (
						regExpInventoryKey.test(operation.environment[key]) &&
						!isCommanderOptionInventoryFileProvided
					)
						throw new Error(
							`Operation: ${operation.name} (idx: ${idx}) contains an environment variable referring to an inventory: ${operation.environment[key]}, inventory file must be provided`
						);
				}
				if (
					operation.when &&
					regExpInventoryKey.test(operation.when) &&
					!isCommanderOptionInventoryFileProvided
				)
					throw new Error(
						`Operation: ${operation.name} (idx: ${idx}) contains a condition when referring to an inventory: ${operation.when}, inventory file must be provided`
					);
			}
			// operation is #updateInventory - inventory is mandatory
			if (
				isBuiltInUpdateInventoryOperation(operation.name) &&
				!isCommanderOptionInventoryFileProvided
			) {
				throw new Error(
					`Operation: ${operation.name} (idx: ${idx}) is a builtin: ${operation.name} which need to interact with an inventory file`
				);
			}
			idx++;
		} catch (error) {
			const message = (error as Error).toString();
			terminateAllProcesses(1, message);
		}
	}
};

export const checkOperationsWhen = (operations: Operation[]) => {
	let idx = 0;
	for (const operation of operations) {
		const messageMalformed = `This operation: ${operation.name} contains 'when' attribute with a malformed value (operation index: ${idx})`;
		if (operation.when) {
			// match comparator
			const comparators: string[] = ["==", "!="];
			let comparator = "";
			for (const comp of comparators) {
				if (new RegExp(comp).test(operation.when)) {
					comparator = comp;
					break;
				}
			}
			// no comparator found
			if (!comparator) throw new Error(`${messageMalformed} [Comparator]`);
			const splited = operation.when.split(comparator);
			// result of split on comparator must be 2 items
			if (splited.length !== 2)
				throw new Error(
					`${messageMalformed} [key/value not found - split give more than 2 items]`
				);
			// first item must start with $
			if (!/^\$/.test(splited[0].trim()) && !/^#inv\./.test(splited[0].trim()))
				throw new Error(`${messageMalformed} [Key not start with $ or #inv.]`);
		}
		idx++;
	}
};

export const checkOperationBookBeforeDiscovering = (
	operations: Operation[]
) => {
	// limitHosts attribut on operationBook, hum...
	for (const operation of operations) {
		if (operation.limitHosts)
			throw new Error(`limitHosts attribut can't be included in operationBook`);
	}
};

/**
 * (no ambiguities) hosts present in limithost must be appear in the host list to perform provided by user
 * because operation is related to hosts and each host present in this process must consistent
 */
export const checkLimitHostsIncludesCommanderOptionsHostsList = (
	operation: Operation,
	finalHosts: HostsType[],
	commanderOptionHost: string[]
) => {
	if (!operation.limitHosts) return;
	for (let limitHost of operation.limitHosts) {
		if (operation.environment) {
			logDebugEvent(
				`checkLimitHostsIncludesCommanderOptionsHostsList: Trying to resolve limitHost: ${limitHost} with environment: ${JSON.stringify(
					operation.environment,
					null,
					4
				)}`
			);
			limitHost = envSubst(limitHost, operation.environment);
			logDebugEvent(
				`checkLimitHostsIncludesCommanderOptionsHostsList: limitHost resolved: ${limitHost}`
			);
		}

		const filterFromHostsProvided = finalHosts.filter(
			(item) => item.toPerform === limitHost || item.userInput === limitHost
		);
		if (!filterFromHostsProvided.length) {
			logDebugEvent(
				`limitHost: "${limitHost}" not found in the hosts list provided by user: -h "${commanderOptionHost}"`
			);
			throw new Error(
				`The operation named: "${
					operation.name
				}" includes the atttribut "limitHosts".
For security reasons, each host in this list must be included in the list of hosts that you provide with the [-h] parameter:

You have provided: -h "${commanderOptionHost.join(" ")}"

The operation: "${
					operation.name
				}" limits its execution to the following hosts: "${operation.limitHosts.join(
					" "
				)}"
`
			);
		}
	}
};
