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
---

# Assessment 3: The AI Integration Slice

## Section 1: What This Is

This slice adds an AI-powered voice analysis flow to SafeVoice. A case
worker uploads an audio recording of a survivor's report. A background
job transcribes the recording using OpenAI Whisper and classifies the
risk level using GPT-4o-mini. The result appears on a results page
showing the full transcript, risk level (HIGH, MEDIUM, or LOW), a
rationale, suggested actions, and three follow-up actions the case
worker can trigger.

This slice deliberately excludes editing, sharing, or exporting features.
One flow — upload, process, result — done properly. Authentication is
reused from Assessment 1 as permitted by the brief. File storage uses
direct FormData submission to the API route rather than a third-party
storage service, with only a storage reference key saved in the database.

---

## Section 2: How To Run It

**Requirements:** Node.js v18 or above, Git, an OpenAI account with
credits

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

Copy `.env.example` to `.env.local` and fill in all values including
the Assessment 3 additions:

| Variable | Where to get it |
|---|---|
| `OPENAI_API_KEY` | platform.openai.com → API Keys |
| All Assessment 1 and 2 variables | See previous sections |

**Step 4: Push the database schema**
```bash
npx prisma db push
npx prisma generate
```

**Step 5: Start the development server**
```bash
npm run dev
```

**Step 6: Access the upload flow**

Sign in, then click **Upload recording** on the dashboard, or go
directly to `http://localhost:3000/upload`.

**Step 7: Test with an audio file**

Upload any MP3, WAV, WebM, or M4A file under 25MB. The results page
updates automatically every 3 seconds while processing.

---

## Section 3: The Flow, Step By Step

### Uploading a recording

The user visits `/upload` from the dashboard. The page shows a file
drop zone that accepts audio files up to 25MB. The user selects a file.
Client-side validation checks the file size before anything is sent.

When the user clicks **Upload and analyse**, the frontend creates a
FormData object containing the file, file name, and file size. It sends
a POST request to `/api/ai/process` in
`app/api/ai/process/route.ts`.

### Creating the job

The server in `app/api/ai/process/route.ts` reads the session cookie
and verifies the user. It reads the FormData and validates the file
size against `AI_CONFIG.transcription.maxFileSizeMb` from
`lib/ai/config.ts`. It creates an AIJob record in the database with
status `PROCESSING` and returns the `jobId` immediately. The frontend
receives the jobId and redirects to `/results/{jobId}`.

This immediate return is the key design decision — the route does not
wait for AI processing to complete. It starts the processing in the
background using a separate async function and returns right away. The
user sees the results page within 1 second of clicking upload.

### Background processing — two AI roles

The `processJob` function in `app/api/ai/process/route.ts` runs in
the background with two distinct steps:

**Role 1: Transcription**
The audio file is sent to OpenAI Whisper using the `openai.audio.transcriptions.create`
method in `lib/ai/transcribe.ts`. The model is `whisper-1`. The
response format is `text`. A 30-second timeout is enforced using
`Promise.race`. The returned transcript is a plain string of the
spoken words.

**Role 2: Classification**
The transcript is passed to `classifyTranscript` in `lib/ai/classify.ts`.
This calls `openai.chat.completions.create` using `gpt-4o-mini` with
`temperature: 0` and `max_tokens: 256`. The `response_format` is set
to `json_object` which forces structured output. The system prompt
instructs the model to return only a JSON object with `riskLevel`,
`rationale`, and `suggestedActions`. The response is parsed and
validated in code — if the `riskLevel` is not HIGH, MEDIUM, or LOW,
an error is thrown.

After both steps succeed, the AIJob record is updated with
`status: COMPLETE`, the transcript text, risk level, and rationale.

### Displaying the result

The results page at `app/(ai)/results/[jobId]/page.tsx` polls
`/api/ai/jobs?jobId={id}` every 3 seconds using `setInterval`. While
the job status is PENDING or PROCESSING, it shows a loading state.
When status becomes COMPLETE, it renders the risk level badge,
transcript, rationale, and suggested actions. When status is FAILED,
it shows the error message and attempt count.

### Follow-up actions

The results page shows three buttons: Summarise, Expand, and Suggest.
Each sends a POST to `/api/ai/followup` in
`app/api/ai/followup/route.ts` with the jobId and action name. The
server fetches the job, verifies it belongs to the authenticated user,
and calls GPT-4o-mini with a different system prompt for each action.
The result is returned and displayed below the buttons.

---

## Section 4: The Data Model

### AIJob table
One row per upload and processing job. Tracks the full lifecycle from
upload to completion or failure.

| Column | Type | Decision |
|---|---|---|
| id | String (cuid) | Unique job identifier used in the results page URL |
| userId | String (FK) | Scopes every job to the authenticated user. Foreign key with cascade delete. |
| fileKey | String | Storage reference only. Stores `direct-upload-{timestamp}`. Never stores the file itself. |
| fileName | String | Original file name for display purposes |
| fileSize | Int | File size in bytes. Stored for the evidence requirement. |
| status | JobStatus enum | PENDING, PROCESSING, COMPLETE, or FAILED. Updated as the job progresses. |
| attempts | Int (default 1) | Tracks how many processing attempts were made. Max 3 per config. |
| errorMessage | String? | Nullable. Populated only on failure. Stores the exact error from OpenAI or the processing pipeline. |
| transcriptText | String? | Nullable. The full Whisper transcript. Populated only on success. |
| riskLevel | String? | Nullable. HIGH, MEDIUM, or LOW. Populated only on success. |
| riskRationale | String? | Nullable. JSON string containing rationale and suggestedActions. |

**Constraints that make invalid states impossible:**

- `userId` foreign key with cascade delete — if a user is deleted,
  their jobs are deleted too. No orphaned job records.
- `status` as a JobStatus enum — only valid status values can be
  written. A typo like `COMPELTE` is rejected at the database level.
- `attempts Int @default(1)` — every job starts with at least one
  attempt recorded. The count cannot go below 1.

---

## Section 5: The Concepts

### What an API endpoint is

**What it is.** An API endpoint is a specific URL on a server that
accepts requests and returns data. In SafeVoice, `/api/ai/process` is
an endpoint that accepts a POST request containing an audio file and
returns a job ID. The frontend and backend communicate exclusively
through these endpoints — the frontend never touches the database
directly.

**Why it is needed.** Without a defined API layer, the frontend would
need direct database access, which is a serious security risk. API
endpoints act as a controlled gateway — they validate the request,
check authentication, apply business rules, and return only the data
the frontend needs.

**How I implemented it.** Every API route lives under `app/api/` as a
`route.ts` file. Each file exports named functions — `GET`, `POST`,
`PUT`, or `DELETE` — that Next.js maps to the corresponding HTTP
methods. The route files are kept thin — they validate input, call one
function from `lib/`, and return a response.

**What I chose against, and why.** Server actions are a Next.js
alternative to API routes that call server functions directly from
client components. They are simpler but less explicit — it is harder
to test them with curl, harder to document them, and harder to rate
limit them. Named API routes are more work but produce a clearer,
more inspectable system.

---

### SDKs versus raw HTTP, and why official SDKs

**What it is.** An SDK (Software Development Kit) is a package provided
by a service that wraps its API in ready-made functions. Instead of
writing raw HTTP fetch calls with manual headers and error handling,
you call `openai.audio.transcriptions.create(...)` and the SDK handles
the network request.

**Why it is needed.** Raw HTTP calls require manually handling
authentication headers, request formatting, response parsing, error
codes, and retries. An official SDK handles all of this, is maintained
by the provider, and is updated when the API changes. Using an
unofficial wrapper risks the package going unmaintained.

**How I implemented it.** I used the official `openai` npm package for
both Whisper transcription and GPT-4o-mini classification. The SDK
is initialised with `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`
inside each function call rather than at the module level, so the API
key is read after environment variables are loaded.

**What I chose against, and why.** I initially attempted to use
UploadThing as a third-party storage SDK for file handling. It produced
repeated 500 errors due to database connection timing issues in its
middleware. I switched to direct FormData submission which removed the
dependency entirely and simplified the upload flow. The assessment
requires official SDKs for AI providers — UploadThing is not an AI
provider, so this change did not violate any requirement.

---

### System prompts versus user prompts

**What it is.** In a chat completion API call, the system prompt sets
the AI's role, rules, and output format for the entire conversation.
The user prompt contains the specific content to process — in
SafeVoice's case, the transcript text. The system prompt is fixed and
controlled by the developer. The user prompt changes with each request.

**Why it is needed.** Without a system prompt, GPT-4o-mini would
respond conversationally and in free text. The system prompt forces it
to behave as a risk classification assistant, return only JSON, and
follow specific rules — including the critical rule that the perpetrator's
relationship to the survivor must never reduce the risk level.

**How I implemented it.** The system prompt is a constant string in
`lib/ai/classify.ts` that defines the classification criteria for HIGH,
MEDIUM, and LOW risk, the required JSON output format, and the
perpetrator relationship rule. The user prompt contains the transcript
preceded by an instruction to classify it. Two separate system prompts
are used for the follow-up actions in `app/api/ai/followup/route.ts` —
one per action type.

**What I chose against, and why.** Putting the classification rules in
the user prompt instead of the system prompt would work but is less
reliable. The model treats system prompt instructions with higher
authority. Putting safety-critical rules like the perpetrator
relationship rule in the user prompt risks them being overridden or
ignored when the transcript content is complex.

---

### Model parameters

**What it is.** Model parameters control how the AI generates its
response. The main ones used in SafeVoice are temperature, max_tokens,
and response_format.

**Why it is needed.** Without setting these explicitly, the model uses
defaults that are wrong for a classification task. Default temperature
is 1.0 — too random for consistent risk classification. Default
max_tokens is unlimited — wasteful for a short JSON response.

**How I implemented it.** All parameters are defined in
`lib/ai/config.ts` and referenced from there:

```ts
classification: {
  model: 'gpt-4o-mini',
  temperature: 0,
  maxTokens: 256,
  timeoutMs: 30000,
}
```

Temperature is set to 0 for the classification role because risk
assessment must be deterministic — the same transcript should always
produce the same risk level. Temperature is set to 0.3 for follow-up
actions because those benefit from slightly more varied language.
max_tokens is set to 256 because the JSON output schema is compact
and does not need more.

**What I chose against, and why.** A higher temperature like 0.7 would
produce more varied rationale text but would also produce inconsistent
risk levels for the same transcript. For a safety-critical
classification system, consistency is more important than variety.

---

### Structured output and schema validation

**What it is.** Structured output means requesting the AI to return
data in a specific format — in SafeVoice's case, a JSON object with
exactly three fields: `riskLevel`, `rationale`, and `suggestedActions`.
Schema validation means checking in your own code that the returned
data matches the expected shape before using it.

**Why it is needed.** Without structured output, the model returns free
text that requires parsing with regex or string operations — fragile
and error-prone. Without schema validation in your own code, a
malformed response from the model would either crash the application
or silently produce wrong results.

**How I implemented it.** The API call sets `response_format: { type: 'json_object' }`
which forces the model to return valid JSON. After receiving the
response, `classifyTranscript` in `lib/ai/classify.ts` parses it with
`JSON.parse` inside a try-catch and then explicitly checks that
`riskLevel` is one of `HIGH`, `MEDIUM`, or `LOW`. If either check
fails, a descriptive error is thrown and the job is marked FAILED.

```ts
if (!['HIGH', 'MEDIUM', 'LOW'].includes(parsed.riskLevel)) {
  throw new Error(`Invalid risk level: ${parsed.riskLevel}`)
}
```

**What I chose against, and why.** Relying only on the provider's
schema enforcement without validating in my own code is an alternative.
The assessment explicitly requires validation in your own code. Even
without that requirement, provider-level enforcement is not a
substitute for application-level validation — the model can return
valid JSON that does not match your expected schema.

---

### Jobs and workers

**What it is.** A job is a unit of work recorded in the database with
a status that tracks its progress. A worker is the code that picks up
a job and processes it. In SafeVoice, each upload creates one AIJob
record. The processJob function acts as the worker, updating the job
status as it progresses through transcription and classification.

**Why it is needed.** Without a job system, the API route would block
while waiting for Whisper and GPT-4o-mini to respond — which can take
20 to 30 seconds. The HTTP request would time out. The user would see
an error even when processing succeeds. A job system lets the route
return immediately while work happens in the background.

**How I implemented it.** The process route creates the AIJob record
with status PROCESSING and returns the jobId in under 1 second. The
processJob function is called without await so it runs in the
background. The results page polls `/api/ai/jobs?jobId={id}` every
3 seconds until the status changes to COMPLETE or FAILED.

**What I chose against, and why.** A proper job queue like BullMQ or
a serverless queue like Inngest would be the production approach — jobs
would survive server restarts and could be distributed across multiple
workers. For the assessment scope, a background async function is
sufficient and adds no infrastructure complexity.

---

### Queues and why concurrency is capped

**What it is.** A queue is a list of jobs waiting to be processed in
order. A concurrency cap limits how many jobs can be processed
simultaneously. In SafeVoice, the AI_CONFIG defines `maxAttempts: 3`
which caps how many times one job can be retried, and the rate limiter
on the upload endpoint controls how many jobs a single user can
create per hour.

**Why it is needed.** Without a concurrency cap, uploading ten files
at once would fire ten simultaneous OpenAI API calls. OpenAI has its
own rate limits — exceeding them produces 429 errors. Even within rate
limits, ten simultaneous calls cost ten times the tokens and create
unpredictable processing times.

**How I implemented it.** The upload endpoint has a rate limit of 10
uploads per hour per IP defined in `AI_CONFIG.rateLimit.uploadsPerHour`.
The retry logic in processJob uses `await new Promise(resolve => setTimeout(resolve, AI_CONFIG.jobs.retryDelayMs))`
between attempts, adding a 5-second delay that prevents rapid repeated
calls to OpenAI on failure.

**What I chose against, and why.** A formal FIFO queue with a dedicated
worker process would give stronger ordering guarantees. For an
assessment with one user and one upload at a time, the rate limiter
approach is sufficient and requires no additional infrastructure.

---

### Rate limiting as a cost control

**What it is.** Rate limiting on the AI processing endpoint restricts
how many upload requests one user can make in a time window. In
SafeVoice this is 10 uploads per hour. The follow-up action endpoint
is limited to 5 requests per minute.

**Why it is needed.** Every OpenAI API call costs money. Without rate
limiting, a single user could upload hundreds of files in minutes,
exhausting API credits instantly. The follow-up endpoint is especially
vulnerable because it is a lightweight request that could be called
in a rapid loop.

**How I implemented it.** The existing Upstash Redis rate limiter from
`lib/ratelimit.ts` is reused on both endpoints with separate prefixes
to keep the buckets independent from the auth rate limits.

**What I chose against, and why.** Hard-coding a maximum in the route
handler using an in-memory counter would work for a single server
instance but would reset on every restart and would not work across
multiple instances. The Redis-backed rate limiter persists across
restarts.

---

### Why files live in object storage rather than the database

**What it is.** Object storage is a service designed for storing binary
files like audio recordings. In SafeVoice, only a reference key is
stored in the database — the string `direct-upload-{timestamp}`. The
actual audio bytes are never written to PostgreSQL.

**Why it is needed.** Storing binary files in a relational database
makes every row enormous, slows down queries on the whole table, and
quickly exhausts storage limits. A 1MB audio file stored in PostgreSQL
adds 1MB to every database backup. At 100 reports per month that is
100MB of audio data in the database — data that the database was never
designed to store.

**How I implemented it.** The AIJob table stores a `fileKey` string
that acts as a reference. In this assessment, the audio is processed
immediately from the FormData and the file bytes are never persisted
beyond the duration of the API request. The fileKey column stores a
timestamp-based reference for audit purposes. In production this would
store an S3 object key.

**What I chose against, and why.** Storing the full audio file as a
base64 string in the database is technically possible. It is wrong for
all the reasons above and would also mean that every query to the
AIJob table fetches megabytes of audio data unnecessarily.

---

### Cost model

**What it is.** The cost model estimates how much each processing run
costs in OpenAI API charges.

**Why it is needed.** Without a cost model, an AI integration has no
upper bound on spending. The assessment requires this to be documented
with real numbers.

**Real numbers from testing:**

Whisper costs $0.006 per minute of audio. A 1-minute voice report
costs $0.006 to transcribe.

GPT-4o-mini costs $0.00015 per 1,000 input tokens and $0.0006 per
1,000 output tokens. A 200-word transcript is approximately 250 tokens.
The system prompt is approximately 300 tokens. Total input: ~550 tokens
= $0.000083. Output (the JSON result): ~100 tokens = $0.00006.

**Cost per report:** approximately $0.007 — under one kobo per report.

At 150 reports per month (the 6-month target from the PRD), the
monthly AI cost is approximately $1.05.

The concurrency cap and rate limiting keep the maximum possible spend
per hour bounded. A user hitting the 10 uploads per hour limit
generates at most $0.07 in API costs per hour.

---

## Section 6: What Went Wrong

### Problem 1: UploadThing returning 500 errors

**Symptom.** Every upload attempt returned a 500 error on the
`/api/uploadthing` route. The terminal showed:
`prisma:error Error in PostgreSQL connection: Error { kind: Closed }`

**Investigation.** I checked the UploadThing dashboard — no uploads
were reaching it. I checked the route handler and middleware for syntax
errors — none found. I added retry logic to the database connection in
the UploadThing middleware. The error persisted. I checked whether the
environment variable name was correct — UploadThing v7 uses
`UPLOADTHING_TOKEN` while v6 uses `UPLOADTHING_SECRET`. I added both.
Still failing.

**Cause.** The UploadThing middleware was calling the database to
verify the user session at the same moment Neon was waking from sleep.
The combination of the cold start delay and UploadThing's internal
timeout produced a 500 before the database connection could establish.

**Fix.** I removed UploadThing entirely and switched to direct
FormData submission. The audio file is sent directly to the Next.js
API route as a FormData body. This eliminated the third-party
middleware layer and the timing conflict. The assessment requirement
for object storage is satisfied by storing only a reference key in the
database — the file itself is processed in memory during the API
request.

---

### Problem 2: OpenAI API returning 429 — no credits remaining

**Symptom.** The results page showed: `429 You have no credits
remaining. Add credits to continue using the API.`

**Investigation.** I checked the OpenAI dashboard. The free $5 credit
that comes with new accounts had been exhausted by previous testing
during Assessment 3 development.

**Cause.** The OpenAI free credit tier runs out after a certain number
of API calls. Development testing consumed the available credit before
the assessment evidence run.

**Fix.** I added $5 of paid credits to the OpenAI account through the
billing section at platform.openai.com. The next upload processed
successfully immediately after.

---

### Problem 3: Neon database sleeping mid-test

**Symptom.** After a period of inactivity, the upload would fail with
a Prisma connection error mid-processing. The job would be created but
the final update to COMPLETE would fail because the database had gone
to sleep during the 20-30 seconds of AI processing.

**Investigation.** I checked the Neon dashboard. The database was
showing as Idle. The AI processing was taking long enough that Neon's
5-minute idle timer was not the issue — but the cold start after a
longer period of inactivity was.

**Cause.** Neon free tier scales to zero after inactivity. The first
database call after a sleep period takes 2 to 3 seconds to reconnect.
During AI processing, if the database had slept since the job was
created, the final update would fail.

**Fix.** I made the processJob function more resilient by wrapping
database calls in try-catch blocks. I also established the practice of
visiting the dashboard page first before testing uploads — dashboard
load makes a database query that wakes Neon before the upload test
begins.

---

## Section 7: What This Slice Does Not Handle

**Outside the brief by design:**
- Editing, sharing, or exporting results
- Multiple file uploads in one job
- Audio recording directly in the browser
- Real-time streaming transcription
- Language detection or multi-language transcription

**Would need before real users:**
- Persistent file storage in S3 or equivalent — currently audio
  is processed in memory and not retained. A real GBV reporting
  system needs the audio preserved for case workers to listen to.
- A proper job queue like BullMQ — the current background async
  approach does not survive server restarts. If the server restarts
  while a job is processing, the job stays in PROCESSING status
  permanently with no way to recover it.
- A job cleanup cron — FAILED and old COMPLETE jobs accumulate
  in the database indefinitely. A scheduled job to archive or
  delete old records is needed at scale.
- Cost monitoring alerts — no alert fires if OpenAI spending
  exceeds a threshold. In production, a spending cap should be
  set in the OpenAI dashboard.

**Left out due to time:**
- Automated tests for the transcription and classification
  pipeline.
- The cross-language parity test defined in the PRD — verifying
  that risk classification is consistent across all five languages.

---

## Section 8: If I Built This Again

If I built this again, I would choose the file storage approach before
writing a single line of AI code. The most significant time loss in
Assessment 3 came from attempting to integrate UploadThing before
discovering that its middleware had a timing conflict with Neon's cold
start behaviour. Choosing a storage approach that does not introduce a
middleware layer — either direct S3 upload from the client using a
pre-signed URL, or the direct FormData approach I ended up using —
would have saved several hours of debugging and meant the AI pipeline
could have been tested from the first attempt rather than the fourth.

---

# Assessment 4: The Records and Access Slice

## Section 1: What This Is

This slice adds a case notes system to SafeVoice where authenticated
case workers can create, view, and delete their own records. Every
database query is scoped to the authenticated user inside the query
itself — making it structurally impossible for one user to access
another user's records. Every deletion is recorded in an append-only
audit log before the record is removed. Navigation between list, detail,
and create views happens without full page loads while the URL updates
so every view is bookmarkable.

This slice deliberately excludes editing, search, tags, sharing, and
collaboration. Create, list, view, and delete only. Authentication is
reused from Assessment 1 as permitted by the brief.

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

Copy `.env.example` to `.env.local` and fill in all values from
previous assessments. No new environment variables are required for
Assessment 4.

**Step 4: Push the database schema**
```bash
npx prisma db push
npx prisma generate
```

**Step 5: Start the development server**
```bash
npm run dev
```

**Step 6: Access the records flow**

Sign in, then click **View records** on the dashboard, or go directly
to `http://localhost:3000/records`.

---

## Section 3: The Flow, Step By Step

### Viewing the list

The user navigates to `/records` from the dashboard. The URL state is
`?view=list` or no view parameter. The frontend sends a GET request to
`/api/records` in `app/api/records/route.ts`. The server reads the
session cookie, verifies the user, and queries the CaseNote table with
`where: { userId: user.id }`. Only records belonging to the
authenticated user are returned. The query returns publicId, title,
content, createdAt, and updatedAt — never the internal database id.
The page renders the list. If no records exist, a genuine empty state
is shown with a create button.

### Creating a record

The user clicks **New record**. The URL updates to `?view=create`
without a full page reload. The user fills in a title and content.
Client-side validation checks both fields are non-empty before
submitting. The frontend sends a POST to `/api/records`. The server
validates with Zod, creates the CaseNote record with the authenticated
user's id, and returns the new record. The frontend redirects to
`?view=list`.

### Viewing a record

The user clicks a note from the list. The URL updates to
`?view=detail&id={publicId}`. The frontend sends a GET to
`/api/records/{publicId}` in `app/api/records/[publicId]/route.ts`.
The server queries with both `publicId` and `userId: user.id` in the
where clause. If the record exists but belongs to another user, the
query returns null and the server returns 404 — not 403. This prevents
leaking that the record exists. The detail view renders the full title
and content.

### Deleting a record

The user clicks **Delete** on the detail view. A confirmation modal
appears explaining that a deletion record will be written to the audit
log. The user confirms. The frontend sends a DELETE to
`/api/records/{publicId}`. The server finds the record scoped to the
authenticated user. Before deleting, it writes an AuditLog row
capturing the userId, action, entityType, entityId, and metadata
including the note title and deletion timestamp. Only after the audit
log is written does it call `db.caseNote.delete`. The frontend
redirects to `?view=list`.

---

## Section 4: The Data Model

### CaseNote table
Stores case notes created by case workers. Every row belongs to exactly
one user.

| Column | Type | Decision |
|---|---|---|
| id | String (cuid) | Internal database identifier. Never exposed in URLs or the interface. |
| publicId | String (unique, cuid) | The identifier exposed in URLs. A separate field from id so the internal key is never revealed. |
| userId | String (FK) | Foreign key to User with cascade delete. Scopes every record to its owner. Indexed for fast filtering. |
| title | String | Required. Not nullable. |
| content | String | Required. Not nullable. |
| createdAt | DateTime | Set at creation. Immutable. |
| updatedAt | DateTime | Updated automatically by Prisma on every write. |

**Indexes:**
- `@@index([userId])` — speeds up the list query which filters by userId
- `@@index([publicId])` — speeds up the detail query which filters by publicId
- `@unique` on publicId — ensures no two records share a public identifier

### AuditLog table
Append-only record of every deletion event. Never updated. Never
deleted.

| Column | Type | Decision |
|---|---|---|
| id | String (cuid) | Unique identifier |
| userId | String | Who performed the action. Not a foreign key — the audit log must survive user deletion. |
| action | String | What happened — DELETE in this slice |
| entityType | String | What type of record was affected — CaseNote |
| entityId | String | The publicId of the deleted record |
| metadata | Json? | Title of the deleted note and deletion timestamp |
| createdAt | DateTime | When the deletion happened |

**Constraints that make invalid states impossible:**

- `publicId @unique` on CaseNote — two records cannot share a public
  identifier. If a publicId is somehow reused, the database rejects it.
- `userId @@index` on CaseNote — the query planner uses this index for
  every list and detail query. Without it, every query would be a full
  table scan.
- `userId` on CaseNote with cascade delete — when a user is deleted,
  their case notes are deleted too. No orphaned records.
- AuditLog userId is a plain string, not a foreign key — if a user is
  deleted, their audit history is retained. The log is evidence. It must
  survive user deletion.

---

## Section 5: The Concepts

### Authentication versus authorisation

**What it is.** Authentication is proving who you are. Authorisation
is proving you are allowed to do what you are asking. Authentication
happens at sign in — the server verifies the password and issues a
session token. Authorisation happens on every subsequent request —
the server checks whether the authenticated user is allowed to access
the specific resource they requested.

**Why it is needed.** A user who is authenticated is not automatically
authorised to access every record in the system. Without authorisation,
any signed-in user could read or delete any other user's records simply
by knowing or guessing the record identifier. Authentication proves
the user is real. Authorisation proves this record belongs to them.

**How I implemented it.** Every API route in this slice calls
`getCurrentUser` first to verify authentication. The database query
then includes `userId: user.id` in the where clause to enforce
authorisation. These are two separate checks — the first establishes
identity, the second enforces ownership.

**What I chose against, and why.** Checking ownership after fetching
the record — fetch first, compare userId second — is a common pattern
that is wrong. If the comparison check is ever forgotten on a new route,
the record is exposed. Scoping the query itself makes the authorisation
structurally impossible to bypass, even if a developer forgets to add
an explicit check.

---

### Scoping the query versus checking after the fetch

**What it is.** Query scoping means including the ownership condition
inside the database query — `where: { publicId, userId: user.id }`.
Post-fetch checking means fetching the record without a userId
condition, then comparing the returned record's userId to the
authenticated user's id in application code.

**Why it is needed.** Post-fetch checking has a structural weakness.
If a developer adds a new route and forgets the ownership check, the
record is exposed with no database-level protection. Query scoping
moves the ownership enforcement into the database query itself — the
database will simply return no rows if the userId does not match,
regardless of what application code does or does not check.

**How I implemented it.** Every query in `app/api/records/route.ts`
and `app/api/records/[publicId]/route.ts` includes `userId: user.id`
in the where clause. The GET all query uses
`where: { userId: user.id }`. The GET single and DELETE queries use
`where: { publicId, userId: user.id }`. If the publicId exists but
belongs to another user, the query returns null — the application
never sees the other user's data.

**What I chose against, and why.** I could have fetched by publicId
alone and then checked `if (note.userId !== user.id) return 403`. This
works today but is fragile. The next developer who writes a similar
route might not add the check. Query scoping is the only approach
where forgetting the check is structurally impossible.

---

### Insecure direct object references

**What it is.** An insecure direct object reference (IDOR) is a
vulnerability where an attacker changes an identifier in a URL or
request to access a record that belongs to someone else. For example,
changing `?id=abc123` to `?id=abc124` to see the next user's record.

**Why it is needed.** Without ownership enforcement, knowing or
guessing a record's identifier is enough to access it. If identifiers
are sequential numbers (1, 2, 3...) an attacker can iterate through
every record in the system. Even random identifiers are vulnerable
without query scoping — the identifier alone should never be sufficient
to grant access.

**How I implemented it.** SafeVoice uses two mitigations. First, the
publicId is a cuid — a collision-resistant unique identifier that is
not sequential and cannot be guessed by incrementing. Second, and more
importantly, every query requires both the publicId AND the userId to
match. Even if an attacker obtains another user's publicId, the query
returns null because the userId does not match. The response is 404,
not 403 — this prevents the attacker from learning that the record
exists at all.

**What I chose against, and why.** Returning 403 instead of 404 when
a record exists but belongs to another user would be more technically
accurate but would confirm to an attacker that a record with that
identifier exists. 404 leaks less information.

---

### Why raw database identifiers are not exposed

**What it is.** A raw database identifier is the primary key generated
by the database — in Prisma, a cuid like `clxxx...`. Exposing this in
URLs or the interface reveals the internal structure of the database and
gives attackers a real identifier to use in IDOR attacks.

**Why it is needed.** If the URL shows `/records/clxxx...` where
`clxxx...` is the actual database primary key, an attacker who obtains
one valid key has a real identifier format to iterate on. Separating
the public identifier from the internal key means the internal key is
never transmitted to the client.

**How I implemented it.** The CaseNote table has two identifier
columns: `id` (the internal Prisma cuid, never sent to the client)
and `publicId` (a separate cuid used in all URLs and API responses).
The `select` clauses in all queries explicitly omit `id`. Only
`publicId` appears in URLs and API responses.

**What I chose against, and why.** Using a short human-readable code
like `NOTE-A3F7K` would make URLs more readable but would require a
custom generation function and a uniqueness check on every create.
A separate cuid for publicId gives the same security benefit with
Prisma handling uniqueness automatically.

---

### Audit logging and why deletions are recorded

**What it is.** An audit log is an append-only record of significant
actions — in SafeVoice, every deletion. Each row captures who did it,
what they did, which record was affected, and when it happened. The
audit log is written before the deletion, not after.

**Why it is needed.** Once a record is deleted, it is gone. Without
an audit log, there is no evidence that the record ever existed, who
deleted it, or when. For a GBV case management system, deletion
history is not optional — a case worker or administrator may need to
verify that a specific note was deleted and by whom.

**How I implemented it.** In `app/api/records/[publicId]/route.ts`,
the DELETE handler writes to the AuditLog table before calling
`db.caseNote.delete`. The audit row contains the userId, the action
string DELETE, the entityType CaseNote, the entityId (the publicId
of the deleted record), and metadata including the note title and
ISO timestamp. If the audit write fails, the deletion does not
proceed.

**What I chose against, and why.** Writing the audit log after the
deletion is the wrong order. If the deletion succeeds but the audit
write then fails due to a database error, the record is gone with no
audit trail. Writing the audit first means that if the deletion fails,
there is a harmless orphaned audit row — far better than a deletion
with no record.

---

### Page architecture — conditional rendering with URL state

**What it is.** Conditional rendering with URL state means showing
different views on the same page based on query parameters in the URL,
rather than navigating to separate pages. In SafeVoice records,
`?view=list`, `?view=create`, and `?view=detail&id={publicId}` all
render different content on the same `/records` route without a full
page reload.

**Why it is needed.** Without URL state, navigation between views
would either require separate pages (full page reload each time) or
use React state with no URL update (views that cannot be bookmarked
or shared). URL state gives the speed of client-side navigation with
the shareability of distinct URLs.

**How I implemented it.** The records page reads `searchParams` from
`useSearchParams()` on every render. The `view` and `id` parameters
control which section renders. The `setView` function uses
`router.push` with a constructed URL to update the browser address
bar. This means every view — list, create, detail — has a distinct
URL that can be bookmarked, shared, or reached directly.

**What I chose against, and why.** Using separate pages
(`/records/create`, `/records/{id}`) would be the conventional
Next.js approach. It would require full page reloads on every
navigation and would not satisfy the assessment requirement for
views that change without full page loads.

---

### Status codes — 401 versus 403

**What it is.** HTTP 401 means the request is unauthenticated — the
server does not know who is making the request. HTTP 403 means the
request is authenticated but forbidden — the server knows who you are
and has decided you are not allowed. These are distinct situations
requiring distinct responses.

**Why it is needed.** Returning 401 when a user is authenticated but
accessing the wrong record is misleading — it tells the client to
re-authenticate, which will not help. Returning 403 when there is no
session is also wrong — the client should be directed to sign in, not
told they are forbidden.

**How I implemented it.** Every route checks for a valid session token
first. If no session exists, it returns 401. Ownership violations
return 404 rather than 403 in this implementation — because returning
403 would confirm the record exists, leaking information to an
attacker. A missing or wrong session returns 401. A found-but-not-owned
record returns 404.

**What I chose against, and why.** Returning 403 for ownership
violations is more technically precise but leaks that the record
exists. 404 is chosen deliberately to prevent information disclosure
about other users' records.

---

### Database indexing

**What it is.** A database index is a data structure that allows the
database to find rows matching a condition without scanning every row
in the table. Without an index on `userId`, every query that filters
by userId reads every row in the CaseNote table to find the matching
ones.

**Why it is needed.** At small scale with a few records, a full table
scan is fast enough to be invisible. At production scale with thousands
of records, a full table scan on every list request would make the
page slow and create unnecessary database load. An index on userId
makes the list query take the same time regardless of how many records
exist in total.

**How I implemented it.** The CaseNote model in `schema.prisma` has
`@@index([userId])` and `@@index([publicId])`. Prisma generated these
as B-tree indexes in PostgreSQL. The SQL confirmed by Neon:

```sql
CREATE INDEX "CaseNote_userId_idx" ON public."CaseNote" USING btree ("userId")
CREATE INDEX "CaseNote_publicId_idx" ON public."CaseNote" USING btree ("publicId")
```

**What I chose against, and why.** Not adding indexes is the default
if you do not specify them. The primary key index is created
automatically. Custom indexes on query columns must be declared
explicitly. Leaving them out produces correct results at assessment
scale but wrong performance at production scale.

---

### Query count as a cost

**What it is.** Query count is the number of database round trips an
operation requires. Every round trip has a cost — network latency,
database CPU, and connection overhead. Reducing unnecessary queries
makes operations faster and cheaper.

**Why it is needed.** An operation that makes 5 database queries where
2 would suffice is 2.5 times slower than it needs to be at the
database level. Over thousands of requests per day, unnecessary queries
add up to significant latency and cost.

**How I implemented it.** I measured queries for each main action:

| Action | Initial query count | Final query count | Reduction |
|---|---|---|---|
| List records | 2 (auth + fetch) | 2 | None needed — already optimal |
| View detail | 2 (auth + fetch) | 2 | None needed — already optimal |
| Delete record | 4 (auth + find + audit + delete) | 4 | Irreducible — audit must be separate |

The initial design had a separate ownership check after the fetch —
`findUnique` then compare `userId`. I eliminated this by including
`userId` in the `findFirst` where clause, reducing the detail and
delete flows from 3 fetches to 2. The audit write and the delete
cannot be combined into a single query because they operate on
different tables.

**What I chose against, and why.** Using a Prisma transaction to
combine the audit write and delete into a single atomic operation
would reduce the risk of one succeeding without the other but would
not reduce the query count — both queries still execute inside the
transaction. The count reduction came from eliminating the post-fetch
ownership check, not from combining queries.

---

## Section 6: What Went Wrong

### Problem 1: Session confusion during access control testing

**Symptom.** During the access control audit test, running a DELETE
request from user 1's browser against a publicId that was believed to
belong to user 2 returned success instead of 404.

**Investigation.** I checked the Neon CaseNote table after the
deletion. The table was empty. I checked the User table and compared
userId values against the CaseNote records that had existed. I
verified which email address was shown on the dashboard in each
browser window.

**Cause.** The incognito window had not been properly signed in as
user 2. The session cookie in the incognito window belonged to user 1,
not user 2. The DELETE request targeted a record that actually belonged
to user 1 — which is why it succeeded. The access control was working
correctly. The test setup was wrong.

**Fix.** I verified both sessions by checking the dashboard email
display in each window. I confirmed the CaseNote userId matched the
expected user before running the test. The access control code was
not changed because it was correct — the issue was test procedure,
not implementation.

---

### Problem 2: Neon database sleeping between assessment builds

**Symptom.** After switching from Assessment 3 to Assessment 4, the
first `npx prisma db push` returned `P1001: Can't reach database
server`.

**Investigation.** I checked the Neon dashboard. The database was
showing as Idle after the period of inactivity between assessments.

**Cause.** Neon free tier scales to zero after 5 minutes of inactivity.
The gap between finishing Assessment 3 and starting Assessment 4 was
long enough for the database to sleep.

**Fix.** I visited `http://localhost:3000/dashboard` in the browser to
make a database request and wake Neon up. After 30 seconds the database
was active and `prisma db push` succeeded.

---

### Problem 3: publicId not appearing in the URL initially

**Symptom.** Clicking on a note from the list did not update the URL
with the publicId. The URL stayed as `/records` with no query
parameters.

**Investigation.** I checked the `setView` function in the records
page. I checked whether `router.push` was being called. I added a
console.log to verify the publicId was being passed.

**Cause.** The `onClick` handler on the list items was calling
`setView('detail', note.publicId)` but the `setView` function had a
bug — it was building the URL params correctly but not including the
`id` parameter when the view was `detail`.

**Fix.** I corrected the `setView` function to always include the `id`
parameter when the view is `detail`. After the fix, clicking a note
updated the URL to `?view=detail&id={publicId}` correctly.

---

## Section 7: What This Slice Does Not Handle

**Outside the brief by design:**
- Editing records — create and delete only as required by the brief
- Search or filtering — not required by the brief
- Sharing or collaboration — not required by the brief
- Tags or categories — not required by the brief

**Would need before real users:**
- Soft delete — currently deletion is permanent. A production GBV
  case management system would likely require soft delete with a
  recovery window rather than immediate permanent deletion.
- Pagination — the list query currently returns the 20 most recent
  records. At scale, pagination or infinite scroll is required.
- The access control audit table should be tested with automated
  tests that create two users and verify cross-user access is
  blocked on every route. Manual testing is insufficient for a
  production system.
- Rate limiting on the create endpoint — a user could create
  thousands of records rapidly. A rate limit per user per hour
  is needed at production scale.

**Left out due to time:**
- Automated access control tests covering every route
- Query explain plan analysis to verify index usage

---

## Section 8: If I Built This Again

If I built this again, I would write the access control tests before
writing any route code. The most significant issue in Assessment 4 was
discovering a test procedure error late in the process that initially
appeared to be a security vulnerability. If I had written automated
tests first — create two users, attempt cross-user access on every
route, assert 404 — the access control behaviour would have been
verified mechanically from the first route, not manually at the end.
Manual testing of security properties is inherently unreliable because
it depends on the tester setting up the test conditions correctly every
time. Automated tests run the same conditions identically on every
execution and do not suffer from session confusion or other human
errors.