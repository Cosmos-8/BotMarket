# GitHub Repository Setup Guide

## Option 1: Using GitHub CLI (Easiest)

If you have GitHub CLI installed:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: BotMarket MVP"

# Create private repo and push
gh repo create botmarket --private --source=. --remote=origin --push
```

## Option 2: Using GitHub Web Interface

### Step 1: Create Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `botmarket` (or your preferred name)
3. Description: "No-Code Polymarket Bot Builder + Marketplace"
4. Select **Private**
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### Step 2: Push Your Code

After creating the repo, GitHub will show you commands. Run these in your project directory:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: BotMarket MVP"

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/botmarket.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Option 3: Manual Setup

If you prefer to set it up manually:

```bash
# 1. Initialize git
git init

# 2. Add remote (after creating repo on GitHub)
git remote add origin https://github.com/YOUR_USERNAME/botmarket.git

# 3. Stage all files
git add .

# 4. Create initial commit
git commit -m "Initial commit: BotMarket MVP"

# 5. Push to main branch
git branch -M main
git push -u origin main
```

## Important Notes

### Files That Won't Be Pushed (Already in .gitignore)
- `.env` files (contain secrets)
- `node_modules/` (dependencies)
- `dist/` (build outputs)
- `.next/` (Next.js build)
- Database files
- IDE files

### Files That Will Be Pushed
- All source code
- Configuration files
- Documentation
- Docker compose files
- Package files

## After Pushing

1. **Add a README badge** (optional):
   ```markdown
   ![Status](https://img.shields.io/badge/status-MVP-green)
   ```

2. **Add topics/tags** on GitHub:
   - `polymarket`
   - `trading-bots`
   - `web3`
   - `hackathon`
   - `typescript`
   - `nextjs`

3. **Set repository description**:
   "No-Code Polymarket Bot Builder + Marketplace - MBC 2025 Hackathon"

## Troubleshooting

### Authentication Issues
If you get authentication errors:
- Use GitHub Personal Access Token instead of password
- Or use SSH keys: `git remote set-url origin git@github.com:USERNAME/botmarket.git`

### Large Files
If you have large files, consider:
- Using Git LFS for large files
- Or excluding them in .gitignore

### Already Have a Repo?
If git is already initialized:
```bash
# Just add remote and push
git remote add origin https://github.com/YOUR_USERNAME/botmarket.git
git push -u origin main
```

