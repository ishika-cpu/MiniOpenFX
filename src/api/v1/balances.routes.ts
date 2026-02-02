import { Hono } from 'hono';
import { fromMinorUnits } from '../../domain/money.js';//imports a helper to convert integer minor->decimal strings
import { ledgerService } from '../../services/ledger/ledger.service.js';

export const balancesRoutes = new Hono();// /v1/balances

balancesRoutes.get('/', async (c) => {
  const clientId = c.get('clientId') as string;
  // Delegate fetching to the ledger service
  const rows = await ledgerService.getBalances(clientId);
  return c.json(
    rows.map((b) => ({//converts db rows to api response format
      currency: b.currency,
      available: fromMinorUnits(BigInt(b.availableMinor), b.currency),//converts minor units to decimal strings
    })),
  );
});
