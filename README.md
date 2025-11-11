# games

[![Auto merge basic check](https://github.com/brightsole/games/actions/workflows/test.yml/badge.svg)](https://github.com/brightsole/games/actions/workflows/test.yml) [![Deploy to Production](https://github.com/brightsole/games/actions/workflows/deploy.yml/badge.svg)](https://github.com/brightsole/games/actions/workflows/deploy.yml) [![Dependabot Updates](https://github.com/brightsole/games/actions/workflows/dependabot/dependabot-updates/badge.svg)](https://github.com/brightsole/games/actions/workflows/dependabot/dependabot-updates)

[preview](https://1ftx9xsywk.execute-api.ap-southeast-2.amazonaws.com/graphql)

[production](https://746npamh9f.execute-api.ap-southeast-2.amazonaws.com/graphql)

<pre>
                      ┌────────────────────────────────────────────────────────────────┐
                      │    <a href="https://github.com/brightsole/jumpingbeen.com">jumpingbeen.com</a>                                             │
                      └─────────────┬─▲────────────────────────────────────────────────┘
                                    │ │
                      ┌───────────────────────────────────────────────────────────┐
                      │    <a href="https://github.com/brightsole/gateway">Federation gateway</a>                                     |
                      │───────────────────────────────────────────────────────────┼───┐
    ┌────────────────►│   DMZ                                                     ◄──┐│
  ┌──────────────────►└───────────────────────────────────────────────────────────┘  ││
  │ │                   ▲                                                      ▲     ││
  │ │                   │                                                      │     ││
  │ │                 ┌─┴────────────────────────────────────────────────────┐ │  ┌──┴▼──────────────────┐
  │ │                 │    <a href="https://github.com/brightsole/solves">Solves service</a>                                    │ │  │ Users service (soon) │
  │ │                 └┬───────────▲───┬─▲────────┬▲────────┬▲───────────────┘ │  └──────────────────────┘
  │ │                  │           │   │ │        ││        ││                 │
  │ │                  │Attempts   │ ┌─▼─┴────┐   ││        ││                 │
  │ │                  │ are       │ ┌────────┐   ││        ││                 │
  │ │                  │memory only│ │  DDB   │   ││        ││                 │
  │ │                  └───────────┘ │ Solves │   ││        ││                 │
  │ │                                └────────┘   ││        ││                 │  you're here
  │┌┴─────────────────────────────────────────────▼┴──┐   ┌─▼┴─────────────────┴───*─────────────────────┐
  ││    <a href="https://github.com/brightsole/hops">Hops service</a>                                  ├───►<a href="https://github.com/brightsole/games">    Games service</a>                             │
  │└──────▲┬─────────┬─▲─────────┬────────────┬─▲─────◄───┴──┬─▲─────────────────────────────────────────┘
  │       ││         │ │         │            │ │            │ │
  │       ││       ┌─▼─┴───┐     │User      ┌─▼─┴───┐      ┌─▼─┴───┐
  │       ││       ┌───────┐     │Goo       ┌───────┐      ┌───────┐
  │       ││       │  DDB  │     │          │  DDB  │      │  DDB  │
  │       ││       │ Links ├───┐ └─────────►│ Hops  │      │ Games │
  │       ││       └───────┘   └───────────►└───────┘      └───────┘
 ┌┴───────┴▼──────────────────────────────────────────┐
 │    <a href="https://github.com/brightsole/words">Words service</a>                                   │
 └──────┬───────────────────────▲─────┬─▲─────────────┘
        │                       │     │ │
        ├─────►Dictionary api───┤   ┌─▼─┴───┐
        │                       │   ┌───────┐
        ├─────►RiTa package─────┤   │  DDB  │
        │                       │   │ Words │
        └─────►Datamuse api─────┘   └───────┘
</pre>

## TODO
1. add cron job lambda that approves games and adds sequential publish dates to them
    1. or an endpoint for us to manually approve
1. would be really nice to tell the queries/mutations if this was a cold start
1. some kind of cache-enhottener for other services when the puzzle's day is up
