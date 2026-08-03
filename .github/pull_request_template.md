## Summary

- What changed?
- Why is this needed?

## Validation

- [ ] Backend tests passed
- [ ] Frontend typecheck/build passed
- [ ] OpenAPI SDK regenerated or checked when API contracts changed
- [ ] Smoke test run when relevant

Commands run:

```bash
# paste commands here
```

## Risk

- User-facing impact:
- Deployment or migration impact:
- Rollback approach:

## Notes

- Related issue:
- Follow-up work:
- Docs or operator runbooks updated when behavior changed:

## Downstream Frontend-Only Checklist

This repository is a frontend-only downstream distribution of SkillHub. Ordinary pull
requests must stay within the approved frontend and governance paths.

- Change purpose:
- Changed frontend area:
- User-visible behavior:
- Validation executed:
- Residual risk:
- Rollback method:

Confirm all of the following:

- [ ] The change is limited to approved frontend or governance paths.
- [ ] No backend, CLI, scanner, deployment, monitoring, compose, or generated API file was modified.
- [ ] No internal host, IP address, credential, token, password, cookie, or private deployment value was committed.
- [ ] Existing repository instructions were read.
- [ ] Relevant validation passed.
- [ ] Upstream synchronization is not being disguised as an ordinary frontend PR.
