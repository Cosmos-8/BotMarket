# BotMarket Frontend

Basic Next.js frontend for testing BotMarket API.

## Features

- ✅ Bot creation form
- ✅ Marketplace with bot listing
- ✅ Bot detail page with metrics
- ✅ Test signal sending
- ✅ Fill simulation (for demo)

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_BASE_CHAIN_ID=84532
```

3. Run development server:
```bash
pnpm dev
```

4. Open http://localhost:3000

## Pages

- `/` - Home page
- `/create` - Create new bot
- `/marketplace` - Browse public bots
- `/bots/[id]` - Bot details and testing

## API Integration

All API calls are in `src/lib/api.ts`. The frontend connects to the API server running on port 3001.

## Notes

This is a basic testing frontend. For production, you should:
- Add wallet connection (wagmi/viem)
- Add proper authentication
- Add error handling and loading states
- Add real-time updates
- Improve UI/UX

