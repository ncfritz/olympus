# @ncfritz/olympus-control

The index of [Olympus Control](../../docs/decisions/0021-control-host-and-console-navigation.md):
the page at the root of `control.olympus.ncfritz.net`, listing the
consoles this host runs.

It is the one app in the suite with no base path, no agent and no session
— the shell renders without them, so the sider and header look the same
here as in any console. `CONTROL_CONSOLES` decides what it lists, read at
request time like everywhere else.

Service health on the cards is deliberately not here: it wants the
monitoring work rather than a browser fanning out over `/health`.
