/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { getProcessEnvValue } from "./system";
import { getOperationsPath } from "./filePathResolver";
import {
	extractOperationNameFromFullOperationDirectory,
	getOperationsManifestPathList,
} from "../helpers/helperOperations";
import { getOperationManifestFileContent } from "./manifests";
import { dirname } from "path";
import { reportDependenciesList } from "./reports";
import { ReportOperationDependenciesLine } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const dependenciesList = (commanderOptions: any) => {
	const OPSDirectory = getProcessEnvValue("OPS");
	if (!OPSDirectory || !OPSDirectory.trim())
		throw new Error(`"${OPSDirectory}" is not OPSDirectory`);
	const operationsPath = getOperationsPath(OPSDirectory);
	const manifestsList = getOperationsManifestPathList(operationsPath);
	let filter: RegExp | null = null;

	if (commanderOptions.filter) {
		filter = new RegExp(commanderOptions.filter, "i");
	}
	const operations: ReportOperationDependenciesLine[] = [];
	const operationsNoDependencies: ReportOperationDependenciesLine[] = [];
	for (const manifest of manifestsList) {
		const content = getOperationManifestFileContent(manifest, false);
		const operationName = extractOperationNameFromFullOperationDirectory(
			dirname(manifest)
		);
		if (content && content.dependencies && content.dependencies.length) {
			const line = `${operationName} ${content.dependencies.join(",")}`;
			if (!filter || (filter && filter.test(line)))
				operations.push({
					manifest: manifest,
					operationName,
					dependencies: content.dependencies,
				});
		} else {
			if (!filter || (filter && filter.test(operationName)))
				operationsNoDependencies.push({
					manifest: manifest,
					operationName,
					dependencies: [],
				});
		}
	}
	let operationToDisplay: ReportOperationDependenciesLine[] = operations;
	if (commanderOptions.Nodep) operationToDisplay = operationsNoDependencies;

	reportDependenciesList(
		OPSDirectory,
		operationToDisplay,
		commanderOptions.filter,
		commanderOptions.Nodep,
		commanderOptions.Json
	);
};
