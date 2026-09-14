# REQ-24 - Canonical Store-Invite Employee Onboarding

**Status:** Owner HR integration implemented and verified

## Goal

Make a reusable Store invite code the primary employee onboarding entry point. An Account can verify a Store code before it belongs to any workspace, then submits a canonical pending request for Owner review. A Store code is never direct authorization and never assigns a role.

## User stories

- As an employee, I enter a Store invite code, see the resolved business and Store, and remain logged in while my request is pending.
- As an Owner, I review the originating Store, assign STAFF, LEADER, or MANAGER, and grant one or more Stores in the same Tenant.
- As an approved employee, I refresh and receive only the Tenant and Store access selected by the Owner.

## Scope and acceptance criteria

- [x] Resolve an active Store invite code to Store and Tenant server-side, without client Tenant, Store, role, or membership input.
- [x] An account-scope session can verify a Store code, create its own `pending` canonical request, and retrieve that pending state after refresh.
- [x] A valid Store code writes only `tenant_join_requests.requested_store_id`; it does not create/activate a membership, Store access, or POS session.
- [x] Owner review shows the originating invited Store and accepts only STAFF, LEADER, or MANAGER with one or more same-Tenant Stores.
- [x] Approval atomically creates or activates one selected-scope membership and exactly the Owner-selected Store access rows, with duplicate and cross-Tenant protection.
- [x] Pending requests do not authorize POS or business APIs, cannot self-approve, and cannot produce OWNER.
- [x] After approval, refresh exposes the approved Tenant and selected Stores; exactly one accessible Store may be auto-selected.
- [x] Retain Tenant-code and legacy onboarding endpoints solely for compatibility; Store codes remain the primary entry point.
- [x] The existing Owner HR request tab displays and approves canonical Store-invite requests through the canonical review API, without moving the Owner to a separate workflow page.
- [x] The Owner HR pending badge includes canonical pending requests, and approval from that page supports STAFF/LEADER/MANAGER plus one or more selected Stores.

## Excluded

No deletion of legacy tables, legacy user fields, Tenant join-code data, or unrelated authorization/POS/HR redesign.
