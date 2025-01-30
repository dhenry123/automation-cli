/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { Command } from "commander";
import { inventoryCreate } from "../inventory";
import { exitNodeJs } from "../system";

/**
 * To create an operationBook
 */
export const commandCreateInventory = (program: Command) => {
	program
		.command("cinv")
		.description("Create an inventory file from the internal template")
		.argument(
			"<inventoryFilePath>",
			"absolute: /, relative: ./ default extension is .yaml"
		)
		.option("-silent", "silent mode")
		.option("-age <string>", "Age public encryption key")
		.option("-mytinydc", "special inventory for MytinyDC project")
		.option(
			"-datacentername",
			"special inventory for MytinyDC project: Datacenter name"
		)
		.option(
			"-network",
			"special inventory for MytinyDC project: CIDR Datacenter network eg: 10.10.10.0/24"
		)
		.option(
			"-domain",
			"special inventory for MytinyDC project: Datacenter domain name"
		)
		.option(
			"-emailManager",
			"special inventory for MytinyDC project: Datacenter manager email user account eg: infogerance"
		)
		.option(
			"-proxy",
			"special inventory for MytinyDC project: internal proxy FQDN eg: http://hostname:port"
		)
		.action(async (_str, _optionValues) => {
			try {
				inventoryCreate(_str, _optionValues);
			} catch (error) {
				await exitNodeJs(1, (error as Error).toString());
			}
			await exitNodeJs();
		});
};
