# Environment Files Location

## Where the .env files are:

The actual `.env` files are in their respective directories (they need to be there for the apps to work):

- **API**: `apps/api/.env` ✅ (exists and working)
- **Frontend**: `apps/web/.env.local` ✅ (exists and working)

## Visible copies in root:

I've created visible copies in the root folder so you can see them:

- **`env.api.txt`** - Copy of `apps/api/.env`
- **`env.web.txt`** - Copy of `apps/web/.env.local`

## Why .env files are hidden:

- Files starting with `.` are hidden by default in many systems
- They're in `.gitignore` so they don't get committed to git
- Your IDE might hide them by default

## To view/edit the actual .env files:

**In VS Code:**
1. Open the file explorer
2. Navigate to `apps/api/` or `apps/web/`
3. The `.env` files should be there (you might need to show hidden files)

**In File Explorer:**
1. Go to `apps/api/` or `apps/web/`
2. Enable "Show hidden files" in View options
3. You'll see the `.env` files

**Or use PowerShell:**
```powershell
Get-Content apps\api\.env
Get-Content apps\web\.env.local
```

## Important:

The apps **must** read the `.env` files from their respective directories:
- API reads from `apps/api/.env`
- Frontend reads from `apps/web/.env.local`

The copies in the root (`env.api.txt`, `env.web.txt`) are just for visibility - they won't be used by the applications.

