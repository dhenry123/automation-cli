/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { OptionValues } from "commander";
import { resolveAbsoluteOPSPathOperations } from "./filePathResolver";
import { existsSync, statSync } from "fs";
import { logDebugEvent } from "./log";
import AdmZip from "adm-zip";
import { consoleLog } from "../helpers/helperUI";
import { getUserHomeDirectory } from "./system";

export const exportOperation = (commanderOptions: OptionValues) => {
	//const consoleColWidth = process.stdout.columns;
	const opsPath = resolveAbsoluteOPSPathOperations(
		commanderOptions.operationsPath
	);
	const operationName = commanderOptions.operation;

	const operationFullPath = `${opsPath}/${operationName}`;

	const zipFileFullPath = `${getUserHomeDirectory()}/automation-cli-exported-package-operation-${operationName}.zip`;

	logDebugEvent(`opsPath: ${opsPath}`);
	logDebugEvent(`zipFileFullPath: ${zipFileFullPath}`);
	logDebugEvent(`operationName to export: ${operationName}`);

	if (!existsSync(opsPath))
		throw new Error(`OPS directory: ${opsPath} doesn't exist`);
	if (!statSync(opsPath).isDirectory())
		throw new Error(`OPS path: ${opsPath} is not a directory`);

	if (!existsSync(`${opsPath}/${operationName}`))
		throw new Error(`Operation path not found: ${operationFullPath}`);

	const zip = new AdmZip();
	zip.addLocalFolder(operationFullPath, operationName);
	zip.addZipComment(`automation-cli - exported operation: ${operationName}`);
	zip.writeZip(zipFileFullPath);
	consoleLog(
		`\nOperation has been exported in the compressed file: ${zipFileFullPath}\n`,
		"green"
	);
};
