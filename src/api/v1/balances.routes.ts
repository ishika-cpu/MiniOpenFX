import { Hono } from 'hono';
import { fromMinorUnits } from '../../domain/money.js';
import { ledgerService } from '../../services/ledger/ledger.service.js';

export const balancesRoutes = new Hono();

balancesRoutes.get('/', async (c) => {
  const clientId = c.get('clientId') as string;
  // Delegate fetching to the ledger service
  const rows = await ledgerService.getBalances(clientId);
  return c.json(
    rows.map((b) => ({
      currency: b.currency,
      available: fromMinorUnits(BigInt(b.availableMinor), b.currency),
    })),
  );
});
