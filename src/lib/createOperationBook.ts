/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 11/08/24
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { resolveAbsolutePathOperationBookManifest } from "./filePathResolver";
import { consoleLog } from "../helpers/helperUI";
import { getManifestBookTemplate } from "./getTemplates";

export const createOperationBook = (userOperationBook: string) => {
	userOperationBook = userOperationBook.trim();
	if (!userOperationBook)
		throw new Error(
			`You have to provided a name to create a new operationBook`
		);
	const operationBookFinalPath =
		resolveAbsolutePathOperationBookManifest(userOperationBook);

	if (existsSync(operationBookFinalPath))
		throw new Error(
			`This operationBook already exists: ${operationBookFinalPath}`
		);
	const dirOperation = dirname(operationBookFinalPath);

	// Try to create missing directory, user must be authorized to create files
	if (!existsSync(dirOperation)) mkdirSync(dirOperation, { recursive: true });

	writeFileSync(operationBookFinalPath, getManifestBookTemplate(), "utf-8");

	consoleLog(
		`\nOperationBook has been created and saved in: ${operationBookFinalPath}`,
		"green"
	);
};
