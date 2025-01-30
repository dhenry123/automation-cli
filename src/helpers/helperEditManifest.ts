/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 12/01/24
 */

import { OptionValues } from "commander";
import { existsSync } from "fs";
import { isCommanderOptionsIncludeEdit } from "./helperOptions";
import { spawnSync } from "child_process";
import {
	resolveAbsolutePathOperationManifest,
	resolveAbsolutePathOperationBookManifest,
	getOperationsPath,
} from "../lib/filePathResolver";
import { logDebugEvent } from "../lib/log";
import { getProcessEnvValue, exitNodeJs } from "../lib/system";
import { OperationBase } from "../lib/types";
import { consoleLog } from "./helperUI";
import { getOperationManifestFileContent } from "../lib/manifests";
import prompts from "prompts";
import { messageCanceledByUser } from "../lib/constants";

export const startEditor = (file: string) => {
	// eslint-disable-next-line no-async-promise-executor
	return new Promise(async (resolve, reject) => {
		// Start the vi editor
		const editor = spawnSync(getProcessEnvValue("EDITOR") || "vi", [file], {
			stdio: ["inherit", "inherit", "inherit"], // passes the standard input/output/error to the vi process
			shell: true,
		});
		if (!editor.status) {
			resolve(null);
		} else {
			reject(new Error(`Editor closed with the error Code: ${editor.status}`));
		}
	});
};

export const tryEdit = async (
	commanderOptions: OptionValues,
	operation: OperationBase
) => {
	// eslint-disable-next-line no-async-promise-executor
	return new Promise(async (resolve, reject) => {
		const fileToEdit = await getOperationFileToEdit(
			commanderOptions,
			operation
		).catch((error) => {
			reject(error);
		});
		if (fileToEdit && fileToEdit !== messageCanceledByUser) {
			logDebugEvent(`File to edit ${fileToEdit}`);
			await startEditor(fileToEdit)
				.then(async () => {
					resolve(null);
				})
				.catch((error) => {
					reject(error);
				});
		} else if (fileToEdit === messageCanceledByUser) {
			reject(`Edit file - ${messageCanceledByUser}`);
		} else {
			reject(`Nothing to edit`);
		}
	});
};

/**
 * Open user editor
 * default is nano, could be change setting environment variable EDITOR
 */
export const openEditor = async (
	commanderOptions: OptionValues,
	operation: OperationBase
) => {
	// Start the process
	await tryEdit(commanderOptions, operation)
		.then(async () => {
			await exitNodeJs();
		})
		.catch(async (error) => {
			logDebugEvent(error.toString());
			await exitNodeJs(1, error.toString());
		});
};

/**
 * File to edit in regard the type:
 * operation || operationBook
 */
export const getOperationFileToEdit = (
	commanderOptions: OptionValues,
	operation: OperationBase,
	callbackTest?: () => void
): Promise<string | null> => {
	// eslint-disable-next-line no-async-promise-executor
	return new Promise(async (resolve, reject) => {
		if (isCommanderOptionsIncludeEdit(commanderOptions)) {
			if (operation.operationType === "operation" && operation.value) {
				logDebugEvent(
					`Command line options includes edit option ${JSON.stringify(
						commanderOptions
					)}`
				);
				const operationYamlFile = resolveAbsolutePathOperationManifest(
					operation.value
				);
				if (existsSync(operationYamlFile)) {
					if (commanderOptions.Eds) {
						// all checks are made in the next method
						const manifestContent = getOperationManifestFileContent(
							operationYamlFile,
							true
						);

						// Default open the first, @todo purpose list of script to select
						if (manifestContent.scripts) {
							// if multiple script, purpose select list, with "cancel" entry
							if (manifestContent.scripts.length > 1) {
								const choice: prompts.Choice[] = [];
								for (const item of manifestContent.scripts) {
									choice.push({
										title: item.replace(
											new RegExp(
												`${getOperationsPath(getProcessEnvValue("OPS"))}/${
													commanderOptions.operation
												}/`
											),
											""
										),
										value: item,
									} as prompts.Choice);
								}
								choice.push({
									title: "Cancel",
									value: messageCanceledByUser,
								} as prompts.Choice);
								if (callbackTest) callbackTest();
								const response = await prompts({
									type: "select",
									name: "script",
									message: "Select the script to be modified",
									choices: choice,
									stdin: process.stdin,
								});
								// To isolate spawn sync error if occurred
								consoleLog(" ");
								resolve(response.script);
							} else if (manifestContent.scripts[0]) {
								resolve(manifestContent.scripts[0]);
							}
						} else if (manifestContent.command) {
							reject(
								`Operation: ${operationYamlFile} contains the attribute "command", which is not associated to a script`
							);
						}
					} else {
						// -edm: edit operation Manifest
						logDebugEvent(`Manifest file ready to edit: ${operationYamlFile}`);
						resolve(operationYamlFile);
					}
				} else {
					resolve(null);
				}
			} else if (
				operation.operationType === "operationBook" &&
				operation.value
			) {
				const operationYamlFile = resolveAbsolutePathOperationBookManifest(
					operation.value
				);
				if (existsSync(operationYamlFile)) {
					resolve(operationYamlFile);
				} else {
					resolve(null);
				}
			}
		} else {
			resolve(null);
		}
	});
};
