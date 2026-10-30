# api.etiennethompson.com
The back end services for my ecosystem of web applications.

## Purpose:

This API provides the data abstraction for the ecosystem of applications I have. It integrates with a Postgres database to store data used by the different applications. It uses JSON as it's communication content type.

## How it works:

The first thing the API does is instantiate a database connection in middleware. It makes a single database connection per request to make the API response extremely quick, rather than making a connection for each database request.

The API is an authenticated API only. You must have valid authentication to use any of the endpoints in this API. Valid authentication takes the form of a client id, which is returned by the [OAuth login service](https://github.com/EtienneThompson/login.etiennethompson.com), as well as a valid application id. The API must make sure you are a valid user of the ecosystem, as well as a valid user of that application. Once you have been authenticated, you can read or modify the data stored for that application.

Every request gets it's own endpoints, usually in one of the following forms:
- `/<app name>/` for GET requests.
- `/<app name>/create` for POST requests.
- `/<app name>/update` for PUT requests.
- `/<app name>/delete` for DELETE requests.

## Current Applications that are supported through the API:

- [OAuth Login Service](https://github.com/EtienneThompson/login.etiennethompson.com)
- [Ecosystem Admin Center](https://github.com/EtienneThompson/admin.etiennethompson.com)
- [Inventory System](https://github.com/EtienneThompson/inventory.etiennethompson.com)
- [QR Tracker](https://github.com/EtienneThompson/QrCode)
- [WeddingCam](https://github.com/EtienneThompson/WeddingCam)

## Technologies:
- Typescript
- Express
- Node-Postgres

## How to run the API locally:

1. Clone the repository.
2. Install packages with `yarn install`
3. Run the project with `yarn run dev`
## Passkeys and password hashing:

Users can log into the [OAuth login service](https://github.com/EtienneThompson/login.etiennethompson.com) with a passkey instead of a password. Passwords are stored as bcrypt hashes.

Before deploying these changes:

1. Run the migration: `APP_ENV=production yarn run migrate 001_passkeys_and_bcrypt.sql`
2. Convert existing passwords to bcrypt: `APP_ENV=production yarn run migrate-passwords`

Passkey settings, set as environment variables:

- `WEBAUTHN_RP_ID`: the domain passkeys are bound to. Defaults to `etiennethompson.com`. Use `localhost` for local development.
- `WEBAUTHN_RP_NAME`: the name shown by passkey managers. Defaults to `Etienne Thompson`.
- `WEBAUTHN_ORIGINS`: comma separated origins allowed to use passkeys. Defaults to `https://login.etiennethompson.com`. Use `http://localhost:4000` for local development.

## QR Tracker:

The `/qr` routes back [QR Tracker](https://github.com/EtienneThompson/QrCode). `/qr/r/<id>` is the public link encoded in each QR code: it records the scan and redirects to the code's destination. The other `/qr` routes need a user of the QR Tracker application.

Before deploying:

1. Run the migration: `APP_ENV=production yarn run migrate 002_qr_tracker.sql`
2. Set the environment variables:
   - `QR_APPLICATION_ID`: QR Tracker's application id from the admin portal. Required. Requests made with any other application id are refused.
   - `QR_PUBLIC_BASE_URL`: the base URL encoded in QR codes, e.g. `https://qr.etiennethompson.com` (that site forwards `/r/<id>` to `/qr/r/<id>`). Defaults to this API's own `/qr` path. Set it before printing codes.

## WeddingCam:

The `/weddingcam` routes back [WeddingCam](https://github.com/EtienneThompson/WeddingCam), a shared "disposable camera" for events. Events, guests and photo metadata are stored in Postgres, and the photos in a private S3 bucket that's only read through short-lived presigned links.

- `/weddingcam/guest/...` routes are public. Guests exchange the secret from an event's QR code for a random bearer token (only its hash is stored), then send it as `Authorization: Bearer <token>`.
- `/weddingcam/events/...` routes need a user of the WeddingCam application.

Before deploying:

1. Run the migration: `APP_ENV=production yarn run migrate 003_weddingcam.sql`
2. Set the environment variables:
   - `WEDDINGCAM_APPLICATION_ID`: WeddingCam's application id from the admin portal. Required. Requests made with any other application id are refused.
   - `WEDDINGCAM_BUCKET_NAME`: the private S3 bucket for photos. The existing `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` need `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on it.
   - `WEDDINGCAM_BUCKET_REGION`: optional, defaults to `us-west-2`.
   - `WEDDINGCAM_S3_ENDPOINT`: optional, for local development against an S3-compatible server such as MinIO.

See the WeddingCam repo's `docs/deployment.md` for the bucket setup.
