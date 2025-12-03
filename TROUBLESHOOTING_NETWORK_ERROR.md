# Troubleshooting Network Error When Creating Bot

## Common Causes

### 1. API Server Not Running
**Symptom**: Network error when trying to create bot

**Solution**:
- Make sure the API server is running
- Check the API window (should show "API server running on port 3001")
- Try accessing http://localhost:3001/health in your browser
- If not running, start it: `cd apps/api && pnpm dev`

### 2. CORS Issues
**Symptom**: Network error in browser console

**Solution**:
- The API has CORS enabled, but if you're using a different port, check the CORS settings
- Make sure `NEXT_PUBLIC_API_URL` in `apps/web/.env.local` matches your API URL

### 3. Database Connection Issues
**Symptom**: Error in API logs about database

**Solution**:
- Make sure Docker is running: `docker ps`
- Check if PostgreSQL is running: `docker logs botmarket-postgres`
- Restart Docker: `docker compose restart`

### 4. Validation Errors
**Symptom**: Error message about invalid configuration

**Solution**:
- Check that all required fields are filled
- Make sure currency and timeframe are selected
- Check browser console for detailed error messages

## Quick Fixes

### Check API is Running
```bash
# In browser, open:
http://localhost:3001/health

# Should return:
{"status":"healthy",...}
```

### Check Frontend Can Reach API
```bash
# In browser console (F12), run:
fetch('http://localhost:3001/health')
  .then(r => r.json())
  .then(console.log)
```

### Restart Services
1. Stop all services (Ctrl+C in terminal windows)
2. Restart Docker: `docker compose restart`
3. Start API: `cd apps/api && pnpm dev`
4. Start Frontend: `cd apps/web && pnpm dev`

## Debug Steps

1. **Check API Logs**: Look at the API terminal window for error messages
2. **Check Browser Console**: Open DevTools (F12) and check for errors
3. **Check Network Tab**: See the actual HTTP request/response
4. **Test API Directly**: Try creating a bot via curl:
   ```bash
   curl -X POST http://localhost:3001/bots \
     -H "Content-Type: application/json" \
     -d '{"config":{...},"visibility":"PUBLIC"}'
   ```

## If Still Not Working

1. Check that all environment variables are set correctly
2. Make sure ports 3000 and 3001 are not in use by other applications
3. Try restarting your computer (sometimes helps with port issues)
4. Check Windows Firewall isn't blocking the connection

