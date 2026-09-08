# Public Fishing Access Data

## Purpose

This registry stores source-traceable information about Oklahoma public fishing access points,
not just water bodies. One lake can have several ramps, piers, shorelines, and parking areas.

## Accessibility policy

- Mark ADA fishing or ADA parking as `confirmed` only when an official operator source explicitly
  describes that specific facility.
- Use `unknown` when details have not been verified.
- Never infer lake-wide accessibility from one accessible facility.

## Permit policy

Keep baseline state-license guidance separate from location-specific city permits, land-access
permits, day-use fees, check-in requirements, and special regulations.

## Required data fields

Every record must include:

- A stable unique ID.
- Facility/access-point coordinates.
- An official source URL.
- A verification date.
- A verification status.
- Explicit unknown values instead of guessed parking or accessibility details.

## Source precedence

1. Site operator or managing agency.
2. Oklahoma Department of Wildlife Conservation.
3. Federal land/water manager.
4. Local municipality or county.
5. Community reports, clearly labeled and never used to overwrite official information.

## Refresh cadence

Review official permit, access, ADA, and parking data before each fishing season and whenever a
managing agency publishes a closure, construction update, or regulation update.

## Local validation 
eof
