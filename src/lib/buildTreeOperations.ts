/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { OptionValues } from "commander";
import { resolveAbsoluteOPSPathOperations } from "./filePathResolver";
import { existsSync, readdirSync, statSync } from "fs";
import path, { dirname } from "path";
import { logDebugEvent } from "./log";
import colors from "colors";

import { consoleLog } from "../helpers/helperUI";
import {
	getCommandToRunOperation,
	getMessageNumberOfOperations,
} from "../helpers/helperOperations";

export const buildTreeOperations = (commanderOptions: OptionValues) => {
	const optionFilter: RegExp | null = commanderOptions.filter
		? new RegExp(commanderOptions.filter)
		: null;
	const optionDisplayFullPath = commanderOptions.displayFullPath;
	const optionNoColors = commanderOptions.nocolors;
	const optionDepth = commanderOptions.depth;
	const optionGenerateCommand = commanderOptions.generateCommand;

	const opsPath = resolveAbsoluteOPSPathOperations(
		commanderOptions.operationsPath
	);
	logDebugEvent(
		`buildTreeOperations - filter: ${optionFilter} - commanderOptions: ${JSON.stringify(
			commanderOptions,
			null,
			4
		)}`
	);
	logDebugEvent(`opsPath: ${opsPath}`);

	if (!existsSync(opsPath))
		throw new Error(`OPS directory: ${opsPath} doesn't exist`);
	if (!statSync(opsPath).isDirectory())
		throw new Error(`OPS path: ${opsPath} is not a directory`);

	/**
	 * Cases:
	 *
	 * optionDisplayFullPath - optionNoColors
	 * Display: Directory || file
	 */
	const displayLine = (isDirectory: boolean, dirPath: string, item: string) => {
		//Directory - never display full Path
		if (isDirectory) {
			const testManifestInside = `${dirPath}/${item}/manifest.yaml`;
			let displayCommandHelp = "";
			if (optionGenerateCommand && existsSync(testManifestInside)) {
				try {
					displayCommandHelp = `: ${getCommandToRunOperation(
						dirPath,
						item,
						commanderOptions.hostsList,
						commanderOptions.inventory
					)}`;
				} catch (error) {
					displayCommandHelp = ` ${colors.red((error as Error).toString())}`;
				}
			}
			if (optionNoColors) {
				return `${item}${displayCommandHelp}`;
			} else {
				return `${colors.green(item)}${colors.cyan(displayCommandHelp)}`;
			}
		}
		// -gc specified do not display files
		if (optionGenerateCommand) return;
		//File - default no full path
		let finalFile = `${dirname(item)}/${item}`;
		// if optionDisplayFullPath
		if (optionDisplayFullPath) finalFile = `${dirPath}/${item}`;

		// Display file with color | no color
		if (optionNoColors) {
			return finalFile;
		} else {
			return colors.cyan(finalFile);
		}
	};

	const displayTree = (
		dirPath: string,
		indent: string = "",
		tree: string[][]
	): string[][] => {
		const files = readdirSync(dirPath);

		files.forEach((file, index) => {
			let level = 1;
			const filePath = path.join(dirPath, file);

			const isLast = index === files.length - 1;
			const prefix = isLast ? "└── " : "├── ";

			const isDirectory = statSync(`${dirPath}/${file}`).isDirectory();
			const line = displayLine(isDirectory, dirPath, file);
			if (line) tree.push([`${dirPath}/${file}`, indent + prefix + line]);

			if (statSync(filePath).isDirectory()) {
				const newIndent = isLast ? indent + "    " : indent + "│   ";
				if (optionDepth && level >= optionDepth) {
					return;
				}
				displayTree(filePath, newIndent, tree);
				level++;
			}
		});
		return tree;
	};

	// Get the directory to display from the command-line arguments
	const directory = opsPath;

	if (existsSync(directory) && statSync(directory).isDirectory()) {
		consoleLog(`OPS directory: ${directory}`, "green");
		const tree = displayTree(directory, "", []);
		let displayOne = false;
		let countOperation = 0;
		for (const line of tree) {
			// Line doesn't match but is children match display to keep natural view of the tree
			if (optionFilter && !new RegExp(optionFilter).test(line[0])) {
				if (
					tree.filter(
						(item) =>
							new RegExp(line[0], "i").test(item[0]) &&
							new RegExp(optionFilter, "i").test(item[0])
					).length === 0
				)
					continue;
			}
			if (/manifest\.yaml/.test(line[1])) countOperation++;
			//Display line
			consoleLog(line[1]);
			displayOne = true;
		}

		if (!displayOne) {
			if (optionFilter) {
				consoleLog("`No operation matches filter", "red");
			} else {
				consoleLog("No operations found", "red");
			}
		}
		if (countOperation)
			consoleLog(
				getMessageNumberOfOperations(opsPath, countOperation),
				"green"
			);
		if (optionFilter) consoleLog(`[*] Filter: ${optionFilter}`, "green");
	} else {
		console.error(`Error: ${directory} is not a valid directory`);
	}
};
