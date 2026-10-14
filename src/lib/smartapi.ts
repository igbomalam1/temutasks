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
  const pin = process.env.SMARTAPI_PIN || '1234';

  if (!apiKey) {
    throw new Error('SMARTAPI_API_KEY is not configured');
  }

  const planId = NETWORK_PLAN_IDS[params.network];
  if (!planId) {
    throw new Error(`Unsupported network: ${params.network}`);
  }

  const endpoint = `https://sabuss.com/vtu/api/buy/${apiKey}`;

  // Form-encoded body as required by Sabuss
  const formData = new URLSearchParams();
  formData.append('pin', pin);
  formData.append('plan_id', planId.toString());
  formData.append('amount', params.amount.toString());
  formData.append('phone', params.phone);
  formData.append('reference', params.reference);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const text = await res.text();
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

    if (code === 200) {
      return {
        success: true,
        status: 'successful',
        code,
        message: result.msg || 'Transaction Successful',
        data: result,
      };
    } else if (code === 400) {
      return {
        success: true,
        status: 'pending',
        code,
        message: result.msg || 'Transaction is processing',
        data: result,
      };
    } else if (code === 800 || code === 900) {
      return {
        success: false,
        status: 'failed',
        code,
        message: result.msg || 'Transaction failed or reversed by provider',
        data: result,
      };
    } else {
      return {
        success: false,
        status: 'failed',
        code,
        message: result.msg || 'Airtime provider returned an error',
        data: result,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      status: 'failed',
      code: 500,
      message: err.message || 'Network error connecting to SmartAPI/Sabuss',
    };
  }
}
