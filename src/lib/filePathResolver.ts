/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import {
	regExpRelative,
	regExpAbsolute,
	legacyDirStorageOperationBooks,
	legacyDirStorageOperations,
	messageNotYamlFilePath,
} from "./constants";
import { logDebugEvent } from "./log";
import { autoCompleteFileExtension, getProcessEnvValue } from "./system";

/**
 * tries to resolve the final absolute path of the operationBook manifest
 * eg:
 * /xxxx/mybook.yaml
 * ./xxxx/mybook.yaml
 * mybook.yaml
 */
export const resolveAbsolutePathOperationBookManifest = (
	operationBook: string
): string => {
	// trim value
	operationBook = operationBook.trim();

	// Not empty and must end with .yaml
	if (!operationBook) {
		throw new Error(messageNotYamlFilePath);
	}
	// Autocomplete extension file
	operationBook = autoCompleteFileExtension("yaml", operationBook);

	let finalPathOperationBookManifest = "";

	if (regExpRelative.test(operationBook)) {
		logDebugEvent(`operationBook value is relative yaml file path`);
		finalPathOperationBookManifest = `${process.cwd()}/${operationBook.replace(
			regExpRelative,
			""
		)}`;
	} else if (regExpAbsolute.test(operationBook)) {
		logDebugEvent(`operationBook value is absolute yaml file path`);
		finalPathOperationBookManifest = operationBook;
	} else {
		// OPS directory operations is the legacy path or value of environment variable OPS
		let opsDirectory = legacyDirStorageOperationBooks;
		if (getProcessEnvValue("OPS")) {
			logDebugEvent(
				`OperationBook: OPS environment variable is set: ${getProcessEnvValue(
					"OPS"
				)}`
			);
			opsDirectory = getOperationBooksPath(getProcessEnvValue("OPS"));
		} else {
			logDebugEvent(
				`OPS environment not set, using OPS default: ${legacyDirStorageOperations}`
			);
		}
		finalPathOperationBookManifest = `${opsDirectory}/${operationBook}`;

		logDebugEvent(
			`operationBook value is yaml file path related to OPS directory: ${opsDirectory}`
		);
	}
	return finalPathOperationBookManifest;
};

/**
 * tries to resolve the final absolute path of the operation manifest
 * eg:
 * /xxxx/
 * ./xxxx/
 * operationName
 */
export const resolveAbsolutePathOperationManifest = (
	operation: string
): string => {
	// trim value
	operation = operation.trim();

	if (!operation) {
		throw new Error("The value of the 'operation' attribute cannot be empty");
	}

	// Remove trailing /
	operation = operation.replace(/\/*$/, "");

	let finalPathOperationManifest = "";

	if (regExpRelative.test(operation)) {
		logDebugEvent(`operation value is relative path`);
		finalPathOperationManifest = `${process.cwd()}/${operation.replace(
			regExpRelative,
			""
		)}/manifest.yaml`;
	} else if (regExpAbsolute.test(operation)) {
		logDebugEvent(`operation value is absolute path`);
		finalPathOperationManifest = `${operation}/manifest.yaml`;
	} else {
		// OPS directory operations is the legacy path or value of environment variable OPS
		let opsDirectory = legacyDirStorageOperations;
		if (getProcessEnvValue("OPS")) {
			logDebugEvent(
				`OPS environment variable is set: ${getProcessEnvValue("OPS")}`
			);
			opsDirectory = getOperationsPath(getProcessEnvValue("OPS"));
		} else {
			logDebugEvent(
				`OPS environment not set, using OPS default: ${legacyDirStorageOperations}`
			);
		}
		finalPathOperationManifest = `${opsDirectory}/${operation}/manifest.yaml`;
		logDebugEvent(`Final operation Path is : ${finalPathOperationManifest}`);
	}
	return finalPathOperationManifest;
};

export const resolveAbsoluteOPSPathOperations = (operationPath: string) => {
	let finalOperationPath = operationPath;
	if (regExpRelative.test(operationPath)) {
		logDebugEvent(`OPS operations value is relative path ${operationPath}`);
		finalOperationPath = `${process.cwd()}/${operationPath.replace(
			regExpRelative,
			""
		)}`;
	} else if (regExpAbsolute.test(operationPath)) {
		logDebugEvent(`operation value is absolute path ${operationPath}`);
		// finalOperationPath already set with value
	} else {
		// OPS directory operations is the legacy path or value of environment variable OPS
		finalOperationPath = `${legacyDirStorageOperations}`;
		if (getProcessEnvValue("OPS")) {
			logDebugEvent(
				`OPS environment variable is set: ${getProcessEnvValue("OPS")}`
			);
			finalOperationPath = getOperationsPath(getProcessEnvValue("OPS"));
		} else {
			logDebugEvent(
				`OPS environment not set, using OPS default: ${legacyDirStorageOperations}`
			);
		}

		logDebugEvent(`Final operation Path is : ${finalOperationPath}`);
	}
	return finalOperationPath;
};

export const getOperationsPath = (basePath: string) => {
	return `${basePath}/operations`;
};

export const getOperationBooksPath = (basePath: string) => {
	return `${basePath}/operationBooks`;
};

/**
 * explicite relative | absolute
 * otherwise inventory from root of OPSDirectory
 */
export const resolveInventoryFilePath = (file: string): string => {
	let filePath = file;
	// Autocomplete extension file
	filePath = autoCompleteFileExtension("yaml", filePath);
	// No absolute or relative path, prefix with OPS
	if (!/^\.|^\//.test(file)) {
		filePath = `${
			getProcessEnvValue("OPS") ? `${getProcessEnvValue("OPS")}/` : ""
		}${file}`;
	}
	// remove multiples
	return filePath.replace(/\/+/g, "/");
};

export const resolveHttpServerPublicPath = (file: string): string => {
	// No absolute or relative path, prefix with OPS
	if (!/^\.|^\//.test(file)) {
		file = `${
			getProcessEnvValue("OPS") ? `${getProcessEnvValue("OPS")}/` : ""
		}${file}`;
	}
	// remove multiples
	return file.replace(/\/+/g, "/");
};
