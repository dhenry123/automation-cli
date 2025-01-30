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
import readline from "node:readline";
import { exitNodeJs } from "./system";
import { messageProcessCanceledByUser } from "./constants";
import { basename, dirname } from "path";
import { Spinner } from "./spinner";

export const importOperation = (
	commanderOptions: OptionValues,
	rl: readline.Interface
) => {
	const opsPath = resolveAbsoluteOPSPathOperations(
		commanderOptions.operationsPath
	);

	const zipFileFullPath = commanderOptions.fileToImport || "";

	logDebugEvent(`opsPath: ${opsPath}`);
	logDebugEvent(`zipFileFullPath: ${zipFileFullPath}`);

	if (!existsSync(opsPath))
		throw new Error(`OPS directory: ${opsPath} doesn't exist`);
	if (!statSync(opsPath).isDirectory())
		throw new Error(`OPS path: ${opsPath} is not a directory`);

	if (!existsSync(zipFileFullPath))
		throw new Error(`Operation file to import not found: ${zipFileFullPath}`);

	const zip = new AdmZip(zipFileFullPath);

	//Analyzing content
	const dirsRoot: string[] = [];
	const manifests: string[] = [];
	for (const zipEntry of zip.getEntries()) {
		const dirName = dirname(zipEntry.entryName).split("/")[0];
		if (!dirsRoot.includes(dirName)) dirsRoot.push(dirName);
		if (basename(zipEntry.entryName) === "manifest.yaml")
			manifests.push(zipEntry.entryName);
	}

	if (dirsRoot.length !== 1) {
		throw new Error(
			`This archive contains more than one root directory, can not continue`
		);
	}

	const finalDestination = `${opsPath}/${dirsRoot[0]}`;

	let finalDestinationExists = false;
	if (existsSync(finalDestination)) {
		finalDestinationExists = true;
		if (!commanderOptions.force)
			throw new Error(
				`Impossible to continue, directory: "${finalDestination}" already exists, you could retry using --force to overwrite the destination`
			);
	}

	consoleLog(`\nImport operation\n`, "bgGreen");
	consoleLog(`Operation file to import: ${zipFileFullPath}`, "cyan");
	consoleLog(`OPS directory: ${opsPath}`, "cyan");
	consoleLog(
		`Number of operations included in this archive: ${manifests.length}`,
		"cyan"
	);
	consoleLog("Compliant content [OK]", "green");

	consoleLog("\nZip archive content:");
	for (const zipEntry of zip.getEntries()) {
		consoleLog(`- ${zipEntry.entryName}`, "red");
	}

	consoleLog(
		"\nWARNING: Before running an imported operation, You need to check the content",
		"bgRed"
	);

	if (finalDestinationExists)
		consoleLog(
			"The final destination already exists, --force has been provided by the user, the final destination will be overwritten.",
			"red"
		);

	rl.question(
		`Are you sure to import this operation ? (Yes/[N]) `,
		(userResponse) => {
			if (userResponse !== "Yes") {
				exitNodeJs(0, messageProcessCanceledByUser);
			}
			const spinner = new Spinner(`Extracting archive to ${opsPath}`);
			zip.extractAllTo(opsPath, !!commanderOptions.force, true);
			spinner.stop();
			if (existsSync(finalDestination)) {
				exitNodeJs(0, `\nOperation has been imported in ${opsPath}`);
			} else {
				throw new Error(
					`impossible to locate final destination: ${finalDestination}`
				);
			}
		}
	);
};
