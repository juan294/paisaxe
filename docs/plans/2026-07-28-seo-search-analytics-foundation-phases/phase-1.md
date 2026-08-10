# Phase 1: External Property Creation and Isolation

## Goal

Create Paisaxe-only external assets and capture the identifiers required by later
repository work.

## Authorization Gate

This phase changes external service and DNS state. Before the first mutation,
present the exact targets and obtain current-conversation authorization for:

- creating the GA account/property/stream;
- creating the Search Console domain property;
- adding the required `paisaxe.es` DNS TXT verification record;
- importing/adding the Bing site; and
- creating the Clarity project.

## Steps

1. Read-only inventory:
   - list GA accounts/properties;
   - list Search Console properties;
   - list Bing sites;
   - list Clarity projects;
   - resolve the authoritative DNS provider for `paisaxe.es`;
   - record existing identifiers without secrets.
2. Create GA:
   - account `Paisaxe`;
   - property `Paisaxe - Production`;
   - reporting timezone `Europe/Madrid`;
   - currency `EUR`;
   - industry `Travel`;
   - web stream name `paisaxe.es`;
   - stream URL `https://paisaxe.es`.
3. Create Search Console Domain property `paisaxe.es`.
4. Add only the returned Google verification TXT record to `paisaxe.es`, then
   verify ownership.
5. Add Bing site by importing the verified Search Console property when supported;
   otherwise add `https://paisaxe.es` and use the least invasive supported
   verification path.
6. Create Clarity project `Paisaxe` for `https://paisaxe.es`, set industry to
   Travel, enable Consent Mode, and set masking to Strict before installing code.
7. Record non-secret IDs in a task-owned handoff:
   - GA account ID;
   - GA property ID;
   - GA measurement ID;
   - Search Console property identifier;
   - Bing site URL;
   - Clarity project ID.
8. Re-list all four services and confirm no other project changed.

## Pseudocode

```text
before = inventory(all services)
assert before has no Paisaxe asset
authorize(exact mutation set)

ga = create_ga_account_property_stream(Paisaxe)
gsc = create_domain_property(paisaxe.es)
dns = add_exact_txt(gsc.verification_record)
verify(gsc, dns)
bing = import_or_add_only(gsc, paisaxe.es)
clarity = create_project(Paisaxe, paisaxe.es)
configure(clarity, masking=Strict, consent_mode=enabled)

after = inventory(all services)
assert after - before == expected Paisaxe assets
```

## Automated Success Criteria

- CLI/API readback returns the new GA account, property, and stream IDs.
- DNS lookup returns the exact Google TXT record.
- Search Console reports verified ownership for `sc-domain:paisaxe.es`.
- Bing returns exactly one Paisaxe site.
- Clarity returns exactly one Paisaxe project with the recorded ID.

## Manual Success Criteria

- Property selectors show Paisaxe with the intended names and URLs.
- No selector shows a renamed, removed, or edited non-Paisaxe asset.
- Clarity visibly reports Strict masking and Consent Mode before tag installation.

## Stop Gate

Stop and present the service inventory and IDs. Do not add repository code or
environment variables in this phase.
