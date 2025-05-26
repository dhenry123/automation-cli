/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { existsSync, readFileSync } from "node:fs";
import {
	word_OperationBook_manifest_file,
	word_Operation_manifest_file,
} from "./constants";
import { logDebugEvent } from "./log";
import { parseDocument } from "yaml";
import type {
	Operation,
	ManifestRunnableType,
	ManifestParametersType,
	ManifestRequiredParameters,
	ManifestOptionalParameters,
	KeyStringValue,
} from "./types";
import { dirname } from "node:path";
import { consoleErr, consoleLog } from "../helpers/helperUI";

/**
 * Get operations from OperationsBook, which could be operation or operationBook
 * OPERATION BOOK filename could be provided without yaml extension
 */
export const getOperationBookManifestFileContent = (
	operationBookYamlFile: string
): Operation[] => {
	let operations: Operation[] = [];

	logDebugEvent(
		`Reading ${word_OperationBook_manifest_file}: ${operationBookYamlFile}`
	);

	if (!existsSync(operationBookYamlFile))
		throw new Error(
			`${word_OperationBook_manifest_file} not found: ${operationBookYamlFile}`
		);

	const content: string = readFileSync(operationBookYamlFile, "utf-8");
	const manifestContent = parseDocument(
		content
	).toJSON() as ManifestRunnableType;

	/**
	 * is structure expected ?
	 */
	if (manifestContent) {
		/**
		 * Get Operations list to execute
		 */
		if (manifestContent.operations) {
			operations = manifestContent.operations;

			for (let idx = 0; idx < operations.length; idx++) {
				// Compatibility old manifests : will be removed in the future
				if (operations[idx].parameters) {
					consoleLog(
						`WARN: OperationBook file: ${operationBookYamlFile} contains 'parameters' attributes, must be replaced by 'environment'. The attribute 'parameters' will be remove in the future.\n`,
						"red"
					);
					operations[idx].environment = operations[idx]
						.parameters as KeyStringValue;
				}
				// Compatibility old manifests : will be removed in the future
				if (operations[idx].name) {
					consoleLog(
						`WARN: OperationBook file: ${operationBookYamlFile} contains 'name' attributes, must be replaced by 'comment' which override the 'comment' attribute of operation at runtime. The attribute 'name' will be remove in the future.\n`,
						"red"
					);
				}
			}
		} else {
			throw new Error(
				`${word_OperationBook_manifest_file}: "${operationBookYamlFile}" doesn't contain 'operations' attribute or 'operations' is empty `
			);
		}
	} else {
		throw new Error(
			`${word_OperationBook_manifest_file}: "${operationBookYamlFile}" content is empty`
		);
	}

	if (!Array.isArray(operations))
		throw new Error(
			`${word_OperationBook_manifest_file}: "${operationBookYamlFile}" 'operations' attribute is not Array type`
		);

	logDebugEvent(
		`OperationBook file content: ${JSON.stringify(operations, null, 4)}`
	);
	return operations;
};

/**
 * Get operation manifest content as Operation Object
 */
export const getOperationManifestFileContent = (
	operationYamlFile: string,
	toEdit: boolean,
	idx?: number
): Operation => {
	const manifestDirname = dirname(operationYamlFile);
	logDebugEvent(
		`Reading ${word_Operation_manifest_file}: "${operationYamlFile}"`
	);

	if (!existsSync(operationYamlFile))
		throw new Error(
			`${word_Operation_manifest_file} not found: "${operationYamlFile}"`
		);

	const content: string = readFileSync(operationYamlFile, "utf-8");
	const operation = parseDocument(content).toJSON() as Operation;

	// Compatibility old manifests : will be removed in the future
	if (operation?.script) {
		consoleErr(
			`WARN: Manifest file: ${operationYamlFile} contains 'script' attributes, must be replaced by 'scripts'. The attribute 'script' will be remove in the future.\n`
		);
		operation.scripts = operation.script;
	}
	if (operation) {
		if (!operation.scripts && !operation.command)
			throw new Error(
				`${word_Operation_manifest_file}: "${operationYamlFile}" doesn't contain scripts | command attribute (operation index: ${
					idx !== undefined ? idx : ""
				}).\nThe yaml manifest can also be malformed!!! (enclose strings of characters in quotes)`
			);
		if (operation.scripts && operation.command)
			throw new Error(
				`${word_Operation_manifest_file}: "${operationYamlFile}" includes the attributes scripts and command. You must choose one of them (operation index: ${idx})`
			);
		if (operation.scripts && !Array.isArray(operation.scripts))
			throw new Error(
				`${word_Operation_manifest_file}: "${operationYamlFile}" includes a scripts attribute which is not Array type (operation index: ${idx})`
			);
		// Resolve script name as absolute
		if (operation.scripts && Array.isArray(operation.scripts)) {
			const scripts: string[] = [];
			for (const script of operation.scripts) {
				// remove trailing /
				const shell = `${manifestDirname.replace(/\/*$/, "")}/${script}`;
				// If edit detected, no exit. UX: allow to edit
				if (!toEdit && !existsSync(shell)) {
					throw new Error(
						`${word_Operation_manifest_file}: "${operationYamlFile}" includes a script not found: "${script}" resolved as: ${shell} ${
							idx !== undefined ? `(operation index: ${idx})` : ""
						}`
					);
				}
				scripts.push(shell);
			}
			operation.scripts = scripts;
		}
		const parameters: ManifestParametersType = { optional: {}, required: {} };
		// Parameters no Array
		if (operation.parameters && Array.isArray(operation.parameters))
			throw new Error(
				`${word_Operation_manifest_file}: "${operationYamlFile}" includes parameters described as Array. Parameters must be a pure object`
			);
		// Parameters keep only required &| optional
		if (operation.parameters?.required)
			parameters.required = operation.parameters
				?.required as ManifestRequiredParameters;
		if (operation.parameters?.optional)
			parameters.optional = operation.parameters
				?.optional as ManifestOptionalParameters;
		// Finally replace parameters with finale values
		operation.parameters = parameters;

		// check parameters types
		if (
			operation.parameters.required &&
			Array.isArray(operation.parameters.required)
		)
			throw new Error(
				`${word_Operation_manifest_file}: "${operationYamlFile}" includes parameters.required described as Array. Parameters must be a pure object`
			);
		if (
			operation.parameters.optional &&
			Array.isArray(operation.parameters.optional)
		)
			throw new Error(
				`${word_Operation_manifest_file}: "${operationYamlFile}" includes parameters.optional described as Array. Parameters must be a pure object`
			);
	} else {
		throw new Error(
			`${word_Operation_manifest_file}: ${operationYamlFile} content is empty`
		);
	}

	logDebugEvent(
		`Operation file content: ['${operationYamlFile}']:  ${JSON.stringify(
			operation,
			null,
			4
		)}`
	);
	// Array because of compatibility
	return operation;
};
