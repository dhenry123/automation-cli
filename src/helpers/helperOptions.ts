/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 10/30/24
 */

import { OptionValues } from "commander";

/**
 * User want to edit something
 */
export const isCommanderOptionsIncludeEdit = (
	commanderOptions: OptionValues
) => {
	return !!(commanderOptions.Eds || commanderOptions.Edm);
};
