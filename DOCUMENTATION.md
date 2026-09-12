# SafeVoice Authentication Slice

## Section 1: What This Is

This repository contains the complete authentication system for SafeVoice,
a gender-based violence reporting application for women in Nigerian IDP camps.
The slice covers account creation, email verification, sign in, session
management, password reset, and a protected dashboard — everything needed
for a user to create and access an account securely.

This slice deliberately excludes all product features beyond authentication.
The dashboard shows only the signed-in user's name and a sign-out button.
There is no profile editing, no settings page, no social sign-in, and no
two-factor authentication. These were excluded because the brief requires
a focused authentication slice, not a full product.

---

## Section 2: How To Run It

**Requirements:** Node.js v18 or above, Git

**Step 1: Clone the repository**
```bash
git clone https://github.com/Lafayettejoe/safevoice-auth.git
cd safevoice-auth
```

**Step 2: Install dependencies**
```bash
npm install
```

**Step 3: Set up environment variables**

Copy `.env.example` to a new file called `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | neon.tech — create a free PostgreSQL project, copy the connection string |
| `JWT_SECRET` | Any random string of at least 32 characters |
| `RESEND_API_KEY` | resend.com — create a free account, generate an API key |
| `RESEND_FROM_EMAIL` | Use `onboarding@resend.dev` for testing |
| `UPSTASH_REDIS_REST_URL` | upstash.com — create a free Redis database, copy the REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | upstash.com — same Redis database, copy the REST token |

**Step 4: Push the database schema**
```bash
npx prisma db push
```

**Step 5: Start the development server**
```bash
npm run dev
```

**Step 6: Open in browser**

Visit `http://localhost:3000` — you will be redirected to the sign-in page.

---

## Section 3: The Flow, Step By Step

### Creating an account

The user visits `/signup` and fills in their name, email, and password.
The form validates client-side before submission — the password must be
at least 8 characters, contain one uppercase letter, and one number.

When the form submits, the frontend sends a POST request to
`/api/auth/signup` with `{ name, email, password }`.

The server in `app/api/auth/signup/route.ts` first checks the rate limit
using Upstash Redis. If the IP has exceeded 3 signups in 60 minutes, it
returns HTTP 429. Otherwise it validates the body using the `signupSchema`
from `lib/validations.ts`. If validation fails it returns HTTP 422 with
the specific error message. If the email already exists in the User table
it returns HTTP 409. Otherwise it hashes the password with bcrypt at cost
factor 12, creates the User record, generates a 6-digit code, saves it to
the VerificationCode table with a 15-minute expiry, and sends the code to
the user's email via Resend. It returns HTTP 201 with the userId.

The frontend receives the userId and redirects to
`/verify?userId=...&email=...`.

### Verifying email

The user enters the 6-digit code from their email. The frontend sends a
POST to `/api/auth/verify` with `{ code, userId }`.

The server in `app/api/auth/verify/route.ts` finds the VerificationCode
record matching both userId and code. If not found it returns HTTP 400.
If the `expiresAt` timestamp is in the past it returns HTTP 400 with an
expiry message. Otherwise it sets `emailVerified: true` on the User record
and deletes the VerificationCode row. It returns HTTP 200.

The frontend redirects to `/signin?verified=true`.

### Signing in

The user enters their email and password. The frontend sends a POST to
`/api/auth/signin` with `{ email, password }`.

The server in `app/api/auth/signin/route.ts` checks the rate limit —
5 attempts per 15 minutes per IP. It looks up the user by email. If not
found it returns HTTP 401 with a generic message that does not reveal
whether the email exists. It then compares the submitted password against
the stored bcrypt hash using `bcrypt.compare`. If the password is wrong it
returns HTTP 401. If `emailVerified` is false it returns HTTP 403. If
everything passes it creates a JWT token signed with the JWT_SECRET,
saves a Session record with a 7-day expiry, sets an httpOnly cookie called
`session`, and returns HTTP 200 with the user's name and email.

The frontend redirects to `/dashboard`.

### Accessing the dashboard

Every request first passes through `middleware.ts`. The middleware reads
the `session` cookie and verifies the JWT using the `jose` library. If the
token is missing or invalid, the user is redirected to `/signin`. If valid,
the request continues to `app/dashboard/page.tsx`.

The dashboard page is a server component. It reads the cookie, verifies
the token, queries the User table for the user's name and email, and
renders a welcome message and a sign-out button.

### Resetting a password

The user visits `/forgot-password` and enters their email. The frontend
sends a POST to `/api/auth/forgot-password`. The server always returns the
same success message whether or not the email exists, to prevent email
enumeration. If the user exists, it generates a cryptographically random
token using `crypto.randomBytes(32)`, saves it to the PasswordResetToken
table with a 1-hour expiry and `used: false`, and emails a reset link
containing the token.

The user clicks the link and reaches `/reset-password?token=...`. They
enter a new password. The frontend sends a POST to
`/api/auth/reset-password` with `{ token, password }`. The server finds
the token in the database, checks it has not been used and has not expired,
hashes the new password, updates the User record, marks the token as
`used: true`, deletes all existing sessions for that user, and returns
HTTP 200.

### Signing out

The dashboard has a sign-out button that posts to `/api/auth/signout`.
The server verifies the current session token, deletes all Session records
for that user from the database, and clears the session cookie by setting
its expiry to a past date. The frontend redirects to `/signin`.

---

## Section 4: The Data Model

### User table
Stores every registered account. Each row is one user.

| Column | Type | Decision |
|---|---|---|
| id | String (cuid) | Unique identifier. CUID chosen over UUID for URL-safety and shorter length. |
| email | String (unique) | Unique constraint enforced at the database level — not just application code. A second signup with the same email is structurally impossible. |
| password | String | Stores the bcrypt hash only. The plain password is never written anywhere. |
| name | String | Required. Not nullable because a display name is always expected. |
| emailVerified | Boolean (default false) | Prevents sign in before verification. Set to true only by the verify route. |
| createdAt | DateTime | Set automatically at creation. Immutable. |
| updatedAt | DateTime | Updated automatically by Prisma on every write. |

### Session table
Stores active login sessions. One row per login event.

| Column | Type | Decision |
|---|---|---|
| userId | String (foreign key) | References User.id with cascade delete — if a user is deleted, their sessions are deleted too. |
| expiresAt | DateTime | Session validity is enforced in the database, not only in application memory. |

### VerificationCode table
Stores email verification codes. Deleted after use.

| Column | Type | Decision |
|---|---|---|
| userId | Foreign key | Links to the User being verified. Cascade delete ensures orphaned codes are cleaned up. |
| code | String | The 6-digit code. Stored as a string to preserve leading zeros. |
| expiresAt | DateTime | Expiry lives in the database. The frontend countdown is just UX — the server always checks this column. |

### PasswordResetToken table
Stores password reset links. Single use, time limited.

| Column | Type | Decision |
|---|---|---|
| token | String (unique) | Unique constraint prevents two valid tokens coexisting. Generated with `crypto.randomBytes(32)` for cryptographic randomness. |
| expiresAt | DateTime | 1-hour window enforced at the database level. |
| used | Boolean (default false) | Set to true immediately after use. The server rejects any token where used is true, making every token single-use. |

**Constraints that make invalid states impossible:**

- `email @unique` on User — a second account with the same email cannot be inserted
- `token @unique` on PasswordResetToken — two active reset tokens for the same user cannot coexist
- `userId` foreign key on Session, VerificationCode, and PasswordResetToken with cascade delete — orphaned records are automatically removed when a user is deleted
- `used: Boolean @default(false)` on PasswordResetToken — a token starts as unused and can only transition to used, never back

---

## Section 5: The Concepts

### Password hashing

**What it is.** Hashing turns a password into a fixed-length scrambled
string that cannot be reversed. When a user signs in, the submitted
password is hashed and compared against the stored hash. The original
password is never stored anywhere.

**Why it is needed.** If the database is ever read by someone who should
not have access, plain passwords would give that person immediate access
to every account. Because people reuse passwords across services, it would
also compromise their accounts elsewhere. A bcrypt hash is computationally
expensive to reverse, making brute-force attacks slow enough to be
impractical.

**How I implemented it.** I used bcryptjs with a cost factor of 12 in
`lib/auth.ts`. The `hashPassword` function is called at signup and password
reset. The `verifyPassword` function is called at signin using
`bcrypt.compare`, which handles timing-safe comparison automatically.

```ts
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}
```

**What I chose against, and why.** SHA-256 is a general-purpose hash that
is intentionally fast. Speed is the wrong property for password hashing —
a fast hash means an attacker can test billions of guesses per second.
Argon2 is a defensible modern alternative, but bcryptjs has stronger
ecosystem support in Node.js and I can reason about its cost factor
directly.

---

### Rate limiting

**What it is.** Rate limiting restricts how many requests a single IP
address can make to a specific endpoint within a time window. Requests
that exceed the limit receive an HTTP 429 response with a retry-after
header.

**Why it is needed.** Without it, an attacker can send thousands of
sign-in attempts per minute to guess passwords, with each attempt costing
me a database query and a bcrypt comparison. Rate limiting makes brute
force attacks economically unviable. The resend-code endpoint is
specifically dangerous without a rate limit — a malicious actor could use
it to send thousands of emails through my Resend account, costing me money.

**How I implemented it.** I used `@upstash/ratelimit` with a sliding window
algorithm in `lib/ratelimit.ts`. Each endpoint has its own limiter with
appropriate thresholds. The rate limit check happens before any database
query in every protected route.

```ts
export const signInRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'safevoice:signin',
})
```

**What I chose against, and why.** I could have implemented rate limiting
with an in-memory store like a Map. This fails immediately in production
because every server restart clears the store, and multiple server
instances cannot share state. A Redis-backed store like Upstash persists
across restarts and scales across instances.

---

### Client-side versus server-side validation

**What it is.** Client-side validation runs in the browser before the
request is sent, giving the user instant feedback. Server-side validation
runs on the server regardless of what the client sent, enforcing the real
rules.

**Why it is needed.** Client-side validation is bypassed trivially — anyone
can send a request directly with curl, Postman, or a script. Without
server-side validation, I could receive empty passwords, missing names,
or malformed emails directly in my database. Server-side validation is the
only validation that actually protects the system. Client-side validation
is purely a user experience improvement.

**How I implemented it.** The validation rules are declared once in
`lib/validations.ts` using Zod schemas. The server uses `schema.safeParse`
in every route handler. The client mirrors the same rules using JavaScript
checks in the form components, giving instant feedback without a network
round trip.

**What I chose against, and why.** I could have written validation rules
separately for client and server. This creates the risk of them diverging
over time — the server might reject something the client allowed or vice
versa, creating a confusing user experience. Sharing the schema from one
source of truth prevents this.

---

### Session management

**What it is.** A session is a record that says a specific user is currently
logged in. When a user signs in, a session is created. When they sign out,
it is destroyed. The session is tracked using a signed JWT stored in an
httpOnly cookie.

**Why it is needed.** HTTP is stateless — each request knows nothing about
previous requests. Sessions give the server a way to identify who is making
each request without asking the user to send their password every time.

**How I implemented it.** At sign in, I create a JWT signed with the
JWT_SECRET containing the userId, with a 7-day expiry. This is stored in
an httpOnly cookie so JavaScript cannot read it. I also save a Session
record in the database. The middleware verifies the JWT on every request
to a protected route using the `jose` library, which works in the Next.js
middleware environment.

**What I chose against, and why.** I could have used server-side sessions
where the session data is stored entirely in the database and the cookie
only contains a session ID. JWTs are stateless — the server can verify
them without a database lookup — which is faster and simpler for this
scale. The tradeoff is that JWTs cannot be individually invalidated before
expiry, which I mitigate by also storing sessions in the database and
checking them on sensitive operations like password reset.

---

### Token and code expiry

**What it is.** Every verification code and password reset token has an
`expiresAt` timestamp stored in the database. The server checks this
timestamp before accepting the code or token. Expired codes and tokens
are rejected even if they are technically correct.

**Why it is needed.** Without expiry, a verification code emailed in 2024
could still be used in 2026. A password reset link intercepted from an
old email would remain valid forever, giving an attacker unlimited time
to use it. Expiry limits the window of opportunity for misuse.

**How I implemented it.** When a verification code is created, I set
`expiresAt = new Date(Date.now() + 15 * 60 * 1000)` — 15 minutes from
now. When the code is submitted, the route checks
`if (verificationCode.expiresAt < new Date())` and returns an error if
true. The same pattern applies to reset tokens with a 1-hour window.

**What I chose against, and why.** I could have stored the expiry only in
the browser — for example, hiding the code after 15 minutes in the UI.
This is purely cosmetic. A user could note the code, wait an hour, and
submit it directly to the API. Expiry must live in the database to be
enforceable.

---

### Idempotency

**What it is.** An idempotent operation produces the same result whether
it is called once or many times. For signup, this means that submitting
the same request twice creates exactly one account, not two.

**Why it is needed.** Network errors can cause browsers to retry requests.
A user clicking the submit button twice in quick succession could create
duplicate accounts if the endpoint is not idempotent. Duplicate accounts
cause confusion and data integrity problems.

**How I implemented it.** The User table has a `@unique` constraint on the
`email` column enforced at the database level. Even if two identical signup
requests arrive simultaneously, PostgreSQL's uniqueness constraint ensures
only one succeeds. The second receives a conflict error which the route
catches and returns as HTTP 409.

**What I chose against, and why.** I could have checked for duplicates in
application code only, without the database constraint. If two requests
arrived at exactly the same millisecond, both could pass the check before
either insert completed, creating a duplicate. The database constraint is
the last line of defence that makes this structurally impossible regardless
of timing.

---

### Database constraints as a last line of defence

**What it is.** Database constraints — unique constraints, foreign keys,
and not-null constraints — are rules enforced by the database itself,
independent of application code. They prevent invalid data from being
inserted even when application logic has a bug.

**Why it is needed.** Application code has bugs. A developer might forget
a check, a race condition might bypass a guard, or a future change might
introduce a regression. Database constraints enforce invariants that must
always be true regardless of what the application does.

**How I implemented it.** The schema uses `@unique` on User.email and
PasswordResetToken.token, foreign key relations with cascade deletes on
all child tables, and `@default(false)` on emailVerified and used to
ensure new records start in the correct state.

**What I chose against, and why.** Relying solely on application-level
checks without database constraints is common but fragile. It assumes the
application code is always correct and complete. Database constraints
provide a safety net that cannot be bypassed by any code path.

---

### Protected routes

**What it is.** A protected route is a page that only authenticated users
can access. Unauthenticated users who try to visit it are redirected to
the sign-in page instead of seeing the content.

**Why it is needed.** Without protected routes, any user who knows the URL
of the dashboard can visit it directly without signing in. The dashboard
URL is not secret — it is `/dashboard`, which anyone can guess. The
protection must be enforced by the server, not by hiding the URL.

**How I implemented it.** The protection lives in `middleware.ts` which
runs before every page request. It reads the `session` cookie, verifies
the JWT using `jose`, and either allows the request through or redirects
to `/signin`. The middleware runs at the edge, before any page component
executes, so there is no moment where an unauthenticated user sees the
dashboard content.

**What I chose against, and why.** I could have put the authentication
check inside the dashboard page component itself. This would work, but it
means the page starts rendering before the check completes, which can
cause a flash of unauthenticated content. Middleware intercepts the
request before any rendering begins.

---

## Section 6: What Went Wrong

### Problem 1: Prisma version conflict

**Symptom.** Running `npx prisma db push` returned
`CLI.UNKNOWN_COMMAND: No command registered for 'push'`.

**Investigation.** I checked whether Prisma was installed — it was. I
checked the Prisma version using `npx prisma version` which also returned
an unknown command error. I searched for the error message and found that
Prisma v6 introduced a new CLI with different commands.

**Cause.** The initial `npx prisma init` installed Prisma v6 which uses
a completely different CLI. The `db push` and `version` commands were
removed and the configuration moved to a `prisma.config.ts` file.

**Fix.** I downgraded to Prisma v5 using
`npm install prisma@5 @prisma/client@5` and deleted the `prisma.config.ts`
file that v6 had created. The standard commands then worked correctly.

---

### Problem 2: Database connection refused on Windows

**Symptom.** Running `npx prisma db push` with Supabase returned
`P1001: Can't reach database server`.

**Investigation.** I verified the database was not paused — the Supabase
dashboard showed status Healthy. I checked the connection string for typos.
I tried the ORM connection string from Supabase instead of the direct
connection string.

**Cause.** Supabase's direct connections use IPv6 by default. Windows
computers typically use IPv4. The two are incompatible without a paid
IPv4 add-on.

**Fix.** I switched from Supabase to Neon, which supports IPv4 connections
out of the box. The connection string from Neon worked immediately with
`npx prisma db push`.

---

### Problem 3: Environment variables not loading

**Symptom.** The server returned
`Error: Missing API key. Pass it to the constructor 'new Resend("re_123")'`
even though the `RESEND_API_KEY` was correctly set in `.env`.

**Investigation.** I checked the `.env` file for syntax errors — there
were none. I updated `next.config.ts` to explicitly pass environment
variables. I cleared the Next.js cache. None of these fixed it.

**Cause.** Next.js reads `.env.local` with higher priority than `.env`.
The application was running correctly but the `RESEND_API_KEY` was not
being picked up because of how Next.js loads environment files in
development mode on Windows.

**Fix.** I created a `.env.local` file with all the same values. Next.js
loaded this file correctly and the API key was available immediately.

---

### Problem 4: Zod validation returning 500 instead of 422

**Symptom.** Submitting a weak password returned
`HTTP 500: Something went wrong` instead of a validation error message.

**Investigation.** I checked the server logs and found the error was thrown
inside the validation block, not the catch block. I added a console.log
to inspect the Zod error object structure.

**Cause.** The project uses Zod v4 which changed the error object structure.
In Zod v3, validation errors were at `error.errors[0].message`. In Zod v4,
they moved to `error.issues[0].message`. My code was using the v3 path
which returned undefined, causing a runtime error.

**Fix.** I updated all six route handlers to use `result.error.issues[0].message`
instead of `result.error.errors[0].message`.

---

## Section 7: What This Slice Does Not Handle

**Outside the brief by design:**
- Two-factor authentication
- Social sign-in (Google, GitHub)
- Profile editing or account settings
- Remember me functionality
- Account deletion

**Would need before real users:**
- Email deliverability — the current setup uses `onboarding@resend.dev`
  which only sends to the Resend account owner's email. A verified sending
  domain is required to email real users.
- Token cleanup — expired VerificationCode and PasswordResetToken records
  accumulate in the database. A scheduled job to delete them would be
  needed at scale.
- Account lockout — the current rate limiting is per-IP. A determined
  attacker using rotating IPs could still attempt many guesses. Account
  lockout after N failed attempts for a specific email would add another
  layer.
- HTTPS enforcement — the app runs on HTTP in development. A production
  deployment requires HTTPS and the secure cookie flag is already
  conditional on `NODE_ENV === 'production'`.

**Left out due to time:**
- Automated tests — unit tests for the auth functions and integration
  tests for the API routes were not written within the assessment window.

---

## Section 8: If I Built This Again

If I built this again, I would set up the database provider before writing
a single line of application code. The most significant time loss in this
build came from discovering mid-build that Supabase's free tier uses IPv6
while my development machine uses IPv4 — a compatibility issue that
required switching database providers entirely and redoing the connection
setup. Choosing and verifying the full infrastructure stack in the first
30 minutes, including running a test query to confirm connectivity, would
have saved hours of debugging that had nothing to do with authentication
logic.