# SkillHub Web Frontend — AGENTS.md

## Lobster Frontend Architecture Boundary

- Preserve the repository's actual React, TypeScript, and Vite conventions.
- Use one runtime configuration source.
- Use one application Base Path abstraction.
- Use one embed-state owner.
- Use one frontend authentication bootstrap owner.
- Use one parent-window message and theme bridge.
- Do not parse the same URL, embed, authentication, theme, or Base Path state independently
  in multiple components.
- Do not hardcode `/skillhub`, internal IP addresses, hosts, ports, credentials, or
  environment-specific origins in application source.
- Do not modify `web/src/api/generated/**`.
- Do not duplicate full upstream pages, routers, API clients, layouts, or authentication flows.
- Prefer small adapters, providers, hooks, wrappers, and configuration-driven behavior.
- Do not create an abstraction until there is a real ownership boundary or reuse requirement.
- Keep patches minimal and focused.
- Preserve upstream component and project conventions when they differ from generic defaults.
