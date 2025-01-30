/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { SecurityAuditResult } from "../types";
import { existsSync } from "fs";
import { inventoryGetContent } from "../inventory";
import { getNestedValue } from "../system";

export const securityAuditInventoryFiles = (
	file: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	commanderOptions: any
): SecurityAuditResult | null => {
	const warnings: string[] = [];
	const objectType = "inventoryFile";

	if (existsSync(file)) {
		const content = inventoryGetContent(file);
		if (
			content.contentEncrypted &&
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			!getNestedValue(content.contentEncrypted as any, "sops")
		)
			warnings.push(`inventory file: ${file} seems not to be encrypted`);
	}
	if (
		!commanderOptions.failed ||
		(commanderOptions.failed && warnings.length)
	) {
		return {
			type: objectType,
			path: file,
			warning: warnings,
		};
	}
	return null;
};
