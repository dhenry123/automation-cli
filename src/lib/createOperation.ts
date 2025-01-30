/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 11/08/24
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { resolveAbsolutePathOperationManifest } from "./filePathResolver";
import { consoleLog } from "../helpers/helperUI";
import { OptionValues } from "commander";
import { getManifestTemplate, getScriptTemplate } from "./getTemplates";

export const createOperation = (
	operationFullPath: string,
	commanderOptions: OptionValues
) => {
	if (!operationFullPath)
		throw new Error(`You have to provided a name to create a new operation`);
	const operationManifestFullPath = resolveAbsolutePathOperationManifest(
		operationFullPath.trim()
	);
	const operationPath = dirname(operationManifestFullPath);
	const operationScriptFullPath = `${operationPath}/run.sh`;
	// Try to create missing directory, user must be authorized to create files

	if (existsSync(operationManifestFullPath))
		throw new Error(
			`This operation manifest already exists: ${operationManifestFullPath}`
		);

	// resources are used to store templates binary etc... required to execute operation
	if (!existsSync(operationPath))
		mkdirSync(`${operationPath}/resources`, { recursive: true });

	writeFileSync(
		operationManifestFullPath,
		getManifestTemplate().replace(
			/#COMMENT#/,
			commanderOptions.comment
				? commanderOptions.comment
				: "What this operation is doing..."
		),
		"utf-8"
	);
	writeFileSync(operationScriptFullPath, getScriptTemplate(), "utf-8");

	consoleLog(
		`\nOperation has been created and saved in: ${operationPath}`,
		"green"
	);
	consoleLog(
		`  You could modify the manifest: ${operationManifestFullPath} (-edm)`
	);
	consoleLog(`  and the bash script : ${operationScriptFullPath} (-eds)`);
};
