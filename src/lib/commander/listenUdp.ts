/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { Command } from "commander";
import dgram from "dgram";
import { consoleErr, consoleLog } from "../../helpers/helperUI";
import { defaultIPortDiscoverInfra } from "../constants";
import { inventoryUpdateFromListening } from "../inventory";
import { Spinner } from "../spinner";
import { exitNodeJs } from "../system";
import { resolveInventoryFilePath } from "../filePathResolver";

/**
 * To discover infra server on local network
 */
export const commandListen = (program: Command) => {
	program
		.command("listen")
		.description(
			"Detect the presence of servers on the local network equipped with the presence module."
		)
		.option("-p, --port <integer>", "Listening on port number")
		.option(
			"-i, --inventory-file <string>",
			"Absolute or relative path of the inventory yaml file, updates the IP address of servers included in the inventory file."
		)
		.option(
			"-timeout <number>",
			"use only when -i is provided. Timeout, in seconds, before stopping listening (default is 30)"
		)
		.option(
			"-f, --force <string>",
			"when inventory is provided, forces addition of specified host to inventory"
		)
		.option("-h, --hostname <string>, Wait only for hostname specified")
		.action(async (_str, options) => {
			const messageToStop = "CTRL+C to stop the listening process";
			const spinner = new Spinner(
				`The listening process starts - ${messageToStop}`
			);
			const maxListeningTime: number = options._optionValues.Timeout || 30; // seconds
			spinner.spin(process.stdout.rows);
			// Define the port to listen on
			const listenPort =
				options._optionValues.port || defaultIPortDiscoverInfra;
			// Create a UDP socket
			const server = dgram.createSocket("udp4");

			const allReadyDiscovered: string[] = [];
			const startProcess = new Date().valueOf() / 1000;
			if (
				options._optionValues.inventoryFile &&
				!options._optionValues.hostname
			)
				consoleLog(
					`This process will listen to the network for: ${maxListeningTime} sec`
				);

			// inventoryFile path resolution
			const inventoryFile = resolveInventoryFilePath(
				options._optionValues.inventoryFile
			);

			let semaphore = 0;
			server.on("listening", () => {
				const address = server.address();
				spinner.setText(
					`Waiting for network information from server${
						options._optionValues.hostname
							? `: ${options._optionValues.hostname}`
							: ""
					} (listening on: ${address.address}:${address.port})`
				);
			});

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			server.on("message", (message: string, remote: any) => {
				try {
					const networkInfos = JSON.parse(message.toString());
					if (networkInfos.hostname) {
						if (
							!options._optionValues.hostname ||
							(options._optionValues.hostname &&
								options._optionValues.hostname.trim() ===
									networkInfos.hostname.trim())
						) {
							// Do not repeat if already discovered - IP address no hostname
							if (allReadyDiscovered.includes(remote.address)) return;
							allReadyDiscovered.push(remote.address);
							if (!options._optionValues.inventoryFile)
								consoleLog(
									`The server (real hostname: "${networkInfos.hostname}") has the ip address: "${remote.address}"`,
									"green"
								);
							// Try to update inventory
							if (options._optionValues.inventoryFile) {
								semaphore = 1;
								inventoryUpdateFromListening(
									inventoryFile,
									remote.address,
									networkInfos.hostname,
									options._optionValues.force
								);
								semaphore = 0;
							}
							spinner.setText(messageToStop);
							if (options._optionValues.hostname && !options.inventoryFile)
								exitNodeJs(0);
						}
					}
				} catch (error) {
					spinner.stop();
					exitNodeJs(1, `Unexpected Error: ${(error as Error).toString()}`);
				}
			});

			setInterval(() => {
				// if -h provided exit
				const currentTime = new Date().valueOf() / 1000;
				// DO NOT EXIT if semaphore is 1 - writing in progress
				if (
					!semaphore &&
					!options._optionValues.hostname &&
					options._optionValues.inventoryFile &&
					currentTime - startProcess > maxListeningTime
				) {
					consoleErr(`Timeout reached: ${maxListeningTime} sec, exiting`);
					exitNodeJs(0);
				}
			}, 1000);
			// Bind the socket to the specified port and address
			server.bind(listenPort);
		});
};
