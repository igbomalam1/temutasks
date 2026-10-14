export const NETWORK_PLAN_IDS: Record<string, number> = {
  MTN: 10,
  AIRTEL: 11,
  GLO: 12,
  '9MOBILE': 1651,
};

export interface AirtimePurchaseParams {
  network: 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE';
  phone: string;
  amount: number;
  reference: string;
}

export interface AirtimeResponse {
  success: boolean;
  status: 'successful' | 'pending' | 'failed';
  code: number;
  message: string;
  data?: any;
}

export async function purchaseAirtime(params: AirtimePurchaseParams): Promise<AirtimeResponse> {
  const apiKey = process.env.SMARTAPI_API_KEY;
  // Always ensure correct PIN: ignore obsolete template pin 1983 if present in env
  const rawPin = process.env.SMARTAPI_PIN?.trim();
  const pin = rawPin && rawPin !== '1983' ? rawPin : '1234';

  if (!apiKey) {
    throw new Error('SMARTAPI_API_KEY is not configured');
  }

  const planId = NETWORK_PLAN_IDS[params.network];
  if (!planId) {
    throw new Error(`Unsupported network: ${params.network}`);
  }

  // Normalize phone: strip spaces and convert 23480... to 080...
  let cleanPhone = params.phone.replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('234') && cleanPhone.length === 13) {
    cleanPhone = '0' + cleanPhone.slice(3);
  }

  const endpoint = `https://sabuss.com/vtu/api/buy/${apiKey}`;

  // Form-encoded body as required by Sabuss
  const formData = new URLSearchParams();
  formData.append('pin', pin);
  formData.append('plan_id', planId.toString());
  formData.append('amount', params.amount.toString());
  formData.append('phone', cleanPhone);
  // Sabuss strictly forbids hyphens in references
  const cleanRef = (params.reference || `AIR${Date.now()}`).replace(/[^a-zA-Z0-9]/g, '');
  formData.append('reference', cleanRef);

  try {
    console.log(`[SmartAPI] Sending airtime request: Network=${params.network}, Plan=${planId}, Amount=${params.amount}, Phone=${cleanPhone}, PIN=${pin}`);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const text = await res.text();
    console.log(`[SmartAPI] Raw response:`, text);

    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      return {
        success: false,
        status: 'failed',
        code: 500,
        message: `Invalid provider response: ${text.substring(0, 100)}`,
      };
    }

    const code = parseInt(result.code, 10);
    const providerMsg =
      result.response ||
      result.desc ||
      result.msg ||
      result.message ||
      result.error ||
      'Transaction processed';

    if (code === 200) {
      return {
        success: true,
        status: 'successful',
        code,
        message: providerMsg,
        data: result,
      };
    } else if (code === 400) {
      return {
        success: true,
        status: 'pending',
        code,
        message: providerMsg,
        data: result,
      };
    } else if (code === 800 || code === 900) {
      return {
        success: false,
        status: 'failed',
        code,
        message: providerMsg,
        data: result,
      };
    } else {
      return {
        success: false,
        status: 'failed',
        code: isNaN(code) ? 500 : code,
        message: providerMsg,
        data: result,
      };
    }
  } catch (err: any) {
    console.error(`[SmartAPI Network Error]:`, err);
    return {
      success: false,
      status: 'failed',
      code: 500,
      message: err.message || 'Network error connecting to SmartAPI/Sabuss',
    };
  }
}
