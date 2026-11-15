/** Paystack désactivé — abonnement = Wave + WhatsApp uniquement */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(410).json({
    error: 'Paystack désactivé',
    message: 'Paiement abonnement uniquement par Wave puis confirmation WhatsApp.',
  });
}
