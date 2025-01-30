# Automation-cli

automation-cli is an open source automation tool for Linux Debian©.

Unit tests and integration tests require a complete execution context (virtual machines, Wireguard environment, sudo environment...) **and are not provided**.

The PRs will therefore have to be very explicit, and mention the precise use cases, so that I can integrate the necessary tests.

## License

[AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.en.html)

## Development environment

NodeJs: v20.18.2
npm: v10.9.0

### Installation

```bash
cd ~
mkdir -p ~/git
git clone https://github.com/dhenry123/automation-cli.git
cd automation-cli
npm install
npm run dev
```

### Test

```bash
node dist/automation-cli.js run -h localhost -c "ls ~"
```

## User documentation

[Here](https://automation-doc.mytinydc.com/).
