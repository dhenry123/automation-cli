/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 12/01/24
 */

//CVE-2024-29415 - @todo replace this npm package
import ip from "ip";
import net from "node:net";
import type { DuplexStream } from "../lib/DuplexStream";
import { inventoryTryResolvKey } from "../lib/inventory";
import { logDebugEvent } from "../lib/log";
import { envSubst } from "../lib/system";
import type { ExecBuiltinOperationParameters } from "../lib/types";
import { emitDataOnStream } from "../lib/run/execOperation";
import { netWorkV4PrivateNetworksRanges } from "../lib/constants";

export const isCIdr = (e: string): boolean => {
	const split = e.trim().split("/");
	if (split.length === 2) {
		const mask = Number.parseInt(split[1]);
		if (mask >= 1 && mask <= 32) return true;
	}
	return false;
};

export const isPrivateNetwork = (cidr: string): boolean => {
	const range = ip.cidrSubnet(cidr);
	return netWorkV4PrivateNetworksRanges.some((privateRange) => {
		const privateSubnet = ip.cidrSubnet(privateRange);
		return (
			privateSubnet.contains(range.firstAddress) ||
			privateSubnet.contains(range.lastAddress)
		);
	});
};

export const isPrivateCidrNetwork = async (
	parameters: ExecBuiltinOperationParameters,
	stream: DuplexStream
) => {
	if (!parameters.values || parameters.values.length !== 1) {
		stream.emit(
			"close",
			new Error("At least one and only one value must be provided")
		);
		return;
	}
	if (typeof parameters.values[0] !== "string") {
		stream.emit("close", new Error("Values item must be string type"));
		return;
	}

	// Trying to resolve key with inventory value
	if (parameters.inventoryFile && parameters.values[0])
		parameters.values[0] = inventoryTryResolvKey(
			parameters.inventoryFile,
			parameters.values[0],
			stream
		);

	const privateCidrNetwork = envSubst(
		parameters.values[0] as string,
		parameters.environment
	);
	if (!isCIdr(privateCidrNetwork)) {
		stream.emit(
			"close",
			new Error(
				`This network is not in CIDR format: '${privateCidrNetwork}'. eg: 172.28.28.0/24`
			)
		);
		return;
	}
	if (!isPrivateNetwork(privateCidrNetwork)) {
		stream.emit(
			"close",
			new Error(
				`This network is not a private network. Range is: ${netWorkV4PrivateNetworksRanges.join(
					" or "
				)}`
			)
		);
		return;
	}
	emitDataOnStream(
		`[INFO] The network provided: ${privateCidrNetwork} is in CIDR format and private`,
		stream,
		false
	);
	stream.emit("close");
};

export const isCidrNetwork = async (
	parameters: ExecBuiltinOperationParameters,
	stream: DuplexStream
) => {
	if (!parameters.values || parameters.values.length !== 1) {
		stream.emit(
			"close",
			new Error("At least one and only one value must be provided")
		);
		return;
	}
	if (parameters.inventoryFile && parameters.values[0])
		parameters.values[0] = inventoryTryResolvKey(
			parameters.inventoryFile,
			parameters.values[0] as string,
			stream
		);
	const privateCidrNetwork = envSubst(
		parameters.values[0] as string,
		parameters.environment
	);
	if (!isCIdr(privateCidrNetwork)) {
		stream.emit(
			"close",
			new Error(
				`This network is not in CIDR format: '${privateCidrNetwork}'. eg: 172.28.28.0/24`
			)
		);
		return;
	}
	emitDataOnStream(
		`[INFO] This network provided: ${privateCidrNetwork} is in CIDR format`,
		stream,
		false
	);
	stream.emit("close");
};

export const checkConnection = (
	server: string,
	port: number,
	timeout: number
): Promise<Error | null> => {
	return new Promise((resolve, reject) => {
		const socket = new net.Socket();

		socket.setTimeout(timeout);

		socket.on("connect", () => {
			logDebugEvent("Connection to service: OK, sending hello");
			socket.write("hello", (error) => {
				if (error) {
					socket.emit("error", true); // difficult to test
				} else {
					//ok service accept message useless to wait for response
					socket.emit("data", "OK");
				}
			});
		});

		socket.on("data", (data) => {
			logDebugEvent(`Receiving data from service: ${data.toString()}`);
			resolve(null);
			socket.destroy();
		});

		socket.on("error", (error: Error) => {
			reject(error);
			socket.destroy();
		});

		socket.on("timeout", () => {
			reject(new Error(`Timeout reached: ${timeout}`)); // difficult to test
			socket.destroy();
		});

		socket.connect(port, server);
	});
};

export const controlNodeGetTcpFreePort = (): Promise<number> => {
	return new Promise((res) => {
		const srv = net.createServer();
		srv.listen(0, () => {
			let port = -1;
			if (srv?.address()) {
				const srvDefAddr = JSON.parse(JSON.stringify(srv.address()));
				if (srvDefAddr?.port) port = srvDefAddr.port;
			}
			srv.close(() => res(port));
		});
	});
};
