# Assessment 1: Authentication Slice
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

---

# Assessment 2: Payment and Billing Slice
# SafeVoice Payment and Billing Slice

## Section 1: What This Is

This repository extends the SafeVoice authentication slice with a complete
subscription and billing system built on Flutterwave in test mode. An
organisation can view available plans, subscribe to a monthly or yearly
camp license, upgrade mid-cycle with proration applied, downgrade at the
end of their current period, and cancel while retaining access until the
paid period ends. Every payment event is recorded as a separate row in an
append-only payment log.

This slice deliberately excludes all product features beyond billing. There
is no landing page, no marketing page, and nothing behind the paywall. The
thing being sold is a plan flag on a subscription record and nothing more.
Reusing the authentication system from Assessment 1 is stated here as
required by the brief.

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

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | neon.tech — free PostgreSQL project |
| `JWT_SECRET` | Any random string, minimum 32 characters |
| `RESEND_API_KEY` | resend.com — free account |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` for testing |
| `UPSTASH_REDIS_REST_URL` | upstash.com — free Redis database |
| `UPSTASH_REDIS_REST_TOKEN` | upstash.com — same Redis database |
| `FLW_PUBLIC_KEY` | Flutterwave dashboard → Settings → API Keys (test mode) |
| `FLW_SECRET_KEY` | Flutterwave dashboard → Settings → API Keys (test mode) |
| `FLW_WEBHOOK_HASH` | Any string you choose — must match what you set in Flutterwave Settings → Webhooks → Secret Hash |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local development |

**Step 4: Push the database schema**
```bash
npx prisma db push
npx prisma generate
```

**Step 5: Seed the plans**
```bash
npm run seed
```

This creates three plan records in the database: Free (₦0), Monthly
(₦5,000), and Yearly (₦48,000).

**Step 6: Start the development server**
```bash
npm run dev
```

**Step 7: Open in browser**

Visit `http://localhost:3000`. Sign in, then click **Manage billing** or
**View plans** from the dashboard.

**Step 8: Test payments**

Use these Flutterwave test card details:

| Field | Value |
|---|---|
| Card number | 5531 8866 5214 2950 |
| Expiry | 09/32 |
| CVV | 564 |
| PIN | 3310 |
| OTP | 12345 |

**Step 9: Test webhooks locally**

Install ngrok and run:
```bash
ngrok http 3000
```

Update your Flutterwave webhook URL to the ngrok forwarding address
followed by `/api/billing/webhook`.

---

## Section 3: The Flow, Step By Step

### Viewing plans

The user navigates to `/billing/plans` from the dashboard. The frontend
sends a GET request to `/api/billing/plans` in
`app/api/billing/plans/route.ts`. The server reads the authenticated
user from the session cookie, fetches all three plans from the Plan table
ordered by amount, and calls `getOrCreateFreeSubscription` from
`lib/billing.ts` to ensure every user has a subscription record. It
returns the plans and the user's current subscription. The page renders
three cards showing Free, Monthly, and Yearly with the current plan
highlighted.

### Subscribing to a plan

The user clicks Subscribe on the Monthly or Yearly card. The frontend
sends a POST to `/api/billing/checkout` in
`app/api/billing/checkout/route.ts`. The server checks the rate limit,
verifies the session, validates the plan ID, generates a unique
transaction reference using `generateTxRef` from `lib/billing.ts`, writes
a INITIATED row to the PaymentLog table, then calls `initiatePayment` from
`lib/flutterwave.ts` which hits the Flutterwave `/v3/payments` endpoint
and returns a hosted payment link. The frontend redirects the user to that
link.

The user completes payment on Flutterwave's page using their card. Flutterwave
redirects the user back to `/billing/return` with the transaction ID and
status in the URL.

### Verifying payment

The return page at `app/billing/return/page.tsx` reads the transaction ID
from the URL and sends a POST to `/api/billing/verify` in
`app/api/billing/verify/route.ts`. The server first checks idempotency
— if a FULFILLED row already exists for this transaction ID, it returns
early without processing again. Otherwise it calls `verifyTransaction`
from `lib/flutterwave.ts` which hits the Flutterwave
`/v3/transactions/{id}/verify` endpoint. If the payment is not
successful, a FAILED row is written to PaymentLog. If successful, a
VERIFIED row is written, the Subscription record is upserted with the
new plan and period dates calculated by `calculatePeriodEnd` from
`lib/billing.ts`, and a FULFILLED row is written. The user is redirected
to `/billing?success=true`.

### Upgrading mid-cycle with proration

The user clicks Upgrade on a higher-tier plan. The frontend sends a POST
to `/api/billing/upgrade` in `app/api/billing/upgrade/route.ts`. The
server calls `calculateProration` from `lib/billing.ts` with the current
period start, period end, current plan amount, and new plan amount. The
proration calculation produces a credit for the unused days and an amount
to charge. A INITIATED row is written to PaymentLog with the full
proration breakdown in the metadata field. The prorated amount is passed
to `initiatePayment` and the user is sent to Flutterwave to pay only the
difference.

### Downgrading

The user clicks Downgrade on a lower-tier plan. The frontend sends a POST
to `/api/billing/upgrade`. The server detects the new plan amount is lower
than the current plan amount and schedules the change by setting
`cancelAtPeriodEnd: true` on the Subscription record with a note in
`cancellationReason`. No payment is taken. The change applies automatically
at the end of the current period. A FULFILLED log row records the event.

### Cancelling

The user clicks Cancel subscription on the billing page at `/billing`. A
confirmation modal appears asking for an optional reason. The user selects
a reason and confirms. The frontend sends a POST to `/api/billing/cancel`
in `app/api/billing/cancel/route.ts`. The server sets
`cancelAtPeriodEnd: true` and saves the cancellation reason to the
Subscription record. The user keeps full access until `currentPeriodEnd`.
A FULFILLED log row records the cancellation event with the access-until
date in the metadata.

### Webhook handling

Flutterwave sends a POST to `/api/billing/webhook` in
`app/api/billing/webhook/route.ts` whenever a payment event occurs. The
server first checks the `verif-hash` header against the `FLW_WEBHOOK_HASH`
environment variable using `verifyWebhookSignature` from
`lib/flutterwave.ts`. If the signature does not match, it returns 401
immediately without processing. If the signature matches, it checks
idempotency — if a FULFILLED row already exists for this transaction ID,
it returns `Already processed` without creating any new records. Otherwise
it logs the event and processes it.

---

## Section 4: The Data Model

### Plan table
Stores the three available plans. Seeded once on setup. Never mutated
during normal operation.

| Column | Type | Decision |
|---|---|---|
| id | String (cuid) | Unique identifier |
| name | String | Human-readable: Free, Monthly, Yearly |
| interval | PlanInterval enum | FREE, MONTHLY, or YEARLY — drives period calculation logic |
| amount | Int | Stored in kobo. Never a decimal. 0, 500000, or 4800000. |
| currency | String (default NGN) | Stored alongside amount so the pair is always complete |

### Subscription table
One row per user. Upserted on every successful payment.

| Column | Type | Decision |
|---|---|---|
| userId | String (unique, FK) | Unique constraint enforces one subscription per user at the database level |
| planId | FK to Plan | References the active plan |
| status | SubscriptionStatus | ACTIVE, CANCELLED, or EXPIRED |
| currentPeriodStart | DateTime | Set at payment verification time |
| currentPeriodEnd | DateTime | Calculated by `calculatePeriodEnd` — 1 month or 1 year from start |
| cancelAtPeriodEnd | Boolean | True means cancel at period end. User keeps access until then. |
| cancellationReason | String? | Optional. Populated from the cancellation prompt. |

### PaymentLog table
Append-only. Every stage of every payment is a separate row. Never
updated. Never deleted.

| Column | Type | Decision |
|---|---|---|
| stage | PaymentStage | INITIATED, VERIFIED, FULFILLED, or FAILED — one row per stage |
| amount | Int | In kobo. The amount at that specific stage. |
| providerReference | String? | Flutterwave transaction ID. Indexed for idempotency lookups. |
| metadata | Json? | Stores proration breakdown, cancellation reason, event type |

**Constraints that make invalid states impossible:**

- `userId @unique` on Subscription — a user cannot have two active
  subscriptions simultaneously
- `providerReference @@index` on PaymentLog — fast idempotency lookup
  before any processing
- `stage` as an enum — only valid payment stages can be recorded
- `amount Int` — storing as an integer makes it structurally impossible
  to store a decimal money value

---

## Section 5: The Concepts

### Minor units and why money is never a decimal

**What it is.** Minor units means storing money as the smallest
indivisible unit of a currency. For Nigerian Naira, the minor unit is
kobo. ₦5,000 is stored as 500,000 kobo. Every amount in SafeVoice is
an integer in kobo — never a decimal.

**Why it is needed.** Floating point numbers cannot represent most
decimal values exactly in binary. The number 0.1 in a computer is actually
0.10000000000000000555... Arithmetic on decimals produces rounding errors.
For money, rounding errors are not acceptable. Storing ₦5,000.50 as a
float and doing arithmetic on it can produce ₦5,000.4999999 or
₦5,000.5000001 depending on the operation. Storing 500050 kobo and doing
integer arithmetic always produces the exact result.

**How I implemented it.** Every amount in the Plan table, Subscription
table, and PaymentLog table is an Int column storing kobo. The
`lib/billing.ts` file works exclusively in kobo. Amounts are only
converted to Naira for display, by dividing by 100 in the UI components.
Flutterwave accepts amounts in Naira so the conversion `amount / 100`
happens only at the point of calling `initiatePayment`.

**What I chose against, and why.** Storing amounts as a Decimal type
with two fixed decimal places is common but still susceptible to
representation issues across different database drivers and programming
languages. Integer kobo storage is unambiguous in every layer of the
stack.

---

### The payment lifecycle — initiation, verification, and fulfilment

**What it is.** Every payment in SafeVoice goes through three distinct
stages recorded as separate rows in the PaymentLog table. Initiation is
when the payment request is created. Verification is when Flutterwave
confirms the payment was received. Fulfilment is when the subscription
is actually activated in SafeVoice's database.

**Why it is needed.** Without separating these three stages, there is no
audit trail. If a user is charged but their subscription is not activated,
there is no record of what happened at which point. If Flutterwave sends
a duplicate event, there is no way to know the payment was already
fulfilled. Keeping three separate rows means every state transition is
recorded permanently and can be reconstructed in a dispute.

**How I implemented it.** In `app/api/billing/checkout/route.ts`, an
INITIATED row is written before the Flutterwave call. In
`app/api/billing/verify/route.ts`, a VERIFIED row is written after
Flutterwave confirms the transaction, and a FULFILLED row is written after
the Subscription record is updated. The PaymentLog table is append-only
— no row is ever updated or deleted.

**What I chose against, and why.** Storing only the final subscription
status without a payment log is simpler but produces no history. If a
customer disputes a charge from three months ago, the only evidence
available is the current subscription status, which may have changed
several times since then. The log is the history.

---

### The payment log and what it proves in a dispute

**What it is.** The PaymentLog table is an immutable record of every
payment event. Each row has a timestamp, a stage, an amount, a
Flutterwave transaction reference, and a metadata field. Together these
rows tell the complete story of every transaction.

**Why it is needed.** When a customer disputes a charge, the payment
processor asks for evidence that the charge was legitimate and that the
service was delivered. Without a log, the only evidence is the current
state of the subscription — which may have been cancelled or modified
since the disputed charge. The log shows what happened, when it happened,
and what the user received.

**How I implemented it.** Every route that handles a payment event writes
to PaymentLog before returning a response. The proration breakdown for
upgrades is stored in the metadata field of the INITIATED row, including
days remaining, credit amount, and amount charged, so it is permanently
on record.

**What I chose against, and why.** Relying on Flutterwave's own
transaction history as the sole record means SafeVoice has no independent
audit trail. If the integration with Flutterwave changes, or if access
to the Flutterwave account is lost, the history is gone. Maintaining an
independent log gives SafeVoice control over its own evidence.

---

### Idempotency in payments

**What it is.** An idempotent payment operation produces the same result
whether it is processed once or many times. In SafeVoice, if Flutterwave
sends the same webhook twice for the same transaction, the second one is
recognised as a duplicate and ignored without creating any new records or
changing any subscription state.

**Why it is needed.** Flutterwave can send the same webhook multiple times
if its first delivery attempt times out or fails. Without idempotency, a
single payment could activate a subscription twice, create duplicate log
entries, or credit a user's account multiple times. This would be a
financial error.

**How I implemented it.** Before processing any webhook or verification
request, the server queries the PaymentLog table for a FULFILLED row with
the matching `providerReference`. If one exists, it returns
`Already processed` immediately without touching the Subscription table
or creating any new rows. The idempotency key is the Flutterwave
transaction ID stored in `providerReference`.

**What I chose against, and why.** Using the transaction reference in a
separate idempotency table is an alternative. I chose to query the
PaymentLog directly because a FULFILLED row already means the payment was
processed — it is the natural idempotency signal without needing a
separate table.

---

### Webhook signature verification

**What it is.** When Flutterwave sends a webhook to SafeVoice, it
includes a `verif-hash` header containing a secret string. SafeVoice
checks this header against the `FLW_WEBHOOK_HASH` environment variable
before processing the webhook. If the header is missing or wrong, the
webhook is rejected immediately.

**Why it is needed.** Without signature verification, anyone who knows
the webhook URL can send fake payment events to SafeVoice. A malicious
actor could send a fabricated `charge.completed` event and activate a
subscription without paying. Signature verification proves the event
came from Flutterwave and not from an attacker.

**How I implemented it.** The `verifyWebhookSignature` function in
`lib/flutterwave.ts` compares the `verif-hash` header against
`process.env.FLW_WEBHOOK_HASH`. The same string is configured in the
Flutterwave dashboard under Settings → Webhooks → Secret Hash. The
webhook route returns HTTP 401 if the signatures do not match.

**What I chose against, and why.** HMAC-SHA256 signature verification
is a more cryptographically robust alternative used by Stripe. Flutterwave
uses a simpler shared secret approach. I used Flutterwave's native method
because it is what the provider supports and because the shared secret
is sufficient when stored securely in environment variables.

---

### Proration

**What it is.** Proration is the calculation of a fair partial charge
when a user upgrades their plan mid-cycle. Instead of charging the full
new plan price, the system calculates how many days of the current plan
are unused, converts that to a credit, and charges only the difference.

**Why it is needed.** Without proration, upgrading mid-cycle would either
overcharge the user (full new plan price with no credit for the current
plan) or require cancelling and restarting the billing cycle, losing the
days already paid for. Proration makes upgrades fair and transparent.

**How I implemented it.** The `calculateProration` function in
`lib/billing.ts` takes the current period start, period end, current plan
amount, and new plan amount. It calculates days remaining and total days
using ceiling division, computes the credit as a floor division to avoid
decimal amounts, and subtracts from the new plan amount.

**Real numbers from my test:**
- Current plan: Monthly at ₦5,000 (500,000 kobo)
- Period start: 12 days ago
- Period end: 18 days from now
- Total days: 30
- Days remaining: 18
- Credit: floor(18/30 × 500,000) = 300,000 kobo = ₦3,000
- New plan: Yearly at ₦48,000 (4,800,000 kobo)
- Amount charged: 4,800,000 − 300,000 = 4,500,000 kobo = **₦45,000**

```ts
const creditAmount = Math.floor((daysRemaining / totalDays) * currentAmount)
const amountToCharge = Math.max(0, newAmount - creditAmount)
```

**What I chose against, and why.** Charging the full new plan price
and giving a credit on the next invoice is an alternative. This is
simpler to implement but requires a credit system. Charging only the
prorated amount immediately is cleaner for the user and requires no
credit tracking.

---

### Cancellation and period-end access

**What it is.** When a user cancels their subscription, SafeVoice does
not immediately remove their access. Instead, it sets `cancelAtPeriodEnd`
to true on the Subscription record. The user keeps full access until
`currentPeriodEnd`, after which the subscription moves to the free plan.

**Why it is needed.** The user paid for a full billing period. Cutting
off access immediately on cancellation would mean taking payment for a
period and then not delivering it. This is a legal and ethical obligation
in most jurisdictions — you cannot take money for a service and then not
provide it.

**How I implemented it.** The cancel route sets `cancelAtPeriodEnd: true`
and saves the optional cancellation reason. The billing page reads this
flag and shows a "CANCELLING" status with the access-until date. The
cancellation event is logged in PaymentLog with the access-until date
in the metadata field.

**What I chose against, and why.** Immediate cancellation with a refund
is an alternative. This is more complex — it requires calculating a
refund amount and initiating a refund through Flutterwave. Period-end
access is simpler, fairer, and the standard practice for subscription
businesses.

---

### Why card details are never stored — PCI scope

**What it is.** SafeVoice never receives, processes, or stores any card
number, CVV, expiry date, or PIN. The user enters their card details
directly on Flutterwave's hosted payment page, not on SafeVoice's pages.

**Why it is needed.** Storing card details makes a system subject to
PCI DSS (Payment Card Industry Data Security Standard) compliance
requirements. PCI DSS is a set of security standards that require annual
audits, penetration testing, network segmentation, and significant
engineering investment. A startup or bootcamp project that stores card
details and is not PCI compliant is a serious security and legal liability.

**How I implemented it.** SafeVoice uses Flutterwave's hosted payment
link approach. The `initiatePayment` function returns a URL on
Flutterwave's domain. The user is redirected there to enter their card
details. Flutterwave processes the payment and redirects back to
SafeVoice with only a transaction ID. SafeVoice never sees the card.

**What I chose against, and why.** Collecting card details directly in
SafeVoice's own form using Flutterwave's inline SDK would give a smoother
user experience without a redirect. But it would bring card data into
SafeVoice's domain, creating PCI scope. The redirect approach keeps
SafeVoice completely outside PCI scope with no compliance burden.

---

### Rate limiting on payment endpoints

**What it is.** The checkout initiation endpoint is rate limited so that
a single IP address cannot trigger unlimited payment initiations in a
short period.

**Why it is needed.** Without rate limiting, a malicious actor could
script thousands of checkout initiations, each creating a PaymentLog
row and making a request to Flutterwave's API. This could exhaust
Flutterwave API rate limits, fill the PaymentLog table with junk data,
and create noise that makes real payment logs hard to audit.

**How I implemented it.** The existing `signUpRateLimit` from
`lib/ratelimit.ts` is reused on the checkout endpoint with a
`checkout:` prefix to keep the rate limit bucket separate from signup.
It uses Upstash Redis with a sliding window algorithm.

**What I chose against, and why.** A separate dedicated rate limiter
for billing would be cleaner and allow different thresholds. I reused
the existing limiter to avoid adding complexity during the assessment
window. In production, billing endpoints would have their own dedicated
rate limit configuration.

---

## Section 6: What Went Wrong

### Problem 1: Flutterwave webhook URL rejecting localhost

**Symptom.** When setting up the Flutterwave webhook in the dashboard,
the webhook URL field rejected `http://localhost:3000/api/billing/webhook`
with an invalid URL error.

**Investigation.** I checked whether the URL format was wrong — it was
not. I tried variations of the localhost URL. All were rejected.

**Cause.** Flutterwave requires a publicly accessible URL for webhooks.
Localhost is only accessible on the local machine. Flutterwave's servers
cannot reach it.

**Fix.** I installed ngrok which creates a secure tunnel from a public
URL to localhost. Running `ngrok http 3000` produced a public URL at
`https://certified-scorecard-coffee.ngrok-free.dev`. I updated the
Flutterwave webhook URL to use the ngrok address followed by
`/api/billing/webhook`.

---

### Problem 2: Neon database going to sleep during testing

**Symptom.** While testing the billing flow, the browser showed a Prisma
error: `Can't reach database server at ep-sweet-leaf-zalixdbs-pooler`.
The error appeared after a period of inactivity.

**Investigation.** I checked the Neon dashboard. The database status
showed it had been paused automatically.

**Cause.** Neon's free tier automatically pauses databases after 5
minutes of inactivity to save resources. The first request after the
pause fails while the database wakes up.

**Fix.** I manually resumed the database from the Neon dashboard and
waited 30 seconds for it to become active again. I also updated
`lib/db.ts` to pass the `datasources` configuration explicitly to
Prisma, which helps it reconnect cleanly after the database wakes up
rather than throwing an unhandled error.

---

### Problem 3: The @types/flutterwave-node-v3 package does not exist

**Symptom.** Running `npm install --save-dev @types/flutterwave-node-v3`
returned a 404 error — package not found.

**Investigation.** I checked the npm registry. No `@types` package exists
for `flutterwave-node-v3`.

**Cause.** The Flutterwave Node.js SDK does not have a community-maintained
types package on the DefinitelyTyped registry.

**Fix.** I skipped the types package entirely and used direct fetch calls
to the Flutterwave REST API in `lib/flutterwave.ts` instead of using the
SDK. I defined my own TypeScript interfaces for the Flutterwave response
shapes. This gave full type safety without depending on an SDK.

---

## Section 7: What This Slice Does Not Handle

**Outside the brief by design:**
- Actual subscription renewal — the system records periods but does not
  automatically renew or charge at period end. A production system would
  require a scheduled job or Flutterwave's recurring billing feature.
- Invoice generation — no PDF invoices are produced.
- Multi-currency support — NGN only.
- Trial periods — no free trial logic exists.
- Refunds — cancellation retains access but no refund is initiated.

**Would need before real users:**
- A production webhook URL — ngrok URLs expire. A deployed server with
  a permanent URL is required.
- Scheduled job for period-end processing — when `cancelAtPeriodEnd` is
  true and `currentPeriodEnd` passes, the subscription should
  automatically move to the free plan. This requires a cron job that
  does not exist yet.
- Flutterwave live mode keys — all testing used test mode keys. Live
  mode requires business verification with Flutterwave.
- Email receipts — no confirmation email is sent after a successful
  payment.

**Left out due to time:**
- Automated tests for the billing routes and proration calculation.
- A proper admin view showing all subscriptions across all users.

---

## Section 8: If I Built This Again

If I built this again, I would implement the payment log as the single
source of truth for subscription state from the start, deriving the
current subscription status by querying the most recent FULFILLED log
entry rather than maintaining a separate mutable Subscription record.
The current design keeps a Subscription table that is updated on every
payment event, which means the table stores the present but not the
history — the log stores the history. In a dispute, the log is what
matters. Building the system so that entitlement is derived directly
from the log would have made both the code simpler and the audit trail
more reliable, because there would be no possibility of the Subscription
record and the PaymentLog ever being out of sync.