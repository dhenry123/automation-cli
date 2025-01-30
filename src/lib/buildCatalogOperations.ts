/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { OptionValues } from "commander";
import { existsSync, statSync } from "fs";
import { getProcessEnvValue, getSubdirectories } from "./system";
import { consoleLog } from "../helpers/helperUI";
import { dirname } from "path";
import { logDebugEvent } from "./log";
import Table from "cli-table3";
import colors from "colors";
import { reportOperationsCatalog } from "./reports";
import {
	extractOperationNameFromFullOperationDirectory,
	getMessageNumberOfOperations,
} from "../helpers/helperOperations";
import { getOperationManifestFileContent } from "./manifests";
import { OperationCatalogItemType } from "./types";

export const buildCatalogOperations = (commanderOptions: OptionValues) => {
	// Display size has minimum to be used with pipe
	const consoleColWidth = process.stdout.columns || 220;
	const filter: RegExp | null = commanderOptions.filter
		? new RegExp(commanderOptions.filter)
		: null;
	logDebugEvent(
		`operationsCatalog - filter: ${filter} - commanderOptions: ${JSON.stringify(
			commanderOptions,
			null,
			4
		)}`
	);
	const opsPath = getProcessEnvValue("OPS");
	logDebugEvent(`opsPath: ${opsPath}`);
	if (!existsSync(opsPath))
		throw new Error(`OPS directory: ${opsPath} doesn't exist`);
	if (!statSync(opsPath).isDirectory())
		throw new Error(`OPS path: ${opsPath} is not a directory`);

	const subdirectories = getSubdirectories(opsPath);
	logDebugEvent(`subdirectories found: ${subdirectories.join(",")}`);
	if (subdirectories.length === 0) {
		const message = `No operations found in this OPS directory: ${opsPath}`;
		logDebugEvent(message);
		consoleLog(message);
	}

	let countOperations = 0;
	const myTable: OperationCatalogItemType[] = [];
	const jsonOperationItems = { operations: myTable };
	for (const operationDir of subdirectories) {
		const jsonOperationItem: OperationCatalogItemType = {
			operation: "",
			path: "",
			comment: "",
			error: "",
			type: "",
			scripts: [],
			environment: { optional: [], required: [] },
			limitHosts: [],
			when: "",
		};
		// Is match filter
		if (filter && !filter.test(operationDir)) continue;
		const manifest = `${operationDir}/manifest.yaml`;
		logDebugEvent(`Manifest to inspect: ${manifest}`);
		if (existsSync(manifest)) {
			logDebugEvent(`Manifest exists`);
			countOperations++;

			// Start new table
			const firstColSize = 21;
			const opName =
				extractOperationNameFromFullOperationDirectory(operationDir);
			const table = new Table({
				head: ["Attributes", "Value"],
				colWidths: [firstColSize, consoleColWidth - firstColSize - 5],
				wordWrap: true,
			});
			table.push(["Operation", opName]);
			table.push(["Path", `${operationDir}`]);

			jsonOperationItem.operation = opName;
			jsonOperationItem.path = operationDir;

			try {
				const manifestContent = getOperationManifestFileContent(
					manifest,
					false
				);
				logDebugEvent(
					`manifestContent: ${JSON.stringify(manifestContent, null, 4)}`
				);
				if (manifestContent)
					reportOperationsCatalog(
						table,
						dirname(manifest),
						manifestContent,
						jsonOperationItem
					);
			} catch (error) {
				const errorAsString = (error as Error)
					.toString()
					.replace(/^Error: /, "");
				table.push(["Error", colors.red(errorAsString)]);
				jsonOperationItem.error = errorAsString;
			}
			if (!commanderOptions.Json) consoleLog(table.toString());
			jsonOperationItems.operations.push(jsonOperationItem);
		}
	}
	logDebugEvent(`Number of subdirectories: ${countOperations}`);
	if (commanderOptions.Json) {
		consoleLog(JSON.stringify(jsonOperationItems, null, 2));
		// Json output force silentmode
		process.env.SILENTMODE = "1";
	} else {
		if (countOperations)
			consoleLog(
				`\n${getMessageNumberOfOperations(opsPath, countOperations)}${
					filter ? ` Filtered on regexp: ${filter}` : ""
				}\n`,
				"green"
			);
	}
};
