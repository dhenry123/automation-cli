/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { OptionValues } from "commander";
import { logDebugEvent } from "../log";
import {
	ManifestOptionalParameters,
	ManifestParametersType,
	Operation,
	OperationBase,
} from "../types";
import {
	getOperationBookManifestFileContent,
	getOperationManifestFileContent,
} from "../manifests";
import {
	convCommanderOptionsEnvVarToKeyValueObject,
	convertEnvironmentObjectToStringArray,
	environmentOverride,
} from "../environment";
import {
	resolveAbsolutePathOperationManifest,
	resolveAbsolutePathOperationBookManifest,
} from "../filePathResolver";
import { openEditor } from "../../helpers/helperEditManifest";
import { isCommanderOptionsIncludeEdit } from "../../helpers/helperOptions";
import { checkOperationBookBeforeDiscovering } from "./checkOperations";
import {
	getOperationEnvironmentFromParametersOptionalDefault,
	isBuiltInOperation,
} from "../../helpers/helperOperations";

/**
 * options commander option -c ||-op is converted to operation
 */
export const getOperationBaseFromCommanderOptions = (
	commanderOptions: OptionValues
): OperationBase | null => {
	const operationBase: OperationBase = {
		name: "command (-c): ",
		operationType: "command",
		value: "",
		environmentFromCommanderOption: commanderOptions.envVar || [],
		register: "",
		nolog: false,
		when: "",
	};
	// command -c
	if (commanderOptions.command && commanderOptions.command.trim()) {
		logDebugEvent(
			`Operation type discovered : 'command' Command Line (-c): ${commanderOptions.command}`
		);
		operationBase.name += commanderOptions.command;
		operationBase.value = commanderOptions.command;
		return operationBase;
	}
	// operation -op
	if (commanderOptions.operation && commanderOptions.operation.trim()) {
		logDebugEvent(
			`Operation type discovered: 'operation' Command Line (-op): ${commanderOptions.operation}`
		);
		operationBase.name = commanderOptions.operation;
		operationBase.operationType = "operation";
		operationBase.value = commanderOptions.operation;
		return operationBase;
	}
	// operationBook -ob
	if (commanderOptions.operationBook && commanderOptions.operationBook.trim()) {
		logDebugEvent(
			`Operation type discovered: 'operationBook' Command Line (-ob): ${commanderOptions.operationBook}`
		);
		operationBase.name = commanderOptions.operationBook;
		operationBase.operationType = "operationBook";
		operationBase.value = commanderOptions.operationBook;
		return operationBase;
	}
	return null;
};

/**
 *
 * Detect type of operation: command, operation, operationBook
 * & Build a list of Operation type
 */
export const discoverOperationsFromCommanderOptions = async (
	commanderOptions: OptionValues
): Promise<Operation[]> => {
	/**
	 * 2 ways to run operation on host:
	 * - manifest (simple operation or operations extracted from operationBook)
	 * - command: operation Object is built from simple provided command
	 */
	let operationsList: OperationBase | null = null;

	if (
		commanderOptions.command ||
		commanderOptions.operation ||
		commanderOptions.operationBook
	) {
		operationsList = getOperationBaseFromCommanderOptions(commanderOptions);
		if (!operationsList)
			throw new Error(`The value of the "command" attribute cannot be empty`);
		// Base list is ready
		// if command no need to read manifest... operation could be executed as it
		if (operationsList.operationType === "command") {
			// convert OperationBase to Operation[]
			return [
				{
					name: operationsList.name,
					command: operationsList.value,
					environment: convCommanderOptionsEnvVarToKeyValueObject(
						operationsList.environmentFromCommanderOption || []
					),
					register: operationsList.register,
				},
			];
		} else {
			logDebugEvent(
				`Starting discoverOperationsFromManifest with operationsList: ${JSON.stringify(
					operationsList
				)}`
			);
			///-------------------
			// Try to edit script for operation with local editor (vi is default)
			// only if operation || operationBook
			///-------------------
			if (
				isCommanderOptionsIncludeEdit(commanderOptions) &&
				(commanderOptions.operation || commanderOptions.operationBook)
			) {
				await openEditor(commanderOptions, operationsList);
			} else {
				// get all operations as Object from manifest
				return discoverOperationsFromManifest(operationsList, false);
			}
		}
	} else {
		throw new Error(
			"You need to pass one of these parameters --command(-c) || --operation(-op) || --operation-book(-ob)"
		);
	}
	return [];
};

/**
 * Could be an operationBook or a simple operation
 * all items will be converted to operation Object
 */
export const discoverOperationsFromManifest = (
	operationBase: OperationBase,
	toEdit: boolean
): Operation[] => {
	let manifestContent: Operation[] = [];

	// get manifest file content as Operation Object
	// operationBook type
	if (operationBase.operationType == "operationBook") {
		// This operation resolve operationBook & check isExists
		const operationBookYamlFile = resolveAbsolutePathOperationBookManifest(
			operationBase.value
		);
		manifestContent = getOperationBookManifestFileContent(
			operationBookYamlFile
		);
		checkOperationBookBeforeDiscovering(manifestContent);
		return resolveOperationsFromOperationBookManifest(
			manifestContent,
			operationBase.environmentFromCommanderOption || [],
			toEdit
		);
	} else {
		// type is : operation
		const operationYamlFile = resolveAbsolutePathOperationManifest(
			operationBase.value
		);
		const operationFromYaml = {
			...getOperationManifestFileContent(operationYamlFile, toEdit),
		};
		return [getOperationAsObject(operationFromYaml, operationBase)];
	}
};

// name is not mandatory in manifest, when started from command line, name is build in OperationBase
// when started from operationBook, operation name is the mandatory name attribute in operation
// environment is populated by environment from command and optional default values included in operations manifests
export const getOperationAsObject = (
	operationFromYaml: Operation,
	operationBase: OperationBase
) => {
	// parameters must always be present on the initial object
	if (!operationFromYaml.parameters) operationFromYaml.parameters = {};
	return {
		...operationFromYaml,
		name: operationBase.name,
		environment: getOperationEnvironmentFromParametersOptionalDefault(
			operationFromYaml.parameters.optional as ManifestOptionalParameters,
			convCommanderOptionsEnvVarToKeyValueObject(
				operationBase.environmentFromCommanderOption || []
			)
		),
		//base override yaml because of operationBook
		register: operationBase.register || operationFromYaml.register,
		nolog: operationBase.nolog || operationFromYaml.nolog,
		when: operationBase.when || operationFromYaml.when,
	};
};

/**
 * At this step as reading operations from operationBook
 * which include
 * - operation name (not full Operation object)
 * - command
 * - or other(s) operationBooks
 * We have to iterate until obtain a list of operations
 * composed of operation objects only
 * IMPORTANT: Command line option -e override environment declared in operationBook
 */
export const resolveOperationsFromOperationBookManifest = (
	opsBase: Operation[],
	environmentFromCommanderOption: string[],
	toEdit: boolean
) => {
	logDebugEvent(
		`resolveOperationsFromOperationBookManifest with operationBook OPBASE: ${JSON.stringify(
			opsBase,
			null,
			4
		)}`
	);
	let operations: Operation[] = [];
	for (const base of opsBase) {
		if (base.command) {
			operations.push({
				name: base.command,
				comment: base.comment,
				command: base.command,
				// take all environnement provided by user could be useful to apply condition on environment variable
				environment: getOperationEnvironmentFromParametersOptionalDefault(
					{},
					convCommanderOptionsEnvVarToKeyValueObject(
						environmentFromCommanderOption || []
					)
				),
				register: base.register,
				when: base.when,
				limitHosts: base.limitHosts,
			});
		} else if (base.operation) {
			let operation: Operation = { ...base };
			if (!isBuiltInOperation(base.operation)) {
				const operationYamlFile = resolveAbsolutePathOperationManifest(
					base.operation
				);
				logDebugEvent(`${base.operation} resolved to ${operationYamlFile}`);
				// Difficulties with operationBook
				// environment is set in book
				// && could be overridden by user environement -e

				// Building operation Object from operation yaml file
				operation = getOperationAsObject(
					getOperationManifestFileContent(operationYamlFile, toEdit),
					{
						name: base.operation,
						environmentFromCommanderOption: environmentFromCommanderOption,
					} as OperationBase
				);
				// set environment found in operationBook overridden by command line (-e)
				const myOp = {
					...operation,
					environment: getOperationEnvironmentFromParametersOptionalDefault(
						(operation.parameters &&
							(operation.parameters.optional as ManifestOptionalParameters)) ||
							{},
						environmentOverride(
							base.environment || {},
							environmentFromCommanderOption,
							operation.parameters as ManifestParametersType
						)
					),
					register: base.register,
					when: base.when || operation.when, // Book override operation
				};
				operations.push(myOp);
				continue;
			} else {
				// Builtin
				if (!operation.parameters) operation.parameters = {};
				operation.environment =
					getOperationEnvironmentFromParametersOptionalDefault(
						operation.parameters.optional as ManifestOptionalParameters,
						convCommanderOptionsEnvVarToKeyValueObject(
							environmentFromCommanderOption || []
						)
					);
				operations.push({
					...operation,
					name: base.operation,
					environment: environmentOverride(
						operation.environment || {},
						environmentFromCommanderOption,
						operation.parameters as ManifestParametersType
					),
					register: base.register,
					nolog: base.nolog,
					when: base.when,
					limitHosts: base.limitHosts,
				});
			}
		} else if (base.operationBook) {
			const operationBookYamlFile = resolveAbsolutePathOperationBookManifest(
				base.operationBook
			);
			const manifestContent = getOperationBookManifestFileContent(
				operationBookYamlFile
			);
			// OperationBook environment is overridden by CommanderOptions environnement
			// concatenation of CommanderOptions environment(-e) & operationBookEnvironment
			logDebugEvent(
				`resolveOperationsFromOperationBookManifest - Preparing environment from Commander Options Environment: ${JSON.stringify(
					resolveOperationsFromOperationBookManifest,
					null,
					4
				)} AND OperationBook environnment: ${
					base.environment ? base.environment : {}
				}`
			);
			const operationBookEnvironment = environmentOverride(
				base.environment ? base.environment : {},
				environmentFromCommanderOption
			);
			logDebugEvent(
				`resolveOperationsFromOperationBookManifest - Environment is now: ${JSON.stringify(
					operationBookEnvironment,
					null,
					4
				)}`
			);
			operations = operations.concat(
				resolveOperationsFromOperationBookManifest(
					manifestContent,
					convertEnvironmentObjectToStringArray(operationBookEnvironment),
					toEdit
				)
			);
		}
	}
	return operations;
};
