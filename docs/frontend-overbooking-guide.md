# Displaying overbooked reservations (frontend guide)

## What `isOverbooked` means

Every reservation returned by the API now carries a computed `isOverbooked: boolean` field
([`ReservationResponseDto`](../src/reservation/dto/reservation-response.dto.ts)):

```json
{
  "id": "…",
  "status": "Accepted",
  "startDate": "2026-08-10",
  "endDate": "2026-08-13",
  "isOverbooked": true,
  "feature": { "id": "…", "name": "Private Cabana", "quantity": 5, "...": "..." },
  "...": "..."
}
```

`true` means: this reservation currently shares its dates with more *confirmed* reservations
than the feature has physical units for. In practice this happens when a Booking.com/Airbnb
booking arrives (via Channex) for a room that's already fully booked locally, or vice versa.

**Important — this is not a stored flag, it's computed fresh on every request.** There is
nothing to "clear": if staff resolves the conflict (declines one of the colliding
reservations), the flag disappears on its own the next time the list is fetched — no action
needed beyond declining/resolving the reservation itself. Don't cache this value client-side
across a mutation; always trust the freshest response.

It's only ever `true` for a reservation in `Accepted` or `Progress` status. A `Pending`
reservation never occupies a unit, so it can't be "overbooked" — always expect `false` there.

## What it does *not* mean

`isOverbooked` is a signal for staff to review and resolve, not a validation error. The
backend deliberately never rejects or blocks an overbooked reservation — an OTA guest with a
confirmed Airbnb/Booking.com booking is real whether or not the room math works out, so it's
always created normally. Don't treat `isOverbooked: true` as something to disable the
reservation for, hide, or auto-cancel — it's purely informational until a human acts on it.

## How to display it

**In the reservation list / calendar view:** a clear, high-contrast visual flag on any
reservation row/card where `isOverbooked === true` — a colored badge or icon (e.g. a red
"⚠ Overbooked" chip) is enough. This should be impossible to miss when scanning the list,
since the entire point is that staff catches it *before* a guest shows up.

**On the reservation detail view:** a visible banner/callout, not just a small badge — e.g.
"This reservation conflicts with another confirmed booking for the same unit and dates."
Since the same conflict flags *both* colliding reservations (see below), consider linking to
or showing the other reservation(s) for the same feature/date range so staff doesn't have to
go hunt for what it collides with.

**Suggested resolution actions to surface from the flagged view** (staff picks one — the
backend doesn't automate any of this):
- Reassign to a different available unit/feature for the same dates, if one exists.
- Decline one of the colliding reservations (`PATCH /resort/:resortId/reservation/:id/status`
  with `{"status": "Declined"}` — this is now a legal transition even from `Accepted`).
  Declining a `Manual`-sourced reservation this way automatically sends the guest a WhatsApp
  message, so no separate guest-notification step is needed from the frontend.
- Contact the guest directly for anything needing a human conversation (e.g. offering an
  upgrade, relocating to a partner property).

## Fetching overbooked reservations directly

`GET /resort/:resortId/reservation` now accepts an `overbooked=true` query parameter, which
returns only the currently-conflicting reservations (still computed live, not a stored
filter). Useful for:
- A dedicated "conflicts" view/tab, separate from the main calendar.
- A periodic poll (e.g. every few minutes on a staff dashboard) to surface new conflicts
  without requiring someone to notice them on the calendar.

```
GET /resort/{resortId}/reservation?overbooked=true
```

Combine with the existing `from`/`to` filters to scope it to an upcoming date range (most
relevant for a "check for conflicts on upcoming stays" view).

## Notes on cost/latency

Computing this flag requires an extra query per reservation on the backend, so list responses
with many reservations are marginally slower than before. This is a deliberate tradeoff (an
always-correct computed value vs. a cached one that can silently go stale) and not expected to
be noticeable at normal resort-scale reservation volumes. Flag it to backend if a specific view
needs to list hundreds of reservations at once and latency becomes visible.
