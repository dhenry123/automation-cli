/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { readdirSync, statSync } from "fs";
import {
	getOPSDirectoryOperationBooksPath,
	getOPSDirectoryOperationsPath,
} from "../../helpers/helperOperations";
import { consoleLog } from "../../helpers/helperUI";
import { regExpYamlExtentionFilename } from "../constants";
import { logDebugEvent } from "../log";
import { getProcessEnvValue } from "../system";
import { securityAuditOperation } from "./secuAuditOperation";
import { securityAuditOperationBook } from "./secuAuditOperationBook";
import colors from "colors";
import { reportSecurityAudit } from "../reports";
import { securityAuditInventoryFiles } from "./securityInventoryFiles";
import { execSync } from "child_process";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const securityAudit = async (commanderOptions: any) => {
	const reportDataOperationBooks = [];
	const reportDataOperation = [];
	const reportDataInventory = [];
	let operationBooksProcessed = 0;
	let operationProcessed = 0;
	let inventoryFileProcessed = 0;
	const consoleColWidth = process.stdout.columns;

	// operationBooks
	const operationBooks = getOPSDirectoryOperationBooksPath();
	if (operationBooks.length === 0) {
		const message = `No operationBooks found in this OPS directory: ${getProcessEnvValue(
			"OPS"
		)}`;
		logDebugEvent(message);
		consoleLog(message);
	}
	for (const operationBook of operationBooks) {
		const booksList = readdirSync(operationBook);
		for (const book of booksList) {
			const curPath = `${operationBook}/${book}`;
			if (
				statSync(curPath).isFile() &&
				regExpYamlExtentionFilename.test(curPath)
			) {
				const result = securityAuditOperationBook(curPath, commanderOptions);
				if (result) reportDataOperationBooks.push(result);
				operationBooksProcessed++;
			}
		}
	}

	// operation
	const operations = getOPSDirectoryOperationsPath();
	for (const operation of operations) {
		const filesList = readdirSync(operation);
		for (const book of filesList) {
			const curPath = `${operation}/${book}`;
			if (
				statSync(curPath).isFile() &&
				new RegExp(`manifest.yaml`).test(curPath)
			) {
				const result = securityAuditOperation(curPath, commanderOptions);
				if (result) reportDataOperation.push(result);
				operationProcessed++;
			}
		}
	}

	// inventoryFiles
	const inventoryFilesList = execSync(
		`cd "${getProcessEnvValue(
			"OPS"
		)}" && grep -r "serversGroups:" *.yaml|cut -d ":" -f 1`
	)
		.toString()
		.split("\n");
	if (inventoryFilesList.length) {
		for (const inventoryFileName of inventoryFilesList) {
			if (!inventoryFileName.trim()) continue;
			const file = `${getProcessEnvValue("OPS")}/${inventoryFileName}`;
			const result = securityAuditInventoryFiles(file, commanderOptions);
			if (result) reportDataInventory.push(result);
			inventoryFileProcessed++;
		}
	}

	// Report
	const operationWarnings = reportDataOperation
		.filter((item) => item.warning.length)
		.length.toString();
	const operationBookWarnings = reportDataOperationBooks
		.filter((item) => item.warning.length)
		.length.toString();

	const inventoryFileWarnings = reportDataInventory
		.filter((item) => item.warning.length)
		.length.toString();

	if (commanderOptions.Json) {
		consoleLog(
			JSON.stringify({
				operations: reportDataOperation,
				operationBooks: reportDataOperationBooks,
				inventoryFiles: reportDataInventory,
				operationFailedProcessed: `${operationWarnings}/${operationProcessed}`,
				operationBooksFailedProcessed: `${operationBookWarnings}/${operationBooksProcessed}`,
				inventoryFailedProcessed: `${inventoryFileWarnings}/${inventoryFileProcessed}`,
			})
		);
	} else {
		for (const operationType of [
			reportDataOperation,
			reportDataOperationBooks,
			reportDataInventory,
		]) {
			for (const line of operationType) {
				consoleLog(
					reportSecurityAudit(
						consoleColWidth,
						line.type,
						line.path,
						line.warning,
						line.shortcut
					)
				);
			}
		}
		consoleLog(
			`${colors.yellow("Operations Failed/Processed: ")}${
				operationWarnings
					? colors.red(operationWarnings)
					: colors.green(operationWarnings)
			}/${colors.green(operationProcessed.toString())}`
		);
		consoleLog(
			`${colors.yellow("OperationBooks Failed/Processed: ")}${
				operationBookWarnings
					? colors.red(operationBookWarnings)
					: colors.green(operationBookWarnings)
			}/${colors.green(operationBooksProcessed.toString())}`
		);
		consoleLog(
			`${colors.yellow("Inventory files Failed/Processed: ")}${
				inventoryFileWarnings
					? colors.red(inventoryFileWarnings)
					: colors.green(inventoryFileWarnings)
			}/${colors.green(inventoryFileProcessed.toString())}`
		);
	}
};
