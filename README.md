# Automation-cli

**Révision du code source** en cours de progression avant publication.

automation-cli est un outil d'automatisation open source, pour Linux Debian©.

Les tests unitaires et les tests d'intégration nécessitent la mise en place d'un contexte complet d'exécution (machines virtuelles, environnement Wireguard, environnement sudo...) **et ne sont pas fournis**.

Les PR devront par conséquent être très explicites, et mentionner les cas précis d'utilisations, afin que je puisse intégrer les tests nécessaires.

## Licence

[AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.en.html)

## Environnement de développement

NodeJs: v20.18.1
npm: v10.8.2

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

## Documentation utilisateur

[située ici](https://automation-doc.mytinydc.com/), traduction "EN" en cours.
