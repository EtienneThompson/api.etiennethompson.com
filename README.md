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
