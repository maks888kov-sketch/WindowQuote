# Notes for tester (admin delete)
1) Preconditions
Set env vars: ADMIN_URL, ADMIN_EMAIL, ADMIN_PASS.
Admin account must be org admin. Target user must exist and must not be the same as logged-in admin.

2) Login path
Open ${ADMIN_URL}/auth.
Fill email/password inputs and click Sign in.

3) Navigate to admin users list
Go to ${ADMIN_URL}/admin/users after login.
Wait for markers and table.

4) Delete action
In a row: click Delete, accept confirm dialog.
PASS = target row/email disappears AND (optional) notice shows 'User deleted.'.

5) Common fail reasons
- Missing server env for Supabase admin client
- Not admin membership
- Trying to delete self
