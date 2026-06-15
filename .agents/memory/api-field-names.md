---
name: API Field Name Contracts
description: Schema mismatches found and fixed between Zod schemas and API routes/frontend pages.
---

## Rule: Zod schemas in lib/api-zod/src/generated/api.ts are the source of truth.

## Fixed Mismatches
- CompleteTaskResponse: API was returning `{reward, newBalance}` → correct is `{success, coinsEarned, totalCoins, message}`
- GetWalletResponse: API was returning `{balance, totalEarned}` → correct is `{coins, totalEarnings, pendingWithdrawals, approvedWithdrawals, rejectedWithdrawals, withdrawableBalance}`
- GetReferralInfoResponse: API was using `{referralCount, totalReferralEarnings}` → correct is `{totalReferrals, totalEarnedFromReferrals}`; also must include `coinsEarned` per referral object.

## URL Mismatches Fixed
- tasks.tsx: `/tasks/complete` → `/tasks/:taskId/complete`
- referrals.tsx: `/referrals?telegramId=X` → `/referrals/:telegramId`
- wallet.tsx: `/wallet/withdrawals?telegramId=X` → `/wallet/:telegramId/withdrawals`

**Why:** Previous agent built frontend and backend separately without cross-checking endpoint URLs and Zod field names.
