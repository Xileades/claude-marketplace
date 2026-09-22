# Xileades Claude marketplace

Open Claude plugins for **French business APIs**, built while automating a real
multi-company group: four legal entities, one accountant, no patience for
surprises. Each plugin ships a PowerShell library, Claude skills, runnable
examples, and a `docs/PITFALLS.md` where every entry comes from a mistake paid
for in production.

> **🇫🇷 En français** — Plugins Claude ouverts pour des API françaises (Qonto,
> PayFit, Pennylane), écrits en automatisant un vrai groupe de quatre sociétés.
> Le code et la documentation sont en anglais ; les termes comptables français
> (lettrage, avoir, exercice, FEC) sont conservés là où ils comptent.

Not affiliated with Qonto, PayFit or Pennylane.

## Plugins

| Plugin | What it covers | Repository |
|---|---|---|
| **Qonto API Toolkit** | Multi-company balances, transactions, statements. Read-only. | [`qonto-api-toolkit`](https://github.com/Xileades/qonto-api-toolkit) |
| **PayFit API Toolkit** | Companies, collaborators, absences, contracts — with payroll safety rules. | [`payfit-api-toolkit`](https://github.com/Xileades/payfit-api-toolkit) |
| **Pennylane API Toolkit** | Access layer, supplier and customer invoices, reconciliation, FEC and ledger exports, analysis. | [`pennylane-api-toolkit`](https://github.com/Xileades/pennylane-api-toolkit) |

## Install

```
/plugin marketplace add Xileades/claude-marketplace
/plugin install pennylane-api-toolkit@xileades
```

Then, in the plugin manager: **Discover** to browse, **Installed** to manage.

## Update

```
/plugin marketplace update xileades
/plugin install pennylane-api-toolkit@xileades
```

Each plugin carries its own `version` in its repository's
`.claude-plugin/plugin.json`, and that file is the authority. This marketplace
deliberately does **not** repeat those version numbers: a version pinned in two
places diverges at the first bump, silently, and the marketplace copy would win
over the truth.

## Credentials

No API key ever lives in these repositories. Each plugin reads a local
`tokens.json` that you create from the `config/tokens.example.json` shipped with
it — see the plugin's own README. Nothing is written to a vendor account by
default; the Qonto toolkit is read-only by design.

## Contributing

Issues and pull requests go to the individual plugin repositories, not here.
This repository only holds the catalogue.

If you change the catalogue itself:

```
node scripts/valider.mjs            # manifest shape
node scripts/valider.mjs --remote   # also checks every source repository answers
```

The same validator runs in CI on every push. `scripts/valider.mjs` is shared
with the private Xileades internal marketplace — fix it in one place, report it
to the other.

## Licence

MIT, like the plugins it lists. See [LICENSE](LICENSE).
