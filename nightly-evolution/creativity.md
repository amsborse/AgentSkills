# Creative features and product intelligence

Find capabilities users would value that the product is missing, grounded in what the product
already is. Creativity here means a sharp, small, product-specific idea, not a generic feature.

## Inputs

- The product's purpose and users (README, AGENTS.md, roadmap/future-scope docs, the policy's
  `focus` goals).
- What the data already supports but the UI does not expose.
- Repeated manual steps visible in issues, handoff notes, logs or runbooks.
- Failure and review queues: what do humans keep fixing by hand?

## Questions

1. What does the user do next after the main flow, and does the product help?
2. Which signal is collected but never shown (trends, freshness, confidence, why-this-result)?
3. Which repeated manual action could existing deterministic code safely automate?
4. Where would one sentence of explanation remove confusion?
5. What does a power user want: keyboard paths, bulk actions, saved views, export?
6. What capability do comparable products have that users here demonstrably miss?

## Shipping one overnight

- Smallest slice that stands alone, behind existing structure and design language.
- Off by default or clearly additive; no change to existing behaviour or data.
- Tests for the new behaviour plus screenshots if visible. Accept with `--evidence` naming them.
- Anything bigger: record it as an opportunity with a concrete first step.

```sh
$EVOLVE memory add --kind opportunity --dimension product_intelligence \
  --title "<capability>" --reason "<evidence it is wanted + proposed first slice>"
```

Never ship features that send messages, emails or notifications, spend money, contact third
parties, or act on a user's behalf. Those need an owner decision.
