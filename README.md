# Psychic Training Leaderboard

Small Vercel API for Psychic Training Series 1 leaderboards.

## API

```txt
GET  /api/leaderboard?mode=easy
POST /api/leaderboard
```

Valid modes:

```txt
easy, normal, hard, hell
```

POST body:

```json
{
  "mode": "easy",
  "userName": "Player",
  "bestLevel": 3,
  "bestScore": 330
}
```

## Vercel Setup

1. Import this repository into Vercel.
2. Add Vercel Blob storage to the project.
3. Redeploy after Blob is connected.
4. Use the deployed API URL in the mobile app.

