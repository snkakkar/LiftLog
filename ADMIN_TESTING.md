# Admin Dashboard & User Testing Guide

## Setup

1. Ensure `.env` has `ADMIN_EMAILS` set (comma-separated admin emails). Default: `migrated@liftlog.local`
2. Restart the dev server after changing env vars.

---

## How to Test

### 1. Sign in as admin

- Go to http://localhost:3000/login
- Email: `migrated@liftlog.local`
- Password: `changeme`
- You should see an **Admin** link in the header after signing in.

### 2. View admin dashboard

- Click **Admin** in the header, or go to http://localhost:3000/admin
- You should see:
  - **Platform stats**: Total user count
  - **Create account**: Form to create new users with temp passwords

### 3. Create a new user (admin flow)

1. On the Admin dashboard, fill in:
   - **Email**: e.g. `testuser@example.com`
   - **Name** (optional): e.g. `Test User`
   - **Temporary password**: e.g. `TempPass123` (min 8 chars)
2. Click **Create user**
3. The response shows the new user’s email and temp password—share these with the user.

### 4. Sign in as the new user

1. Sign out (click **Sign out** in the header)
2. Go to http://localhost:3000/login
3. Sign in with the new user’s email and temp password
4. The new user should not see the Admin link (unless their email is in `ADMIN_EMAILS`)

### 5. Change password (user flow)

1. While signed in as the new user, go to **Profile**
2. Open the **Password** tab
3. Enter:
   - **Current password**: the temp password
   - **New password**: at least 8 characters
4. Click **Change password**
5. Sign out and sign in again with the new password to confirm it works.

### 6. Self-signup (public flow)

1. Sign out
2. Go to http://localhost:3000/signup
3. Enter email, name, and password (min 8 chars)
4. After signup you are signed in automatically
5. Go to **Profile → Password** to change the password if needed.

---

## Summary

| Action              | Where                    | Who can do it      |
|---------------------|--------------------------|--------------------|
| View user count     | Admin dashboard          | Admins only        |
| Create user + temp pw| Admin dashboard          | Admins only        |
| Change own password | Profile → Password tab   | Any signed-in user |
| Sign up (new account)| /signup                 | Anyone             |
