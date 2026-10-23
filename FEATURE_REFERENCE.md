# Bike Hub feature reference → ThrottleHub

Public pages and official help material reviewed on 21 October 2026. This is product-structure research, not a reproduction of protected code, wording, photographs, identity or design. Logged-in/private management flows were not independently exercised.

| Publicly observed pattern                                                      | Relevant ThrottleHub adaptation                            | This iteration                                                                    |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Marketplace-led home connects latest ads, editorial, discussions and events    | Classifieds first, useful community discovery beneath      | Real-data homepage with intentional zero-content states                           |
| Classified category hierarchy, browsing filters and list/grid navigation       | Dirt-bike categories with country/model/location filtering | Existing marketplace retained; structured filters expanded                        |
| Shared accounts engage across selling, discussions, events and theft reporting | One Auth UID, public rider profile, private account data   | Shared Firebase identity; profile discussions linked                              |
| Technical/community discussion topics carry author/date/activity               | Mechanics, builds, riding, racing and trade advice         | Ten configured categories, actual counts, chronological replies, moderation       |
| News/gear content has category/date/editorial presentation                     | Original off-road articles and technical reading           | Admin publishing with drafts/covers/captions and public SSR pages                 |
| Stolen Bikes is a distinct community destination                               | Moderated motorcycle reports separate from adverts         | Pending review, private evidence, safe information pathway and recovery lifecycle |
| Event discovery complements marketplace/community                              | Confirmed race/training/community dates                    | Admin-published upcoming/past directory and detail pages                          |

Sources: [Bike Hub homepage](https://bikehub.co.za/), [official platform overview](https://help.bikehub.co.za/en/articles/3954481-what-is-bike-hub), [shared-account capabilities](https://help.bikehub.co.za/en/articles/3530603-what-can-i-do-with-a-bike-hub-account-why-do-i-need-one), [classified browsing](https://bikehub.co.za/classifieds/all-ads?page=58&seller_type=private), [technical discussion example](https://forum.bikehub.co.za/topic/189493-need-help-lost-hub-pawl/), [stolen-bike forum example](https://forum.bikehub.co.za/topic/197861-stolen-scott-scale-940-carbon-gauteng/), [official help structure](https://help.bikehub.co.za/en/).

Observed help structure separates selling, buying, ratings, accounts and services. Detailed seller-management UI, private profile settings, editorial tools, event submission and theft-review administration were not inspected behind login; ThrottleHub's implementations follow the user's requirements instead of assuming Bike Hub's internal design.

Postponed: protected payments, paid ad boosts/dealer subscriptions, ratings/verification, advanced social feeds/following, event registration, automatic aggregation, full-text relevance search and automated theft matching. No source content, user posts, stolen-bike details, articles or dates were imported into ThrottleHub.
