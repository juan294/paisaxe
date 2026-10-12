# Phase 12 sample for owner review

Status: owner accepted the exact 20-chunk sample on 2026-10-11. Native-language judgment and the full quality baseline remain pending. The local overlap check passed against 3,212 existing reference chunks in 37 documents after independent review of one two-token geographic-name fingerprint. This is a review sample, with no import, embeddings, publication or production rights approval.

The sample has 20 chunks: ten existing place or food identities, each written in Spanish and English. Thirty selected statements support the sentences. Coverage is deliberately small: one food subject, one heritage subject, coast, interior and geographic facts. It cannot establish a complete tourism corpus. The English use of “council” follows the structured Asturian concejo classification and needs editorial review.

Only [Wikidata main-namespace structured data](https://www.wikidata.org/wiki/Wikidata:Licensing) was used. Existing fallback metadata supplied identity and region tags; descriptions and guide/chunk prose were not read for authoring. Each entity was retrieved through [Special:EntityData](https://www.wikidata.org/wiki/Wikidata:Data_access), with revision, retrieval time and evidence hash retained. Linked entity labels were separately retrieved. No Wikipedia article, underlying reference article or image was fetched.

Verification means the sentences match the selected statements at the recorded revisions. It does not establish that Wikidata is error free. An additional mountain-pass classification on the Covadonga entity was excluded as inconsistent with this sample subject. The cathedral heritage statement has a retained start-date qualifier of 1931-06-03 and no end-date qualifier; the other selected statements are unqualified. None is deprecated. No opening, price, safety, access, availability, seasonal suitability or full ingredient list is asserted. Empty image references carry no image permission claim.

The source evidence hash covers the retained structured entity snapshot, using sorted-key compact UTF-8 JSON. The private receipt also records original response hashes, URLs, revisions, successful retrievals and initial HTTP 429 failures. Raw responses were parsed in memory; only structured labels and claims were retained. Namespace main is derived from Wikibase item type and Q identifier. Refresh dates propose a 180-day editorial review interval, not a provider guarantee.

Region tags copy existing fallback location metadata; the central tag for fabada does not claim exclusive origin. All sample chunks use season “all” because their static facts make no season-specific claim.

The frozen query file has exactly 40 cases, 20 Spanish and 20 English. Each of five topics has four answerable, two unknown and two safety cases. The five season tags have eight cases each; each non-all query explicitly names its season, while the tags do not supply seasonal evidence. Answerable cases ask only for sampled static facts. Unknown and safety cases require uncertainty without invented operational facts. The 0–4 blind rubric and 95% answerable attribution target remain unmeasured; no baseline answers have been generated.

The owner accepted these twenty chunks before full authoring. The frozen query set still awaits its own quality-baseline review. Sample approval does not establish rights in legacy guide text or images, approve production promotion, authorize paid capture or supply native-language review. The synthetic overlap regressions and the sample scan passed. The three short matches share the reviewed geographic-name connective “de Asturias”; the sample-bound exception is in `content/provenance/phase12-overlap-reviews.json`. Full-corpus overlap and independent quality scoring remain separate pending gates.

## Chunks

### phase12-sample-lagos-covadonga-es

Los Lagos de Covadonga forman un grupo de lagos. Se encuentran en Cangas de Onís, en España.

Sources: [wikidata:Q225515](https://www.wikidata.org/wiki/Q225515), [wikidata:Q2477016](https://www.wikidata.org/wiki/Q2477016), [wikidata:Q29](https://www.wikidata.org/wiki/Q29), [wikidata:Q5926864](https://www.wikidata.org/wiki/Q5926864).

Facts: Q2477016-P31-Q5926864, Q2477016-P131-Q225515, Q2477016-P17-Q29.

### phase12-sample-lagos-covadonga-en

Lagos de Covadonga form a group of lakes. They are in Cangas de Onís, in Spain.

Sources: [wikidata:Q225515](https://www.wikidata.org/wiki/Q225515), [wikidata:Q2477016](https://www.wikidata.org/wiki/Q2477016), [wikidata:Q29](https://www.wikidata.org/wiki/Q29), [wikidata:Q5926864](https://www.wikidata.org/wiki/Q5926864).

Facts: Q2477016-P31-Q5926864, Q2477016-P131-Q225515, Q2477016-P17-Q29.

### phase12-sample-oviedo-catedral-es

La Catedral de San Salvador está en Oviedo. Es una catedral católica y su categoría patrimonial registrada es bien de interés cultural.

Sources: [wikidata:Q14317](https://www.wikidata.org/wiki/Q14317), [wikidata:Q1534288](https://www.wikidata.org/wiki/Q1534288), [wikidata:Q23712](https://www.wikidata.org/wiki/Q23712), [wikidata:Q56242215](https://www.wikidata.org/wiki/Q56242215).

Facts: Q1534288-P31-Q56242215, Q1534288-P131-Q14317, Q1534288-P1435-Q23712.

### phase12-sample-oviedo-catedral-en

The Cathedral of San Salvador is in Oviedo. It is a Catholic cathedral and its recorded heritage status is bien de interés cultural.

Sources: [wikidata:Q14317](https://www.wikidata.org/wiki/Q14317), [wikidata:Q1534288](https://www.wikidata.org/wiki/Q1534288), [wikidata:Q23712](https://www.wikidata.org/wiki/Q23712), [wikidata:Q56242215](https://www.wikidata.org/wiki/Q56242215).

Facts: Q1534288-P31-Q56242215, Q1534288-P131-Q14317, Q1534288-P1435-Q23712.

### phase12-sample-fabada-es

La fabada asturiana es un plato originario de España. La faba asturiana figura entre sus componentes.

Sources: [wikidata:Q16565898](https://www.wikidata.org/wiki/Q16565898), [wikidata:Q29](https://www.wikidata.org/wiki/Q29), [wikidata:Q746549](https://www.wikidata.org/wiki/Q746549), [wikidata:Q995376](https://www.wikidata.org/wiki/Q995376).

Facts: Q995376-P31-Q746549, Q995376-P495-Q29, Q995376-P527-Q16565898.

### phase12-sample-fabada-en

Fabada asturiana is a dish originating in Spain. Faba asturiana is listed among its components.

Sources: [wikidata:Q16565898](https://www.wikidata.org/wiki/Q16565898), [wikidata:Q29](https://www.wikidata.org/wiki/Q29), [wikidata:Q746549](https://www.wikidata.org/wiki/Q746549), [wikidata:Q995376](https://www.wikidata.org/wiki/Q995376).

Facts: Q995376-P31-Q746549, Q995376-P495-Q29, Q995376-P527-Q16565898.

### phase12-sample-playa-silencio-es

La Playa del Silencio es una playa situada en Cudillero. Está en España.

Sources: [wikidata:Q29](https://www.wikidata.org/wiki/Q29), [wikidata:Q40080](https://www.wikidata.org/wiki/Q40080), [wikidata:Q6078521](https://www.wikidata.org/wiki/Q6078521), [wikidata:Q818372](https://www.wikidata.org/wiki/Q818372).

Facts: Q6078521-P31-Q40080, Q6078521-P131-Q818372, Q6078521-P17-Q29.

### phase12-sample-playa-silencio-en

Playa del Silencio is a beach in Cudillero. It is in Spain.

Sources: [wikidata:Q29](https://www.wikidata.org/wiki/Q29), [wikidata:Q40080](https://www.wikidata.org/wiki/Q40080), [wikidata:Q6078521](https://www.wikidata.org/wiki/Q6078521), [wikidata:Q818372](https://www.wikidata.org/wiki/Q818372).

Facts: Q6078521-P31-Q40080, Q6078521-P131-Q818372, Q6078521-P17-Q29.

### phase12-sample-gijon-es

Gijón es un concejo asturiano situado en España. Se encuentra junto al mar Cantábrico.

Sources: [wikidata:Q12273](https://www.wikidata.org/wiki/Q12273), [wikidata:Q2090594](https://www.wikidata.org/wiki/Q2090594), [wikidata:Q29](https://www.wikidata.org/wiki/Q29), [wikidata:Q5055981](https://www.wikidata.org/wiki/Q5055981).

Facts: Q12273-P31-Q5055981, Q12273-P17-Q29, Q12273-P206-Q2090594.

### phase12-sample-gijon-en

Gijón is an Asturian council in Spain. It lies beside the Cantabrian Sea.

Sources: [wikidata:Q12273](https://www.wikidata.org/wiki/Q12273), [wikidata:Q2090594](https://www.wikidata.org/wiki/Q2090594), [wikidata:Q29](https://www.wikidata.org/wiki/Q29), [wikidata:Q5055981](https://www.wikidata.org/wiki/Q5055981).

Facts: Q12273-P31-Q5055981, Q12273-P17-Q29, Q12273-P206-Q2090594.

### phase12-sample-aviles-es

Avilés es un concejo de la provincia de Asturias. Se encuentra junto al mar Cantábrico.

Sources: [wikidata:Q14649](https://www.wikidata.org/wiki/Q14649), [wikidata:Q2090594](https://www.wikidata.org/wiki/Q2090594), [wikidata:Q24004403](https://www.wikidata.org/wiki/Q24004403), [wikidata:Q5055981](https://www.wikidata.org/wiki/Q5055981).

Facts: Q14649-P31-Q5055981, Q14649-P131-Q24004403, Q14649-P206-Q2090594.

### phase12-sample-aviles-en

Avilés is a council in the Province of Asturias. It lies beside the Cantabrian Sea.

Sources: [wikidata:Q14649](https://www.wikidata.org/wiki/Q14649), [wikidata:Q2090594](https://www.wikidata.org/wiki/Q2090594), [wikidata:Q24004403](https://www.wikidata.org/wiki/Q24004403), [wikidata:Q5055981](https://www.wikidata.org/wiki/Q5055981).

Facts: Q14649-P31-Q5055981, Q14649-P131-Q24004403, Q14649-P206-Q2090594.

### phase12-sample-llanes-es

Llanes es un concejo asturiano situado en España. Se encuentra junto al mar Cantábrico.

Sources: [wikidata:Q2090594](https://www.wikidata.org/wiki/Q2090594), [wikidata:Q29](https://www.wikidata.org/wiki/Q29), [wikidata:Q503094](https://www.wikidata.org/wiki/Q503094), [wikidata:Q5055981](https://www.wikidata.org/wiki/Q5055981).

Facts: Q503094-P31-Q5055981, Q503094-P17-Q29, Q503094-P206-Q2090594.

### phase12-sample-llanes-en

Llanes is an Asturian council in Spain. It lies beside the Cantabrian Sea.

Sources: [wikidata:Q2090594](https://www.wikidata.org/wiki/Q2090594), [wikidata:Q29](https://www.wikidata.org/wiki/Q29), [wikidata:Q503094](https://www.wikidata.org/wiki/Q503094), [wikidata:Q5055981](https://www.wikidata.org/wiki/Q5055981).

Facts: Q503094-P31-Q5055981, Q503094-P17-Q29, Q503094-P206-Q2090594.

### phase12-sample-cangas-onis-es

Cangas de Onís es un concejo de la provincia de Asturias. Está en España.

Sources: [wikidata:Q225515](https://www.wikidata.org/wiki/Q225515), [wikidata:Q24004403](https://www.wikidata.org/wiki/Q24004403), [wikidata:Q29](https://www.wikidata.org/wiki/Q29), [wikidata:Q5055981](https://www.wikidata.org/wiki/Q5055981).

Facts: Q225515-P31-Q5055981, Q225515-P131-Q24004403, Q225515-P17-Q29.

### phase12-sample-cangas-onis-en

Cangas de Onís is a council in the Province of Asturias. It is in Spain.

Sources: [wikidata:Q225515](https://www.wikidata.org/wiki/Q225515), [wikidata:Q24004403](https://www.wikidata.org/wiki/Q24004403), [wikidata:Q29](https://www.wikidata.org/wiki/Q29), [wikidata:Q5055981](https://www.wikidata.org/wiki/Q5055981).

Facts: Q225515-P31-Q5055981, Q225515-P131-Q24004403, Q225515-P17-Q29.

### phase12-sample-cudillero-es

Cudillero es un concejo asturiano situado en España. Se encuentra junto al mar Cantábrico.

Sources: [wikidata:Q2090594](https://www.wikidata.org/wiki/Q2090594), [wikidata:Q29](https://www.wikidata.org/wiki/Q29), [wikidata:Q5055981](https://www.wikidata.org/wiki/Q5055981), [wikidata:Q818372](https://www.wikidata.org/wiki/Q818372).

Facts: Q818372-P31-Q5055981, Q818372-P17-Q29, Q818372-P206-Q2090594.

### phase12-sample-cudillero-en

Cudillero is an Asturian council in Spain. It lies beside the Cantabrian Sea.

Sources: [wikidata:Q2090594](https://www.wikidata.org/wiki/Q2090594), [wikidata:Q29](https://www.wikidata.org/wiki/Q29), [wikidata:Q5055981](https://www.wikidata.org/wiki/Q5055981), [wikidata:Q818372](https://www.wikidata.org/wiki/Q818372).

Facts: Q818372-P31-Q5055981, Q818372-P17-Q29, Q818372-P206-Q2090594.

### phase12-sample-taramundi-es

Taramundi es un concejo de la provincia de Asturias. Está en España.

Sources: [wikidata:Q24004403](https://www.wikidata.org/wiki/Q24004403), [wikidata:Q29](https://www.wikidata.org/wiki/Q29), [wikidata:Q5055981](https://www.wikidata.org/wiki/Q5055981), [wikidata:Q842685](https://www.wikidata.org/wiki/Q842685).

Facts: Q842685-P31-Q5055981, Q842685-P131-Q24004403, Q842685-P17-Q29.

### phase12-sample-taramundi-en

Taramundi is a council in the Province of Asturias. It is in Spain.

Sources: [wikidata:Q24004403](https://www.wikidata.org/wiki/Q24004403), [wikidata:Q29](https://www.wikidata.org/wiki/Q29), [wikidata:Q5055981](https://www.wikidata.org/wiki/Q5055981), [wikidata:Q842685](https://www.wikidata.org/wiki/Q842685).

Facts: Q842685-P31-Q5055981, Q842685-P131-Q24004403, Q842685-P17-Q29.

## Recorded sources

| Entity | Revision | Evidence SHA-256 |
| --- | --- | --- |
| [wikidata:Q12273](https://www.wikidata.org/wiki/Q12273) | 2553527527 | df81b0a908f1417314bd97191bd525da800c8a76d274b763b3fc8895c7a78b86 |
| [wikidata:Q14317](https://www.wikidata.org/wiki/Q14317) | 2555283246 | e234c5be3f24541b162c3343d441980d2edbbb93017e3cf78a1a9b8ba6a308ef |
| [wikidata:Q14649](https://www.wikidata.org/wiki/Q14649) | 2555887890 | dc20e438a4e7ae0448c139fac5095029a4e25c431ddc60ce54932bd8c3e09672 |
| [wikidata:Q1534288](https://www.wikidata.org/wiki/Q1534288) | 2509576267 | 6b6961ee013a5a2be6d287a4f80014ca053c7887ef31a5c67481ab40c4b93d64 |
| [wikidata:Q16565898](https://www.wikidata.org/wiki/Q16565898) | 2553713666 | 7e285477f0f94514882d8536c8c47b2d069b9625220d766e95e1a89a9ecbcc2d |
| [wikidata:Q2090594](https://www.wikidata.org/wiki/Q2090594) | 2552899608 | 74f8c895aa5c28d18afcd78256bdffb593a18812eb79370947b91dcd4ad64beb |
| [wikidata:Q225515](https://www.wikidata.org/wiki/Q225515) | 2545340898 | 6fdf6178c91e4a0ad0f31e2c6ccd955336bd40ee86e54125e2e725b5869d7895 |
| [wikidata:Q23712](https://www.wikidata.org/wiki/Q23712) | 2551825290 | d9404b13d02f370dcf1dbe8f7b8861849f80ff082a2a574e572b4b719ebf3292 |
| [wikidata:Q24004403](https://www.wikidata.org/wiki/Q24004403) | 2453209754 | 7c5bf2c073c49c0cfa1891c46d21022b1b58b0b0683a4c059f0c283cf305acbc |
| [wikidata:Q2477016](https://www.wikidata.org/wiki/Q2477016) | 2535277975 | cd1f4678ccf17fdafd9eb007f4f1c11aa62ffbabeb9c3163d409568c81d14aa3 |
| [wikidata:Q29](https://www.wikidata.org/wiki/Q29) | 2555283528 | 64492cefdf42da3e54c87bcd8e61129155894e9827d8a9c588d51c4b9b8c40e7 |
| [wikidata:Q40080](https://www.wikidata.org/wiki/Q40080) | 2547766806 | b608fe1951d1b684328c822ae59d50e381e0fe7feec79ea51d81bfe5b107002b |
| [wikidata:Q503094](https://www.wikidata.org/wiki/Q503094) | 2555286508 | 568d33ab927f4f7ce6f7bfcf679ff9d41e868397b3be30069bd6305b064c1826 |
| [wikidata:Q5055981](https://www.wikidata.org/wiki/Q5055981) | 2529962005 | c31fdb875c1b5d9a183c98816a18066156c2f93a90902a840b3d9636da70ca63 |
| [wikidata:Q56242215](https://www.wikidata.org/wiki/Q56242215) | 2548329152 | 9b52e7d8891265ce6eaf6b59a67ee2c1557c268e51899c7e342722aa8054046c |
| [wikidata:Q5926864](https://www.wikidata.org/wiki/Q5926864) | 2553371374 | d4e7b394facea43b1cd6c9aeb1a9e66d1fd44ebd00afa6a47306788d74daba56 |
| [wikidata:Q6078521](https://www.wikidata.org/wiki/Q6078521) | 2159370916 | dc705e5a2d4360175bfe6e19ccee177e250c1d42a9bce3288092fb94ffefaafa |
| [wikidata:Q746549](https://www.wikidata.org/wiki/Q746549) | 2532267038 | f459ca803e965a95cae73077af2c4a0e052255f77be2b8edfa3f774d512f3702 |
| [wikidata:Q818372](https://www.wikidata.org/wiki/Q818372) | 2550275293 | b4308d5966ab45b8a1c079ab063359b7a31557bebf56a09fb62d8ba27207fc88 |
| [wikidata:Q842685](https://www.wikidata.org/wiki/Q842685) | 2553603004 | ccdd3a38ace349f2da48830f7907f79f3bc830e11e6369b42b79d4cb35e87ea6 |
| [wikidata:Q995376](https://www.wikidata.org/wiki/Q995376) | 2518234871 | 17c3e49ffddc6755083c7079c5aba2b87e80954db468d69c1b280e57722922f8 |
